/**
 * Die Kurzfassung eines Artikels — was eine Liste, ein Verweis und eine
 * Auswahl von ihm brauchen, und nicht mehr.
 *
 * Bis zum 13.10. holte die Oberfläche den ganzen Bestand mit jedem Feld und
 * jeder Kante, um daraus eine Liste von Namen zu zeichnen. Mit den 24 157
 * Artikeln aus 5e.tools hiess das: zig Megabyte, bevor die erste Zeile
 * dastand. Der ganze Artikel kommt jetzt erst, wenn man ihn öffnet.
 *
 * Was drinbleibt, sagt nicht eine Feldliste, sondern die Frage, die gestellt
 * wird:
 * - **Liste und Suche:** Name, Art, `Identity` (Nummer, Aliasse, Deckname),
 *   Marken und Vorbereitungsstand.
 * - **Verweise `[[…]]`:** dieselben — `linkCandidates` liest Nummer, Name
 *   und Aliasse.
 * - **Instanz oder nicht:** die Kante `instanceOf` (D82); eine Instanz ist
 *   kein Verweisziel und steht in keiner Liste.
 * - **Woher:** die Kanten `inLayer` und die Karte `Source` — das Kompendium
 *   filtert nach Ebene und zeigt die Quelle in der Zeile.
 * - **Auswahlen, die eine Art nennen (M6):** die Felder, nach denen ein
 *   `enumWhere` filtert. Sie werden aus dem Register gelesen und nicht hier
 *   aufgezählt — ein Filter, der morgen dazukommt, bringt sein Feld mit.
 *
 * Gekürzt wird **nach** dem Sieb: was hier ankommt, ist schon das, was der
 * Betrachter sehen darf, samt Deckname statt Name.
 */
import { INSTANCE_RELATION } from './instance.js';
import { LAYER_RELATION } from './visibility.js';
import type { Entity, Registry } from './types.js';

/** Diese Karten gehen ganz mit; sie sind klein und tragen, wonach gesucht wird. */
const GANZE_KARTEN = ['Identity', 'Tags', 'Status', 'Source'];
/** Diese Kanten gehen mit; alle anderen fragt erst der geöffnete Artikel. */
const KANTEN = [INSTANCE_RELATION, LAYER_RELATION];

/** Die Felder, nach denen irgendeine Auswahl filtert (`enumWhere`). */
export function summaryFields(registry: Pick<Registry, 'interfaces'>): Set<string> {
  const felder = new Set<string>();
  for (const def of Object.values(registry.interfaces ?? {})) {
    for (const prop of Object.values(def.schema?.properties ?? {})) {
      for (const filter of Object.values(prop.enumWhere ?? {})) {
        for (const feld of Object.keys(filter ?? {})) felder.add(feld);
      }
    }
  }
  return felder;
}

export function summaryOf(entity: Entity, felder: Set<string>): Entity {
  const components: Record<string, Record<string, unknown>> = {};
  for (const [typ, karte] of Object.entries(entity.components ?? {})) {
    if (!karte) continue;
    if (GANZE_KARTEN.includes(typ)) {
      components[typ] = karte;
      continue;
    }
    for (const [feld, wert] of Object.entries(karte)) {
      if (felder.has(feld)) (components[typ] ??= {})[feld] = wert;
    }
  }
  return {
    id: entity.id,
    interfaces: entity.interfaces,
    name: entity.name,
    components,
    relations: (entity.relations ?? []).filter((r) => KANTEN.includes(r.type)),
    ...(entity.createdAt ? { createdAt: entity.createdAt } : {}),
    ...(entity.updatedAt ? { updatedAt: entity.updatedAt } : {}),
  };
}
