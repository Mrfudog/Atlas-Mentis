import { entriesOf, fieldTitle, primaryInterface, proseFields } from '@nw/model';
import type { Entity, Registry } from '@nw/model';

/** Was ein Abschnitt als Text zeigt, in dieser Reihenfolge; der Rest der Prosafelder danach. */
const ZUERST = ['ReadAloud.readaloud', 'Description.description', 'Prose.paragraph'];
/** Was nicht Buchtext ist: die Fundstelle (steht im Kopf), die Aufgaben der Leitung. */
const NICHT = ['Notes.note', 'Todos.items'];
/** Als Kasten gesetzt — Vorlesetext und was nur die Leitung liest (wie `artikel.scss`). */
const KASTEN: Record<string, string> = {
  'ReadAloud.readaloud': 'vorlesen',
  'Secrets.secret': 'geheim',
  'Tactics.tactics': 'geheim',
  'Encounter.hint': 'geheim',
};
/** Wie ein Absatz eines Buchs gesetzt wird, nach `Paragraph.kind` (T-108); Text, Liste und Tabelle stehen im Fluss. */
const SORTE: Record<string, string> = { sidebar: 'rand', quote: 'zitat' };
const SORTE_LABEL: Record<string, string> = { sidebar: 'Sidebar', quote: 'Quote' };

/** Ein Stück Buchtext: `art` ist die Klasse (`text`, `vorlesen`, `rand` …). */
export interface Block {
  key: string;
  art: string;
  label: string;
  text: string;
}

function rang(ref: string): number {
  const i = ZUERST.indexOf(ref);
  return i < 0 ? ZUERST.length : i;
}

/**
 * **Der Text eines Artikels, wie ein Buch ihn setzt** (T-091, T-108): die
 * Prosafelder seiner Art in Lesereihenfolge — Vorlesetext als Kasten,
 * Fliesstext im Fluss, ein Absatz nach seiner Sorte. Dieselben Blöcke in
 * der Leseansicht und auf der Artikelseite (Element `parts`).
 */
export function bloeckeVon(r: Registry, e: Entity): Block[] {
  const typ = primaryInterface(e);
  const felder = proseFields(r, typ)
    .map((f) => ({ f, ref: `${f.type}.${f.key}` }))
    .filter(({ ref }) => !NICHT.includes(ref))
    .sort((a, b) => rang(a.ref) - rang(b.ref));
  const sorte = String((e.components?.['Paragraph'] as { kind?: unknown } | undefined)?.kind ?? 'text');
  const eigen = typ === 'Paragraph' && SORTE[sorte];
  const out: Block[] = [];
  for (const { f, ref } of felder) {
    const karte = (e.components?.[f.type] ?? {}) as Record<string, unknown>;
    for (const eintrag of entriesOf(karte[f.key])) {
      if (!eintrag.value.trim()) continue;
      const fluss = ref === 'Prose.paragraph' || ref === 'Description.description';
      out.push({
        key: `${ref}#${eintrag.id}`,
        art: KASTEN[ref] ?? (fluss ? (eigen ? SORTE[sorte]! : 'text') : 'feld'),
        label: eigen ? SORTE_LABEL[sorte]! : fieldTitle(r, typ, f),
        text: eintrag.value,
      });
    }
  }
  return out;
}
