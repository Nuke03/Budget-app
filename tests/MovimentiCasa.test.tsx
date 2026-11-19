import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MovimentiCasa } from '@/app/casa/movimenti/MovimentiCasa';
import { AnnullaProvider } from '@/app/AnnullaProvider';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';
import type { CasaCorrente } from '@/lib/data/households';
import type { CasaAggiunta } from '@/lib/loadCasaData';
import type { Transaction, Transfer } from '@/lib/types';

const refresh = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
  usePathname: () => '/x',
}));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('@/lib/data/transactions', () => ({
  eliminaMovimento: vi.fn().mockResolvedValue(undefined),
  modificaMovimento: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/data/transfers', () => ({ deleteTransfer: vi.fn().mockResolvedValue(undefined) }));

import { eliminaMovimento, modificaMovimento } from '@/lib/data/transactions';
import { deleteTransfer } from '@/lib/data/transfers';

const fabio = { householdId: 'h1', userId: 'u1', displayName: 'Fabio', joinedAt: '2026-01-01', slot: 1, attivo: true };
const anna = { householdId: 'h1', userId: 'u2', displayName: 'Anna', joinedAt: '2026-01-02', slot: 2, attivo: true };
const casa: CasaCorrente = {
  household: { id: 'h1', nome: 'Casa Rossi', createdAt: '2026-01-01', archiviataIl: null, createdBy: 'u1' },
  members: [fabio, anna],
  invite: null,
  me: fabio,
};
const aggiunta: CasaAggiunta = {
  householdId: 'h1',
  meUserId: 'u1',
  nomi: [
    { userId: 'u1', nome: 'Fabio' },
    { userId: 'u2', nome: 'Anna' },
  ],
  conti: [{ id: 'ac', nome: 'Conto comune', saldoAttuale: 500, contaInDisponibile: true, targetSaldo: null, archiviato: false }],
  categorie: [{ id: 'cc', nome: 'Bollette', tipo: 'expense', colore: null, archiviata: false, ruolo: null }],
  obiettivi: [],
};

function tx(over: Partial<Transaction>): Transaction {
  return {
    id: 't', tipo: 'expense', importo: 10, data: '2026-11-05', categoriaId: 'cc', accountId: 'ac',
    goalId: null, descrizione: 'Voce', nota: null, createdAt: '', stima: false, userId: 'u1', ...over,
  };
}

const lista = [
  tx({ id: 'luce', descrizione: 'Luce', importo: 64.2, data: '2026-11-05' }),
  tx({ id: 'gas', descrizione: 'Gas ottobre', importo: 30, data: '2026-10-20' }),
  tx({ id: 'altrui', descrizione: 'Spesa di Anna', importo: 12, data: '2026-11-03', pagataDaUserId: 'u2' }),
];

function trasf(over: Partial<Transfer>): Transfer {
  return {
    id: 'v1', householdId: 'h1', userId: 'u1', daAccountId: null, aAccountId: 'ac', importo: 250,
    data: '2026-11-04', causale: 'versamento', beneficiarioUserId: null, perContoDiUserId: null,
    meseCompetenza: '2026-11-01', soloRegistrazione: false, nota: null, createdAt: '', ...over,
  };
}

const cartaFabio = { id: 'ap', nome: 'Carta Fabio', saldoAttuale: 200, contaInDisponibile: true, targetSaldo: null, archiviato: false };

function apri(
  trasferimenti: Transfer[] = [],
  transazioni: Transaction[] = lista,
  extra: { meUserId?: string; contiPersonali?: (typeof cartaFabio)[] } = {}
) {
  return render(
    <AnnullaProvider>
      <MovimentiCasa
        casa={casa}
        aggiunta={aggiunta}
        transazioni={transazioni}
        trasferimenti={trasferimenti}
        meUserId={extra.meUserId ?? 'u1'}
        contiPersonali={extra.contiPersonali}
      />
    </AnnullaProvider>
  );
}

// L'eliminazione parte dopo 5 secondi: qui il tempo si controlla a mano (act di React e timer finti
// non vanno d'accordo, quindi si lasciano solo finire le promesse).
function timerFinti() {
  vi.useRealTimers();
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(new Date('2026-11-09T10:00:00Z'));
}
async function passa(ms: number) {
  await vi.advanceTimersByTimeAsync(ms);
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-09T10:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('MovimentiCasa', () => {
  it('filtra per mese', () => {
    apri();
    expect(screen.getByText('Luce')).toBeInTheDocument();
    expect(screen.queryByText('Gas ottobre')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Mese'), { target: { value: '2026-10' } });
    expect(screen.getByText('Gas ottobre')).toBeInTheDocument();
    expect(screen.queryByText('Luce')).not.toBeInTheDocument();
  });

  it('mostra importo con segno, categoria e chi ha pagato', () => {
    apri();
    expect(screen.getByText('−64,20 €')).toBeInTheDocument();
    expect(screen.getAllByText(/Bollette/).length).toBeGreaterThan(0);
    expect(screen.getByText('Anna')).toBeInTheDocument();
  });

  it('Elimina nasconde la riga e non scrive ancora', () => {
    timerFinti();
    apri();
    const riga = screen.getByText('Luce').closest('li') as HTMLElement;
    fireEvent.click(riga.querySelector('button:last-of-type') as HTMLElement);
    expect(screen.queryByText('Luce')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Spesa eliminata.');
    expect(eliminaMovimento).not.toHaveBeenCalled();
  });

  it('dopo 5 secondi chiama una sola rpc elimina_movimento (riga e saldo insieme)', async () => {
    timerFinti();
    apri();
    const riga = screen.getByText('Luce').closest('li') as HTMLElement;
    fireEvent.click(riga.querySelector('button:last-of-type') as HTMLElement);
    await passa(5000);
    expect(eliminaMovimento).toHaveBeenCalledTimes(1);
    expect(eliminaMovimento).toHaveBeenCalledWith(expect.anything(), 'luce');
    expect(refresh).toHaveBeenCalled();
  });

  it('Annulla non scrive mai e la riga torna al suo posto', async () => {
    timerFinti();
    apri();
    fireEvent.click(screen.getAllByText('Elimina')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(screen.getByText('Luce')).toBeInTheDocument();
    await passa(10000);
    expect(eliminaMovimento).not.toHaveBeenCalled();
    expect(window.localStorage.length).toBe(0);
  });

  it('modificare chiama una sola rpc modifica_movimento con tutti i campi', async () => {
    apri();
    fireEvent.click(screen.getAllByText('Modifica')[0]);
    fireEvent.change(screen.getByLabelText('Importo'), { target: { value: '70' } });
    fireEvent.click(screen.getByText('Salva modifiche'));
    await waitFor(() => expect(modificaMovimento).toHaveBeenCalledTimes(1));
    expect(modificaMovimento).toHaveBeenCalledWith(expect.anything(), 'luce', {
      tipo: 'expense',
      importo: 70,
      data: '2026-11-05',
      categoriaId: 'cc',
      accountId: 'ac',
      goalId: null,
      descrizione: 'Luce',
      nota: null,
    });
    expect(screen.getByText('−70,00 €')).toBeInTheDocument();
  });

  it('non mostra Elimina né Modifica per una spesa pagata da un altro', () => {
    apri();
    const riga = screen.getByText('Spesa di Anna').closest('li') as HTMLElement;
    expect(riga.querySelector('button')).toBeNull();
    expect(screen.getAllByText('Elimina')).toHaveLength(1);
  });

  it('se la scrittura fallisce mostra l avviso di errore e rimette la riga', async () => {
    timerFinti();
    vi.mocked(eliminaMovimento).mockRejectedValueOnce(new Error('rete'));
    apri();
    fireEvent.click(screen.getAllByText('Elimina')[0]);
    await passa(5000);
    expect(screen.getByRole('status')).toHaveTextContent('Non è andata: riprova.');
    expect(screen.getByText('Luce')).toBeInTheDocument();
    expect(window.localStorage.length).toBe(0);
  });

  it('mostra un versamento in stile neutro e senza importo nei totali', () => {
    apri([trasf({})]);
    expect(screen.getByText('Versamento di Fabio')).toBeInTheDocument();
    const riga = screen.getByText('Versamento di Fabio').closest('li') as HTMLElement;
    expect(riga.textContent).toContain('novembre');
    expect(riga.textContent).not.toMatch(/[+-]\s?250/);
    expect(riga.querySelector('.text-danger, .text-success')).toBeNull();
  });

  it('Annulla compare solo per l autore: nasconde il movimento e dopo 5 secondi chiama deleteTransfer', async () => {
    timerFinti();
    apri([trasf({}), trasf({ id: 'v2', userId: 'u2', importo: 90 })]);
    expect(screen.getAllByText('Annulla')).toHaveLength(1);
    fireEvent.click(screen.getByText('Annulla'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Elimina' }));
    expect(screen.queryByText('Versamento di Fabio')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Movimento eliminato.');
    expect(deleteTransfer).not.toHaveBeenCalled();
    await passa(5000);
    expect(deleteTransfer).toHaveBeenCalledTimes(1);
    expect(deleteTransfer).toHaveBeenCalledWith(expect.anything(), 'v1');
  });

  it('Annulla dell avviso rimette il movimento e non cancella mai', async () => {
    timerFinti();
    apri([trasf({})]);
    fireEvent.click(screen.getByText('Annulla'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Elimina' }));
    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(screen.getByText('Versamento di Fabio')).toBeInTheDocument();
    await passa(10000);
    expect(deleteTransfer).not.toHaveBeenCalled();
  });

  it('se la cancellazione del movimento fallisce compare l errore e il movimento torna', async () => {
    timerFinti();
    vi.mocked(deleteTransfer).mockRejectedValueOnce(new Error('rete'));
    apri([trasf({})]);
    fireEvent.click(screen.getByText('Annulla'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Elimina' }));
    await passa(5000);
    expect(screen.getByRole('status')).toHaveTextContent('Non è andata: riprova.');
    expect(screen.getByText('Versamento di Fabio')).toBeInTheDocument();
  });

  describe('conferma per i movimenti che spostano soldi', () => {
    it('chiede conferma con una frase chiara e Lascia stare non fa nulla', async () => {
      timerFinti();
      const { container } = apri([trasf({ importo: 640 })]);
      fireEvent.click(screen.getByText('Annulla'));
      expect(screen.getByText(/Il versamento di .*640,00.* sparisce anche dai saldi dei conti/)).toBeInTheDocument();
      assertNessunaParolaVietata(container);
      fireEvent.click(screen.getByRole('button', { name: 'Lascia stare' }));
      expect(screen.getByText('Versamento di Fabio')).toBeInTheDocument();
      await passa(10000);
      expect(deleteTransfer).not.toHaveBeenCalled();
    });

    it('con "Non avvisarmi più" la volta dopo elimina subito, ma resta annullabile', async () => {
      timerFinti();
      apri([trasf({}), trasf({ id: 'v3', importo: 30 })]);
      fireEvent.click(screen.getAllByText('Annulla')[0]);
      fireEvent.click(screen.getByLabelText('Non avvisarmi più'));
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Elimina' }));
      expect(window.localStorage.getItem('conferme:movimento_casa')).toBe('no');
      fireEvent.click(screen.getAllByText('Annulla')[0]);
      expect(screen.queryByRole('button', { name: 'Lascia stare' })).not.toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('Movimento eliminato.');
      await passa(5000);
      expect(deleteTransfer).toHaveBeenCalledTimes(2);
    });
  });

  describe('spesa pagata con una carta personale', () => {
    const carta = tx({ id: 'carta', descrizione: 'Spesa carta', importo: 40, accountId: 'ap', pagataDaUserId: 'u1' });

    it('senza il conto personale caricato non si può modificare, ma si elimina', () => {
      apri([], [carta]);
      const riga = screen.getByText('Spesa carta').closest('li') as HTMLElement;
      expect(riga.textContent).toContain('Fabio');
      expect(screen.getByText('Elimina')).toBeInTheDocument();
      expect(screen.queryByText('Modifica')).not.toBeInTheDocument();
    });

    it('chi ha pagato vede Modifica, il conto è "Io, con <conto>" e non si cambia', async () => {
      apri([], [carta], { contiPersonali: [cartaFabio] });
      fireEvent.click(screen.getByText('Modifica'));
      const conti = screen.getByText('Chi ha pagato') as HTMLElement;
      expect(within(conti).getAllByRole('button')).toHaveLength(1);
      expect(within(conti).getByRole('button', { name: 'Io, con Carta Fabio' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Conto comune' })).not.toBeInTheDocument();
      // una spesa pagata con la carta non diventa un'entrata
      expect(screen.queryByRole('button', { name: 'Entrata' })).not.toBeInTheDocument();
      fireEvent.change(screen.getByLabelText('Importo'), { target: { value: '55' } });
      fireEvent.click(screen.getByText('Salva modifiche'));
      await waitFor(() => expect(modificaMovimento).toHaveBeenCalledTimes(1));
      expect(modificaMovimento).toHaveBeenCalledWith(
        expect.anything(),
        'carta',
        expect.objectContaining({ importo: 55, accountId: 'ap', tipo: 'expense' })
      );
    });

    it('l altro membro non vede Modifica né Elimina, anche con un conto dallo stesso id', () => {
      apri([], [carta], { meUserId: 'u2', contiPersonali: [cartaFabio] });
      const riga = screen.getByText('Spesa carta').closest('li') as HTMLElement;
      expect(riga.querySelector('button')).toBeNull();
    });

    it('errore della rpc: la riga torna com era e compare il messaggio', async () => {
      vi.mocked(modificaMovimento).mockRejectedValueOnce(new Error('movimento non modificabile'));
      apri([], [carta], { contiPersonali: [cartaFabio] });
      fireEvent.click(screen.getByText('Modifica'));
      fireEvent.change(screen.getByLabelText('Importo'), { target: { value: '55' } });
      fireEvent.click(screen.getByText('Salva modifiche'));
      expect(await screen.findByText('Salvataggio fallito, controlla la connessione e riprova.')).toBeInTheDocument();
      expect(screen.getByText('−40,00 €')).toBeInTheDocument();
    });
  });

  it('se la rpc di modifica fallisce la riga torna quella vecchia e compare l errore', async () => {
    vi.mocked(modificaMovimento).mockRejectedValueOnce(new Error('rete'));
    apri();
    fireEvent.click(screen.getAllByText('Modifica')[0]);
    fireEvent.change(screen.getByLabelText('Importo'), { target: { value: '70' } });
    fireEvent.click(screen.getByText('Salva modifiche'));
    expect(await screen.findByText('Salvataggio fallito, controlla la connessione e riprova.')).toBeInTheDocument();
    expect(screen.getByText('−64,20 €')).toBeInTheDocument();
    expect(modificaMovimento).toHaveBeenCalledTimes(1);
  });

  describe('conferma prima di lasciare qualcuno senza soldi', () => {
    const cartaRimborsata = tx({ id: 'carta', descrizione: 'Spesa carta', importo: 100, accountId: 'ap', pagataDaUserId: 'u1' });
    const rimborso = trasf({ id: 'rb', causale: 'rimborso', userId: 'u2', beneficiarioUserId: 'u1', importo: 100, aAccountId: null });

    it('eliminare una spesa già rimborsata chiede conferma e spiega chi resta senza', async () => {
      timerFinti();
      apri([rimborso], [cartaRimborsata]);
      fireEvent.click(screen.getByText('Elimina'));
      expect(screen.getByText(/già stata rimborsata a Fabio/)).toBeInTheDocument();
      expect(screen.getByText(/la casa resta senza 100,00 €/)).toBeInTheDocument();
      expect(eliminaMovimento).not.toHaveBeenCalled();
      assertNessunaParolaVietata(screen.getByLabelText('Conferma'));
      fireEvent.click(screen.getByText('Procedi lo stesso'));
      expect(screen.queryByLabelText('Conferma')).not.toBeInTheDocument();
      await passa(5000);
      expect(eliminaMovimento).toHaveBeenCalledWith(expect.anything(), 'carta');
    });

    it('Lascia com è non cancella niente', () => {
      apri([rimborso], [cartaRimborsata]);
      fireEvent.click(screen.getByText('Elimina'));
      fireEvent.click(screen.getByText("Lascia com'è"));
      expect(screen.queryByLabelText('Conferma')).not.toBeInTheDocument();
      expect(screen.getByText('Spesa carta')).toBeInTheDocument();
      expect(eliminaMovimento).not.toHaveBeenCalled();
    });

    it('una spesa non rimborsata si elimina senza conferma', async () => {
      timerFinti();
      apri([], [cartaRimborsata]);
      fireEvent.click(screen.getByText('Elimina'));
      expect(screen.queryByLabelText('Conferma')).not.toBeInTheDocument();
      await passa(5000);
      expect(eliminaMovimento).toHaveBeenCalled();
    });

    it('annullare un versamento per conto di un altro già restituito chiede conferma', async () => {
      timerFinti();
      const prestito = trasf({ id: 'pc', perContoDiUserId: 'u2', importo: 200, aAccountId: null });
      const resto = trasf({ id: 'rs', causale: 'restituzione', userId: 'u2', beneficiarioUserId: 'u1', importo: 200, meseCompetenza: null, aAccountId: null });
      apri([prestito, resto], []);
      fireEvent.click(screen.getAllByText('Annulla')[0]);
      expect(screen.getByText(/Anna ha già restituito dei soldi a Fabio/)).toBeInTheDocument();
      expect(deleteTransfer).not.toHaveBeenCalled();
      fireEvent.click(screen.getByText('Procedi lo stesso'));
      await passa(5000);
      expect(deleteTransfer).toHaveBeenCalledWith(expect.anything(), 'pc');
    });
  });

  it('mese senza movimenti: una frase neutra, senza conteggi né colpe', () => {
    const { container } = apri([], []);
    expect(screen.getByText('Nessun movimento in questo mese.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    assertNessunaParolaVietata(container);
  });

  it('nessuna parola vietata', () => {
    const { container } = apri();
    assertNessunaParolaVietata(container);
  });
});

describe('MovimentiCasa: libretto', () => {
  it('copertina con il titolo e pallino del colore della categoria', () => {
    const conColore: CasaAggiunta = {
      ...aggiunta,
      categorie: [{ id: 'cc', nome: 'Bollette', tipo: 'expense', colore: '#f97362', archiviata: false, ruolo: null }],
    };
    const { container } = render(
      <AnnullaProvider>
        <MovimentiCasa casa={casa} aggiunta={conColore} transazioni={lista} trasferimenti={[]} meUserId="u1" />
      </AnnullaProvider>
    );
    expect(screen.getByRole('banner')).toHaveTextContent('Movimenti di casa');
    expect(container.querySelector('[data-colore="#f97362"]')).not.toBeNull();
  });
});
