import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StoricoCasa } from '@/app/history/StoricoCasa';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

describe('StoricoCasa', () => {
  it('mostra le righe neutre e nessuna parola vietata', () => {
    const { container } = render(
      <StoricoCasa
        righe={[
          { id: 'a', data: '2026-11-03', etichetta: 'Versamento alla casa, novembre', importo: 776, verso: 'esce' },
          { id: 'b', data: '2026-11-02', etichetta: 'Rimborso dalla casa', importo: 45, verso: 'entra' },
        ]}
      />
    );
    expect(screen.getByText('Movimenti con la casa')).toBeInTheDocument();
    expect(screen.getByText('Versamento alla casa, novembre')).toBeInTheDocument();
    expect(screen.getByText('Rimborso dalla casa')).toBeInTheDocument();
    assertNessunaParolaVietata(container);
  });

  it('la riga neutra dei risparmi tasse non ha segno e la nota sta sotto il titolo', () => {
    render(
      <StoricoCasa
        titolo="Tasse messe da parte"
        id="tasse-messe-da-parte"
        nota="Sono sempre soldi tuoi: cambiano solo conto."
        righe={[{ id: 'pa-1', data: '2026-05-11', etichetta: 'Spostato sul conto tasse', importo: 548, verso: 'neutro' }]}
      />
    );
    expect(screen.getByText('Sono sempre soldi tuoi: cambiano solo conto.')).toBeInTheDocument();
    const importo = screen.getByText(/548,00/);
    expect(importo.textContent).not.toMatch(/[−+-]/);
  });

  it('le righe di casa mantengono il segno', () => {
    render(
      <StoricoCasa
        righe={[
          { id: 'a', data: '2026-11-03', etichetta: 'Versamento', importo: 776, verso: 'esce' },
          { id: 'b', data: '2026-11-02', etichetta: 'Rimborso', importo: 45, verso: 'entra' },
        ]}
      />
    );
    expect(screen.getByText(/776,00/).textContent).toMatch(/^−/);
    expect(screen.getByText(/45,00/).textContent).toMatch(/^\+/);
    expect(screen.queryByText(/sempre soldi tuoi/)).not.toBeInTheDocument();
  });

  it('senza righe non mostra la sezione', () => {
    render(<StoricoCasa righe={[]} />);
    expect(screen.queryByText('Movimenti con la casa')).not.toBeInTheDocument();
  });
});
