// Disegno dell'icona dell'app: copertina blu, libretto bianco, timbro rosso.
// Il rosso del timbro e' sanzionato come marchio, solo qui.
const COPERTINA = '#14306b';
const PAGINA = '#ffffff';
const TIMBRO = '#c8102e';

// `margine` e' la quota del lato lasciata libera attorno al disegno.
export function IconaApp({ lato, margine }: { lato: number; margine: number }) {
  const area = lato * (1 - 2 * margine);
  const larghezza = area * 0.62;
  const altezza = area * 0.76;
  const riga = Math.max(2, Math.round(area * 0.025));
  const timbro = area * 0.3;
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
          justifyContent: 'flex-end',
          alignItems: 'center',
          background: PAGINA,
          borderRadius: area * 0.08,
          paddingBottom: altezza * 0.16,
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -timbro * 0.35,
            right: -timbro * 0.3,
            width: timbro,
            height: timbro,
            borderRadius: timbro,
            background: TIMBRO,
            border: `${Math.max(2, Math.round(timbro * 0.1))}px solid ${COPERTINA}`,
          }}
        />
        <div style={{ width: larghezza * 0.64, height: riga, background: COPERTINA, opacity: 0.35, marginTop: riga * 3 }} />
        <div style={{ width: larghezza * 0.46, height: riga, background: COPERTINA, opacity: 0.35, marginTop: riga * 3 }} />
      </div>
    </div>
  );
}
