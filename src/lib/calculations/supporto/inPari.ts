export interface RigaStima {
  importo: number;
  accountId: string | null;
  casa: boolean;
}

export function righeDaRiepilogo(input: {
  carta: number | null;
  contanti: number | null;
  spazio: 'personale' | 'casa';
  contoCarta: string | null;
  contoContanti: string | null;
}): RigaStima[] {
  const casa = input.spazio === 'casa';
  const righe: RigaStima[] = [];
  if (input.carta !== null && input.carta > 0) righe.push({ importo: input.carta, accountId: input.contoCarta, casa });
  if (input.contanti !== null && input.contanti > 0) {
    righe.push({ importo: input.contanti, accountId: input.contoContanti, casa });
  }
  return righe;
}

const èContanti = (nome: string): boolean => nome.toLowerCase().includes('contanti');

// Carta: l'ultimo conto usato che non sia dei contanti, altrimenti il primo che non lo è.
// Contanti: un conto con "contanti" nel nome, se c'è.
export function scegliConti(
  conti: { id: string; nome: string }[],
  ultimiUsati: (string | null | undefined)[]
): { contoCarta: string | null; contoContanti: string | null } {
  const noContanti = conti.filter((c) => !èContanti(c.nome));
  const ultimo = ultimiUsati.find((id) => id && noContanti.some((c) => c.id === id));
  return {
    contoCarta: ultimo ?? noContanti[0]?.id ?? null,
    contoContanti: conti.find((c) => èContanti(c.nome))?.id ?? null,
  };
}
