/**
 * **Die Ebene eines Artikels wechseln** (T-383): im Bearbeiten steht sie
 * als erstes Feld, und gespeichert wird sie als das, was sie ist — die
 * Kante `inLayer` vom Artikel zur Ebene. Kein Feld daneben: eine zweite
 * Stelle für dieselbe Angabe liefe beim ersten Import auseinander.
 *
 * Gezählt werden nur Kanten, die etwas **bringen**; eine mit
 * `mode: 'removes'` nimmt etwas aus dem Stapel und ist keine Herkunft —
 * sie bleibt, wie sie ist, und wird in der Kantenliste bearbeitet.
 */
import type { Entity, Registry, Relation } from './types.js';
import { entityName } from './entity.js';
import { isInstance } from './instance.js';
import { isLayer } from './stack.js';
import { LAYER_RELATION } from './visibility.js';

type Kante = Pick<Relation, 'id' | 'type' | 'to'> & { props?: Record<string, unknown> };

/** Bringt diese Kante den Artikel in eine Ebene (und nimmt ihn nicht heraus)? */
export function bringsIntoLayer(r: Kante): boolean {
  return r.type === LAYER_RELATION && (r.props as { mode?: unknown } | undefined)?.mode !== 'removes';
}

/** Die Ebenen, in denen ein Artikel liegt, in der Reihenfolge seiner Kanten. */
export function homeLayers(relations: readonly Kante[] | undefined): string[] {
  const raus: string[] = [];
  for (const r of relations ?? []) if (bringsIntoLayer(r) && r.to && !raus.includes(r.to)) raus.push(r.to);
  return raus;
}

/**
 * **Die Kanten, nachdem der Artikel in `layer` liegt** — alle bringenden
 * `inLayer`-Kanten fallen weg, eine auf `layer` kommt dazu (sie behält die
 * Id der ersten, die es gab, damit ein Vergleich keine neue Kante sieht).
 * `null`: in keiner Ebene (das darf nur die Verwaltung, am Server
 * geprüft). Steht er schon genau dort, bleibt die Liste, wie sie war.
 */
export function withHomeLayer<K extends Kante>(relations: readonly K[], layer: string | null, entityId: string): (K | Kante)[] {
  const jetzt = homeLayers(relations);
  if (layer ? jetzt.length === 1 && jetzt[0] === layer : jetzt.length === 0) return [...relations];
  const erste = relations.find(bringsIntoLayer);
  const rest = relations.filter((r) => !bringsIntoLayer(r));
  if (!layer) return rest;
  return [...rest, { id: erste?.id ?? `${entityId}~${LAYER_RELATION}-1`, type: LAYER_RELATION, to: layer, props: {} }];
}

/**
 * **Was ein Schreiben an den Ebenen ändert** (T-383): welche Ebenen
 * dazukommen, welche wegfallen, und ob der Artikel danach in keiner mehr
 * liegt. Der Server prüft damit, ob das Konto in jede neue Ebene schreibt.
 * Gezählt werden auch Kanten mit `mode: 'removes'` — auch sie wirken in
 * der Ebene, auf die sie zeigen.
 */
export function layerChange(
  before: Pick<Entity, 'relations'> | null | undefined,
  after: Pick<Entity, 'relations'>,
): { added: string[]; removed: string[]; homeless: boolean } {
  const alle = (rs: readonly Kante[] | undefined) =>
    new Set((rs ?? []).filter((r) => r.type === LAYER_RELATION && r.to).map((r) => r.to));
  const vorher = alle(before?.relations);
  const nachher = alle(after.relations);
  return {
    added: [...nachher].filter((l) => !vorher.has(l)),
    removed: [...vorher].filter((l) => !nachher.has(l)),
    homeless: homeLayers(before?.relations).length > 0 && homeLayers(after.relations).length === 0,
  };
}

/* ------------------------------------------------------------------ */

