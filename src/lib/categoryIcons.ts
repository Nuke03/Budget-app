import {
  Baby, Briefcase, Bus, Car, Coffee, Dumbbell, Fuel, Gift, GraduationCap, HeartPulse, House, Landmark,
  PartyPopper, PawPrint, Percent, Phone, Pill, Plane, Receipt, Shirt, ShoppingCart, Tag, Utensils, Wifi,
  type LucideIcon,
} from 'lucide-react';

// Le icone facoltative delle categorie. Gli id sono gli stessi del controllo SQL della migrazione 0016.
export const CATEGORY_ICONS = [
  { id: 'carrello', label: 'Carrello', Icon: ShoppingCart },
  { id: 'casa', label: 'Casa', Icon: House },
  { id: 'auto', label: 'Auto', Icon: Car },
  { id: 'benzina', label: 'Benzina', Icon: Fuel },
  { id: 'bus', label: 'Autobus', Icon: Bus },
  { id: 'bolletta', label: 'Bolletta', Icon: Receipt },
  { id: 'telefono', label: 'Telefono', Icon: Phone },
  { id: 'wifi', label: 'Internet', Icon: Wifi },
  { id: 'salute', label: 'Salute', Icon: HeartPulse },
  { id: 'farmacia', label: 'Farmacia', Icon: Pill },
  { id: 'svago', label: 'Svago', Icon: PartyPopper },
  { id: 'ristorante', label: 'Ristorante', Icon: Utensils },
  { id: 'caffe', label: 'Caffè', Icon: Coffee },
  { id: 'regalo', label: 'Regalo', Icon: Gift },
  { id: 'vestiti', label: 'Vestiti', Icon: Shirt },
  { id: 'animali', label: 'Animali', Icon: PawPrint },
  { id: 'sport', label: 'Sport', Icon: Dumbbell },
  { id: 'viaggio', label: 'Viaggio', Icon: Plane },
  { id: 'studio', label: 'Studio', Icon: GraduationCap },
  { id: 'lavoro', label: 'Lavoro', Icon: Briefcase },
  { id: 'tasse', label: 'Tasse', Icon: Percent },
  { id: 'banca', label: 'Banca', Icon: Landmark },
  { id: 'bambini', label: 'Bambini', Icon: Baby },
  { id: 'altro', label: 'Altro', Icon: Tag },
] as const satisfies readonly { id: string; label: string; Icon: LucideIcon }[];

export type IconaId = (typeof CATEGORY_ICONS)[number]['id'];

export const ICONA_IDS: readonly string[] = CATEGORY_ICONS.map((i) => i.id);

export function iconaDi(id: string | null | undefined): LucideIcon | null {
  return CATEGORY_ICONS.find((i) => i.id === id)?.Icon ?? null;
}
