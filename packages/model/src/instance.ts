/**
 * Vorlage und Instanz: zwei Wachen aus einem Statblock, und jede darf
 * anders werden.
 *
 * Eine **Instanz** ist ein eigener Artikel mit einer Kante `instanceOf` auf
 * ihre **Vorlage**. Gespeichert wird an ihr nur, **was abweicht**; gelesen
 * wird Vorlage und Abweichung zusammen. Korrigiert jemand die Vorlage,
 * erreicht das jede Instanz, die das Feld nicht selbst gesetzt hat — und
 * eine Wache mit 18 Trefferpunkten behält ihre 18.
 *
 * Vorher gab es zwei schlechtere Wege. Ein Statblock, den dreissig Wachen
 * teilen, macht aus jeder Änderung an einer eine Änderung an allen. Eine
 * Kopie je Wache hält sie auseinander und macht aus einem Tippfehler in der
 * Vorlage dreissig Tippfehler, die niemand mehr findet.
 *
 * **Gleich wie die Vorlage heisst: folgt der Vorlage.** Wer in einer
 * Instanz den Wert der Vorlage einträgt, hat keine Abweichung, und beim
 * Speichern fällt er weg (`thinInstance`). So braucht das Zurücksetzen
 * keinen eigenen Knopf in jeder Oberfläche, und eine Maske, die den
 * aufgelösten Artikel zurückschickt, schreibt nicht still alle Werte der
 * Vorlage fest.
 *
 * Wie überall wird beim Lesen aufgelöst und nichts davon gespeichert (D8).
 */

import type { Entity, EntityId, Relation } from './types.js';

/** Instanz → Vorlage. */
export const INSTANCE_RELATION = 'instanceOf';

/**
 * Karten, die eine Instanz **nie** von der Vorlage nimmt. `Identity` ist
 * ihr eigener Name und ihre eigene Nummer. `Visibility` wird so wenig
 * vererbt wie anderswo: eine Vorlage, die die Leitung verbirgt, soll nicht
 * still dreissig Wachen mitverbergen, die am Tisch stehen.
 */
export const NOT_INHERITED_CARDS: readonly string[] = ['Identity', 'Visibility'];

/**
 * Kanten, die zur Vorlage **als Artikel** gehören und nicht zu ihrem
 * Inhalt: wo sie liegt, wem sie gehört, wovon sie eine Spielart ist. Die
 * übrigen — die Aktionen eines Statblocks (`composedOf`) zum Beispiel —
 * bringt die Vorlage mit, solange die Instanz keine eigenen dieser Art hat.
 */
export const NOT_INHERITED_RELATIONS: readonly string[] = [
  INSTANCE_RELATION,
  'belongsTo',
  'inLayer',
  'overrides',
  'variantOf',
];

/** Weiter als so viele Vorlagen hoch wird nicht gesucht. */
const MAX_DEPTH = 8;

type Lookup = ReadonlyMap<EntityId, Entity>;

/** Die Vorlage, auf die diese Instanz zeigt — oder `null`. */
export function templateOf(entities: Lookup, entity: Entity): Entity | null {
  const kante = (entity.relations ?? []).find((r) => r.type === INSTANCE_RELATION);
  return (kante && entities.get(kante.to)) || null;
}

/** Ist das eine Instanz? Gefragt wird die Kante, nicht ob die Vorlage noch steht. */
export function isInstance(entity: Entity): boolean {
  return (entity.relations ?? []).some((r) => r.type === INSTANCE_RELATION);
}

/**
 * Die Vorlagen hoch, die nächste zuerst. Eine Vorlage darf selbst eine
 * Instanz sein („Hauptmann" aus „Wache"); ein Kreis bricht ab, statt
 * endlos zu laufen.
 */
export function templateChain(entities: Lookup, entity: Entity): Entity[] {
  const kette: Entity[] = [];
  const gesehen = new Set<EntityId>([entity.id]);
  let jetzt: Entity | null = templateOf(entities, entity);
  while (jetzt && !gesehen.has(jetzt.id) && kette.length < MAX_DEPTH) {
    kette.push(jetzt);
    gesehen.add(jetzt.id);
    jetzt = templateOf(entities, jetzt);
  }
  return kette;
}

