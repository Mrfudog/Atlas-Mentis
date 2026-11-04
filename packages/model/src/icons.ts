/**
 * **Icons im Register** (T-461, REQ-460, E-210).
 *
 * Ein Icon ist ein Name aus dem Katalog unten (`map-pin`, `sword`), und
 * drei Stellen dürfen einen tragen: die **Art** (`InterfaceDef.icon`, die
 * `extends`-Kette hoch geerbt wie `area` — eine Stadt ist ein Ort und
 * zeigt den Ort, bis sie etwas Eigenes sagt), das **Feld**
 * (`PropertySchema.icon`) und der **Artikel** (`Identity.icon`, das
 * eigene schlägt das der Art). Gezeigt wird überall gleich — Liste,
 * Kurzansicht, Kopf, Kanten, Kachel — über eine Komponente, die den Namen
 * hier nachschlägt; was der Katalog nicht kennt, zeichnet nichts.
 *
 * **Der Katalog ist ein Platzhaltersatz** (Schnitt 1): Lucide-Icons, je
 * eines als ein einziger SVG-Pfad (24 × 24, Strich 2, `currentColor`), mit
 * Beschriftung, Suchwörtern und Quelle. Schnitt 2 (REQ-462) holt ihn in
 * ein eigenes Asset-Modul mit derselben Schnittstelle — Id, Pfad, Lizenz,
 * Tags — und bündelt nur, was genutzt wird. Darum steht hier **kein**
 * Rendering und keine Farbe: ein Icon ist Daten, die Oberfläche zeichnet.
 */
import type { Entity, Registry } from './types.js';
import { primaryInterface, typeChain } from './entity.js';

/** Woher ein Icon kommt, mit Lizenz — der Hinweis steht im Handbuch. */
export interface IconSource {
  label: string;
  licence: string;
  url: string;
}

export const ICON_SOURCES: Record<string, IconSource> = {
  lucide: {
    label: 'Lucide',
    licence: 'ISC (portions MIT, Feather Icons) — © 2013–2023 Cole Bemis (Feather), © 2025 Lucide Contributors',
    url: 'https://lucide.dev',
  },
};

export interface IconDef {
  /** Der Name, wie ihn Art, Feld und Artikel nennen. */
  id: string;
  label: string;
  /** Wonach der Wähler ihn findet — neben Id und Beschriftung. */
  tags: string[];
  /** Ein einziger Pfad im 24 × 24-Raster; Strich 2, abgerundet, `currentColor`. */
  d: string;
  source: keyof typeof ICON_SOURCES;
}

/* Lucide 0.552.0, umgeschrieben zu je einem Pfad (Kreise, Linien,
   Rechtecke und Polygone als Pfadbefehle), Tags aus unserer Sicht. */
