import { ImageResponse } from 'next/og';
import { IconaApp } from '@/lib/iconaApp';

export const contentType = 'image/png';

export function generateImageMetadata() {
  return [
    { id: '192', contentType, size: { width: 192, height: 192 } },
    { id: '512', contentType, size: { width: 512, height: 512 } },
  ];
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const lato = Number(await id);
  return new ImageResponse(<IconaApp lato={lato} margine={0.1} />, { width: lato, height: lato });
}
