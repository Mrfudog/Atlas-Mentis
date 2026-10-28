/**
 * The Validation engine.
 *
 * On write: read the asserted type, walk its chain, and check that every card
 * names a type in that chain and that every required field is filled. Strict
 * by default (D2) unless the caller opts into expert mode.
 *
 * Zod guards the shape of registry rows and entities at the storage boundary —
 * the place where a malformed document would otherwise become a silent
 * corruption that only surfaces months later.
 */

import { z } from 'zod';
import { enumHolds, enumOptions, linkAccepts, linkTargets, typeChain } from './entity.js';
import type { Entity, LayoutElement, ObjectSchema, Registry } from './types.js';

const propertyType = z.enum(['string', 'number', 'integer', 'boolean', 'array', 'object']);

/* Was ein Feld oder eine Kante zur Facette sagt (T-174). */
const facetHint = z.union([
  z.literal(false),
  z.object({ label: z.string().optional(), order: z.number().optional(), as: z.enum(['effect', 'requirement']).optional() }),
]);

/* Worauf ein Verweisfeld zeigen darf. Die Art ist die Regel, die Marken
   und der Feldwert sind Vorschläge für die Maske. */
const linkTargetSchema = z.object({
  interfaces: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  where: z
    .object({ component: z.string(), property: z.string(), value: z.unknown().optional() })
    .optional(),
});

const propertySchema = z
  .object({
    type: propertyType,
    title: z.string().optional(),
    enum: z.array(z.string()).optional(),
    /* Die Werte stehen einmal in einer Aufzählungszeile, und das Feld nennt sie. */
    enumRef: z.union([z.string(), z.array(z.string())]).optional(),
    /* Je genannter Art: welche Artikel davon in Frage kommen (M6). */
    enumWhere: z.record(z.string(), z.record(z.string(), z.array(z.string()))).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    format: z.string().optional(),
    items: z.object({ type: propertyType }).optional(),
    derived: z.string().optional(),
    of: z.string().optional(),
    unit: z.string().optional(),
    target: linkTargetSchema.optional(),
    alwaysEdit: z.boolean().optional(),
    prominent: z.boolean().optional(),
    /* Pflicht erst für einen Stand (E-177). */
    requiredFor: z.enum(['prepared', 'ready']).optional(),
    description: z.string().optional(),
    glossary: z.string().optional(),
    editOnly: z.boolean().optional(),
    suggest: z.boolean().optional(),
    many: z.boolean().optional(),
    readOnly: z.boolean().optional(),
    facet: facetHint.optional(),
    default: z.unknown().optional(),
    /* Die Form eines Eintrags in einem `many`-Feld (REQ-238). Rekursiv,
       weil ein Eintrag Felder hat und jedes davon ein Feld ist. */
    entry: z.lazy(() => objectSchema).optional(),
  })
  /* **`measure` ohne `unit` rechnet nichts.** Umgerechnet wird aus der
     gespeicherten Einheit (D8); nennt das Feld keine, sieht das Ergebnis
     aus wie „diese Zahl ist schon richtig". Genau so stand die
     Geschwindigkeit einer Kreatur jahrelang in Fuss auf einem metrischen
     Tisch, und niemand sah es dem Feld an. */
  .refine((p) => p.format !== 'measure' || typeof p.unit === 'string', {
    message: 'A measure field must name the unit its numbers are in (unit: "ft").',
    path: ['unit'],
  });

/* Rekursiv über `PropertySchema.entry` (REQ-238); der Typ steht dabei,
   weil zod eine Schleife sonst nicht ableiten kann. */
const objectSchema: z.ZodType<ObjectSchema> = z.lazy(() =>
  z.object({
    type: z.literal('object'),
    required: z.array(z.string()).optional(),
    properties: z.record(z.string(), propertySchema),
    additionalProperties: z.boolean().optional(),
  }),
);

const ViewPathStepSchema = z.object({
  relation: z.string(),
  dir: z.enum(['out', 'in']).optional(),
  type: z.string().optional(),
});

const LayoutWhenSchema = z.object({
  type: z.string().optional(),
  field: z.string().optional(),
  has: z.array(z.string()).optional(),
  empty: z.boolean().optional(),
  relation: z.string().optional(),
  incoming: z.string().optional(),
});

