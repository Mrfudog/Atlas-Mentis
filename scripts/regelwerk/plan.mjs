/**
 * **Ein Regelwerk aus einer Paketdatei** (T-122) — der rechnende Teil,
 * ohne Netz und ohne Dateien, damit er sich prüfen lässt.
 *
 * Ein Paket beschreibt eine Ebene und ihre Artikel in der Sprache des
 * Registers: Art, Name, Felder als `Typ.feld`, Kanten nach Schlüssel. Es
 * gehört zu keinem bestimmten Buch; was ein Buch enthält, steht nur in der
 * Paketdatei, und die liegt **ausserhalb des Repositorys** (fremde Lizenz).
 *
 *   {
 *     "format": "atlas-regelwerk/1",
 *     "layer": { "name", "abbreviation", "author", "published", "version",
 *                "kind": "book", "order": 20, "publisher": "Third party" },
 *     "articles": [
 *       { "key": "r1", "type": "Recipe", "name": "…",
 *         "fields": { "Recipe.tool": "…", "Recipe.dc": 12 },
 *         "relations": [ { "type": "needs", "to": "m1", "props": { "qty": 2 } },
 *                        { "type": "yields", "to": { "name": "…", "type": "Item" } } ],
 *         "learnable": true }
 *     ]
 *   }
 *
 * `to` nennt einen Schlüssel aus dem Paket, `{ "id" }` einen Artikel auf
 * dem Server oder `{ "name", "type" }` einen, den der Server unter diesem
 * Namen kennt (ein Werkzeug aus dem Grundregelwerk). `learnable` an einem
 * Rezept legt seine **Blaupause** an: eine Information ohne Felder, über
 * `knowledge` am Rezept — die lernt man (D55). Ohne Angabe sind Rezepte
 * lernbar, denn ein Rezept, das niemand lernen kann, kann niemand.
 */

export const FORMAT = 'atlas-regelwerk/1';
export const RECIPE = 'Recipe';
export const INFORMATION = 'Information';
export const BLUEPRINT_SUFFIX = '#blueprint';

/** Die Arten, deren Felder an `type` gelten — wie `typeChain` im Modell. */
export function typeChain(registry, name) {
  const out = [];
  const seen = new Set();
  const offen = [name];
  while (offen.length) {
    const at = offen.shift();
    if (seen.has(at) || !registry.interfaces?.[at]) continue;
    seen.add(at);
    out.push(at);
    for (const p of registry.interfaces[at].extends ?? []) offen.push(p);
  }
  return out;
}

/** Passt eine Art auf eine Kantenseite (`*`, oder die `extends`-Kette hoch)? */
export function fits(registry, type, ends) {
  if (!ends || !ends.length || ends.includes('*')) return true;
  return typeChain(registry, type).some((t) => ends.includes(t));
}

/**
 * Die Artikel, die tatsächlich angelegt werden: die aus dem Paket und je
 * lernbarem Rezept seine Blaupause samt `knowledge`-Kante.
 */
export function expand(paket) {
  const out = [];
  for (const a of paket.articles ?? []) {
    const kopie = { ...a, fields: { ...(a.fields ?? {}) }, relations: [...(a.relations ?? [])] };
    out.push(kopie);
    if (a.type === RECIPE && a.learnable !== false) {
      const key = `${a.key}${BLUEPRINT_SUFFIX}`;
      kopie.relations.push({ type: 'knowledge', to: key });
      out.push({
        key,
        type: INFORMATION,
        name: `Blueprint: ${a.name}`,
        fields: { 'Information.fields': [], 'Information.tier': 'secret' },
        relations: [],
      });
    }
  }
  return out;
}

/** Wohin eine Kante zeigt, in einer Form: `{ key }`, `{ id }` oder `{ name, type }`. */
export function target(to) {
  if (typeof to === 'string') return { key: to };
  if (to && typeof to === 'object') {
    if (typeof to.id === 'string') return { id: to.id };
    if (typeof to.name === 'string') return { name: to.name, type: typeof to.type === 'string' ? to.type : undefined };
  }
  return null;
}

/**
 * Prüft ein Paket gegen das Register, bevor irgendetwas geschrieben wird.
 * Fehler halten den Lauf an; Hinweise nicht. Die Meldungen nennen
 * Schlüssel, Art und Feld — nie den Text eines Artikels.
 */
