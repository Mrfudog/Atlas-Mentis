/**
 * Was das Register über seine Zeilen wissen muss, ohne etwas zu zeichnen —
 * die Feldarten, Zyklen, Verweise. Rein, damit es ohne DOM prüfbar ist.
 *
 * Fachliche Vorlage ist das Register des Prototyps
 * (`prototype/nebelwacht-artikel.html`: `FIELD_KINDS`, `fieldKind`,
 * `setFieldKind`, `wouldCycle`, `techName`).
 */

import { enumRefKind, typeChain } from '@nw/model';
import type { InterfaceDef, PropertySchema, Registry } from '@nw/model';

/* ---------- Feldarten ----------
   Ein Feld trägt einen JSON-Schema-`type`, aber die Maske braucht eine
   feinere Unterscheidung: eine Farbe, eine feste Wahl und ein Verweis sind
   auf der Leitung alles Text und in einer Maske nichts davon. `format` und
   `enum`/`enumRef` tragen das; `fieldKind` liest es zurück, damit das
   Register gewöhnliches JSON Schema bleibt. */
export const FIELD_KINDS: readonly (readonly [string, string])[] = [
  ['text', 'Text'],
  ['number', 'Number'],
  ['boolean', 'Yes/No'],
  ['choice', 'Choice'],
  ['choices', 'Several choices'],
  ['color', 'Colour'],
  ['link', 'Link to article'],
  ['links', 'Links to articles'],
  ['asset', 'Image / asset'],
  ['date', 'World date'],
  ['grid', 'Painted grid'],
  ['zones', 'Zones on a grid'],
  ['list', 'List'],
  ['object', 'Object'],
];

export function fieldKind(p: PropertySchema | undefined): string {
  if (!p) return 'text';
  if (p.format === 'color') return 'color';
  if (p.format === 'link') return p.type === 'array' ? 'links' : 'link';
  if (p.format === 'asset') return 'asset';
  if (p.format === 'date') return 'date';
  if (p.format === 'grid') return 'grid';
  if (p.format === 'zones') return 'zones';
  if (p.type === 'array' && (Array.isArray(p.enum) || p.enumRef)) return 'choices';
  if (Array.isArray(p.enum) || p.enumRef) return 'choice';
  if (p.type === 'number' || p.type === 'integer') return 'number';
  if (p.type === 'boolean') return 'boolean';
  if (p.type === 'array') return 'list';
  if (p.type === 'object') return 'object';
  return 'text';
}

/** Die Formate, die eine Feldart festlegen — ein Wechsel nimmt sie mit. */
const ART_FORMATE = new Set(['color', 'link', 'asset', 'date', 'measure', 'grid', 'zones']);

/**
 * Eine andere Feldart: nur die Angaben, die die Art ausmachen, werden neu
 * gesetzt — Beschriftung, Rechnung und Pflicht überstehen den Wechsel.
 * Gibt ein neues Feld zurück; das alte bleibt unberührt.
 */
export function setFieldKind(alt: PropertySchema, kind: string): PropertySchema {
  const p: PropertySchema = { ...alt };
  delete p.enum;
  /* Auch die Nennung: ein Feld, das keine Auswahl mehr ist, darf keine
     Liste mehr nennen — sonst käme sie beim nächsten Wechsel zurück. */
  delete p.enumRef;
  delete p.enumWhere;
  delete p.items;
  delete p.target;
  if (p.format && ART_FORMATE.has(p.format)) delete p.format;
  switch (kind) {
    case 'number': p.type = 'number'; break;
    case 'boolean': p.type = 'boolean'; break;
    case 'list': p.type = 'array'; break;
    case 'object': p.type = 'object'; break;
    case 'choice': p.type = 'string'; p.enum = []; break;
    /* Mehrere Werte aus einer Liste: die Werte kommen aus einer Zeile,
       und die wählt man gleich darunter. */
    case 'choices': p.type = 'array'; p.items = { type: 'string' }; p.enum = []; break;
    case 'color': p.type = 'string'; p.format = 'color'; break;
    case 'asset': p.type = 'string'; p.format = 'asset'; break;
    case 'date': p.type = 'string'; p.format = 'date'; break;
    case 'link': p.type = 'string'; p.format = 'link'; p.target = {}; break;
    case 'links': p.type = 'array'; p.format = 'link'; p.items = { type: 'string' }; p.target = {}; break;
    case 'grid': p.type = 'array'; p.format = 'grid'; p.items = { type: 'string' }; break;
    case 'zones': p.type = 'object'; p.format = 'zones'; break;
    default: p.type = 'string';
  }
  return p;
}