/* Ein Reiter enthält ein Layout, und ein Layout kann Reiter enthalten —
   also ist das Schema rekursiv. `z.lazy` ist dafür da; die Tiefe begrenzt
   niemand, weil Reiter in Reitern niemand baut und eine Grenze, die nie
   greift, nur eine Zahl ist, die jemand erklären muss. */
const LayoutElementSchema: z.ZodType<LayoutElement> = z.lazy(() =>
  z.object({
    id: z.string(),
    el: z.enum(['heading', 'text', 'fields', 'prose', 'description', 'composed', 'usedBy', 'relations', 'image', 'linked', 'knowledge', 'map', 'sheet', 'turn', 'spells', 'campaign', 'inventory', 'crafting', 'wares', 'knowledgeContents', 'board', 'initiative', 'quests', 'timeline', 'live', 'table', 'prep', 'crawl', 'stack', 'members', 'standing', 'statblock', 'spell', 'item', 'shape', 'stats', 'token', 'parts', 'rules', 'reader', 'contents', 'classOverview', 'originOverview', 'tabs', 'section', 'columns', 'tileGroup', 'carousel', 'collapsible', 'quote', 'badges', 'edgeTable', 'structure', 'collection']),
    text: z.string().optional(),
    fields: z.union([z.literal('all'), z.array(z.string())]).optional(),
    except: z.array(z.string()).optional(),
    columns: z.number().optional(),
    /* Anzeige je Art (T-184): nur, wenn der Artikel es sagt. */
    when: z
      .object({
        type: z.string().optional(),
        field: z.string().optional(),
        has: z.array(z.string()).optional(),
        empty: z.boolean().optional(),
        relation: z.string().optional(),
        incoming: z.string().optional(),
      })
      .optional(),
    /* Gestaltete Ansichten (T-268): Kinder, Pfad über Kanten, Einstellungen. */
    children: z.array(LayoutElementSchema).optional(),
    path: z.array(ViewPathStepSchema).optional(),
    props: z.array(z.string()).optional(),
    open: z.boolean().optional(),
    side: z.enum(['right', 'bottom', 'none']).optional(),
    toc: z.enum(['left', 'top', 'off']).optional(),
    /* Die Struktur (T-341): Kanten, Tiefe, Baum oder Netz. */
    edges: z.array(z.string()).optional(),
    depth: z.number().optional(),
    layout: z.enum(['tree', 'net']).optional(),
    /* Eine Sammlung (T-425): Arten, Darstellung, Ansicht je Treffer, Ordnung. */
    types: z.array(z.string()).optional(),
    show: z.enum(['tiles', 'list', 'table']).optional(),
    source: z.enum(['linked', 'filter', 'members']).optional(),
    filter: z
      .object({ tags: z.array(z.string()).optional(), fields: z.array(z.string()).optional(), q: z.string().optional() })
      .strict()
      .optional(),
    limit: z.number().int().positive().optional(),
    unranked: z.boolean().optional(),
    view: z.string().optional(),
    viewByType: z.record(z.string(), z.string()).optional(),
    sort: z.object({ by: z.string(), desc: z.boolean().optional() }).optional(),
    groupBy: z.literal('type').optional(),
    /* Die Position in einer zusammengesetzten Ansicht (T-425, E-168). */
    pos: z.number().optional(),
    style: z.object({ head: z.string().optional(), surface: z.string().optional(), frame: z.string().optional(), text: z.string().optional() }).strict().optional(),
    tabs: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
          layout: z.array(LayoutElementSchema),
        }),
      )
      .optional(),
  }),
);

/* Eine Anpassung je Art (T-110): alles nach `id` bzw. Eintrag. */
const LayoutAdjustSchema = z.object({
  drop: z.array(z.string()).optional(),
  hide: z.array(z.string()).optional(),
  add: z.record(z.string(), z.array(z.string())).optional(),
  extra: z.array(LayoutElementSchema).optional(),
  order: z.array(z.string()).optional(),
});

