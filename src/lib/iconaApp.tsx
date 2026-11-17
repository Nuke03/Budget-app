// Disegno dell'icona dell'app: copertina blu, libretto bianco, timbro rosso.
// Il rosso del timbro e' sanzionato come marchio, solo qui.
const COPERTINA = '#14306b';
const PAGINA = '#ffffff';
const TIMBRO = '#c8102e';

// `margine` e' la quota del lato lasciata libera attorno al disegno.
export function IconaApp({ lato, margine }: { lato: number; margine: number }) {
  const area = lato * (1 - 2 * margine);
  // Libretto verticale (rapporto 0.75), circa il 58% del lato, dentro i margini di sicurezza.
  const altezza = Math.min((lato * 0.58) / 0.75, area);
  const larghezza = altezza * 0.75;
  const riga = Math.max(3, Math.round(lato * 0.022));
  const timbro = larghezza * 0.42;
  const anello = Math.max(3, Math.round(lato * 0.028));
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: COPERTINA,
      }}
    >
      <div
        style={{
          width: larghezza,
          height: altezza,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          background: PAGINA,
          borderRadius: larghezza * 0.1,
          padding: larghezza * 0.14,
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: larghezza * 0.09,
            background: COPERTINA,
            opacity: 0.22,
            borderTopLeftRadius: larghezza * 0.1,
            borderBottomLeftRadius: larghezza * 0.1,
          }}
        />
        <div style={{ width: larghezza * 0.6, height: riga, background: COPERTINA, opacity: 0.4, marginTop: altezza * 0.08 }} />
        <div style={{ width: larghezza * 0.42, height: riga, background: COPERTINA, opacity: 0.4, marginTop: riga * 3 }} />
        <div
          style={{
            position: 'absolute',
            bottom: altezza * 0.1,
            right: larghezza * 0.1,
            width: timbro,
            height: timbro,
            borderRadius: timbro,
            border: `${anello}px solid ${TIMBRO}`,
            transform: 'rotate(-10deg)',
          }}
        />
      </div>
    </div>
  );
}
