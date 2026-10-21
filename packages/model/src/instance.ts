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
 * Kanten, die einem **Stück** gehören (T-150): das Inventar eines
 * Behälters (`carries`). Zwei Rucksäcke aus einer Vorlage tragen nicht
 * denselben Inhalt — also erbt keine Instanz das Inventar ihrer Vorlage.
 * Anders als `inLayer` ist eine solche Kante aber eine **Abweichung**: ein
 * Rucksack mit eigenem Inhalt ist kein beliebiges Stück mehr
 * (`followsTemplate`), und auf ihn kommt kein zweiter.
 */
export const PIECE_RELATIONS: readonly string[] = ['carries'];

/**
 * Kanten, die zur Vorlage **als Artikel** gehören und nicht zu ihrem
 * Inhalt: wo sie liegt, wem sie gehört, wovon sie eine Spielart ist, was
 * sie als Stück trägt. Die
 * übrigen — die Aktionen eines Statblocks (`composedOf`) zum Beispiel —
 * bringt die Vorlage mit, solange die Instanz keine eigenen dieser Art hat.
 */
export const NOT_INHERITED_RELATIONS: readonly string[] = [
  INSTANCE_RELATION,
  'belongsTo',
  'inLayer',
  'overrides',
  'variantOf',
  ...PIECE_RELATIONS,
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
  /* Was sie von der Vorlage las, bekommt eine eigene Id, wie in
     `thinInstance`: die Kanten-Id ist Schlüssel der ganzen Tabelle, und
     solange die Vorlage noch steht, hält sie dieselbe — in Postgres
     scheiterte das Speichern der gelösten Instanz daran. */
  const eigen = new Set((entity.relations ?? []).map((r) => r.id));
  return {
    ...voll,
    relations: (voll.relations ?? [])
      .filter((r) => r.type !== INSTANCE_RELATION)
      .map((r) => (eigen.has(r.id) ? r : { ...r, id: `${r.id}@${entity.id}` })),
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

/**
 * **Ein Stück entsteht als Instanz** (T-133, T-150): was einer Figur in die
 * Hand kommt — gekauft, erbeutet, gefertigt, geschenkt —, ist ein eigener
 * Artikel mit `instanceOf` auf den Grundartikel und trägt sonst nur seinen
 * Namen, seine Nummer und den Stand `ready` (ein Stück am Tisch ist keine
 * Vorbereitung). Alles Übrige liest es von der Vorlage, bis es abweicht:
 * eine Gravur, ein anderer Name, verbrauchte Ladungen. Eine Funktion für
 * alle Wege, damit Kauf, Beute und Handwerk dasselbe Stück anlegen.
 *
 * `id` ist die Artikel-Id, `number` der Bezeichner (`nextId` über den Typ
 * der Vorlage), `layer` die Ebene, in die das Stück gehört — die der
 * laufenden Kampagne, sonst steht es in keinem Stapel.
 */
export function newInstance(template: Entity, opts: { id: EntityId; number: string; layer?: EntityId | null }): Entity {
  const name = String(template.components?.['Identity']?.['name'] ?? template.name ?? template.id);
  return {
    id: opts.id,
    interfaces: [...(template.interfaces ?? [])],
    name,
    components: { Identity: { name, id: opts.number }, Status: { status: 'ready' } },
    relations: [
      { id: `${opts.id}~instanceOf`, type: INSTANCE_RELATION, to: template.id, props: {} },
      ...(opts.layer ? [{ id: `${opts.id}~inLayer`, type: 'inLayer', to: opts.layer, props: {} }] : []),
    ],
  };
}

/**
 * Weicht diese Instanz in nichts von ihrer Vorlage ab? Dann ist sie ein
 * beliebiges Stück davon: Gekauftes darf auf ihren Stapel, und wer sie
 * verkauft, verliert nichts, wenn sie danach wegfällt. Name, Nummer,
 * Stand und Sichtbarkeit zählen nicht als Abweichung — der Name aber nur,
 * solange er der der Vorlage ist.
 */
export function followsTemplate(entities: Lookup, entity: Entity): boolean {
  const vorlage = templateOf(entities, entity);
  if (!vorlage) return false;
  const name = entity.components?.['Identity']?.['name'];
  const vorlagenName = vorlage.components?.['Identity']?.['name'] ?? vorlage.name;
  if (!leer(name) && name !== vorlagenName) return false;
  for (const [card, werte] of Object.entries(entity.components ?? {})) {
    if (card === 'Identity' || card === 'Status' || NOT_INHERITED_CARDS.includes(card)) continue;
    if (Object.values(werte ?? {}).some((w) => !leer(w))) return false;
  }
  return (entity.relations ?? []).every((r) => NOT_INHERITED_RELATIONS.includes(r.type) && !PIECE_RELATIONS.includes(r.type));
}

/**
 * **Der Grundartikel** eines Stücks: die fernste Vorlage, sonst das Stück
 * selbst (T-150). Ein Rezept braucht „Eisenbarren", und der gekaufte
 * Barren ist eine Instanz davon — gezählt wird er als Eisenbarren.
 */
export function baseArticle(entities: Lookup, id: EntityId): EntityId {
  const e = entities.get(id);
  if (!e) return id;
  const kette = templateChain(entities, e);
  return kette.length ? kette[kette.length - 1]!.id : id;
}

/**
 * **Ein Nachschlagen, das aufgelöst liefert** (T-275): `get` gibt jeden
 * Artikel mit seiner Vorlage darunter (`resolveInstance`), erst beim Fragen
 * und je Artikel einmal. Für Rechnungen, die `byId` „schon aufgelöst"
 * erwarten (`effectsAt`, `characterStats`) — ein Stück im Inventar ist
 * eine Instanz und trägt seine Wirkungen sonst nicht. Aufzählen
 * (`values`) liefert die Artikel, wie sie gespeichert sind.
 */
export function resolvedLookup(entities: Lookup): Lookup {
  if (entities instanceof AufgeloesteMap) return entities;
  return new AufgeloesteMap(entities);
}

/* Ohne Kopie: ein Bestand von 24 000 Artikeln wird je Frage nicht abgeschrieben. */
class AufgeloesteMap implements ReadonlyMap<EntityId, Entity> {
  private readonly fertig = new Map<EntityId, Entity>();
  constructor(private readonly roh: Lookup) {}
  get(id: EntityId): Entity | undefined {
    const da = this.fertig.get(id);
    if (da) return da;
    const e = this.roh.get(id);
    if (!e) return undefined;
    const r = resolveInstance(this.roh, e);
    this.fertig.set(id, r);
    return r;
  }
  has(id: EntityId): boolean {
    return this.roh.has(id);
  }
  get size(): number {
    return this.roh.size;
  }
  forEach(fn: (value: Entity, key: EntityId, map: ReadonlyMap<EntityId, Entity>) => void, thisArg?: unknown): void {
    this.roh.forEach((v, k) => fn.call(thisArg, v, k, this));
  }
  entries() {
    return this.roh.entries();
  }
  keys() {
    return this.roh.keys();
  }
  values() {
    return this.roh.values();
  }
  [Symbol.iterator]() {
    return this.roh[Symbol.iterator]();
  }
}