export const InterfaceDefSchema = z.object({
  name: z.string(),
  label: z.string().optional(),
  abstract: z.boolean().optional(),
  extends: z.array(z.string()).optional(),
  schema: objectSchema.optional(),
  area: z.enum(['world', 'story', 'rules', 'play']).optional(),
  views: z.record(z.string(), z.union([z.array(LayoutElementSchema), z.object({ adjust: LayoutAdjustSchema })])).optional(),
  units: z.enum(['imperial', 'metric', 'both']).optional(),
  /* `Typ.feld` → Beschriftung. Eine Beschriftung und keine Feldliste. */
  titles: z.record(z.string(), z.string()).optional(),
  /* `Typ.feld` oder `edge:<Art>` → Stand, ab dem es Pflicht ist (E-177). */
  requiredFor: z.record(z.string(), z.enum(['prepared', 'ready', 'none'])).optional(),
  /* `Typ.feld` → Ziel (T-119): wie `target` am Feld, nur für diese Art. */
  targets: z.record(z.string(), linkTargetSchema).optional(),
  /* Wie ein Artikel dieser Art als Marker steht (T-214). */
  markerView: z.enum(['symbol', 'name', 'image', 'card']).optional(),
});

export const EnumDefSchema = z.object({
  name: z.string(),
  label: z.string().optional(),
  values: z.array(z.string()),
});

export const UnitDefSchema = z.object({
  code: z.string(),
  label: z.string(),
  quantity: z.string(),
  system: z.enum(['imperial', 'metric']),
  base: z.number(),
  aliases: z.array(z.string()).optional(),
  decimals: z.number().optional(),
});

export const RelationDefSchema = z.object({
  type: z.string(),
  label: z.string(),
  inverseLabel: z.string(),
  /* Bedeutung und versprochene Wirkung (T-111); die heutige Wirkung wird gerechnet. */
  means: z.string().optional(),
  intended: z.string().optional(),
  from: z.array(z.string()).optional(),
  to: z.array(z.string()).optional(),
  owned: z.boolean().optional(),
  cardinality: z.enum(['one', 'many']).optional(),
  requiredFor: z.enum(['prepared', 'ready']).optional(),
  /* An welchem Ende die Kante sich wie ein Feld liest. */
  asField: z.enum(['from', 'to']).optional(),
  section: z.string().optional(),
  props: objectSchema.optional(),
  facet: facetHint.optional(),
});

export const ViewDefSchema = z.object({
  label: z.string(),
  order: z.number().optional(),
  fields: z.union([z.literal('all'), z.literal('none'), z.array(z.string())]),
  description: z.boolean().optional(),
  composed: z.boolean().optional(),
  relations: z.boolean().optional(),
  bindings: z.boolean().optional(),
  image: z.boolean().optional(),
  layout: z.array(LayoutElementSchema).optional(),
  rest: z.boolean().optional(),
  empty: z.enum(['hide', 'show']).optional(),
  /* Gruppe und Geltung (T-268, E-103). */
  group: z.string().optional(),
  applies: z
    .object({
      types: z.array(z.string()).optional(),
      where: z.array(LayoutWhenSchema).optional(),
      article: z.string().optional(),
    })
    .optional(),
  /* Ein Beitrag (T-425, E-168): legt sich über die Ansicht seiner Gruppe. */
  adjust: LayoutAdjustSchema.optional(),
  priority: z.number().optional(),
  styles: z.record(z.string(), z.object({ head: z.string().optional(), surface: z.string().optional(), frame: z.string().optional(), text: z.string().optional() }).strict()).optional(),
});

const TokenSchema = z
  .object({
    label: z.string(),
    role: z.enum(['surface', 'text', 'accent', 'line']),
    light: z.string().min(1),
    dark: z.string().min(1),
    on: z.string().optional(),
    description: z.string().optional(),
  })
  .strict();

export const RegistrySchema = z.object({
  interfaces: z.record(z.string(), InterfaceDefSchema),
  relations: z.record(z.string(), RelationDefSchema),
  views: z.record(z.string(), ViewDefSchema),
  units: z.record(z.string(), UnitDefSchema),
  enums: z.record(z.string(), EnumDefSchema).optional(),
  tokens: z.record(z.string(), TokenSchema).optional(),
  vars: z.record(z.string(), z.string()),
  settings: z.record(z.string(), z.string()).optional(),
});


