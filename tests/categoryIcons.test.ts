import { describe, it, expect } from 'vitest';
import { CATEGORY_ICONS, iconaDi } from '../src/lib/categoryIcons';

describe('categoryIcons', () => {
  it('24 id unici, con etichetta italiana e icona', () => {
    expect(CATEGORY_ICONS).toHaveLength(24);
    expect(new Set(CATEGORY_ICONS.map((i) => i.id)).size).toBe(24);
    for (const i of CATEGORY_ICONS) {
      expect(i.label.length).toBeGreaterThan(2);
      expect(i.Icon).toBeTruthy();
    }
  });
  it('iconaDi: id noto o niente', () => {
    expect(iconaDi('carrello')).toBeTruthy();
    expect(iconaDi(null)).toBeNull();
    expect(iconaDi('boh')).toBeNull();
  });
});
