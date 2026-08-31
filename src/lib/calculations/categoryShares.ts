export interface CategoryShare {
  nome: string;
  totale: number;
  percentuale: number;
}

export function computeCategoryShares(
  chartData: { nome: string; totale: number }[]
): CategoryShare[] {
  const totaleComplessivo = chartData.reduce((sum, c) => sum + c.totale, 0);

  return chartData.map((c) => ({
    nome: c.nome,
    totale: c.totale,
    percentuale: totaleComplessivo > 0 ? (c.totale / totaleComplessivo) * 100 : 0,
  }));
}
