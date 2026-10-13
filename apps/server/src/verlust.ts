/**
 * **Was ein Start löschen würde, wird vorher gezählt** (T-076, REQ-191).
 *
 * Eine Migration oder ein Seed, der Felder, Arten, Kanten oder Listenwerte
 * entfernt, liess gespeicherte Werte bisher still fallen. Jetzt zählt der
 * Start vorher, was betroffen ist; steht etwas da und ist der Schritt nicht
 * ausdrücklich freigegeben, bricht er ab und sagt, was und wie man freigibt.
 * Die Sicherung vor dem Ausrollen (`deploy.sh`, REQ-155) bleibt der Weg
 * zurück — das hier ist der, auf dem man gar nicht erst hin muss.
 *
 * Freigegeben wird je Schritt über `ATLAS_ALLOW_DATA_LOSS`, eine Liste mit
 * Kommas: der Dateiname der Migration (mit oder ohne `.sql`) oder `seed`.
 * Für genau einen Lauf gesetzt, nicht in `.env` — eine Freigabe, die stehen
 * bleibt, gibt auch den nächsten Verlust frei.
 */

import { articlesTaking, registryUsage, type RegistryUsage } from '@nw/model';
import type { Entity, Registry } from '@nw/model';

export const FREIGABE_VAR = 'ATLAS_ALLOW_DATA_LOSS';

/** Was ein Schritt entfernen würde, und wie oft es im Bestand steht. */
export interface Betroffen {
  was: string;
  anzahl: number;
}

export class DatenverlustError extends Error {
  constructor(
    readonly schritt: string,
    readonly betroffen: Betroffen[],
  ) {
    const liste = betroffen.map((b) => `  - ${b.was}: ${b.anzahl}`).join('\n');
    super(
      `${schritt} würde gespeicherte Werte entfernen:\n${liste}\n` +
        `Abgebrochen, nichts geändert. Freigeben für genau diesen Lauf mit ` +
        `${FREIGABE_VAR}=${schritt} (die Sicherung vor dem Ausrollen bleibt der Weg zurück).`,
    );
    this.name = 'DatenverlustError';
  }
}

export interface VerlustOptionen {
  /** Die Umgebung, aus der die Freigabe gelesen wird. */
  env?: NodeJS.ProcessEnv;
  /** Wohin ein freigegebener Verlust gemeldet wird. */
  log?: (meldung: string) => void;
}

function freigaben(env: NodeJS.ProcessEnv): Set<string> {
  return new Set(
    (env[FREIGABE_VAR] ?? '')
      .split(',')
      .map((s) => s.trim().replace(/\.sql$/, ''))
      .filter(Boolean),
  );
}

/**
 * Bricht ab, wenn etwas betroffen und der Schritt nicht freigegeben ist;
 * sonst meldet es den Verlust im Log. Gibt die Summe zurück.
 */
export function pruefeVerlust(
  schritt: string,
  betroffen: Betroffen[],
  { env = process.env, log = console.warn }: VerlustOptionen = {},
): number {
  const echt = betroffen.filter((b) => b.anzahl > 0);
  const summe = echt.reduce((n, b) => n + b.anzahl, 0);
  if (!summe) return 0;
  if (!freigaben(env).has(schritt.replace(/\.sql$/, ''))) {
    throw new DatenverlustError(schritt, echt);
  }
  log(
    `${schritt}: freigegebener Verlust, ${summe} Werte — ` +
      echt.map((b) => `${b.was}: ${b.anzahl}`).join(', '),
  );
  return summe;
}

/**
 * Die Prüfabfragen im Kopf einer Migration: je Zeile
 * `-- verlust: select count(*) from …`. Jede gibt eine Zahl zurück — wie
 * viele gespeicherte Werte die Migration entfernt.
 */
export function pruefabfragen(sql: string): string[] {
  const out: string[] = [];
  for (const zeile of sql.split('\n')) {
    const m = /^--\s*verlust:\s*(.+?)\s*;?\s*$/i.exec(zeile);
    if (m) out.push(m[1]!);
  }
  return out;
}

