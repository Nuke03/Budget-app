import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn(() => ({})) }));
vi.mock('@/lib/utenteOLogin', () => ({ leggiSessione: vi.fn(async () => ({ userId: 'u1', token: 't' })) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }), usePathname: () => '/x' }));
import { render, screen, renderHook, waitFor, act } from '@testing-library/react';
import { qualcosaAperto, useQualcosaAperto, useUtenteId } from '@/lib/fumetti/ambiente';
import { AvvisoAnnulla } from '@/app/AvvisoAnnulla';
import { createClient } from '@/lib/supabase/client';
import { leggiSessione } from '@/lib/utenteOLogin';

describe('qualcosaAperto', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('è falso su un body vuoto', () => {
    expect(qualcosaAperto()).toBe(false);
  });

  it('è vero con un dialog modale', () => {
    document.body.innerHTML = '<div role="dialog" aria-modal="true"></div>';
    expect(qualcosaAperto()).toBe(true);
  });

  it('è falso se il dialog modale è un fumetto (data-fumetto-giro)', () => {
    document.body.innerHTML = '<div role="dialog" aria-modal="true" data-fumetto-giro></div>';
    expect(qualcosaAperto()).toBe(false);
  });

  it('è vero con l attesa del foglio dopo il salvataggio (body[data-dopo-in-attesa])', () => {
    document.body.setAttribute('data-dopo-in-attesa', '');
    expect(qualcosaAperto()).toBe(true);
    document.body.removeAttribute('data-dopo-in-attesa');
    expect(qualcosaAperto()).toBe(false);
  });

  it('è vero con l avviso di annullamento visibile', () => {
    document.body.innerHTML = '<div data-avviso-annulla></div>';
    expect(qualcosaAperto()).toBe(true);
  });
});

describe('useUtenteId', () => {
  beforeEach(() => {
    vi.mocked(leggiSessione).mockResolvedValue({ userId: 'u1', token: 't' });
  });

  it('restituisce l utente della sessione', async () => {
    const { result } = renderHook(() => useUtenteId());
    await waitFor(() => expect(result.current).toBe('u1'));
  });

  it('restituisce null se createClient lancia, senza rompere', async () => {
    vi.mocked(createClient).mockImplementationOnce(() => {
      throw new Error('env mancanti');
    });
    const { result } = renderHook(() => useUtenteId());
    await act(async () => {});
    expect(result.current).toBeNull();
  });

  it('restituisce null se leggiSessione rifiuta', async () => {
    vi.mocked(leggiSessione).mockRejectedValueOnce(new Error('rete'));
    const { result } = renderHook(() => useUtenteId());
    await act(async () => {});
    expect(result.current).toBeNull();
  });
});

describe('useQualcosaAperto', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('con un dialog già nel body parte già da true al primo render', () => {
    document.body.innerHTML = '<div role="dialog" aria-modal="true"></div>';
    let primo: boolean | null = null;
    renderHook(() => {
      const v = useQualcosaAperto();
      if (primo === null) primo = v;
      return v;
    });
    expect(primo).toBe(true);
  });

  it('passa da false a true quando compare un dialog', async () => {
    const { result } = renderHook(() => useQualcosaAperto());
    expect(result.current).toBe(false);
    act(() => {
      const dialog = document.createElement('div');
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      document.body.appendChild(dialog);
    });
    await waitFor(() => expect(result.current).toBe(true));
  });
});

describe('AvvisoAnnulla', () => {
  it('con un testo mette [data-avviso-annulla] nel blocco visibile', () => {
    const { container } = render(
      <AvvisoAnnulla testo="Spesa eliminata." onAnnulla={() => {}} onChiudi={() => {}} />,
    );
    expect(container.querySelector('[data-avviso-annulla]')).not.toBeNull();
    expect(screen.getByText('Spesa eliminata.')).toBeInTheDocument();
  });

  it('senza testo non c è il blocco con l attributo', () => {
    const { container } = render(<AvvisoAnnulla testo={null} onAnnulla={null} onChiudi={() => {}} />);
    expect(container.querySelector('[data-avviso-annulla]')).toBeNull();
  });
});

describe('useQualcosaAperto: osservatore', () => {
  it('guarda solo gli attributi che contano', () => {
    const orig = MutationObserver.prototype.observe;
    const opzioni: MutationObserverInit[] = [];
    MutationObserver.prototype.observe = function (t: Node, o?: MutationObserverInit) {
      opzioni.push(o ?? {});
      return orig.call(this, t, o);
    };
    try {
      renderHook(() => useQualcosaAperto());
    } finally {
      MutationObserver.prototype.observe = orig;
    }
    expect(opzioni[0].attributeFilter).toEqual(['aria-modal', 'data-avviso-annulla', 'data-dopo-in-attesa']);
    expect(opzioni[0].childList).toBe(true);
    expect(opzioni[0].subtree).toBe(true);
  });
});
