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
import { enumOptions, linkAccepts, linkTargets, typeChain } from './entity.js';
import type { Entity, LayoutElement, Registry } from './types.js';

const propertyType = z.enum(['string', 'number', 'integer', 'boolean', 'array', 'object']);

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
    min: z.number().optional(),
    max: z.number().optional(),
    format: z.string().optional(),
    items: z.object({ type: propertyType }).optional(),
    derived: z.string().optional(),
    of: z.string().optional(),
    unit: z.string().optional(),
    target: linkTargetSchema.optional(),
    alwaysEdit: z.boolean().optional(),
    many: z.boolean().optional(),
    readOnly: z.boolean().optional(),
    default: z.unknown().optional(),
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

const objectSchema = z.object({
  type: z.literal('object'),
  required: z.array(z.string()).optional(),
  properties: z.record(z.string(), propertySchema),
  additionalProperties: z.boolean().optional(),
});

/* Ein Reiter enthält ein Layout, und ein Layout kann Reiter enthalten —
   also ist das Schema rekursiv. `z.lazy` ist dafür da; die Tiefe begrenzt
   niemand, weil Reiter in Reitern niemand baut und eine Grenze, die nie
   greift, nur eine Zahl ist, die jemand erklären muss. */
const LayoutElementSchema: z.ZodType<LayoutElement> = z.lazy(() =>
  z.object({
    id: z.string(),
    el: z.enum(['heading', 'text', 'fields', 'prose', 'description', 'composed', 'relations', 'image', 'linked', 'knowledge', 'map', 'sheet', 'inventory', 'crafting', 'board', 'initiative', 'quests', 'timeline', 'live', 'table', 'prep', 'crawl', 'stack', 'standing', 'tabs']),
    text: z.string().optional(),
    fields: z.union([z.literal('all'), z.array(z.string())]).optional(),
    except: z.array(z.string()).optional(),
    columns: z.number().optional(),
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

export const InterfaceDefSchema = z.object({
  name: z.string(),
  label: z.string().optional(),
  abstract: z.boolean().optional(),
  alwaysEdit: z.boolean().optional(),
  extends: z.array(z.string()).optional(),
  schema: objectSchema.optional(),
  area: z.enum(['world', 'history', 'rules', 'play']).optional(),
  views: z.record(z.string(), z.array(LayoutElementSchema)).optional(),
  units: z.enum(['imperial', 'metric', 'both']).optional(),
  /* `Typ.feld` → Beschriftung. Eine Beschriftung und keine Feldliste. */
  titles: z.record(z.string(), z.string()).optional(),
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
  from: z.array(z.string()).optional(),
  to: z.array(z.string()).optional(),
  owned: z.boolean().optional(),
  cardinality: z.enum(['one', 'many']).optional(),
  /* An welchem Ende die Kante sich wie ein Feld liest. */
  asField: z.enum(['from', 'to']).optional(),
  section: z.string().optional(),
  props: objectSchema.optional(),
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
});

export const RegistrySchema = z.object({
  interfaces: z.record(z.string(), InterfaceDefSchema),
  relations: z.record(z.string(), RelationDefSchema),
  views: z.record(z.string(), ViewDefSchema),
  units: z.record(z.string(), UnitDefSchema),
  enums: z.record(z.string(), EnumDefSchema).optional(),
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
    | 'unknown_relation';
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
      const erlaubteWerte = enumOptions(registry, prop);
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