export function enumRefs(p: Pick<PropertySchema, 'enumRef'> | undefined): string[] {
  const r = p?.enumRef;
  return r ? (Array.isArray(r) ? r : [r]) : [];
}

/** Was ein Feld hält, in einer Zeile — die Spalte „Holds". */
export function holds(registry: Pick<Registry, 'enums' | 'interfaces'>, p: PropertySchema): string {
  if (p.derived) return `derived · ${p.derived}`;
  const art = FIELD_KINDS.find(([k]) => k === fieldKind(p))?.[1] ?? 'Text';
  const teile: string[] = [art.toLowerCase()];
  if (p.enum?.length) teile.push(p.enum.slice(0, 5).join(' · ') + (p.enum.length > 5 ? ' …' : ''));
  for (const n of enumRefs(p)) teile.push(`from ${registry.enums?.[n]?.label ?? registry.interfaces[n]?.label ?? n}`);
  if (p.target?.interfaces?.length) teile.push(`→ ${p.target.interfaces.join(', ')}`);
  if (typeof p.min === 'number' || typeof p.max === 'number') teile.push(`${p.min ?? '…'}–${p.max ?? '…'}`);
  if (p.format === 'long') teile.push('long');
  if (p.format === 'signed') teile.push('signed');
  if (p.format === 'measure') teile.push('measure');
  if (p.unit) teile.push(p.unit);
  if (p.many) teile.push('many');
  if (p.suggest) teile.push('suggests');
  if (p.alwaysEdit) teile.push('always an input');
  if (p.readOnly) teile.push('issued');
  return teile.join(' · ');
}

/* ---------- Typen ---------- */

/** Die direkten Obertypen. */
export function parentsOf(registry: Pick<Registry, 'interfaces'>, name: string): string[] {
  return registry.interfaces[name]?.extends ?? [];
}

/** Alle Obertypen, ohne den Typ selbst — die Reihenfolge von `typeChain`. */
export function ancestorsOf(registry: Pick<Registry, 'interfaces'>, name: string): string[] {
  return typeChain(registry, name).filter((t) => t !== name);
}

/** Alle Arten, die diesen Typ nehmen — direkt oder über einen anderen. */
export function takersOf(registry: Pick<Registry, 'interfaces'>, name: string): string[] {
  return Object.keys(registry.interfaces)
    .filter((n) => n !== name && typeChain(registry, n).includes(name))
    .sort();
}

/** Die Arten, die ihn direkt in `extends` nennen. */
export function childrenOf(registry: Pick<Registry, 'interfaces'>, name: string): string[] {
  return Object.keys(registry.interfaces)
    .filter((n) => parentsOf(registry, n).includes(name))
    .sort();
}

/** Nähme `name` den Typ `parent` dazu, drehte sich die Kette im Kreis? */
export function wouldCycle(registry: Pick<Registry, 'interfaces'>, name: string, parent: string): boolean {
  return parent === name || typeChain(registry, parent).includes(name);
}

/**
 * Über welchen direkten Obertyp ein geerbter hereinkommt — `null`, wenn er
 * direkt dazugenommen ist. Nur der direkte lässt sich hier herausnehmen.
 */
export function viaOf(registry: Pick<Registry, 'interfaces'>, name: string, ancestor: string): string | null {
  const direkt = parentsOf(registry, name);
  if (direkt.includes(ancestor)) return null;
  return direkt.find((p) => typeChain(registry, p).includes(ancestor)) ?? null;
}

/**
 * Welche Typen aus der Kette fielen, nähme `name` den Obertyp `parent`
 * heraus — die Karten davon wären danach an keinem seiner Artikel mehr
 * erlaubt (`card_not_inherited`).
 */
export function droppedBy(registry: Pick<Registry, 'interfaces'>, name: string, parent: string): string[] {
  const vorher = typeChain(registry, name);
  const def = registry.interfaces[name];
  if (!def) return [];
  const ohne: Pick<Registry, 'interfaces'> = {
    interfaces: { ...registry.interfaces, [name]: { ...def, extends: parentsOf(registry, name).filter((p) => p !== parent) } },
  };
  const nachher = new Set(typeChain(ohne, name));
  return vorher.filter((t) => !nachher.has(t));
}

