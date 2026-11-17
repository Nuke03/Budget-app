import { ImageResponse } from 'next/og';
import { IconaApp } from '@/lib/iconaApp';

export const contentType = 'image/png';

export function generateImageMetadata() {
  return [
    { id: '192', contentType, size: { width: 192, height: 192 } },
    { id: '512', contentType, size: { width: 512, height: 512 } },
    // Maschera: il sistema ritaglia fino al 20% per lato, quindi il disegno sta piu' al centro.
    { id: 'maskable', contentType, size: { width: 512, height: 512 } },
  ];
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const chiave = String(await id);
  const maschera = chiave === 'maskable';
  const lato = maschera ? 512 : Number(chiave);
  return new ImageResponse(<IconaApp lato={lato} margine={maschera ? 0.2 : 0.1} />, { width: lato, height: lato });
}
