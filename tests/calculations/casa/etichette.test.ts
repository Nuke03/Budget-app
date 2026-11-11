import { describe, it, expect } from 'vitest';
import { nomiAltri, etichettaChiHaPagato } from '@/lib/calculations/casa/etichette';
import type { Account, Transaction } from '@/lib/types';

const nomi = [
  { userId: 'u1', nome: 'Fabio' },
  { userId: 'u2', nome: 'Anna' },
  { userId: 'u3', nome: 'Marco' },
  { userId: 'u4', nome: 'Giulia' },
];

describe('nomiAltri', () => {
  it('un solo altro', () => {
    expect(nomiAltri(nomi.slice(0, 2), 'u1')).toBe('Anna');
  });
  it('due altri', () => {
    expect(nomiAltri(nomi.slice(0, 3), 'u1')).toBe('Anna e Marco');
  });
  it('tre altri', () => {
    expect(nomiAltri(nomi, 'u1')).toBe('Anna, Marco e Giulia');
  });
  it('nessun altro', () => {
    expect(nomiAltri(nomi.slice(0, 1), 'u1')).toBeNull();
  });
});

const conti: Account[] = [
  { id: 'c1', nome: 'Conto comune', saldoAttuale: 0, contaInDisponibile: true, targetSaldo: null },
];
const mappa = { u1: 'Fabio', u2: 'Anna' };
function tx(over: Partial<Transaction>): Transaction {
  return {
    id: 't', tipo: 'expense', importo: 1, data: '2026-11-01', categoriaId: null, accountId: null,
    goalId: null, descrizione: 'x', nota: null, createdAt: '', stima: false, ...over,
  };
}

describe('etichettaChiHaPagato', () => {
  it('pagata da un membro: il suo nome', () => {
    expect(etichettaChiHaPagato(tx({ pagataDaUserId: 'u2', accountId: 'c1' }), conti, mappa)).toBe('Anna');
  });
  it('con conto di casa: il nome del conto', () => {
    expect(etichettaChiHaPagato(tx({ accountId: 'c1', userId: 'u1' }), conti, mappa)).toBe('Conto comune');
  });
  it('senza conto: il nome dell autore', () => {
    expect(etichettaChiHaPagato(tx({ userId: 'u1' }), conti, mappa)).toBe('Fabio');
  });
  it('senza nulla: stringa vuota', () => {
    expect(etichettaChiHaPagato(tx({}), conti, mappa)).toBe('');
  });
});