export const RelationSchema = z.object({
  id: z.string(),
  type: z.string(),
  to: z.string(),
  props: z.record(z.string(), z.unknown()).optional(),
});

export const EntitySchema = z.object({
  id: z.string().min(1),
  interfaces: z.array(z.string()).min(1),
  name: z.string(),
  components: z.record(z.string(), z.record(z.string(), z.unknown())),
  adhoc: z
    .array(z.object({ key: z.string(), label: z.string(), type: z.string(), value: z.unknown() }))
    .optional(),
  relations: z.array(RelationSchema).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  revision: z.number().int().positive().optional(),
});

export interface ValidationIssue {
  code:
    | 'unknown_interface'
    | 'card_not_inherited'
    | 'unknown_card'
    | 'missing_property'
    /* Was dasteht, aber nicht dastehen darf: ein Wort ausserhalb der
       Aufzählung, eine Zahl ausserhalb der Spanne, ein Text, wo eine Zahl
       mit Grenzen steht. */
    | 'value_not_allowed'
    | 'value_out_of_range'
    | 'value_not_a_number'
    /* Ein Verweisfeld, das auf die falsche Artikelart zeigt — oder auf
       nichts. */
    | 'link_wrong_type'
    | 'dangling_link'
    | 'dangling_relation'
    | 'unknown_relation'
    /* Zwei Stufen desselben Grundzustands in einer Zustandsliste (D48):
       „Exhaustion 2" und „Exhaustion 3" zugleich sind ein Zähler, der
       zweimal zählt. */
    | 'condition_stage_twice'
    /* `overrides` ersetzt eine Fassung durch eine andere **derselben Art**
       (M9); über Arten hinweg wäre es eine Verwechslung. */
    | 'overrides_other_type'
    /* Zwei Einträge eines Feldes mit derselben `id` (REQ-238): was an
       der Id hängt, wüsste nicht, welcher gemeint ist. */
    | 'entry_id_twice'
    /* Ein Stand wird gesetzt, dessen Pflicht fehlt (T-425, E-178,
       `stateRefusal`) — gemeldet vom Server, der den Stand davor kennt. */
    | 'state_gaps'
    /* Die letzte Ebene oder der Stand eines Artikels wird entfernt (T-425,
       E-179, E-182): jeder Artikel hat beides — gemeldet vom Server. */
    | 'layer_required'
    | 'status_required'
    /* Eine Wahl der Figur nimmt, was sie schon hat (T-299,
       `newChoiceDuplicates`) — gemeldet vom Server, nicht von hier. */
    | 'choice_duplicate';
  message: string;
  /** Die Art, deren Karte es betrifft. */
  component?: string;
  property?: string;
  relation?: string;
}

export interface ValidateOptions {
  /** D2: when true, cards outside the type's chain are tolerated. */
  expertMode?: boolean;
  /** Ids that exist, so dangling edges can be reported. Omit to skip that check. */
  knownIds?: ReadonlySet<string>;
  /**
   * Was es gibt, **und als was**: Id → Artikelart. Damit prüft ein
   * Verweisfeld seinen Zieltyp, und die Schlüssel zählen gleich als
   * `knownIds` — zwei Listen derselben Artikel wären eine, die veraltet.
   */
  knownTypes?: ReadonlyMap<string, string>;
  /**
   * Zustand (Id) → Grundzustand (Id), aus den `stageOf`-Kanten (siehe
   * `stageBases`). Ohne sie bleibt die Regel „höchstens eine Stufe je
   * Grundzustand" ungeprüft — die Prüfung kann den Grundzustand nicht raten.
   */
  stageOf?: ReadonlyMap<string, string>;
}

/**
 * Die Zuordnung Stufe → Grundzustand aus den gespeicherten `stageOf`-Kanten.
 * Die Kante steht an der Stufe, die Gegenrichtung ist eine Abfrage — diese
 * Karte ist die Abfrage, einmal gerechnet und nicht gespeichert (D8).
 */
