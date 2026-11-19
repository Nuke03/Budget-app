import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Ogni modifica ed eliminazione di un movimento è una sola rpc (0012): nessun percorso del client
// aggiorna più la riga e poi il saldo in due richieste.
const PERCORSI = [
  'src/app/history/page.tsx',
  'src/app/casa/movimenti/MovimentiCasa.tsx',
  'src/app/casa/movimenti/page.tsx',
  'src/app/AnnullaProvider.tsx',
  'src/lib/data/transactions.ts',
  'src/lib/eliminazioniInSospeso.ts',
];

describe('movimenti atomici: nessun aggiornamento del saldo in due passi', () => {
  for (const file of PERCORSI) {
    it(`${file} non chiama adjust_account_balance né adjustAccountBalance`, () => {
      const src = readFileSync(join(process.cwd(), file), 'utf8');
      expect(src).not.toMatch(/adjust_account_balance|adjustAccountBalance/);
      expect(src).not.toMatch(/deltaPerModifica/);
    });
  }

  it('il client non scrive più righe di transactions in due passi (update/delete diretti)', () => {
    for (const file of ['src/app/history/page.tsx', 'src/app/casa/movimenti/MovimentiCasa.tsx']) {
      const src = readFileSync(join(process.cwd(), file), 'utf8');
      expect(src).not.toMatch(/updateTransaction|deleteTransaction/);
    }
  });

  it('adjustAccountBalance e deltaPerModifica non esistono più nel client', () => {
    expect(readFileSync(join(process.cwd(), 'src/lib/data/accounts.ts'), 'utf8')).not.toMatch(/adjust_account_balance/);
    expect(existsSync(join(process.cwd(), 'src/lib/calculations/accountBalance.ts'))).toBe(false);
  });
});
