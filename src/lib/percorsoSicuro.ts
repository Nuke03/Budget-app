// Dopo il login si torna solo a un percorso interno: "/qualcosa", mai un altro sito.
export function percorsoInternoSicuro(valore: string | null | undefined): string {
  if (typeof valore !== 'string' || valore === '') return '/';
  if (!valore.startsWith('/') || valore.startsWith('//')) return '/';
  if (valore.includes(String.fromCharCode(92)) || /[\u0000-\u001f\u007f]/.test(valore)) return '/';
  return valore;
}

// "next=..." da aggiungere all'indirizzo del login, vuoto se non serve.
export function nextPerLogin(percorso: string | null | undefined): string {
  const sicuro = percorsoInternoSicuro(percorso);
  return sicuro === '/' ? '' : `next=${encodeURIComponent(sicuro)}`;
}
