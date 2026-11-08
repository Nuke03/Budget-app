export function messaggioErroreLogin(message: string): string {
  if (/fetch failed|failed to fetch|network/i.test(message)) {
    return 'Non riesco a raggiungere il database. Riprova tra qualche minuto.';
  }
  if (/invalid login credentials/i.test(message)) {
    return 'Email o password errati.';
  }
  return message;
}