/**
 * Entfernt eine Migration etwas, das Artikel tragen können? Grob mit
 * Absicht: lieber eine Prüfabfrage zu viel verlangen als eine zu wenig.
 */
export function entferntDaten(sql: string): boolean {
  const ohneKommentare = sql.replace(/--.*$/gm, '');
  return /\bdelete\s+from\b|\bdrop\s+(table|column)\b|\btruncate\b|payload\s*-\s*'/i.test(
    ohneKommentare,
  );
}

/**
 * Was ein neuer Registerteil gegenüber dem alten wegnimmt und der Bestand
 * trägt: Arten, Felder, Werte einer Liste am Feld, Kantenarten und Werte
 * einer Aufzählungszeile. Die Artikel werden nur gelesen, wenn überhaupt
 * etwas wegfällt — der Bestand ist gross (24 157 aus 5e.tools).
 */
export async function registerVerlust<K extends keyof Registry>(
  vorher: Registry,
  part: K,
  wert: Registry[K],
  artikel: () => Promise<Entity[]>,
): Promise<Betroffen[]> {
  const nachher: Registry = { ...vorher, [part]: wert };
  const kandidaten: Array<(u: RegistryUsage) => Betroffen> = [];

  for (const [typ, def] of Object.entries(vorher.interfaces)) {
    const neu = nachher.interfaces[typ];
    if (!neu) {
      kandidaten.push((u) => ({
        was: `Art ${typ} (Artikel und Karten)`,
        anzahl: articlesTaking(vorher, u, typ) + (u.cards[typ]?.articles ?? 0),
      }));
      continue;
    }
    const neueFelder = neu.schema?.properties ?? {};
    for (const [feld, p] of Object.entries(def.schema?.properties ?? {})) {
      const q = neueFelder[feld];
      if (!q) {
        kandidaten.push((u) => ({
          was: `Feld ${typ}.${feld}`,
          anzahl: u.cards[typ]?.fields[feld] ?? 0,
        }));
        continue;
      }
      /* Eine Liste am Feld hält erst, wenn sie Wörter hat; wird sie
         gekürzt, weist die Prüfung den gestrichenen Wert beim nächsten
         Speichern ab. */
      if (p.enum?.length && q.enum?.length) {
        for (const w of p.enum.map(String).filter((w) => !q.enum!.map(String).includes(w))) {
          kandidaten.push((u) => ({
            was: `Wert ${typ}.${feld} = ${w}`,
            anzahl: u.values[`${typ}.${feld}`]?.[w] ?? 0,
          }));
        }
      }
    }
  }

  for (const typ of Object.keys(vorher.relations)) {
    if (!nachher.relations[typ]) {
      kandidaten.push((u) => ({ was: `Kantenart ${typ}`, anzahl: u.relations[typ] ?? 0 }));
    }
  }

  /* Ein Wert, der aus einer Aufzählungszeile fällt, zählt an jedem Feld,
     das die Zeile nennt. */
  for (const [name, def] of Object.entries(vorher.enums ?? {})) {
    const bleibt = new Set(nachher.enums?.[name]?.values ?? []);
    const weg = def.values.filter((v) => !bleibt.has(v));
    if (!weg.length) continue;
    const felder: string[] = [];
    for (const [typ, idef] of Object.entries(vorher.interfaces)) {
      for (const [feld, p] of Object.entries(idef.schema?.properties ?? {})) {
        const refs = Array.isArray(p.enumRef) ? p.enumRef : p.enumRef ? [p.enumRef] : [];
        if (refs.includes(name)) felder.push(`${typ}.${feld}`);
      }
    }
    for (const w of weg) {
      kandidaten.push((u) => ({
        was: `Wert ${name} = ${w}`,
        anzahl: felder.reduce((n, f) => n + (u.values[f]?.[w] ?? 0), 0),
      }));
    }
  }

  if (!kandidaten.length) return [];
  const usage = registryUsage(vorher, await artikel());
  return kandidaten.map((k) => k(usage)).filter((b) => b.anzahl > 0);
}
