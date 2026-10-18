/**
 * **Die eigene Kampagne als Datei** (T-077, REQ-029, REQ-155, REQ-199):
 * die Leitung lädt ihre Kampagne jederzeit herunter, unabhängig von den
 * Sicherungen des Servers. Das Format ist das, das `import.ts` liest —
 * `format`, `registry`, `entities` —, also kommt dieselbe Datei auf
 * demselben Weg zurück.
 *
 * **Was hineingeht.** Das Register, ganz: es sind die Regeln, nach denen
 * die Artikel gelesen werden, und ohne sie ist die Datei ein Haufen Karten.
 * Dazu die Artikel, die zur Kampagne gehören:
 *
 *  - jeder Artikel mit einer Ebenenkante (auch `mode: 'removes'`) auf eine
 *    **Kampagnenebene** — eine Ebene, die diese Kampagne aufschaltet und
 *    keine andere (die Regel aus CLAUDE.md, „die Ebene sagt wessen") und
 *    die kein Regelwerk ist (`Layer.kind` nicht `system`/`expansion`/`book`).
 *    Ein Regelwerk, das nur diese Runde aufschaltet, gehört ihr zwar, ist
 *    aber nicht ihre Arbeit: 5e.tools kommt aus seiner eigenen Pipeline
 *    zurück und machte die Datei hundertmal so gross. `kind` entscheidet
 *    hier nur, was in der Datei steht, nicht, wer etwas sieht — ein
 *    Tippfehler macht sie grösser oder kleiner, aber lässt nichts durch;
 *    gesiebt wird unten trotzdem.
 *  - jeder Artikel **ohne** Ebenenkante (E1: er gilt in jeder Kampagne),
 *    ausser den anderen Kampagnen und den Ebenen, die diese Kampagne nicht
 *    aufschaltet. Die aufgeschalteten Ebenen gehen als Artikel mit, auch
 *    die geteilten: sonst zeigte `activates` an der Kampagne ins Leere.
 *
 * Mit `all` (nur die Verwaltung): jeder Artikel, auch 5e.tools.
 *
 * **Was nicht hineingeht:** Konten, Sitzungen, Tokens, Einladungen und die
 * Rollen am Tisch (`members`, REQ-199). Die stehen in eigenen Tabellen und
 * nie in einem Artikel; hier wird nur aus Register und Artikeln gelesen,
 * also kann keins davon hineinrutschen.
 *
 * **Gesiebt nach dem Recht des Aufrufers:** die Verwaltung bekommt alles,
 * die Leitung, was sie sieht (`articleVisible`). Felder werden nicht
 * gekürzt — die Ausfuhr ist auf die Leitung beschränkt, und die Felder der
 * Leitung (`gmFields`) sind ihre. Eine Sicherung, der die Geheimnisse
 * fehlen, wäre keine.
 *
 * **Die Bilder stehen als Liste darin** (`files`, T-114), nicht als
 * Dateien: je Asset der Ablageschlüssel, die Grösse und der Medientyp. Die
 * Dateien selbst liegen in der Sicherung des Servers (`daten/bilder`,
 * `backups/bilder`); eine JSON-Datei mit dreissig Karten zu je 20 MB wäre
 * keine, die jemand herunterlädt. Mit der Liste lässt sich prüfen, ob nach
 * dem Zurückspielen jede Datei da ist.
 *
 * **Gespeichert, nicht gelesen:** eine Instanz geht so hinaus, wie sie
 * liegt (nur, was abweicht), nicht aufgelöst — sonst schriebe die Einfuhr
 * jedes Feld der Vorlage in sie hinein.
 */

import {
  ACTIVATES_RELATION,
  isCompareEdge,
  isOffEdge,
  CAMPAIGN_TYPE,
  LAYER_COMPONENT,
  LAYER_RELATION,
  articleVisible,
  campaignVisibility,
  entityName,
} from '@nw/model';
import type { Entity, Registry } from '@nw/model';
import type { User } from './auth.js';

/** Ebenenarten, die ein Regelwerk sind und nicht die Arbeit einer Runde. */
/* Ein Abenteuer aus 5e.tools (T-082) ist Buchtext wie ein Buch: was die
   Runde daraus macht, liegt als Fassung in ihrer eigenen Ebene (E-018). */
/* Eine Gruppe (T-088) enthält Ebenen und keine Artikel — keine Kampagnenebene. */
const REGELWERK = new Set(['system', 'expansion', 'book', 'adventure', 'group']);

export interface Ausfuhr {
  format: 'nebelwacht/1';
  at: string;
  campaign: { id: string; name: string };
  /** `campaign`: nur die eigenen Ebenen; `all`: der ganze Bestand. */
  layers: 'campaign' | 'all';
  registry: Registry & { components: Registry['interfaces'] };
  entities: Entity[];
  /** Die Dateien der Bilder in dieser Ausfuhr (T-114) — nur genannt. */
  files: AusfuhrDatei[];
}