export function check(paket, registry) {
  const fehler = [];
  const hinweise = [];
  if (paket?.format !== FORMAT) fehler.push(`format: expected "${FORMAT}"`);
  if (!paket?.layer?.name) fehler.push('layer.name is missing');
  const artikel = expand(paket ?? {});
  const typVon = new Map();
  for (const a of artikel) {
    const wo = `${a.key ?? '?'} (${a.type ?? '?'})`;
    if (!a.key || typeof a.key !== 'string') fehler.push(`${wo}: key is missing`);
    else if (typVon.has(a.key)) fehler.push(`${wo}: key is used twice`);
    else typVon.set(a.key, a.type);
    const def = registry.interfaces?.[a.type];
    if (!def) {
      fehler.push(`${wo}: no such type`);
      continue;
    }
    if (def.abstract) fehler.push(`${wo}: type cannot be created`);
    if (!a.name || typeof a.name !== 'string') fehler.push(`${wo}: name is missing`);
    const kette = typeChain(registry, a.type);
    for (const ref of Object.keys(a.fields ?? {})) {
      const [t, k] = ref.split('.');
      if (!t || !k || !kette.includes(t)) fehler.push(`${wo}: field ${ref} does not belong to this type`);
      else if (!registry.interfaces[t]?.schema?.properties?.[k]) fehler.push(`${wo}: field ${ref} does not exist`);
      else if (registry.interfaces[t].schema.properties[k].derived) fehler.push(`${wo}: field ${ref} is derived and takes no value`);
    }
  }
  for (const a of artikel) {
    if (!registry.interfaces?.[a.type]) continue;
    const wo = `${a.key} (${a.type})`;
    for (const r of a.relations ?? []) {
      const def = registry.relations?.[r.type];
      if (!def) {
        fehler.push(`${wo}: no such edge ${r.type}`);
        continue;
      }
      if (!fits(registry, a.type, def.from)) fehler.push(`${wo}: ${r.type} does not start at this type`);
      const z = target(r.to);
      if (!z) fehler.push(`${wo}: ${r.type} has no target`);
      else if (z.key !== undefined) {
        if (!typVon.has(z.key)) fehler.push(`${wo}: ${r.type} points to unknown key ${z.key}`);
        else if (!fits(registry, typVon.get(z.key), def.to)) fehler.push(`${wo}: ${r.type} may not point to a ${typVon.get(z.key)}`);
      } else if (z.type && !fits(registry, z.type, def.to)) {
        fehler.push(`${wo}: ${r.type} may not point to a ${z.type}`);
      }
      for (const p of Object.keys(r.props ?? {})) {
        if (!def.props?.properties?.[p]) fehler.push(`${wo}: ${r.type} has no property ${p}`);
      }
    }
  }
  const zaehlung = {};
  for (const a of artikel) zaehlung[a.type] = (zaehlung[a.type] ?? 0) + 1;
  if (!artikel.length) hinweise.push('the package has no articles');
  return { fehler, hinweise, zaehlung, artikel };
}

/**
 * Die Karten eines Artikels: die Vorgaben seiner Art, darüber die Felder
 * aus dem Paket — dieselbe Regel wie beim Anlegen am Server. `Identity`
 * bleibt, wie sie am Server steht (Name und Nummer vergibt er).
 */
export function components(registry, a, vorher = {}) {
  const out = {};
  for (const t of typeChain(registry, a.type)) {
    const schema = registry.interfaces[t]?.schema;
    if (!schema) continue;
    const karte = {};
    for (const [k, p] of Object.entries(schema.properties ?? {})) {
      if (!p.derived && p.default !== undefined) karte[k] = JSON.parse(JSON.stringify(p.default));
    }
    if (Object.keys(karte).length || (schema.required ?? []).length) out[t] = karte;
  }
  for (const [ref, wert] of Object.entries(a.fields ?? {})) {
    const [t, k] = ref.split('.');
    if (wert === undefined || wert === null || wert === '') continue;
    (out[t] ??= {})[k] = wert;
  }
  if (vorher.Identity) out.Identity = { ...vorher.Identity, name: a.name };
  return out;
}

/**
 * Die Kanten eines Artikels mit aufgelösten Zielen. `ids`: Schlüssel →
 * Server-Id; `fremd`: `name|type` → Server-Id. Eine Kante, die es am
 * Server schon gab, behält ihre Id — so bleibt ein zweiter Lauf ruhig.
 */
export function relations(a, { ids, fremd, layerId, vorher = [] }) {
  const out = [];
  const offen = [];
  for (const r of a.relations ?? []) {
    const z = target(r.to);
    const to = z?.id ?? (z?.key !== undefined ? ids.get(z.key) : fremd.get(`${z?.name}|${z?.type ?? ''}`.toLowerCase()));
    if (!to) {
      offen.push(r);
      continue;
    }
    out.push({ type: r.type, to, props: r.props ?? {} });
  }
  if (layerId) out.push({ type: 'inLayer', to: layerId, props: {} });
  const genutzt = new Set();
  const mitId = out.map((r) => {
    const alt = vorher.find((v) => v.type === r.type && v.to === r.to && !genutzt.has(v.id));
    if (alt) genutzt.add(alt.id);
    return alt ? { ...r, id: alt.id } : r;
  });
  return { relations: mitId, offen };
}

/** Die externen Ziele (`{ name, type }`), die der Server auflösen muss. */
export function externalTargets(artikel) {
  const out = new Map();
  for (const a of artikel) {
    for (const r of a.relations ?? []) {
      const z = target(r.to);
      if (z?.name !== undefined) out.set(`${z.name}|${z.type ?? ''}`.toLowerCase(), z);
    }
  }
  return [...out.values()];
}