/** Ein Artikel, der mit dem verschobenen mitgeht, wenn man ihn lässt (T-402, E-161). */
export interface LayerFollower {
  id: string;
  name: string;
  type: string;
  /** Über welche Kante er dranhängt: `partOf`, `belongsTo`, `carries`, `holds`. */
  via: string;
  /** An welchem Artikel des Laufs er hängt (der verschobene oder ein anderer Mitläufer). */
  of: string;
  /** Welcher der verschobenen Artikel ihn mitbringt. */
  root: string;
  layers: string[];
  /** Liegt er in einer Ebene, aus der sein Artikel kommt? Nur dann ist er vorgewählt. */
  sameLayer: boolean;
  writable: boolean;
  /** Liegt er schon in der Zielebene (und nur dort)? */
  already: boolean;
  preselected: boolean;
  /** Wo er sonst noch verknüpft ist — Kanten und `[[Verweise]]` von ausserhalb des Laufs. */
  linkedFrom: { id: string; name: string; via: string }[];
}

export interface LayerMovePlan {
  roots: { id: string; name: string; type: string; layers: string[] }[];
  followers: LayerFollower[];
}

const nameOf = (e: Entity): string => entityName(e) || e.id;

/** Alle `[[Ziel` in den Texten eines Artikels — Id oder Nummer, ohne Anzeige und Anker. */
function textZiele(wert: unknown, raus: Set<string>): void {
  if (typeof wert === 'string') {
    if (!wert.includes('[[')) return;
    for (const m of wert.matchAll(/\[\[([^\]|#]+)/g)) raus.add(m[1]!.trim().toLowerCase());
  } else if (Array.isArray(wert)) for (const w of wert) textZiele(w, raus);
  else if (wert && typeof wert === 'object') for (const w of Object.values(wert)) textZiele(w, raus);
}

/**
 * **Was mit einem Artikel in eine andere Ebene geht** (T-402, E-161 a+c):
 * seine Teile (`partOf`, auch Teile von Teilen), sein eigener Statblock
 * oder dessen Instanz (eine Kante mit `asField: 'to'`), sein Inventar
 * (`asField: 'from'`) und die Stücke darin (`holds` auf eine Instanz; ein
 * Grundartikel im Inventar steht für sich). Vorgewählt ist ein Mitläufer,
 * wenn er in einer Ebene liegt, aus der sein Artikel kommt (`from`, sonst
 * die heutigen), das Konto ihn schreibt und er nicht schon im Ziel liegt.
 * Je Mitläufer steht, wo er sonst noch verknüpft ist — die Leitung soll
 * sehen, dass ein Teil auch in einem anderen Kapitel steht, bevor sie ihn
 * mitnimmt. Ebenen gehen nie mit: eine Ebene, die in einer Gruppe hängt,
 * ist kein Kapitel.
 */
export function layerMovePlan(
  registry: Pick<Registry, 'relations'>,
  raw: ReadonlyMap<string, Entity>,
  ids: readonly string[],
  opts: { layer: string | null; from?: readonly string[]; mayWrite?: (id: string) => boolean },
): LayerMovePlan {
  const anArt = new Set<string>();
  const traegtArt = new Set<string>();
  for (const r of Object.values(registry.relations ?? {})) {
    if (r.asField === 'to') anArt.add(r.type);
    if (r.asField === 'from') traegtArt.add(r.type);
  }
  /* Rückwärts einmal: wer hängt an wem (Teile, Statblöcke). */
  const daran = new Map<string, { von: string; via: string }[]>();
  for (const e of raw.values()) {
    if (isLayer(e)) continue;
    for (const r of e.relations ?? []) {
      if (r.type !== 'partOf' && !anArt.has(r.type)) continue;
      (daran.get(r.to) ?? daran.set(r.to, []).get(r.to)!).push({ von: e.id, via: r.type });
    }
  }
  const roots = ids.map((id) => raw.get(id)).filter((e): e is Entity => !!e);
  const lauf = new Set(roots.map((e) => e.id));
  const followers: LayerFollower[] = [];
  for (const root of roots) {
    const alt = new Set(opts.from?.length ? opts.from : homeLayers(root.relations));
    const offen = [root.id];
    while (offen.length) {
      const hier = raw.get(offen.shift()!);
      if (!hier) continue;
      const dazu: { id: string; via: string }[] = (daran.get(hier.id) ?? []).map((x) => ({ id: x.von, via: x.via }));
      for (const r of hier.relations ?? []) {
        if (traegtArt.has(r.type)) dazu.push({ id: r.to, via: r.type });
        else if (r.type === 'holds' && raw.get(r.to) && isInstance(raw.get(r.to)!)) dazu.push({ id: r.to, via: 'holds' });
      }
      for (const { id, via } of dazu) {
        const e = raw.get(id);
        if (!e || lauf.has(id) || isLayer(e)) continue;
        lauf.add(id);
        offen.push(id);
        const layers = homeLayers(e.relations);
        const sameLayer = layers.some((l) => alt.has(l));
        const writable = opts.mayWrite ? opts.mayWrite(id) : true;
        const already = opts.layer ? layers.length === 1 && layers[0] === opts.layer : layers.length === 0;
        followers.push({
          id, name: nameOf(e), type: e.interfaces?.[0] ?? '', via, of: hier.id, root: root.id,
          layers, sameLayer, writable, already, preselected: sameLayer && writable && !already, linkedFrom: [],
        });
      }
    }
  }
  /* Wo die Mitläufer sonst noch hängen — ein Durchgang über den Bestand. */
  const gesucht = new Map<string, LayerFollower>();
  for (const f of followers) {
    gesucht.set(f.id.toLowerCase(), f);
    const nr = raw.get(f.id)?.components?.['Identity']?.['id'];
    if (typeof nr === 'string' && nr) gesucht.set(nr.toLowerCase(), f);
  }
  if (gesucht.size) {
    for (const e of raw.values()) {
      if (lauf.has(e.id) || isLayer(e)) continue;
      const treffer = new Map<LayerFollower, string>();
      for (const r of e.relations ?? []) {
        const f = gesucht.get(r.to.toLowerCase());
        if (f && f.id === r.to && !treffer.has(f)) treffer.set(f, r.type);
      }
      const ziele = new Set<string>();
      textZiele(e.components, ziele);
      for (const z of ziele) {
        const f = gesucht.get(z);
        if (f && !treffer.has(f)) treffer.set(f, 'text');
      }
      for (const [f, via] of treffer) f.linkedFrom.push({ id: e.id, name: nameOf(e), via });
    }
  }
  return {
    roots: roots.map((e) => ({ id: e.id, name: nameOf(e), type: e.interfaces?.[0] ?? '', layers: homeLayers(e.relations) })),
    followers,
  };
}

/**
 * **Die Änderungen eines Ebenenwechsels** (T-402): jeder genannte Artikel
 * liegt danach in `layer` und nur dort (`withHomeLayer`); was schon dort
 * liegt oder fehlt, fällt weg. Fassungen und übrige Kanten bleiben.
 */
export function layerMoveChanges(
  raw: ReadonlyMap<string, Entity>,
  ids: readonly string[],
  layer: string | null,
): { id: string; before: Entity; after: Entity }[] {
  const raus: { id: string; before: Entity; after: Entity }[] = [];
  for (const id of new Set(ids)) {
    const e = raw.get(id);
    if (!e) continue;
    const relations = withHomeLayer(e.relations ?? [], layer, e.id) as Entity['relations'];
    if (relations === e.relations || JSON.stringify(relations) === JSON.stringify(e.relations ?? [])) continue;
    raus.push({ id, before: e, after: { ...e, relations } });
  }
  return raus;
}
