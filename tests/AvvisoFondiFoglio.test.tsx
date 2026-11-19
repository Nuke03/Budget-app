import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

const rispondiAvviso = vi.fn(async (..._a: unknown[]): Promise<{ coperto: number; resto: number } | undefined> => undefined);
const rimandaLezione = vi.fn(async (..._a: unknown[]): Promise<void> => {});
vi.mock('@/app/impara/actions', () => ({ rimandaLezione: (...a: unknown[]) => rimandaLezione(...a) }));
vi.mock('@/app/impara/dopoSalvataggio', () => ({
  rispondiAvviso: (...a: unknown[]) => rispondiAvviso(...(a as [])),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

import { AvvisoFondiFoglio } from '@/app/add/AvvisoFondiFoglio';
import { LezioneFoglio } from '@/app/add/LezioneFoglio';
import type { AvvisoFondi } from '@/lib/calculations/percorso/avviso';

const ID = 't1';
const conFondo: AvvisoFondi = { buco: 50, toccati: ['obiettivi'], fondoImprevisti: { goalId: 'g1', accantonato: 80 } };

function apri(avviso: AvvisoFondi, lezione: 'imprevisti' | 'prima-da-parte' = 'prima-da-parte', onChiudi = vi.fn()) {
  const r = render(<AvvisoFondiFoglio avviso={avviso} transactionId={ID} lezione={lezione} onChiudi={onChiudi} />);
  return { ...r, onChiudi };
}

beforeEach(() => {
  rispondiAvviso.mockClear();
  rispondiAvviso.mockResolvedValue(undefined);
});

describe('AvvisoFondiFoglio', () => {
  it('con fondo mostra le due scelte e Sì collega la spesa al fondo', async () => {
    apri(conFondo);
    expect(screen.getByText('Questa spesa usa 50 € che avevi messo da parte.')).toBeInTheDocument();
    expect(screen.getByText('È un imprevisto vero?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No, è una spesa normale' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sì, prendili dal fondo imprevisti' }));
    await waitFor(() => expect(rispondiAvviso).toHaveBeenCalledWith(ID, 'imprevisto', 'g1'));
    expect(await screen.findByText('Il fondo ha fatto il suo lavoro.')).toBeInTheDocument();
  });

  it('Sì con spesa più grande del fondo: dice quanto ha coperto il fondo e quanto la prossima entrata', async () => {
    rispondiAvviso.mockResolvedValueOnce({ coperto: 80, resto: 220 });
    apri(conFondo);
    fireEvent.click(screen.getByRole('button', { name: 'Sì, prendili dal fondo imprevisti' }));
    expect(
      await screen.findByText('Il fondo ha coperto 80 €. Gli altri 220 € li copre la prossima entrata.')
    ).toBeInTheDocument();
    expect(screen.queryByText('Il fondo ha fatto il suo lavoro.')).not.toBeInTheDocument();
    assertNessunaParolaVietata(document.body);
  });

  it('Sì con spesa coperta per intero: il fondo ha fatto il suo lavoro', async () => {
    rispondiAvviso.mockResolvedValueOnce({ coperto: 30, resto: 0 });
    apri(conFondo);
    fireEvent.click(screen.getByRole('button', { name: 'Sì, prendili dal fondo imprevisti' }));
    expect(await screen.findByText('Il fondo ha fatto il suo lavoro.')).toBeInTheDocument();
  });

  it('No: risponde normale e dice che la prossima entrata copre prima il buco', async () => {
    apri(conFondo);
    fireEvent.click(screen.getByRole('button', { name: 'No, è una spesa normale' }));
    await waitFor(() => expect(rispondiAvviso).toHaveBeenCalledWith(ID, 'normale', undefined));
    expect(await screen.findByText('Va bene. La prossima entrata copre prima questi 50 €.')).toBeInTheDocument();
  });

  it('con solo tasse toccate niente Sì e la frase dice le tasse', () => {
    apri({ buco: 30, toccati: ['tasse'], fondoImprevisti: null });
    expect(screen.getByText('Questa spesa usa 30 € che servono per le tasse.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sì/ })).not.toBeInTheDocument();
    expect(screen.getByText('La prossima entrata copre prima questi 30 €.')).toBeInTheDocument();
    expect(screen.getByText('Chiudi')).toBeInTheDocument();
  });

  it('casa e debiti: frasi dedicate', () => {
    const a = apri({ buco: 10, toccati: ['casa'], fondoImprevisti: null });
    expect(screen.getByText('Questa spesa usa 10 € che servono per la quota della casa.')).toBeInTheDocument();
    a.unmount();
    apri({ buco: 10, toccati: ['debiti'], fondoImprevisti: null });
    expect(
      screen.getByText('Questa spesa usa 10 € che servono per restituire quello che devi in casa.')
    ).toBeInTheDocument();
  });

  it('senza fondo: informazione e prossima entrata, nessuna domanda', () => {
    apri({ buco: 50, toccati: ['obiettivi'], fondoImprevisti: null }, 'imprevisti');
    expect(screen.queryByText('È un imprevisto vero?')).not.toBeInTheDocument();
    expect(screen.getByText('La prossima entrata copre prima questi 50 €.')).toBeInTheDocument();
  });

  it('errore nel rispondere: resta sulla domanda e lo dice', async () => {
    rispondiAvviso.mockRejectedValueOnce(new Error('x'));
    apri(conFondo);
    fireEvent.click(screen.getByRole('button', { name: 'Sì, prendili dal fondo imprevisti' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('È un imprevisto vero?')).toBeInTheDocument();
    expect(screen.queryByText('Il fondo ha fatto il suo lavoro.')).not.toBeInTheDocument();
  });

  it('il link alla lezione apre il foglio lezione, Più tardi chiude', () => {
    const { onChiudi } = apri({ buco: 50, toccati: ['obiettivi'], fondoImprevisti: null }, 'imprevisti');
    fireEvent.click(screen.getByRole('button', { name: 'Il cuscinetto per gli imprevisti' }));
    expect(screen.getByText('In breve')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Apri la lezione' })).toHaveAttribute('href', '/impara/imprevisti');
    fireEvent.click(screen.getByRole('button', { name: 'Più tardi' }));
    expect(onChiudi).toHaveBeenCalled();
  });

  it('nessuna parola vietata in tutte le varianti', async () => {
    const varianti: AvvisoFondi[] = [
      conFondo,
      { buco: 5, toccati: ['obiettivi'], fondoImprevisti: null },
      { buco: 5, toccati: ['casa'], fondoImprevisti: null },
      { buco: 5, toccati: ['debiti'], fondoImprevisti: null },
      { buco: 5, toccati: ['tasse'], fondoImprevisti: null },
    ];
    for (const v of varianti) {
      const { container, unmount } = apri(v);
      assertNessunaParolaVietata(document.body);
      expect(container).toBeTruthy();
      if (v.fondoImprevisti) {
        fireEvent.click(screen.getByRole('button', { name: 'No, è una spesa normale' }));
        await screen.findByText(/Va bene/);
        assertNessunaParolaVietata(document.body);
      }
      unmount();
    }
    const l = render(<LezioneFoglio lezioneId="imprevisti" onChiudi={() => {}} />);
    assertNessunaParolaVietata(document.body);
    l.unmount();
  });
});