const LUCIDE: Omit<IconDef, 'source'>[] = [
  { id: 'globe', label: 'Globe', tags: ['world', 'earth', 'planet'], d: 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20' },
  { id: 'map-pin', label: 'Map pin', tags: ['place', 'location', 'marker'], d: 'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0M9 10a3 3 0 1 0 6 0a3 3 0 1 0 -6 0' },
  { id: 'user', label: 'User', tags: ['creature', 'person', 'npc', 'character'], d: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M8 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0' },
  { id: 'users', label: 'Users', tags: ['party', 'group', 'people'], d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3.128a4 4 0 0 1 0 7.744M22 21v-2a4 4 0 0 0-3-3.87M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0' },
  { id: 'flag', label: 'Flag', tags: ['faction', 'banner', 'organisation'], d: 'M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528' },
  { id: 'box', label: 'Box', tags: ['item', 'object', 'package'], d: 'M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Zm3.3 7 8.7 5 8.7-5M12 22V12' },
  { id: 'sword', label: 'Sword', tags: ['weapon', 'blade', 'attack'], d: 'm11 19-6-6m5 21-2-2m8 16-4 4M9.5 17.5 21 6V3h-3L6.5 14.5' },
  { id: 'shield', label: 'Shield', tags: ['armor', 'armour', 'defense', 'protection'], d: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z' },
  { id: 'sparkles', label: 'Sparkles', tags: ['spell', 'magic', 'glitter'], d: 'M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594zM20 2v4M22 4h-4M2 20a2 2 0 1 0 4 0a2 2 0 1 0 -4 0' },
  { id: 'scroll-text', label: 'Scroll text', tags: ['quest', 'task', 'mission', 'document'], d: 'M15 12h-5M15 8h-5M19 17V5a2 2 0 0 0-2-2H4M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3' },
  { id: 'calendar', label: 'Calendar', tags: ['event', 'session', 'date', 'day'], d: 'M8 2v4M16 2v4M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2zM3 10h18' },
  { id: 'clapperboard', label: 'Clapperboard', tags: ['scene', 'movie', 'act'], d: 'M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Zm6.2 5.3 3.1 3.9m12.4 3.4 3.1 4M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z' },
  { id: 'swords', label: 'Swords', tags: ['encounter', 'fight', 'battle', 'combat'], d: 'M14.5 17.5L3 6L3 3L6 3L17.5 14.5M0 0L0 0M0 0L0 0M0 0L0 0M14.5 6.5L18 3L21 3L21 6L17.5 9.5M0 0L0 0M0 0L0 0M0 0L0 0' },
  { id: 'map', label: 'Map', tags: ['map', 'navigation', 'region'], d: 'M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0zM15 5.764v15M9 3.236v15' },
  { id: 'layout-grid', label: 'Layout grid', tags: ['board', 'tiles', 'dashboard'], d: 'M4 3h5a1 1 0 0 1 1 1v5a1 1 0 0 1 -1 1h-5a1 1 0 0 1 -1 -1v-5a1 1 0 0 1 1 -1zM15 3h5a1 1 0 0 1 1 1v5a1 1 0 0 1 -1 1h-5a1 1 0 0 1 -1 -1v-5a1 1 0 0 1 1 -1zM15 14h5a1 1 0 0 1 1 1v5a1 1 0 0 1 -1 1h-5a1 1 0 0 1 -1 -1v-5a1 1 0 0 1 1 -1zM4 14h5a1 1 0 0 1 1 1v5a1 1 0 0 1 -1 1h-5a1 1 0 0 1 -1 -1v-5a1 1 0 0 1 1 -1z' },
  { id: 'compass', label: 'Compass', tags: ['campaign', 'direction', 'journey'], d: 'm16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265zM2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0' },
  { id: 'layers', label: 'Layers', tags: ['layer', 'stack', 'book'], d: 'M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83zM2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17' },
  { id: 'book', label: 'Book', tags: ['rule', 'rules', 'tome'], d: 'M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20' },
  { id: 'graduation-cap', label: 'Graduation cap', tags: ['class', 'school', 'training'], d: 'M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0zM22 10v6M6 12.5V16a6 3 0 0 0 12 0v-3.5' },
  { id: 'dna', label: 'Dna', tags: ['ancestry', 'species', 'heritage'], d: 'm10 16 1.5 1.5m14 8-1.5-1.5M15 2c-1.798 1.998-2.518 3.995-2.807 5.993m16.5 10.5 1 1m17 6-2.891-2.891M2 15c6.667-6 13.333 0 20-6m20 9 .891.891M3.109 14.109 4 15m6.5 12.5 1 1m7 18 2.891 2.891M9 22c1.798-1.998 2.518-3.995 2.807-5.993' },
  { id: 'id-card', label: 'Id card', tags: ['background', 'identity', 'origin'], d: 'M16 10h2M16 14h2M6.17 15a3 3 0 0 1 5.66 0M7 11a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-16a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2z' },
  { id: 'target', label: 'Target', tags: ['skill', 'goal', 'aim', 'focus'], d: 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0M6 12a6 6 0 1 0 12 0a6 6 0 1 0 -12 0M10 12a2 2 0 1 0 4 0a2 2 0 1 0 -4 0' },
  { id: 'languages', label: 'Languages', tags: ['language', 'translate', 'speech'], d: 'm5 8 6 6m4 14 6-6 2-3M2 5h12M7 2h1m22 22-5-10-5 10M14 18h6' },
  { id: 'flask-conical', label: 'Flask conical', tags: ['recipe', 'alchemy', 'potion', 'craft'], d: 'M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2M6.453 15h11.094M8.5 2h7' },
  { id: 'hammer', label: 'Hammer', tags: ['trade', 'tool', 'craft', 'build'], d: 'm15 12-9.373 9.373a1 1 0 0 1-3.001-3L12 9m18 15 4-4m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172v-.344a2 2 0 0 0-.586-1.414l-1.657-1.657A6 6 0 0 0 12.516 3H9l1.243 1.243A6 6 0 0 1 12 8.485V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5' },
  { id: 'backpack', label: 'Backpack', tags: ['container', 'inventory', 'bag', 'carry'], d: 'M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM8 10h8M8 18h8M8 22v-6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v6M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2' },
  { id: 'image', label: 'Image', tags: ['image', 'picture', 'photo', 'asset'], d: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2zM7 9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21' },
  { id: 'sticky-note', label: 'Sticky note', tags: ['note', 'memo', 'reminder'], d: 'M21 9a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM15 3v5a1 1 0 0 0 1 1h5' },
  { id: 'book-open', label: 'Book open', tags: ['story', 'chapter', 'arc', 'read'], d: 'M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z' },
  { id: 'tags', label: 'Tags', tags: ['tag', 'label', 'category'], d: 'M13.172 2a2 2 0 0 1 1.414.586l6.71 6.71a2.4 2.4 0 0 1 0 3.408l-4.592 4.592a2.4 2.4 0 0 1-3.408 0l-6.71-6.71A2 2 0 0 1 6 9.172V3a1 1 0 0 1 1-1zM2 7v6.172a2 2 0 0 0 .586 1.414l6.71 6.71a2.4 2.4 0 0 0 3.191.193M10 6.5a0.5 0.5 0 1 0 1 0a0.5 0.5 0 1 0 -1 0' },
  { id: 'heart', label: 'Heart', tags: ['hit points', 'health', 'life', 'love'], d: 'M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5' },
  { id: 'star', label: 'Star', tags: ['favourite', 'rating', 'deity', 'important'], d: 'M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z' },
  { id: 'lock', label: 'Lock', tags: ['secret', 'locked', 'private', 'hidden'], d: 'M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-7a2 2 0 0 1 2 -2zM7 11V7a5 5 0 0 1 10 0v4' },
  { id: 'brain', label: 'Brain', tags: ['knowledge', 'mind', 'memory', 'intelligence'], d: 'M12 18V5M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5M17.997 5.125a4 4 0 0 1 2.526 5.77M18 18a4 4 0 0 0 2-7.464M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517M6 18a4 4 0 0 1-2-7.464M6.003 5.125a4 4 0 0 0-2.526 5.77' },
  { id: 'clock', label: 'Clock', tags: ['time', 'duration', 'hour'], d: 'M12 6v6l4 2M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0' },
  { id: 'coins', label: 'Coins', tags: ['money', 'gold', 'price', 'treasure'], d: 'M2 8a6 6 0 1 0 12 0a6 6 0 1 0 -12 0M18.09 10.37A6 6 0 1 1 10.34 18M7 6h1v4m16.71 13.88.7.71-2.82 2.82' },
];

export const ICONS: readonly IconDef[] = LUCIDE.map((i) => ({ ...i, source: 'lucide' }));

const NACH_ID = new Map(ICONS.map((i) => [i.id, i]));

/** Das Icon zu einem Namen; `undefined` für einen, den der Katalog nicht kennt. */
export function iconDef(id: string | undefined | null): IconDef | undefined {
  return id ? NACH_ID.get(id.trim()) : undefined;
}

/**
 * Suchen nach Id, Beschriftung und Tags, Treffer im Namen zuerst. Leer
 * heisst alle — der Wähler zeigt den ganzen Satz, bevor jemand tippt.
 */
export function searchIcons(q: string): IconDef[] {
  const s = q.trim().toLowerCase();
  if (!s) return [...ICONS];
  const vorn: IconDef[] = [];
  const hinten: IconDef[] = [];
  for (const i of ICONS) {
    if (i.id.includes(s) || i.label.toLowerCase().includes(s)) vorn.push(i);
    else if (i.tags.some((t) => t.includes(s))) hinten.push(i);
  }
  /* Ein Treffer, der mit dem Gesuchten beginnt, vor einem, der es nur enthält. */
  vorn.sort((a, b) => Number(b.label.toLowerCase().startsWith(s) || b.id.startsWith(s)) - Number(a.label.toLowerCase().startsWith(s) || a.id.startsWith(s)));
  return [...vorn, ...hinten];
}

/** Das Icon einer Art: ihres, sonst das des nächsten Obertyps, der eines sagt. */
export function typeIcon(registry: Pick<Registry, 'interfaces'>, type: string | undefined): string | undefined {
  if (!type) return undefined;
  for (const t of typeChain(registry, type)) {
    const eigen = registry.interfaces[t]?.icon;
    if (typeof eigen === 'string' && eigen.trim()) return eigen.trim();
  }
  return undefined;
}

/** Das Icon eines Artikels: sein eigenes (`Identity.icon`), sonst das seiner Art. */
export function iconOf(registry: Pick<Registry, 'interfaces'>, entity: Entity | undefined): string | undefined {
  if (!entity) return undefined;
  const eigen = (entity.components?.['Identity'] as { icon?: unknown } | undefined)?.icon;
  if (typeof eigen === 'string' && eigen.trim()) return eigen.trim();
  return typeIcon(registry, primaryInterface(entity));
}

/** Das Icon eines Feldes — am Feld selbst, bei der Art, der es gehört. */
export function fieldIcon(registry: Pick<Registry, 'interfaces'>, type: string | undefined, key: string): string | undefined {
  if (!type) return undefined;
  for (const t of typeChain(registry, type)) {
    const p = registry.interfaces[t]?.schema?.properties?.[key];
    if (p && typeof p.icon === 'string' && p.icon.trim()) return p.icon.trim();
  }
  return undefined;
}
