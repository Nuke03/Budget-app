'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

const FOCALIZZABILI = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';
const MARGINE = 12;
const LARGHEZZA = 300;
const PUNTA = 10;
const RESPIRO = 4;

type Rett = { left: number; top: number; width: number; height: number };

function leggiRett(ancora: string): Rett | null {
  const el = document.querySelector(`[data-fumetto="${ancora}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return null;
  if (r.bottom <= 0 || r.right <= 0 || r.top >= window.innerHeight || r.left >= window.innerWidth) return null;
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

const uguali = (a: Rett | null, b: Rett | null) =>
  a === b || (!!a && !!b && a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height);

// La bolla di aiuto accanto a un pezzo della pagina (cercato con data-fumetto).
// Modale: velo con un buco attorno al pezzo, focus dentro. Non modale: resta lì senza togliere nulla.
export function Fumetto({
  ancora,
  testo,
  modale,
  passo,
  etichettaAvanti,
  onAvanti,
  onSalta,
  onChiudi,
}: {
  ancora: string;
  testo: string;
  modale: boolean;
  passo?: { n: number; di: number };
  etichettaAvanti?: string;
  onAvanti?: () => void;
  onSalta?: () => void;
  onChiudi?: () => void;
}) {
  const [rett, setRett] = useState<Rett | null>(null);
  const [finestra, setFinestra] = useState({ w: 0, h: 0 });
  const scheda = useRef<HTMLDivElement>(null);
  const alSalta = useRef(onSalta);
  alSalta.current = onSalta;

  useEffect(() => {
    const ricalcola = () => {
      const nuovo = leggiRett(ancora);
      setRett((prima) => (uguali(prima, nuovo) ? prima : nuovo));
      setFinestra((f) => (f.w === window.innerWidth && f.h === window.innerHeight ? f : { w: window.innerWidth, h: window.innerHeight }));
    };
    ricalcola();
    window.addEventListener('resize', ricalcola);
    window.addEventListener('scroll', ricalcola, true);
    // Il pezzo può comparire dopo, quando la pagina finisce di caricare i dati.
    const osservatore = new MutationObserver(ricalcola);
    osservatore.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.removeEventListener('resize', ricalcola);
      window.removeEventListener('scroll', ricalcola, true);
      osservatore.disconnect();
    };
  }, [ancora]);

  const visibile = rett !== null;

  // Modale: il focus va su "Avanti", Tab resta dentro, Esc salta, alla chiusura il focus torna.
  useEffect(() => {
    if (!modale || !visibile) return;
    const prima = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const elenco = () => Array.from(scheda.current?.querySelectorAll<HTMLElement>(FOCALIZZABILI) ?? []);
    scheda.current?.querySelector<HTMLElement>('[data-fumetto-avanti]')?.focus();
    function tasto(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        alSalta.current?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const el = elenco();
      if (el.length === 0) return;
      const primo = el[0];
      const ultimo = el[el.length - 1];
      const attivo = document.activeElement;
      if (!scheda.current?.contains(attivo)) {
        e.preventDefault();
        primo.focus();
      } else if (e.shiftKey && attivo === primo) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && attivo === ultimo) {
        e.preventDefault();
        primo.focus();
      }
    }
    document.addEventListener('keydown', tasto);
    return () => {
      document.removeEventListener('keydown', tasto);
      prima?.focus();
    };
  }, [modale, visibile]);

  if (!rett) return null;

  const { w, h } = finestra;
  const larghezza = Math.min(LARGHEZZA, Math.max(0, w - MARGINE * 2));
  const centro = rett.left + rett.width / 2;
  const sinistra = Math.min(Math.max(centro - larghezza / 2, MARGINE), Math.max(MARGINE, w - MARGINE - larghezza));
  const sotto = rett.top + rett.height / 2 < h / 2;
  const puntaX = Math.min(Math.max(centro - sinistra, 20), larghezza - 20);
  const distanza = PUNTA + RESPIRO + 2;

  const posizione: React.CSSProperties = {
    position: 'fixed',
    left: `max(${sinistra}px, calc(env(safe-area-inset-left) + ${MARGINE}px))`,
    width: larghezza,
    ...(sotto
      ? { top: `max(calc(env(safe-area-inset-top) + ${MARGINE}px), ${rett.top + rett.height + distanza}px)` }
      : { bottom: `max(calc(env(safe-area-inset-bottom) + ${MARGINE}px), ${h - rett.top + distanza}px)` }),
  };

  const buco = { x: rett.left - RESPIRO, y: rett.top - RESPIRO, w: rett.width + RESPIRO * 2, h: rett.height + RESPIRO * 2 };
  const attributiDialog = modale
    ? { 'aria-modal': 'true' as const, 'data-fumetto-giro': '' }
    : { 'aria-live': 'polite' as const };

  return (
    <>
      {modale && (
        <svg aria-hidden="true" className="fixed inset-0 z-[60] h-full w-full" width={w} height={h}>
          <defs>
            <mask id="fumetto-buco">
              <rect width={w} height={h} fill="white" />
              <rect x={buco.x} y={buco.y} width={buco.w} height={buco.h} rx={10} fill="black" />
            </mask>
          </defs>
          <rect width={w} height={h} fill="black" fillOpacity={0.4} mask="url(#fumetto-buco)" />
          <rect x={buco.x} y={buco.y} width={buco.w} height={buco.h} rx={10} fill="none" stroke="var(--brand)" strokeWidth={2} />
        </svg>
      )}
      <div
        ref={scheda}
        role="dialog"
        aria-label="Suggerimento"
        {...attributiDialog}
        style={posizione}
        className="z-[61] rounded-[var(--radius-md)] border border-rule bg-surface p-4 text-ink"
      >
        <span
          aria-hidden="true"
          className={`absolute h-2.5 w-2.5 rotate-45 border-rule bg-surface ${sotto ? '-top-[5px] border-l border-t' : '-bottom-[5px] border-b border-r'}`}
          style={{ left: puntaX - 5 }}
        />
        {!modale && (
          <button
            type="button"
            aria-label="Chiudi"
            onClick={onChiudi}
            className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full text-ink-2 hover:bg-brand-tint"
          >
            <X size={18} />
          </button>
        )}
        {modale && passo && <p className="mb-1 text-xs text-ink-2">{`${passo.n} di ${passo.di}`}</p>}
        <p className={`text-sm leading-snug ${modale ? '' : 'pr-10'}`}>{testo}</p>
        {modale ? (
          <div className="mt-3 flex items-center justify-between gap-3">
            <button type="button" onClick={onSalta} className="min-h-11 px-2 text-sm text-ink-2 underline">
              Salta
            </button>
            <button
              type="button"
              data-fumetto-avanti
              onClick={onAvanti}
              className="min-h-12 rounded-[var(--radius-md)] bg-brand px-5 text-sm font-semibold text-brand-foreground"
            >
              {etichettaAvanti ?? 'Avanti'}
            </button>
          </div>
        ) : (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={onChiudi}
              className="min-h-11 rounded-[var(--radius-md)] bg-brand px-4 text-sm font-semibold text-brand-foreground"
            >
              Ho capito
            </button>
          </div>
        )}
      </div>
    </>
  );
}