export interface AusfuhrDatei {
  asset: string;
  ref: string;
  mime?: string;
  bytes?: number;
}

/** Die Bilder unter diesen Artikeln, die in der Ablage liegen (`backend: app`). */
function dateienVon(entities: Entity[]): AusfuhrDatei[] {
  const raus: AusfuhrDatei[] = [];
  for (const e of entities) {
    const a = e.components?.['Asset'] as { backend?: unknown; ref?: unknown; mime?: unknown; bytes?: unknown } | undefined;
    if (!a || typeof a.ref !== 'string' || (a.backend ?? 'app') !== 'app') continue;
    raus.push({
      asset: e.id,
      ref: a.ref,
      ...(typeof a.mime === 'string' ? { mime: a.mime } : {}),
      ...(typeof a.bytes === 'number' ? { bytes: a.bytes } : {}),
    });
  }
  return raus;
}

const art = (e: Entity): string => (e.interfaces ?? [])[0] ?? '';

/** Die Ebenen, die diese Kampagne aufschaltet. */
function aufgeschaltet(kampagne: Entity): Set<string> {
  /* Vergleichsebenen (T-092) und abgeschaltete (T-088) gehören nicht dazu: sie sind nicht im Spiel. */
  return new Set(
    (kampagne.relations ?? [])
      .filter((r) => r.type === ACTIVATES_RELATION && !isCompareEdge(r) && !isOffEdge(r))
      .map((r) => r.to),
  );
}

/** Die Kampagnenebenen: von dieser Kampagne aufgeschaltet, von keiner anderen, kein Regelwerk. */
export function kampagnenEbenen(alle: Map<string, Entity>, kampagne: Entity): Set<string> {
  const fremd = new Set<string>();
  for (const e of alle.values()) {
    if (art(e) !== CAMPAIGN_TYPE || e.id === kampagne.id) continue;
    for (const id of aufgeschaltet(e)) fremd.add(id);
  }
  const out = new Set<string>();
  for (const id of aufgeschaltet(kampagne)) {
    const ebene = alle.get(id);
    if (!ebene || fremd.has(id)) continue;
    const kind = (ebene.components?.[LAYER_COMPONENT] as { kind?: unknown } | undefined)?.kind;
    if (typeof kind === 'string' && REGELWERK.has(kind)) continue;
    out.add(id);
  }
  return out;
}

/** Gehört der Artikel in die Ausfuhr dieser Kampagne (ohne `all`)? */
function gehoertDazu(e: Entity, kampagne: Entity, eigene: Set<string>, an: Set<string>): boolean {
  const ebenen = (e.relations ?? []).filter((r) => r.type === LAYER_RELATION).map((r) => r.to);
  if (ebenen.length) return ebenen.some((id) => eigene.has(id));
  if (art(e) === CAMPAIGN_TYPE) return e.id === kampagne.id;
  if (art(e) === 'Layer') return an.has(e.id);
  return true;
}

export function kampagnenAusfuhr(
  alle: Entity[],
  registry: Registry,
  kampagne: Entity,
  optionen: { all?: boolean; user: User },
): Ausfuhr {
  const karte = new Map(alle.map((e) => [e.id, e] as const));
  const eigene = kampagnenEbenen(karte, kampagne);
  const an = aufgeschaltet(kampagne);
  const auge = optionen.user.isAdmin
    ? undefined
    : (() => {
        /* Die Regeln je Gruppe dieser Kampagne gelten auch hier (T-252). */
        const campaignRules = campaignVisibility(karte, registry, kampagne);
        return { actors: optionen.user.actorIds ?? [], roles: optionen.user.roles ?? {}, ...(campaignRules ? { campaignRules } : {}) };
      })();
  const entities = alle
    .filter((e) => optionen.all || gehoertDazu(e, kampagne, eigene, an))
    .filter((e) => articleVisible(karte, e, auge))
    .sort((a, b) => a.id.localeCompare(b.id));
  return {
    format: 'nebelwacht/1',
    at: new Date().toISOString(),
    campaign: { id: kampagne.id, name: entityName(kampagne) },
    layers: optionen.all ? 'all' : 'campaign',
    /* `components` ist der zweite Name für `interfaces`, den die Einfuhr
       des Prototyps noch liest — wie in der Datei aus 5e.tools. */
    registry: { ...registry, components: registry.interfaces },
    entities,
    files: dateienVon(entities),
  };
}

/** `nebelwacht-2026-10-13.json` — der Name der Kampagne, klein und ohne Sonderzeichen. */
export function ausfuhrName(name: string, at: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'campaign'}-${at.slice(0, 10)}.json`;
}