export function stageBases(entities: Iterable<Entity>): Map<string, string> {
  const raus = new Map<string, string>();
  for (const e of entities) {
    for (const r of e.relations ?? []) {
      if (r.type === 'stageOf') raus.set(e.id, r.to);
    }
  }
  return raus;
}

/** Check one entity against the registry. An empty array means it is valid. */
export function validateEntity(
  registry: Registry,
  entity: Entity,
  options: ValidateOptions = {},
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const name = entity.interfaces?.[0];

  if (!name || !registry.interfaces[name]) {
    issues.push({
      code: 'unknown_interface',
      message: `Unknown interface: ${name ?? '(none)'}`,
    });
    return issues;
  }

  const kette = typeChain(registry, name);
  const erlaubt = new Set(kette);

  /* Eine Karte, die keine Art des Artikels nennt, ist kein Tippfehler im
     Register, sondern ein Wert ohne Erklärung: es gibt kein Feld, das ihn
     beschreibt, und keine Ansicht, die ihn zeigt. */
  for (const card of Object.keys(entity.components ?? {})) {
    if (!registry.interfaces[card]) {
      issues.push({
        code: 'unknown_card',
        component: card,
        message: `${card} is not a type in the registry`,
      });
      continue;
    }
    if (!erlaubt.has(card) && !options.expertMode) {
      issues.push({
        code: 'card_not_inherited',
        component: card,
        message: `${name} does not inherit from ${card}`,
      });
    }
  }

  /* Pflichtfelder gelten für die ganze Kette, auch wenn die Karte gar nicht
     da ist: eine fehlende Karte ist kein leerer Wert, sondern derselbe. */
  for (const type of kette) {
    const schema = registry.interfaces[type]?.schema;
    if (!schema) continue;
    const card = entity.components?.[type];
    for (const property of schema.required ?? []) {
      const prop = schema.properties[property];
      if (prop?.derived) continue; // derived values are never stored
      if (card?.[property] === undefined || card[property] === '') {
        issues.push({
          code: 'missing_property',
          component: type,
          property,
          message: `${type}.${property} is required`,
        });
      }
    }
  }

  /* Was in einem Feld steht, muss das Feld auch zulassen. Geprüft wird
     nur, was **dasteht**: ein leeres Feld ist keine falsche Angabe, und
     dafür gibt es `required`. Gerechnete Werte stehen nie in den Daten.

     Eine Aufzählung und eine Spanne waren bis hierher Angaben für die
     Maske allein. Eine Regel, die nur das Eingabefeld kennt, gilt für
     jeden Weg nicht, der nicht durch die Maske führt — Einfuhr, Umzug,
     eine Zeile von Hand —, und genau dort entstehen die Werte, die
     niemand mehr erklären kann. */
  for (const type of kette) {
    const schema = registry.interfaces[type]?.schema;
    const card = entity.components?.[type];
    if (!schema || !card) continue;
    for (const [property, prop] of Object.entries(schema.properties)) {
      if (prop.derived) continue;
      const wert = card[property];
      if (wert === undefined || wert === '' || wert === null) continue;
      /* Nennt das Feld eine Artikelart, schlägt die Liste vor und hält
         nicht (M6, D50): ein Artikelname ist der heutige Stand. */
      const erlaubteWerte = enumHolds(registry, prop) ? enumOptions(registry, prop) : undefined;
      if (erlaubteWerte) {
        /* **Eine Karte nennt ihre Werte, nicht sich selbst.** `zones`
           hält `{"x,y": "action"}`: die Zeile gilt für die Einträge, und
           den Schlüssel erfindet der Ort. Ohne diesen Zweig prüfte die
           Schleife das Objekt selbst gegen die Liste — und liess es durch,
           weil es keinen `value` trägt. Stillschweigend richtig ist
           dasselbe wie stillschweigend falsch: beides sagt nichts. */
        const eintraege = prop.format === 'zones' && wert && typeof wert === 'object'
          ? Object.values(wert as Record<string, unknown>)
          : null;
        const werte = eintraege ?? (Array.isArray(wert) ? wert : [wert]);
        for (const einer of werte) {
          const text = typeof einer === 'object' && einer !== null
            ? (einer as { value?: unknown }).value
            : einer;
          if (text === undefined || text === '' || text === null) continue;
          if (!erlaubteWerte.includes(String(text))) {
            issues.push({
              code: 'value_not_allowed',
              component: type,
              property,
              message: `${type}.${property} is ${String(text)}, which is not one of ${erlaubteWerte.join(', ')}`,
            });
          }
        }
      }
      if (typeof prop.min === 'number' || typeof prop.max === 'number') {
        const zahl = Number(wert);
        if (!Number.isFinite(zahl)) {
          issues.push({
            code: 'value_not_a_number',
            component: type,
            property,
            message: `${type}.${property} is ${String(wert)}, which is not a number`,
          });
        } else if (
          (typeof prop.min === 'number' && zahl < prop.min)
          || (typeof prop.max === 'number' && zahl > prop.max)
        ) {
          issues.push({
            code: 'value_out_of_range',
            component: type,
            property,
            message: `${type}.${property} is ${zahl}, outside ${prop.min ?? '−∞'}…${prop.max ?? '∞'}`,
          });
        }
      }
    }
  }

  /* **Ein Eintrag mit Form wird geprüft wie eine kleine Karte** (REQ-238):
     Pflicht, Aufzählung, Spanne — und jede `id` nur einmal, denn an ihr
     hängt, was anderswo auf genau diesen Eintrag zeigt (die Antwort
     einer Figur auf eine Wahl). */
  for (const type of kette) {
    const schema = registry.interfaces[type]?.schema;
    const card = entity.components?.[type];
    if (!schema || !card) continue;
    for (const [property, prop] of Object.entries(schema.properties)) {
      if (!prop.entry || !Array.isArray(card[property])) continue;
      const ids = new Set<string>();
      for (const eintrag of card[property] as unknown[]) {
        const o = (eintrag && typeof eintrag === 'object' ? eintrag : {}) as Record<string, unknown>;
        const id = typeof o['id'] === 'string' ? o['id'] : '';
        const wo = `${type}.${property}#${id || '?'}`;
        if (id && ids.has(id)) {
          issues.push({ code: 'entry_id_twice', component: type, property, message: `${wo} appears twice` });
        }
        if (id) ids.add(id);
        for (const pflicht of prop.entry.required ?? []) {
          if (o[pflicht] === undefined || o[pflicht] === '' || o[pflicht] === null) {
            issues.push({ code: 'missing_property', component: type, property, message: `${wo}: ${pflicht} is required` });
          }
        }
        for (const [k, p] of Object.entries(prop.entry.properties)) {
          const wert = o[k];
          if (wert === undefined || wert === '' || wert === null) continue;
          const erlaubt = enumHolds(registry, p) ? enumOptions(registry, p) : undefined;
          if (erlaubt) {
            for (const einer of Array.isArray(wert) ? wert : [wert]) {
              if (!erlaubt.includes(String(einer))) {
                issues.push({
                  code: 'value_not_allowed', component: type, property,
                  message: `${wo}: ${k} is ${String(einer)}, which is not one of ${erlaubt.join(', ')}`,
                });
              }
            }
          }
          if (typeof p.min === 'number' || typeof p.max === 'number') {
            for (const einer of Array.isArray(wert) ? wert : [wert]) {
              const zahl = Number(einer);
              if (!Number.isFinite(zahl)) {
                issues.push({ code: 'value_not_a_number', component: type, property, message: `${wo}: ${k} is ${String(einer)}, which is not a number` });
              } else if ((typeof p.min === 'number' && zahl < p.min) || (typeof p.max === 'number' && zahl > p.max)) {
                issues.push({ code: 'value_out_of_range', component: type, property, message: `${wo}: ${k} is ${zahl}, outside ${p.min ?? '−∞'}…${p.max ?? '∞'}` });
              }
            }
          }
        }
      }
    }
  }

  /* **Ein Verweisfeld hält eine Id, und die Id gehört zu einer Art.**
     Geprüft wird nur, wenn der Aufrufer sagt, was es gibt — ohne das
     wüsste die Prüfung nicht, worauf der Verweis zeigt, und eine Regel,
     die raten muss, lehnt irgendwann das Richtige ab.

     Die Marken und der Feldwert aus `LinkTarget` bleiben aussen vor: sie
     lesen den heutigen Zustand des Ziels, und ein entfernter Marker würde
     einen längst gespeicherten Verweis rückwirkend falsch machen. */
  if (options.knownTypes) {
    for (const type of kette) {
      const schema = registry.interfaces[type]?.schema;
      const card = entity.components?.[type];
      if (!schema || !card) continue;
      for (const [property, prop] of Object.entries(schema.properties)) {
        if (prop.format !== 'link' || prop.derived) continue;
        const werte = Array.isArray(card[property]) ? card[property] : [card[property]];
        for (const einer of werte as unknown[]) {
          if (einer === undefined || einer === '' || einer === null) continue;
          const id = String(einer);
          const art = options.knownTypes.get(id);
          if (!art) {
            issues.push({
              code: 'dangling_link',
              component: type,
              property,
              message: `${type}.${property} points at ${id}, which does not exist`,
            });
            continue;
          }
          if (!linkAccepts(registry, prop, art)) {
            issues.push({
              code: 'link_wrong_type',
              component: type,
              property,
              message: `${type}.${property} points at a ${art}, but only ${(linkTargets(prop) ?? []).join(', ')} is allowed`,
            });
          }
        }
      }
    }
  }

  /* **Höchstens eine Stufe je Grundzustand** (D48), in jeder Liste von
     Zuständen: in einem Verweisfeld, das auf `Condition` zeigt, und in den
     Zuständen einer Teilnahme am Kampf. */
  if (options.stageOf) {
    const stufen = options.stageOf;
    const pruefe = (ids: string[], wo: { component?: string; property?: string; relation?: string }) => {
      const gesehen = new Map<string, string>();
      for (const id of ids) {
        const grund = stufen.get(id);
        if (!grund) continue;
        const frueher = gesehen.get(grund);
        if (frueher !== undefined && frueher !== id) {
          issues.push({
            code: 'condition_stage_twice',
            ...wo,
            message: `${frueher} and ${id} are two stages of ${grund}; a list holds at most one`,
          });
        }
        gesehen.set(grund, id);
      }
    };
    for (const type of kette) {
      const schema = registry.interfaces[type]?.schema;
      const card = entity.components?.[type];
      if (!schema || !card) continue;
      for (const [property, prop] of Object.entries(schema.properties)) {
        if (prop.format !== 'link' || prop.type !== 'array' || !Array.isArray(card[property])) continue;
        if (!linkTargets(prop)?.some((t) => t === 'Condition')) continue;
        pruefe((card[property] as unknown[]).map(String), { component: type, property });
      }
    }
    for (const relation of entity.relations ?? []) {
      if (relation.type !== 'participates') continue;
      const liste = (relation.props as { conditions?: unknown } | undefined)?.conditions;
      if (!Array.isArray(liste)) continue;
      pruefe(
        liste.map((c) => (c as { rule?: unknown } | null)?.rule).filter((r): r is string => typeof r === 'string'),
        { relation: 'participates', property: 'conditions' },
      );
    }
  }

  /* Wer die Arten mitgibt, hat die Ids mitgegeben. Zwei Listen derselben
     Artikel wären eine, die veraltet. */
  const bekannt = options.knownIds
    ?? (options.knownTypes ? new Set(options.knownTypes.keys()) : undefined);

  for (const relation of entity.relations ?? []) {
    if (!registry.relations[relation.type]) {
      issues.push({
        code: 'unknown_relation',
        relation: relation.type,
        message: `Relation type ${relation.type} is not in the registry`,
      });
    }
    if (relation.type === 'overrides' && options.knownTypes) {
      const ziel = options.knownTypes.get(relation.to);
      if (ziel && ziel !== name) {
        issues.push({
          code: 'overrides_other_type',
          relation: relation.type,
          message: `${name} replaces a ${ziel}; an override stays within one type`,
        });
      }
    }
    if (bekannt && !bekannt.has(relation.to)) {
      issues.push({
        code: 'dangling_relation',
        relation: relation.type,
        message: `${relation.type} points at ${relation.to}, which does not exist`,
      });
    }
  }

  return issues;
}
