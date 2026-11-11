'use client';

import { useState } from 'react';
import { mandaProva } from './actions';

function chiaveInBytes(base64: string): Uint8Array<ArrayBuffer> {
  const riempimento = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + riempimento).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function ProvaNotifiche({
  chiavePubblica,
  configurata,
}: {
  chiavePubblica: string;
  configurata: boolean;
}) {
  const [esito, setEsito] = useState('');
  const [inCorso, setInCorso] = useState(false);

  async function manda() {
    setInCorso(true);
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setEsito('Questo browser non supporta le notifiche (su iPhone serve l\'app aperta dalla schermata Home).');
        return;
      }
      await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
      const registrazione = await navigator.serviceWorker.ready;
      const permesso = await Notification.requestPermission();
      if (permesso !== 'granted') {
        setEsito(`Permesso non dato (${permesso}).`);
        return;
      }
      const iscrizione =
        (await registrazione.pushManager.getSubscription()) ??
        (await registrazione.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: chiaveInBytes(chiavePubblica),
        }));
      const r = await mandaProva(JSON.parse(JSON.stringify(iscrizione)));
      setEsito(r.messaggio);
    } catch (e) {
      setEsito(`Errore: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setInCorso(false);
    }
  }

  if (!configurata) {
    return <p className="p-6">Mancano le chiavi delle notifiche su Vercel.</p>;
  }

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Prova delle notifiche</h1>
      <button
        type="button"
        onClick={manda}
        disabled={inCorso}
        className="rounded-lg bg-black px-4 py-3 text-white disabled:opacity-50"
      >
        Manda una notifica di prova
      </button>
      {esito && <p role="status">{esito}</p>}
    </main>
  );
}
