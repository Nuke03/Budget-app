import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CreateGoalForm } from '@/app/goals/CreateGoalForm';

describe('CreateGoalForm', () => {
  it('richiede una scadenza quando la modalità è dilazionato', () => {
    const onSubmit = vi.fn();
    render(<CreateGoalForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Regalo anniversario' } });
    fireEvent.change(screen.getByLabelText('Importo target'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Modalità'), { target: { value: 'dilazionato' } });

    expect(screen.getByText('Crea obiettivo')).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Scadenza'), { target: { value: '2026-11-27' } });

    expect(screen.getByText('Crea obiettivo')).toBeEnabled();
  });

  it('non richiede scadenza quando la modalità è bloccato', () => {
    const onSubmit = vi.fn();
    render(<CreateGoalForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Telepass' } });
    fireEvent.change(screen.getByLabelText('Importo target'), { target: { value: '130' } });

    expect(screen.getByText('Crea obiettivo')).toBeEnabled();
  });
});
