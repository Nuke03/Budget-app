import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FoglioInferiore } from '@/app/FoglioInferiore';

function Prova({ onClose = () => {} }: { onClose?: () => void }) {
  const [aperto, setAperto] = useState(false);
  return (
    <>
      <button onClick={() => setAperto(true)}>Apri</button>
      {aperto ? (
        <FoglioInferiore titolo="Prova" onClose={() => { onClose(); setAperto(false); }}>
          <button>Uno</button>
          <button>Due</button>
        </FoglioInferiore>
      ) : null}
    </>
  );
}

describe('FoglioInferiore', () => {
  it('è piatto: niente ombra né sfocatura, bordo sopra', () => {
    render(<Prova />);
    fireEvent.click(screen.getByText('Apri'));
    const html = document.body.innerHTML;
    expect(html).not.toMatch(/shadow-2xl|backdrop-blur/);
    expect(screen.getByRole('dialog').className).toContain('border-t');
  });
  it('porta il focus sul primo controllo del contenuto', () => {
    render(<Prova />);
    fireEvent.click(screen.getByText('Apri'));
    expect(screen.getByText('Uno')).toHaveFocus();
  });
  it('Tab resta dentro il foglio', () => {
    render(<Prova />);
    fireEvent.click(screen.getByText('Apri'));
    screen.getByText('Due').focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    expect(screen.getByText('Due')).not.toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(screen.getByText('Due')).toHaveFocus();
  });
  it('Escape chiude e il focus torna a chi ha aperto', () => {
    const onClose = vi.fn();
    render(<Prova onClose={onClose} />);
    const apri = screen.getByText('Apri');
    apri.focus();
    fireEvent.click(apri);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(apri).toHaveFocus();
  });
});