function kopie<T>(wert: T): T {
  return wert === undefined ? wert : (JSON.parse(JSON.stringify(wert)) as T);
}

function leer(wert: unknown): boolean {
  return wert === undefined || wert === null || wert === '';
}

/**
 * Der Artikel, wie er gelesen wird: Vorlage, darüber die Abweichungen.
 *
 * Feld für Feld, nicht Karte für Karte — eine Wache mit eigenen
 * Trefferpunkten soll die Rüstungsklasse der Vorlage behalten. Ein Feld mit
 * mehreren Einträgen (Merkmale, Aktionen als Text) wird ganz ersetzt: eine
 * halbe Liste aus der Vorlage und eine halbe von hier wäre eine, die
 * niemand geschrieben hat.
 *
 * Ohne Vorlage kommt der Artikel unverändert zurück.
 */
export function resolveInstance(entities: Lookup, entity: Entity): Entity {
  const kette = templateChain(entities, entity);
  if (!kette.length) return entity;

  const components: Entity['components'] = {};
  /* Von oben nach unten: die fernste Vorlage zuerst, die Instanz zuletzt. */
  for (const schicht of [...kette].reverse()) {
    for (const [card, werte] of Object.entries(schicht.components ?? {})) {
      if (NOT_INHERITED_CARDS.includes(card)) continue;
      const ziel = (components[card] ??= {});
      for (const [feld, wert] of Object.entries(werte ?? {})) {
        if (!leer(wert)) ziel[feld] = kopie(wert);
      }
    }
  }
  for (const [card, werte] of Object.entries(entity.components ?? {})) {
    const ziel = (components[card] ??= {});
    for (const [feld, wert] of Object.entries(werte ?? {})) {
      if (!leer(wert)) ziel[feld] = kopie(wert);
    }
  }

  /* Kanten nach Art: hat die Instanz eigene Aktionen, gelten ihre; sonst
     die der nächsten Vorlage, die welche hat. Zusammengemischt wären es
     Aktionen, die keiner der beiden hat. */
  const eigene = entity.relations ?? [];
  const arten = new Set(eigene.map((r) => r.type));
  const geerbt: Relation[] = [];
  for (const schicht of kette) {
    const neu = new Set<string>();
    for (const r of schicht.relations ?? []) {
      if (NOT_INHERITED_RELATIONS.includes(r.type) || arten.has(r.type)) continue;
      geerbt.push(kopie(r));
      neu.add(r.type);
    }
    for (const t of neu) arten.add(t);
  }

  return { ...entity, components, relations: [...eigene.map(kopie), ...geerbt] };
}

/**
 * Welche Felder dieser Instanz **aus der Vorlage** kommen: `Karte.feld`.
 * Für die Anzeige — „aus Wache" — und für nichts sonst.
 */
export function inheritedFields(entities: Lookup, entity: Entity): string[] {
  if (!templateChain(entities, entity).length) return [];
  const aufgeloest = resolveInstance(entities, entity);
  const raus: string[] = [];
  for (const [card, werte] of Object.entries(aufgeloest.components)) {
    for (const feld of Object.keys(werte ?? {})) {
      if (leer(entity.components?.[card]?.[feld])) raus.push(`${card}.${feld}`);
    }
  }
  return raus;
}

/**
 * Was gespeichert wird: nur die Abweichungen.
 *
 * Ein Feld, das gleich steht wie in der aufgelösten Vorlage, fällt weg —
 * gleich heisst „folgt der Vorlage". Geerbte Kanten fallen ebenso weg; sie
 * werden an ihrer Id erkannt, die sie aus der Vorlage mitbringen. Eine
 * Maske, die den aufgelösten Artikel zurückschickt, schreibt damit genau
 * das fest, was jemand geändert hat.
 */
