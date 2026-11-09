import type { Account, Transaction } from '../../types';

// "Anna", "Anna e Marco", "Anna, Marco e Giulia": gli altri membri della casa.
export function nomiAltri(nomi: { userId: string; nome: string }[], meUserId: string): string | null {
  const altri = nomi.filter((n) => n.userId !== meUserId).map((n) => n.nome);
  if (altri.length === 0) return null;
  if (altri.length === 1) return altri[0];
  return `${altri.slice(0, -1).join(', ')} e ${altri[altri.length - 1]}`;
}

// Chi ha messo i soldi: la persona indicata, altrimenti il conto di casa, altrimenti chi ha registrato.
export function etichettaChiHaPagato(
  t: Transaction,
  conti: Account[],
  nomi: Record<string, string>
): string {
  if (t.pagataDaUserId && nomi[t.pagataDaUserId]) return nomi[t.pagataDaUserId];
  const conto = t.accountId ? conti.find((c) => c.id === t.accountId) : undefined;
  if (conto) return conto.nome;
  if (t.userId && nomi[t.userId]) return nomi[t.userId];
  return '';
}
