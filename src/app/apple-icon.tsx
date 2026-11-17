import { ImageResponse } from 'next/og';
import { IconaApp } from '@/lib/iconaApp';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

// Sfondo pieno e margini larghi: iOS arrotonda gli angoli da solo.
export default function AppleIcon() {
  return new ImageResponse(<IconaApp lato={size.width} margine={0.16} />, { ...size });
}
