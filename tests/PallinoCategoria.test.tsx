import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PallinoCategoria } from '@/app/home/PallinoCategoria';

describe('PallinoCategoria', () => {
  it('senza icona è il pallino colorato, aria-hidden', () => {
    const { container } = render(<PallinoCategoria colore="#0F9D6B" />);
    const dot = container.querySelector('[data-colore="#0F9D6B"]') as HTMLElement;
    expect(dot.parentElement).toHaveAttribute('aria-hidden', 'true');
    expect(dot.style.backgroundColor).not.toBe('');
    expect(container.querySelector('svg')).toBeNull();
  });

  it('con icona è un\'icona da 16px nel colore, aria-hidden, senza pallino', () => {
    const { container } = render(<PallinoCategoria colore="#0F9D6B" icona="carrello" />);
    const svg = container.querySelector('svg') as SVGElement;
    expect(svg).toHaveAttribute('width', '16');
    expect(svg).toHaveAttribute('height', '16');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect((svg.parentElement as HTMLElement).dataset.icona).toBe('carrello');
    expect(container.querySelector('[data-colore]')?.getAttribute('data-colore')).toBe('#0F9D6B');
    expect(container.querySelector('.rounded-full')).toBeNull();
  });

  it('un\'icona sconosciuta torna al pallino', () => {
    const { container } = render(<PallinoCategoria colore="#0F9D6B" icona="boh" />);
    expect(container.querySelector('svg')).toBeNull();
    expect(container.querySelector('.rounded-full')).not.toBeNull();
  });

  it('senza colore né icona resta lo spazio', () => {
    const { container } = render(<PallinoCategoria colore={null} />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });
});
