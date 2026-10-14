import { choicesOf, type Entity } from '@nw/model';

/**
 * **Ein Eintrag je Klasse** (T-095, REQ-238). Gespeichert bleibt, was das
 * Modell sagt: die Kante `hasClass` mit Stufe und Unterklasse und je
 * Antwort eine Kante `chose` (C6). Gezeigt wird aber eins — „Barbarian,
 * Stufe 3, Path of the Berserker" mit den Fertigkeiten, die sie dafür
 * gewählt hat —, denn als zwei Zeilen nebeneinander las sich die Antwort
 * wie eine eigene Sache, und bei zwei Klassen war nicht mehr zu sehen,
 * welche Wahl zu welcher gehört. Dasselbe gilt für Abstammung und
 * Hintergrund.
 */

/** Die Kanten, an denen Antworten hängen. */
export const EINTRAG_KANTEN: readonly string[] = ['hasClass', 'hasAncestry', 'hasBackground'];

/** Was hier von einer Kante gebraucht wird — gespeichert oder im Entwurf. */
export interface KantenStueck {
  id: string;
  type: string;
  to: string;
  props?: Record<string, unknown>;
}

/**
 * **Zu welchem Eintrag eine Antwort gehört**: Antwort-Kante → Eintrags-Kante.
 * Eine Antwort gehört zur Klasse, wenn die Klasse oder ihre Unterklasse
 * fragt, zu Abstammung oder Hintergrund, wenn die fragen; ein gewähltes
 * Talent, das selbst wieder fragt, gehört dahin, wo es gewählt wurde. Was
 * keiner Quelle der Figur gehört (verwaist, `orphanAnswers`), bleibt eine
 * eigene Zeile — verschwiegen wäre es verloren.
 */
export function antwortenJeEintrag(kanten: readonly KantenStueck[]): Map<string, string> {
  const eigner = new Map<string, string>();
  for (const k of kanten) {
    if (!EINTRAG_KANTEN.includes(k.type) || !k.to) continue;
    if (!eigner.has(k.to)) eigner.set(k.to, k.id);
    const sub = k.props?.['subclass'];
    if (k.type === 'hasClass' && typeof sub === 'string' && sub && !eigner.has(sub)) eigner.set(sub, k.id);
  }
  const raus = new Map<string, string>();
  const antworten = kanten.filter((k) => k.type === 'chose');
  for (let neu = true; neu; ) {
    neu = false;
    for (const a of antworten) {
      const zu = eigner.get(a.to);
      if (raus.has(a.id) || !zu) continue;
      raus.set(a.id, zu);
      neu = true;
      /* Was diese Antwort wählt, fragt vielleicht selbst (ein Talent). */
      const picks = Array.isArray(a.props?.['picks']) ? (a.props['picks'] as unknown[]) : [];
      for (const p of picks) if (typeof p === 'string' && !eigner.has(p)) eigner.set(p, zu);
    }
  }
  return raus;
}

/** Die Sorten einer Wahl, deren Antwort Artikel-Ids hält. */
const ARTIKEL = new Set(['feat', 'spell', 'feature', 'subclass']);

/**
 * **Wie eine Antwort heisst und was sie sagt** — aus der Wahl am fragenden
 * Artikel, wenn er da ist: ihre Notiz, wenn sie kurz ist, sonst die Liste,
 * aus der sie zieht („Languages"), sonst die Id als Wort
 * („martial-archetype" → „Martial archetype"); Ids als Namen, ein
 * Schlüssel als seine Beschriftung.
 */
export function antwortText(
  quelle: Entity | undefined,
  choice: string,
  picks: readonly string[],
  name: (id: string) => string | undefined,
): { label: string; text: string } {
  const c = choicesOf(quelle).find((x) => x.id === choice);
  const wort = choice.replace(/[-_]+/g, ' ').replace(/\s+\d+$/, '').trim();
  /* Woraus gewählt wird, sagt mehr als eine lange Notiz: „Languages". */
  const liste = [...(c?.from?.enumRef ?? []), ...(c?.from?.interfaces ?? [])];
  const label =
    c?.note && c.note.length <= 24
      ? c.note
      : liste.length === 1 && c?.kind !== 'subclass'
        ? `${liste[0]!.replace(/([a-z])([A-Z])/g, '$1 $2')}s`
        : wort.charAt(0).toUpperCase() + wort.slice(1);
  const artikel = !!c && (ARTIKEL.has(String(c.kind)) || !!c.from?.interfaces?.length);
  const text = picks
    .map((p) => {
      const opt = c?.from?.options?.find((o) => o.key === p);
      if (opt) return `(${opt.key}) ${opt.label}`;
      if (c?.kind === 'ability') return p.toUpperCase();
      return artikel || !c ? (name(p) ?? p) : p;
    })
    .join(', ');
  return { label, text };
}