/** Ein Name für eine neue Zeile aus ihrer Beschriftung: `Sky ship` → `SkyShip`. */
export function techName(label: string, taken: Record<string, unknown>, klein = false): string {
  const wort = label
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9 ]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join('');
  let base = wort || 'New';
  if (/^[0-9]/.test(base)) base = `T${base}`;
  if (klein) base = base[0]!.toLowerCase() + base.slice(1);
  let n = base;
  for (let i = 2; taken[n]; i++) n = `${base}${i}`;
  return n;
}

/** Ein Feldschlüssel: Buchstaben, Ziffern, Unterstrich, nicht mit einer Ziffer vorn. */
export function fieldKey(roh: string): string {
  const k = roh.trim().replace(/[^A-Za-z0-9_]/g, '');
  return /^[0-9]/.test(k) ? `f${k}` : k;
}

/**
 * **Wer einen Typ nennt** — ausser über `extends` (das sind seine Nehmer).
 * Ein Typ, den ein Verweisfeld, eine Liste, eine Kante oder eine
 * Umbenennung nennt, lässt sich nicht still löschen: die Nennung stünde
 * danach auf etwas, das es nicht gibt.
 */
export function mentionsOf(registry: Registry, name: string): string[] {
  const out: string[] = [];
  for (const [t, def] of Object.entries(registry.interfaces)) {
    if (t === name) continue;
    for (const [k, p] of Object.entries(def.schema?.properties ?? {})) {
      if (p.target?.interfaces?.includes(name)) out.push(`field ${t}.${k} links to it`);
      if (enumRefs(p).some((r) => r === name || r.startsWith(`${name}.`))) out.push(`field ${t}.${k} takes its choices`);
      if (p.enumWhere?.[name]) out.push(`field ${t}.${k} filters it`);
    }
    if (Object.keys(def.titles ?? {}).some((r) => r.startsWith(`${name}.`))) out.push(`${t} renames one of its fields`);
  }
  for (const [r, def] of Object.entries(registry.relations)) {
    if (def.from?.includes(name) || def.to?.includes(name)) out.push(`edge ${r}`);
  }
  return out;
}

/** Die Felder, die eine Aufzählungszeile nennen (`enumRef`). */
export function enumUsers(registry: Pick<Registry, 'interfaces'>, list: string): string[] {
  const out: string[] = [];
  for (const [t, def] of Object.entries(registry.interfaces)) {
    for (const [k, p] of Object.entries(def.schema?.properties ?? {})) {
      if (enumRefs(p).includes(list)) out.push(`${t}.${k}`);
    }
  }
  return out;
}

/** Was eine Nennung in `enumRef` ist: Aufzählung, Art, Feldliste — oder nichts. */
export function refKind(registry: Pick<Registry, 'enums' | 'interfaces'>, name: string): string | null {
  return enumRefKind(registry, name) ?? null;
}

/** Ein Typ mit Schema, damit Felder dazukommen können. */
export function withSchema(def: InterfaceDef): InterfaceDef {
  return {
    ...def,
    schema: { type: 'object', ...(def.schema ?? {}), properties: { ...(def.schema?.properties ?? {}) } },
  };
}

/* ---------- Ein Feld wegnehmen, ein Feld umbenennen ----------
   Ein Feldschlüssel steht an mehr als einer Stelle: im Schema, in der
   Pflichtliste, in Rechnungen und `of` der Nachbarn, in Umbenennungen
   (`titles`) jeder Art und in den Anordnungen (`views`). Wer nur das Schema
   ändert, lässt die anderen auf einen Namen zeigen, den es nicht mehr gibt. */

type Ifs = Registry['interfaces'];

/** Wo `Typ.feld` in einem Layout genannt ist (rekursiv durch Reiter). */
function layoutNennt(layout: unknown, ref: string): boolean {
  if (!Array.isArray(layout)) return false;
  return layout.some((el: { fields?: unknown; except?: unknown; tabs?: { layout?: unknown }[] }) =>
    (Array.isArray(el?.fields) && el.fields.includes(ref))
    || (Array.isArray(el?.except) && el.except.includes(ref))
    || (el?.tabs ?? []).some((t) => layoutNennt(t?.layout, ref)));
}

