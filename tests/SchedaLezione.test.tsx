import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { lezione } from '@/lib/percorso/lezioni';
import { assertNessunaParolaVietata } from './helpers/paroleVietate';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
const apriLezione = vi.fn(async () => {});
const rimandaLezione = vi.fn(async () => {});
const lezioneFatta = vi.fn(async () => {});
vi.mock('@/app/impara/actions', () => ({
  apriLezione: (...a: unknown[]) => apriLezione(...(a as [])),
  rimandaLezione: (...a: unknown[]) => rimandaLezione(...(a as [])),
  lezioneFatta: (...a: unknown[]) => lezioneFatta(...(a as [])),
}));

import { SchedaLezione } from '@/app/impara/SchedaLezione';

beforeEach(() => {
  push.mockClear();
  apriLezione.mockClear();
  rimandaLezione.mockClear();
  lezioneFatta.mockClear();
});

describe('SchedaLezione', () => {
  it('la lezione senza numeri mostra Per esempio', () => {
    const l = lezione('dove-vanno');
    const { container } = render(<SchedaLezione lezione={l} numeri={null} />);
    expect(screen.getByText('Per esempio')).toBeInTheDocument();
    expect(screen.queryByText('Con i tuoi numeri')).not.toBeInTheDocument();
    expect(screen.getByText(l.esempio)).toBeInTheDocument();
    expect(screen.getByText('In breve')).toBeInTheDocument();
    assertNessunaParolaVietata(container);
  });

  it('con i numeri mostra Con i tuoi numeri e non l esempio', () => {
    const l = lezione('piano');
    render(<SchedaLezione lezione={l} numeri="Adesso il tuo libero è 100 €." />);
    expect(screen.getByText('Con i tuoi numeri')).toBeInTheDocument();
    expect(screen.getByText('Adesso il tuo libero è 100 €.')).toBeInTheDocument();
    expect(screen.queryByText(l.esempio)).not.toBeInTheDocument();
  });

  it('all apertura segna la lezione come vista', () => {
    render(<SchedaLezione lezione={lezione('piano')} numeri={null} />);
    expect(apriLezione).toHaveBeenCalledWith('piano');
  });

  it('Più tardi chiama rimandaLezione', async () => {
    render(<SchedaLezione lezione={lezione('piano')} numeri={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Più tardi' }));
    await waitFor(() => expect(rimandaLezione).toHaveBeenCalledWith('piano'));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/impara'));
  });

  it('Più tardi che fallisce non blocca: si torna all elenco lo stesso', async () => {
    rimandaLezione.mockRejectedValueOnce(new Error('rete'));
    render(<SchedaLezione lezione={lezione('piano')} numeri={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Più tardi' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/impara'));
  });

  it('Prova chiama lezioneFatta prima di navigare', async () => {
    const l = lezione('piano');
    render(<SchedaLezione lezione={l} numeri={null} />);
    fireEvent.click(screen.getByRole('button', { name: l.prova!.etichetta }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(l.prova!.href));
    expect(lezioneFatta).toHaveBeenCalledWith('piano');
    expect(lezioneFatta.mock.invocationCallOrder[0]).toBeLessThan(push.mock.invocationCallOrder[0]);
  });

  it('i link stanno sotto Per saperne di più', () => {
    const l = lezione('piano');
    render(<SchedaLezione lezione={l} numeri={null} />);
    expect(screen.getByText('Per saperne di più')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: l.link[0].etichetta })).toHaveAttribute('href', l.link[0].url);
  });
});
