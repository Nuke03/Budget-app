import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FieldHint } from '@/app/FieldHint';

describe('FieldHint', () => {
  it('non mostra la spiegazione finché non si clicca sull\'icona', () => {
    render(<FieldHint testo="Spiegazione del campo" />);
    expect(screen.queryByText('Spiegazione del campo')).not.toBeInTheDocument();
  });

  it('mostra la spiegazione al click e la nasconde ricliccando', () => {
    render(<FieldHint testo="Spiegazione del campo" />);
    const icona = screen.getByLabelText('Maggiori informazioni');

    fireEvent.click(icona);
    expect(screen.getByText('Spiegazione del campo')).toBeInTheDocument();

    fireEvent.click(icona);
    expect(screen.queryByText('Spiegazione del campo')).not.toBeInTheDocument();
  });
});
