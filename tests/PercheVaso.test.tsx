import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PercheVaso } from '@/app/piva/PerchePiva';
import type { PivaSettings } from '@/lib/types';

const settings = (over: Partial<PivaSettings> = {}): PivaSettings => ({
  id: 's', attivo: true, dataApertura: '2024-01-01', categoriaFatturatoId: 'c', coefficienteRedditivita: 78,
  aliquotaSostitutivaOverride: 5, aliquotaContributoSoggettivo: 10, aliquotaContributoIntegrativo: 2,
  minimaleContributivoAnnuo: 856, contributiVersatiAnnoPrecedente: 0, contoTasseId: 't', preset: 'enpap',
  guidataDal: '2026-01-01', stipendioMensile: null, stipendioRivistoIl: null, incassoMeseMagro: null, ...over,
});
const stima = { imposta: 390, soggettivo: 856, integrativo: 200, totale: 1446 };

function apri(s: PivaSettings, fatturato: number) {
  render(<PercheVaso settings={s} fatturato={fatturato} stima={stima} messi={0} />);
  fireEvent.click(screen.getByRole('button', { name: /Perché/ }));
}

describe('PercheVaso: minimale', () => {
  it('se il soggettivo è salito al minimo dice quanto aggiungere, col nome della cassa', () => {
    apri(settings(), 10000);
    expect(screen.getByText("Il minimo dell'ENPAP è 856 €: aggiungi 76 € entro l'anno.")).toBeInTheDocument();
  });
  it('senza cassa nota dice "della cassa"', () => {
    apri(settings({ preset: 'altro' }), 10000);
    expect(screen.getByText("Il minimo della cassa è 856 €: aggiungi 76 € entro l'anno.")).toBeInTheDocument();
  });
  it('se la percentuale supera il minimo non dice nulla', () => {
    apri(settings(), 20000);
    expect(screen.queryByText(/aggiungi/)).not.toBeInTheDocument();
  });
});