export function thinInstance(entities: Lookup, entity: Entity): Entity {
  const vorlage = templateOf(entities, entity);
  if (!vorlage) return entity;
  const basis = resolveInstance(entities, vorlage);
  const geerbteIds = new Set((basis.relations ?? []).map((r) => r.id));

  const components: Entity['components'] = {};
  for (const [card, werte] of Object.entries(entity.components ?? {})) {
    if (NOT_INHERITED_CARDS.includes(card)) {
      components[card] = werte;
      continue;
    }
    const eigen: Record<string, unknown> = {};
    for (const [feld, wert] of Object.entries(werte ?? {})) {
      if (leer(wert)) continue;
      const dort = basis.components?.[card]?.[feld];
      if (JSON.stringify(dort) === JSON.stringify(wert)) continue;
      eigen[feld] = wert;
    }
    if (Object.keys(eigen).length) components[card] = eigen;
  }
  /* Kanten **je Art**: stehen genau die der Vorlage da, folgt die Instanz
     ihr, und keine davon wird gespeichert. Fehlt eine oder kam eine dazu,
     hat jemand die Liste dieser Art geändert — dann gehört sie ganz der
     Instanz. Eine Kante einzeln zu vergleichen hiesse: wer an Wache 2 den
     Waffenangriff streicht, bekäme ihn beim Speichern zurück, weil die
     übrigen noch der Vorlage gleichen. Mitgebrachte Ids bekommen dabei
     eine eigene, damit dieselbe Id nicht an zwei Artikeln für zwei
     verschiedene Kanten steht. */
  const geerbtNachArt = new Map<string, Relation[]>();
  for (const r of basis.relations ?? []) {
    if (NOT_INHERITED_RELATIONS.includes(r.type)) continue;
    geerbtNachArt.set(r.type, [...(geerbtNachArt.get(r.type) ?? []), r]);
  }
  const hierNachArt = new Map<string, Relation[]>();
  const relations: Relation[] = [];
  for (const r of entity.relations ?? []) {
    if (NOT_INHERITED_RELATIONS.includes(r.type)) relations.push(r);
    else hierNachArt.set(r.type, [...(hierNachArt.get(r.type) ?? []), r]);
  }
  for (const [art, hier] of hierNachArt) {
    const dort = geerbtNachArt.get(art) ?? [];
    if (JSON.stringify(hier) === JSON.stringify(dort)) continue;
    for (const r of hier) {
      relations.push(geerbteIds.has(r.id) ? { ...r, id: `${r.id}@${entity.id}` } : r);
    }
  }
  return { ...entity, components, relations };
}

/**
 * Die Instanz von ihrer Vorlage lösen: alles, was sie gelesen hat, steht
 * danach an ihr selbst, und die Kante fällt weg. So geht es, bevor eine
 * Vorlage gelöscht wird — sonst nähme das Löschen dreissig Wachen ihre
 * Zahlen, und keine sagte warum.
 */
export function detachInstance(entities: Lookup, entity: Entity): Entity {
  const voll = resolveInstance(entities, entity);
  return {
    ...voll,
    relations: (voll.relations ?? []).filter((r) => r.type !== INSTANCE_RELATION),
  };
}

/**
 * Wie eine Instanz ausgeliefert wird: aufgelöst, und mit der Angabe, was
 * davon aus der Vorlage kommt. Eine Oberfläche kann die Felder dann blass
 * zeigen, ohne die Vorlage selbst zu bekommen — die darf jemandem
 * verborgen sein, dessen Wache er sehen darf.
 */
export function readInstance(entities: Lookup, entity: Entity): Entity {
  const vorlage = templateOf(entities, entity);
  if (!vorlage) return entity;
  return {
    ...resolveInstance(entities, entity),
    fromTemplate: { template: vorlage.id, fields: inheritedFields(entities, entity) },
  };
}

/** Die Instanzen, die **direkt** auf diese Vorlage zeigen. */
export function instancesOf(entities: Lookup, template: Entity): Entity[] {
  const raus: Entity[] = [];
  for (const e of entities.values()) {
    if ((e.relations ?? []).some((r) => r.type === INSTANCE_RELATION && r.to === template.id)) {
      raus.push(e);
    }
  }
  return raus;
}