function layoutUmbenennen(layout: unknown, alt: string, neu: string): void {
  if (!Array.isArray(layout)) return;
  for (const el of layout as { fields?: unknown; except?: unknown; tabs?: { layout?: unknown }[] }[]) {
    if (Array.isArray(el.fields)) el.fields = el.fields.map((x: string) => (x === alt ? neu : x));
    if (Array.isArray(el.except)) el.except = el.except.map((x: string) => (x === alt ? neu : x));
    for (const t of el.tabs ?? []) layoutUmbenennen(t.layout, alt, neu);
  }
}

/** Wer ausser dem Schema dieses Feld nennt — für die Rückfrage vor dem Löschen. */
export function fieldMentions(registry: Registry, owner: string, key: string): string[] {
  const ref = `${owner}.${key}`;
  const out: string[] = [];
  const nachbarn = registry.interfaces[owner]?.schema?.properties ?? {};
  for (const [k, p] of Object.entries(nachbarn)) {
    if (k === key) continue;
    if (p.of === key) out.push(`${k} is shown in its cell`);
    if (p.derived && new RegExp(`\\b${key}\\b`).test(p.derived)) out.push(`${k} is worked out from it`);
  }
  for (const [t, def] of Object.entries(registry.interfaces)) {
    if (def.titles?.[ref]) out.push(`${t} renames it`);
    if (Object.values(def.views ?? {}).some((l) => layoutNennt(l, ref))) out.push(`${t} arranges it in a view`);
    for (const [k, p] of Object.entries(def.schema?.properties ?? {})) {
      if (enumRefs(p).includes(ref)) out.push(`${t}.${k} takes its choices`);
    }
  }
  for (const [v, def] of Object.entries(registry.views)) {
    if (layoutNennt(def.layout, ref) || (Array.isArray(def.fields) && def.fields.includes(ref))) {
      out.push(`the view ${v} names it`);
    }
  }
  return out;
}

/** Das Feld aus dem Schema, der Pflichtliste und den Umbenennungen nehmen. */
export function removeField(ifs: Ifs, owner: string, key: string): void {
  const schema = ifs[owner]?.schema;
  if (!schema) return;
  delete schema.properties[key];
  if (schema.required) {
    schema.required = schema.required.filter((x) => x !== key);
    if (!schema.required.length) delete schema.required;
  }
  const ref = `${owner}.${key}`;
  for (const def of Object.values(ifs)) {
    if (def.titles?.[ref] !== undefined) {
      delete def.titles[ref];
      if (!Object.keys(def.titles).length) delete def.titles;
    }
  }
}

/**
 * Den Schlüssel umbenennen, wo das Register ihn nennt — Schema (in der
 * Reihenfolge), Pflicht, Rechnungen und `of` der Nachbarn, `titles` und
 * die Anordnungen aller Arten. Die Werte in den Artikeln wandern **nicht**
 * mit; darum bietet die Maske das nur an, solange keiner etwas trägt.
 * Ein Text heisst: geht nicht, und warum.
 */
export function renameField(ifs: Ifs, owner: string, alt: string, neu: string): string | void {
  const schema = ifs[owner]?.schema;
  if (!schema?.properties[alt]) return `${owner} has no field ${alt}.`;
  if (schema.properties[neu]) return `${owner} already has a field ${neu}.`;
  const props: Record<string, PropertySchema> = {};
  for (const [k, p] of Object.entries(schema.properties)) props[k === alt ? neu : k] = p;
  schema.properties = props;
  if (schema.required) schema.required = schema.required.map((x) => (x === alt ? neu : x));
  const wort = new RegExp(`\\b${alt}\\b`, 'g');
  for (const p of Object.values(props)) {
    if (p.of === alt) p.of = neu;
    if (p.derived) p.derived = p.derived.replace(wort, neu);
  }
  const vorher = `${owner}.${alt}`;
  const nachher = `${owner}.${neu}`;
  for (const def of Object.values(ifs)) {
    if (def.titles?.[vorher] !== undefined) {
      def.titles[nachher] = def.titles[vorher]!;
      delete def.titles[vorher];
    }
    for (const l of Object.values(def.views ?? {})) layoutUmbenennen(l, vorher, nachher);
    for (const p of Object.values(def.schema?.properties ?? {})) {
      const refs = enumRefs(p);
      if (refs.includes(vorher)) {
        const n = refs.map((r) => (r === vorher ? nachher : r));
        p.enumRef = n.length === 1 ? n[0]! : n;
      }
    }
  }
}
