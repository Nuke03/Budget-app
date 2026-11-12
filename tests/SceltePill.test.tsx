import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { SceltePill } from '@/app/casa/SceltePill';

function Prova({ onChange = () => {} }: { onChange?: (c: string) => void }) {
  const [v, setV] = useState<string | null>('a');
  return (
    <SceltePill
      legenda="Scelta"
      valore={v}
      onChange={(c) => {
        setV(c);
        onChange(c);
      }}
      opzioni={[
        { chiave: 'a', etichetta: 'Uno' },
        { chiave: 'b', etichetta: 'Due' },
        { chiave: 'c', etichetta: 'Tre' },
      ]}
    />
  );
}

describe('SceltePill', () => {
  it('è un gruppo di radio con una sola opzione raggiungibile col Tab', () => {
    render(<Prova />);
    expect(screen.getByRole('radiogroup', { name: 'Scelta' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Uno' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Uno' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: 'Due' })).toHaveAttribute('tabindex', '-1');
  });

  it('le frecce spostano la scelta e il fuoco, e girano ai bordi', () => {
    const onChange = vi.fn();
    render(<Prova onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Uno' }), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('b');
    expect(screen.getByRole('radio', { name: 'Due' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Due' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Due' }), { key: 'ArrowLeft' });
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Uno' }), { key: 'ArrowUp' });
    expect(screen.getByRole('radio', { name: 'Tre' })).toBeChecked();
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Tre' }), { key: 'ArrowDown' });
    expect(screen.getByRole('radio', { name: 'Uno' })).toBeChecked();
  });
});
