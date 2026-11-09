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

  it('senza righe non mostra la sezione', () => {
    render(<StoricoCasa righe={[]} />);
    expect(screen.queryByText('Movimenti con la casa')).not.toBeInTheDocument();
  });
});
