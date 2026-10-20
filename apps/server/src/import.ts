/**
 * **Eine Ausfuhrdatei einlesen** — von der Kommandozeile, nicht über das
 * Netz (Arbeitsplan §4, P5; M13 schlanker).
 *
 *   pnpm --filter @nw/server run import <datei> [--only-new [--additions] | --replace | --replace-layer[=<id|Name>] | --layers] [--dry-run]
 *   docker compose exec app node apps/server/dist/import.js <datei> --only-new
 *
 * Dieselbe Semantik wie die Einfuhr des Prototyps: eine Datei mit
 * `registry` und **ohne** `entities` bringt nur die Zeilen; mit `entities`
 * kommen die Artikel dazu, und `--replace` löscht, was nicht in der Datei
 * steht — **alles**, auch die eigenen Kampagnenartikel.
 *
 * **Ersetzen je Ebene** (`--replace-layer`, W8): gelöscht wird nur, was
 * die Ebene der Datei bringt (`inLayer` auf sie und auf keine andere) und
 * in der Datei fehlt; alles andere bleibt — auch was hier in der Buchebene
 * angelegt wurde (anderes Id-Präfix als die Datei, T-270). Ohne Wert nimmt es die eine
 * Ebene, auf die die Artikel der Datei zeigen. Was gelöscht wird, wird
 * gezählt, und Kanten aus bleibenden Artikeln, die danach ins Leere zeigen,
 * werden aufgezählt — in Postgres bleiben sie stehen (Migration 012a) und
 * wären sonst ein stiller `dangling_relation`.
 *
 * **Nur ergänzen** (`--only-new`, D71): der 5e.tools-Import ist ein
 * einmaliger Lauf, danach wird ergänzt. Angelegt wird nur, wessen Id es
 * noch nicht gibt; was schon steht, bleibt, wie es ist — auch wenn die
 * Leitung es seither geändert hat. Ebenso das Register: nur Zeilen, die
 * es noch nicht gibt, kommen dazu. Gelöscht wird nichts. **Die Nummern der
 * neuen Artikel werden an den Bestand angeglichen** (T-087,
 * `nummernAngleichen`): ein Verweis im Text nennt die Nummer
 * (`[[spell-0601|Fireball]]`, M11), und der Bestand ist mit einem älteren
 * Lauf entstanden, dessen Nummern nicht die der Datei sind.
 *
 * **Nur die Ebenen ergänzen** (`--layers`, T-088): aus der Datei zählen nur
 * die Ebenen. Was es nicht gibt (die Gruppen), wird angelegt; an einer
 * bestehenden Ebene kommt dazu, was dort leer ist (Kürzel, Erscheinen,
 * Autor, Stufen, Beschreibung — was die Leitung geändert hat, bleibt), und
 * ihre Gruppen des Importers (`e5_group_*`) werden die der Datei. Kein
 * Artikel und keine Registerzeile wird angefasst.
 *
 * `--dry-run` sagt dasselbe
 * und schreibt nichts. Jeder Artikel geht durch `validateEntity` mit `knownTypes`, **bevor**
 * irgendetwas geschrieben wird: eine halb eingelesene Datei wäre ein
 * Bestand, den niemand mehr erklären kann.
 *
 * **Verweigert, solange kein Verwaltungskonto existiert.** Ein Server ohne
 * Konto lässt Lesen ohne Anmeldung zu, damit man an einen frisch
 * aufgesetzten herankommt; mit zehntausend geladenen Artikeln wäre das
 * eine offene Bibliothek. Erst das Konto, dann der Bestand.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  EntitySchema,
  RegistrySchema,
  INSTANCE_RELATION,
  detachInstance,
  entityName,
  isInstance,
  resolveInstance,
  stageBases,
  thinInstance,
  validateEntity,
  groupingOf,
  PUBLISHER_GROUPING,
  isBookPart,
  partRank,
} from '@nw/model';
import type { Entity, Registry } from '@nw/model';
import type { Repository } from './repo.js';

/** Die Registerteile, die die Ablage speichert. */
const TEILE = ['interfaces', 'relations', 'views', 'units', 'vars', 'enums', 'settings'] as const;

export interface ImportErgebnis {
  text: string;
  geschrieben: number;
  geloescht: number;
  /** Mit `onlyNew`: Artikel der Datei, deren Id es schon gab. */
  uebersprungen?: number;
  /** Mit `onlyNew`: neue Artikel, deren Nummer oder Verweise angeglichen wurden (T-087). */
  angeglichen?: number;
  /** Kanten aus bleibenden Artikeln auf gelöschte, als `Artikel —typ→ Ziel`. */
  verwaisteKanten?: string[];
}

export interface ImportOptionen {
  /** Alles löschen, was nicht in der Datei steht. */
  replace?: boolean;
  /**
   * Nur löschen, was diese Ebene bringt und in der Datei fehlt — Id oder
   * Name der Ebene, `true` für die eine Ebene der Datei.
   */
  replaceLayer?: string | true;
  /**
   * Nur anlegen, was es noch nicht gibt (D71): bestehende Artikel und
   * Registerzeilen werden übersprungen, nichts wird gelöscht.
   */
  onlyNew?: boolean;
  /** Nur die Ebenen der Datei: neue anlegen, bestehende ergänzen (T-088). */
  layers?: boolean;
  /**
   * Mit `onlyNew`: nur die Neuzugänge, die die Datei nennt (`additions`,
   * T-087) — was nicht zum Grundstand gehört. Für einen Bestand, der mit
   * einem älteren Importer geladen wurde: dort trägt manches Geteilte eine
   * andere Peg-Id, und `onlyNew` allein legte es ein zweites Mal an.
   */
  additions?: boolean;
  /** Alles prüfen und sagen, nichts schreiben. */
  dryRun?: boolean;
}

export class ImportFehler extends Error {}

export async function runImport(
  repo: Repository,
  daten: unknown,
  optionen: ImportOptionen = {},
): Promise<ImportErgebnis> {
  if (optionen.replace && optionen.replaceLayer) {
    throw new ImportFehler('`--replace` und `--replace-layer` schliessen sich aus: das eine löscht alles, was fehlt, das andere nur die Ebene.');
  }
  if (optionen.onlyNew && (optionen.replace || optionen.replaceLayer)) {
    throw new ImportFehler('`--only-new` schliesst `--replace` und `--replace-layer` aus: das eine lässt Bestehendes stehen, die anderen ersetzen es.');
  }
  if (optionen.additions && !optionen.onlyNew) {
    throw new ImportFehler('`--additions` gehört zu `--only-new`: es engt ein, was neu angelegt wird.');
  }
  if (optionen.layers && (optionen.replace || optionen.replaceLayer || optionen.onlyNew)) {
    throw new ImportFehler('`--layers` steht allein: es ergänzt nur Ebenen und ersetzt nichts.');
  }
  const verwaltung = (await repo.listUsers()).filter((u) => u.isAdmin && !u.disabledAt);
  if (!verwaltung.length) {
    throw new ImportFehler(
      'Kein Verwaltungskonto. Zuerst eines anlegen: `pnpm --filter @nw/server user add <name> --admin` — '
      + 'solange keins existiert, liest der Server ohne Anmeldung, und ein geladener Bestand wäre offen.',
    );
  }

  if (!daten || typeof daten !== 'object' || Array.isArray(daten)) throw new ImportFehler('Die Datei ist kein Objekt.');
  const d = daten as { format?: unknown; registry?: unknown; entities?: unknown; additions?: unknown };
  if (optionen.additions && !Array.isArray(d.additions)) {
    throw new ImportFehler('`--additions`: die Datei nennt keine Neuzugänge (`additions`) — sie stammt von einem Importer vor T-087.');
  }
  if (d.format !== undefined && !String(d.format).startsWith('nebelwacht/')) {
    throw new ImportFehler(`Unbekanntes Format: ${String(d.format)}`);
  }
  if (d.entities !== undefined && !Array.isArray(d.entities)) throw new ImportFehler('`entities` ist keine Liste.');

  /* Das Register der Datei gilt für die Prüfung, so wie es danach gilt.
     `components` ist der zweite Name für `interfaces` aus der Ausfuhr des
     Prototyps und wird hier nicht gebraucht. */
  const aktuell = await repo.getRegistry();
  let registry: Registry = aktuell;
  if (d.registry !== undefined) {
    const { components: _alt, ...roh } = d.registry as Record<string, unknown>;
    /* Mit `--only-new` gewinnt je Teil die Zeile, die schon steht. */
    const zusammen = optionen.onlyNew ? nurNeueZeilen(aktuell, roh) : { ...aktuell, ...roh };
    const geprueft = RegistrySchema.safeParse(zusammen);
    if (!geprueft.success) {
      throw new ImportFehler(`Register ungültig: ${geprueft.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
    }
    registry = geprueft.data as Registry;
  }

  /* Nur Zeilen: der Bestand bleibt, wie er ist — auch mit `--replace`. Eine
     leere Liste `entities: []` ist etwas anderes: eine Sicherung ohne
     Artikel, also „alles weg". */
  if (d.entities === undefined) {
    if (optionen.layers) throw new ImportFehler('`--layers` braucht Artikel: die Datei bringt nur Registerzeilen.');
    if (optionen.dryRun) return { text: 'Probelauf: das Register würde übernommen, die Artikel blieben.', geschrieben: 0, geloescht: 0 };
    const liegen = await schreibeRegister(repo, d.registry, registry);
    await repo.appendEvent('import.registry', undefined, {});
    return { text: `Register übernommen. Die Artikel bleiben, wie sie sind.${liegenText(liegen)}`, geschrieben: 0, geloescht: 0 };
  }

  const ausDatei: Entity[] = [];
  const fehler: string[] = [];
  for (const [i, roh] of (d.entities as unknown[]).entries()) {
    const p = EntitySchema.safeParse(roh);
    if (!p.success) fehler.push(`#${i}: ${p.error.issues[0]?.message ?? 'ungültig'}`);
    else ausDatei.push(p.data as Entity);
  }
  const dateiIds = new Set<string>();
  for (const e of ausDatei) {
    if (dateiIds.has(e.id)) fehler.push(`${e.id}: steht zweimal in der Datei`);
    dateiIds.add(e.id);
  }

  if (optionen.layers) {
    if (fehler.length) throw new ImportFehler(`${fehler.length} Fehler, nichts geschrieben:\n${fehler.slice(0, 30).join('\n')}`);
    return ebenenErgaenzen(repo, aktuell, ausDatei, Boolean(optionen.dryRun));
  }

  /* Was es danach gibt: mit `--replace` nur die Datei, mit
     `--replace-layer` der Bestand ohne das, was die Ebene brachte und die
     Datei nicht mehr bringt, mit `--only-new` der Bestand und dazu, was
     er noch nicht kennt, sonst der Bestand und die Datei darüber. */
  const bestand = await repo.listEntities();
  const bestandIds = new Set(bestand.map((e) => e.id));
  /* **Ein Teil kommt nur mit seinem Ganzen** (T-108): steht ein Kapitel
     oder eine Szene schon, gehört, was darin steht, der Leitung (oder der
     Migration 046, die den Text schon geladener Abenteuer zu Teilen
     machte) — ein Lauf legte sonst neben ihren Teilen eine zweite Fassung
     desselben Texts an. */
  const ganzesSchonDa = (e: Entity): boolean =>
    isBookPart(e) && (e.relations ?? []).some((r) => partRank(r) !== undefined && bestandIds.has(r.to));
  const neuRoh = optionen.onlyNew ? ausDatei.filter((e) => !bestandIds.has(e.id) && !ganzesSchonDa(e)) : ausDatei;
  /* **Nur die Neuzugänge** (`--additions`, T-087), und was einer davon über
     eine Kante braucht und noch nirgends steht (die 2014-Karte, auf die die
     2024-Karte mit `variantOf` zeigt) — sonst lehnte die Prüfung die Kante ab. */
  const genannt = new Set(Array.isArray(d.additions) ? d.additions.map(String) : []);
  const mitZielen = (auswahl: Entity[]): Entity[] => {
    const nachId = new Map(neuRoh.map((e) => [e.id, e] as const));
    const drin = new Set(auswahl.map((e) => e.id));
    const offen = [...auswahl];
    while (offen.length) {
      for (const r of offen.pop()!.relations ?? []) {
        const z = nachId.get(r.to);
        if (!z || drin.has(z.id)) continue;
        drin.add(z.id);
        offen.push(z);
      }
    }
    return neuRoh.filter((e) => drin.has(e.id));
  };
  const neu0 = optionen.additions ? mitZielen(neuRoh.filter((e) => genannt.has(e.id))) : neuRoh;
  const ausAlterEbene = neuRoh.length - neu0.length;
  const mitgezogen = optionen.additions ? neu0.filter((e) => !genannt.has(e.id)).length : 0;
  /* **Ein neuer Teil an einem bestehenden Artikel** (T-169): die Kreatur
     eines benannten Statblocks ist neu, der Statblock steht schon — und
     die Kante `belongsTo` steht an ihm. Eine Kante, die sich an einem Ende
     wie ein Feld liest (`asField`), von einem bestehenden Artikel auf einen
     neuen, kommt darum an den bestehenden dazu; was dort schon stand, bleibt.
     Hat er schon eine (`one`) — die Leitung hat ihm selbst eine Kreatur
     gegeben —, kommt der neue Artikel gar nicht: er wäre eine zweite Figur
     ohne Zahlen. Andere Kanten aus bestehenden Artikeln bleiben, wie sie sind. */
  const angehaengt: Entity[] = [];
  const ohneHalt = new Set<string>();
  if (optionen.onlyNew) {
    const neuIds = new Set(neu0.map((e) => e.id));
    const nachBestand = new Map(bestand.map((e) => [e.id, e] as const));
    const vergeben = new Set([...bestand, ...neu0].flatMap((e) => (e.relations ?? []).map((r) => r.id)));
    for (const a of ausDatei) {
      const alt = nachBestand.get(a.id);
      if (!alt) continue;
      let kopie: Entity | undefined;
      for (const r of a.relations ?? []) {
        const def = registry.relations[r.type];
        if (!neuIds.has(r.to) || !def?.asField) continue;
        const schon = (kopie ?? alt).relations ?? [];
        if (schon.some((x) => x.type === r.type && (def.cardinality === 'one' || x.to === r.to))) {
          ohneHalt.add(r.to);
          continue;
        }
        kopie ??= structuredClone(alt);
        let n = schon.length + 1;
        while (vergeben.has(`${alt.id}~${r.type}-${n}`)) n += 1;
        const id = `${alt.id}~${r.type}-${n}`;
        vergeben.add(id);
        kopie.relations = [...schon, { ...r, id }];
      }
      if (kopie) angehaengt.push(kopie);
    }
  }
  const neu = neu0.filter((e) => !ohneHalt.has(e.id));
  const anhangText = `${angehaengt.length ? ` ${angehaengt.length} bestehende Artikel bekommen eine Kante auf einen neuen (${[...new Set(angehaengt.flatMap((e) => (e.relations ?? []).filter((r) => neu.some((x) => x.id === r.to)).map((r) => r.type)))].join(', ')}).` : ''}${ohneHalt.size ? ` ${ohneHalt.size} neue nicht angelegt: ihr bestehender Artikel hat schon einen.` : ''}`;
  const teileMitGanzem = optionen.onlyNew ? ausDatei.filter((e) => !bestandIds.has(e.id) && ganzesSchonDa(e)).length : 0;
  const uebersprungen = ausDatei.length - neu.length;
  const angeglichen = optionen.onlyNew ? nummernAngleichen(ausDatei, bestand, neu) : 0;
  const angeglichenText = `${angeglichen ? ` ${angeglichen} davon mit angeglichener Nummer oder angeglichenen Verweisen (die Nummern der Datei sind nicht die des Bestands).` : ''}${optionen.additions ? ` Nur Neuzugänge: ${ausAlterEbene} Artikel mit neuer Id aus dem Grundstand nicht angelegt${mitgezogen ? `; ${mitgezogen} davon kamen doch mit, weil ein Neuzugang auf sie zeigt` : ''}.` : ''}`;
  const ids = new Set(neu.map((e) => e.id));
  let weg: Entity[] = [];
  let ebenenText = '';
  if (optionen.replace) weg = bestand.filter((e) => !ids.has(e.id));
  else if (optionen.replaceLayer) {
    const ebene = findeEbene(optionen.replaceLayer, neu, bestand);
    ebenenText = `Ebene „${entityName(ebene)}" (${ebene.id})`;
    /* **Eigenes in einer Buchebene bleibt** (T-270): ein Glossarbegriff
       oder eine Tischregel, die hier angelegt wurde, gehört der Quelle und
       nicht dem Einleser. Gelöscht wird nur, was dasselbe Id-Präfix trägt
       wie die Datei (`e5_` aus 5e.tools); hat eine Id der Datei keines,
       gilt die alte Regel. */
    const praefixe = idPraefixe(ids);
    weg = bestand.filter((e) => !ids.has(e.id) && nurInEbene(e, ebene.id) && (!praefixe || praefixe.has(idPraefix(e.id) ?? '')));
  }
  const wegIds = new Map(weg.map((e) => [e.id, entityName(e)] as const));
  const danach = new Map<string, Entity>();
  for (const e of bestand) if (!wegIds.has(e.id)) danach.set(e.id, e);
  for (const e of neu) danach.set(e.id, e);
  for (const e of angehaengt) danach.set(e.id, e);
  /* Eine Vorlage, die geht, nimmt nichts mit — wie beim Löschen über die
     Route: ihre bleibenden Instanzen bekommen vorher, was sie lasen. */
  const geloest: Entity[] = [];
  if (wegIds.size) {
    const vorher = new Map(bestand.map((e) => [e.id, e] as const));
    for (const e of danach.values()) {
      if (ids.has(e.id) || !isInstance(e)) continue;
      if ((e.relations ?? []).some((r) => r.type === INSTANCE_RELATION && wegIds.has(r.to))) geloest.push(detachInstance(vorher, e));
    }
    for (const e of geloest) danach.set(e.id, e);
  }
  /* Eine Kanten-Id ist Schlüssel der ganzen Tabelle, nicht je Artikel:
     zwei gleiche schreiben bis zur zweiten und brechen dann ab. Darum
     hier, vor dem ersten Schreiben, über alles, was danach steht. */
  const kantenIds = new Map<string, string>();
  for (const e of danach.values()) {
    for (const r of e.relations ?? []) {
      const schon = kantenIds.get(r.id);
      if (schon !== undefined) fehler.push(`Kante ${r.id}: steht an ${schon} und an ${e.id}`);
      else kantenIds.set(r.id, e.id);
    }
  }
  const arten = new Map([...danach.values()].map((e) => [e.id, e.interfaces?.[0] ?? ''] as const));
  /* Die Ids einmal: ohne sie baut die Prüfung je Artikel ein Set aus
     allen Schlüsseln, und bei zehntausend Artikeln sind das Minuten. */
  const bekannt = new Set(arten.keys());
  const stufen = stageBases(danach.values());

  const zuSchreiben: Entity[] = [];
  for (const e of neu) {
    let pruefling = e;
    let schreib = e;
    if (isInstance(e)) {
      pruefling = resolveInstance(danach, e);
      schreib = thinInstance(danach, e);
    }
    for (const issue of validateEntity(registry, pruefling, { knownTypes: arten, knownIds: bekannt, stageOf: stufen })) {
      fehler.push(`${e.interfaces?.[0] ?? '?'} „${e.name}" (${e.id}): ${issue.message}`);
    }
    zuSchreiben.push(schreib);
  }
  for (const e of angehaengt) {
    for (const issue of validateEntity(registry, isInstance(e) ? resolveInstance(danach, e) : e, { knownTypes: arten, knownIds: bekannt, stageOf: stufen })) {
      fehler.push(`${e.interfaces?.[0] ?? '?'} „${e.name}" (${e.id}): ${issue.message}`);
    }
  }
  if (fehler.length) {
    throw new ImportFehler(`${fehler.length} Fehler, nichts geschrieben:\n${fehler.slice(0, 30).join('\n')}${fehler.length > 30 ? `\n… ${fehler.length - 30} weitere` : ''}`);
  }

  /* Kanten aus Artikeln, die bleiben und nicht aus der Datei kommen, auf
     einen, der geht. Die aus der Datei hat die Prüfung oben schon. */
  const verwaisteKanten: string[] = [];
  if (wegIds.size) {
    for (const e of danach.values()) {
      if (ids.has(e.id)) continue;
      for (const r of e.relations ?? []) {
        if (wegIds.has(r.to)) verwaisteKanten.push(`${entityName(e)} (${e.id}) —${r.type}→ ${wegIds.get(r.to)} (${r.to})`);
      }
    }
  }

  if (optionen.dryRun) {
    const zeilen = [optionen.onlyNew
      ? `Probelauf, nichts geschrieben — nur ergänzen: ${zuSchreiben.length} neu, ${uebersprungen} übersprungen (gibt es schon${teileMitGanzem ? `; davon ${teileMitGanzem} Teile, deren Kapitel oder Szene schon steht` : ''}).${angeglichenText}${anhangText}`
      : `Probelauf, nichts geschrieben${ebenenText ? ` — ${ebenenText}` : ''}: ${zuSchreiben.length} Artikel würden geschrieben, ${weg.length} gelöscht${weg.length ? ` (${jeArt(weg)})` : ''}.`];
    if (optionen.onlyNew && zuSchreiben.length) zeilen.push(jeEbene(zuSchreiben, danach));
    if (geloest.length) zeilen.push(`${geloest.length} Instanzen würden von ihrer Vorlage gelöst: ${geloest.map((e) => `${entityName(e)} (${e.id})`).join(', ')}`);
    if (verwaisteKanten.length) zeilen.push(kantenText(verwaisteKanten, 'würden ins Leere zeigen'));
    return { text: zeilen.join('\n'), geschrieben: 0, geloescht: 0, ...(optionen.onlyNew ? { uebersprungen, angeglichen } : {}), verwaisteKanten };
  }

  /* Erst löschen, dann schreiben: geprüft ist der Stand danach, und eine
     Kanten-Id, die ein gehender Artikel noch hält, darf ein kommender
     schon tragen — umgekehrt bräche das Schreiben an ihr ab. Bricht ein
     Lauf mittendrin ab, bringt derselbe Befehl noch einmal den Rest. */
  const liegen = await schreibeRegister(repo, d.registry, registry);
  /* Gelesen ist alles; nachgeführt werden muss beim Schreiben nichts
     (T-296: sonst je Artikel die ganze Liste kopiert, quadratisch). */
  repo.releaseHeld?.();
  let geloescht = 0;
  for (const alt of weg) {
    if (await repo.deleteEntity(alt.id)) geloescht += 1;
  }
  for (const e of zuSchreiben) await repo.putEntity(e);
  for (const e of angehaengt) await repo.putEntity(e);
  for (const e of geloest) await repo.putEntity(e);
  await repo.appendEvent('import', undefined, {
    written: zuSchreiben.length,
    removed: geloescht,
    replace: Boolean(optionen.replace),
    ...(optionen.onlyNew ? { onlyNew: true, skipped: uebersprungen, ...(angehaengt.length ? { attached: angehaengt.length } : {}) } : {}),
    ...(optionen.replaceLayer ? { replaceLayer: ebenenText } : {}),
    ...(verwaisteKanten.length ? { danglingRelations: verwaisteKanten.length } : {}),
  });

  /* **Die eine Stelle, an der das Ersetzen etwas zurücklässt** (Abgleich
     §4.4, 5): Konten führen Figuren, und die Figur-Ids stehen am Konto,
     nicht im Bestand. Zeigen sie danach ins Leere, wird es gesagt. */
  const verwaist: string[] = [];
  for (const u of await repo.listUsers()) {
    const weg = (u.actorIds ?? []).filter((a) => !danach.has(a));
    if (weg.length) verwaist.push(`${u.name}: ${weg.join(', ')}`);
  }
  const zeilen = [optionen.onlyNew
    ? `Nur ergänzt: ${zuSchreiben.length} neu, ${uebersprungen} übersprungen (gibt es schon${teileMitGanzem ? `; davon ${teileMitGanzem} Teile, deren Kapitel oder Szene schon steht` : ''}).${angeglichenText}${anhangText}`
    : `${ebenenText ? `${ebenenText}: ` : ''}${zuSchreiben.length} Artikel geschrieben${geloescht ? `, ${geloescht} gelöscht (${jeArt(weg)})` : ''}.`];
  if (optionen.onlyNew && zuSchreiben.length) zeilen.push(jeEbene(zuSchreiben, danach));
  if (geloest.length) zeilen.push(`${geloest.length} Instanzen von ihrer gelöschten Vorlage gelöst (sie tragen jetzt, was sie lasen): ${geloest.map((e) => `${entityName(e)} (${e.id})`).join(', ')}`);
  if (verwaisteKanten.length) zeilen.push(kantenText(verwaisteKanten, 'zeigen jetzt ins Leere'));
  if (verwaist.length) zeilen.push(`Figuren, die es nicht mehr gibt, an Konten:\n  ${verwaist.join('\n  ')}`);
  return { text: zeilen.join('\n') + liegenText(liegen), geschrieben: zuSchreiben.length, geloescht, ...(optionen.onlyNew ? { uebersprungen, angeglichen } : {}), verwaisteKanten };
}

const nummerVon = (e: Entity): string => {
  const n = (e.components?.['Identity'] as { id?: unknown } | undefined)?.id;
  return typeof n === 'string' ? n : '';
};

/**
 * **Die Nummern neuer Artikel an den Bestand angleichen** (T-087, für
 * `--only-new`). Der Importer zählt je Lauf von vorn; ein Bestand, der mit
 * einem älteren Lauf oder Datenstand entstand, trägt für denselben Artikel
 * (dieselbe Peg-Id) oft eine andere Nummer — und unter der Nummer der
 * Datei womöglich einen ganz anderen Artikel. Ein Verweis nennt die Nummer
 * (M11), also zeigte ein neuer 2024-Zauber, der auf den 2014-Fireball
 * verweist, sonst auf irgendetwas.
 *
 * Darum, nur an den neuen Artikeln:
 *  1. Eine Nummer, die im Bestand schon ein anderer trägt, wird eine neue
 *     — hinter der höchsten, die Bestand oder Datei kennt. Und dann jede
 *     neue Nummer derselben Reihe (`chapter-…`), in der Folge der Datei:
 *     Kapitel und Arcs stehen nach ihrer Nummer, und nähme nur die
 *     kollidierende eine neue, stünde „Chapter 1" hinter dem Anhang
 *     (T-296, gesehen an Curse of Strahd).
 *  2. Jeder Verweis `[[nummer|…]]` nennt danach die Nummer, die sein Ziel
 *     im Bestand trägt oder jetzt bekommt.
 *  3. Ein Verweis auf einen Artikel der Datei, der weder im Bestand steht
 *     noch jetzt angelegt wird (ein Teil, dessen Ganzes schon steht; mit
 *     `--additions` der Grundstand, den der Bestand nicht kennt), wird ein Verweis nach
 *     Namen (`[[Fireball]]`): seine Nummer kann im Bestand ein anderer
 *     tragen, und ein falscher Verweis ist schlechter als einer, der nach
 *     dem Namen sucht.
 * Der Bestand wird nicht angefasst. Gibt die Zahl der geänderten Artikel zurück.
 */
export function nummernAngleichen(ausDatei: Entity[], bestand: Entity[], neu: Entity[]): number {
  const besetzt = new Map<string, string>();
  const imBestand = new Map<string, string>();
  const hoechste = new Map<string, number>();
  const zaehle = (n: string) => {
    const m = /^(.*)-(\d+)$/.exec(n);
    if (m) hoechste.set(m[1]!, Math.max(hoechste.get(m[1]!) ?? 0, Number(m[2])));
  };
  for (const e of bestand) {
    const n = nummerVon(e);
    if (!n) continue;
    besetzt.set(n, e.id);
    imBestand.set(e.id, n);
    zaehle(n);
  }
  for (const e of ausDatei) zaehle(nummerVon(e));
  /* Dateinummer → Nummer danach. */
  const um = new Map<string, string>();
  for (const e of ausDatei) {
    const n = nummerVon(e);
    const da = imBestand.get(e.id);
    if (n && da && da !== n) um.set(n, da);
  }
  const geaendert = new Set<Entity>();
  const kommt = new Set(neu.map((e) => e.id));
  const fehlt = new Map<string, string>();
  for (const e of ausDatei) {
    const n = nummerVon(e);
    if (n && !imBestand.has(e.id) && !kommt.has(e.id)) fehlt.set(n, e.name);
  }
  const reihe = (n: string): string => /^(.*)-(\d+)$/.exec(n)?.[1] ?? n;
  const umReihen = new Set<string>();
  for (const e of neu) {
    const n = nummerVon(e);
    const wer = n ? besetzt.get(n) : undefined;
    if (n && wer && wer !== e.id) umReihen.add(reihe(n));
  }
  for (const e of neu) {
    const n = nummerVon(e);
    if (!n) continue;
    const wer = besetzt.get(n);
    if ((!wer || wer === e.id) && !umReihen.has(reihe(n))) {
      besetzt.set(n, e.id);
      continue;
    }
    const prefix = reihe(n);
    const frisch = (hoechste.get(prefix) ?? 0) + 1;
    hoechste.set(prefix, frisch);
    const neueNummer = `${prefix}-${String(frisch).padStart(4, '0')}`;
    um.set(n, neueNummer);
    besetzt.set(neueNummer, e.id);
    e.components = { ...e.components, Identity: { ...(e.components['Identity'] as object), id: neueNummer } };
    geaendert.add(e);
  }
  if (!um.size && !fehlt.size) return geaendert.size;
  const verweis = /\[\[([^\]|]+)(\|[^\]]*)?\]\]/g;
  const wert = (v: unknown, aenderung: { ja: boolean }): unknown => {
    if (typeof v === 'string') {
      if (!v.includes('[[')) return v;
      const neuText = v.replace(verweis, (roh, ziel: string, zeige: string | undefined) => {
        const t = ziel.trim();
        const nach = um.get(t);
        if (nach) return `[[${nach}${zeige ?? ''}]]`;
        const name = fehlt.get(t);
        if (name !== undefined) return `[[${zeige ? zeige.slice(1) : name}]]`;
        return roh;
      });
      if (neuText !== v) aenderung.ja = true;
      return neuText;
    }
    if (Array.isArray(v)) return v.map((x) => wert(x, aenderung));
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, wert(x, aenderung)]));
    return v;
  };
  for (const e of neu) {
    const aenderung = { ja: false };
    const karten = wert(e.components, aenderung) as Entity['components'];
    if (!aenderung.ja) continue;
    e.components = karten;
    geaendert.add(e);
  }
  return geaendert.size;
}

/** Die Gruppen, die der Importer anlegt (`gruppeEbeneId`, `herausgeberEbeneId`, T-094) — nur deren Kanten ersetzt `--layers`. */
const IMPORTER_GRUPPE = /^e5_(group|publisher)_/;

/**
 * **Nur die Ebenen** (`--layers`, T-088): neue anlegen, an bestehenden das
 * Leere füllen und die Gruppen des Importers auf den Stand der Datei
 * bringen. Kein anderer Artikel wird gelesen oder geschrieben.
 */
async function ebenenErgaenzen(repo: Repository, registry: Registry, ausDatei: Entity[], dryRun: boolean): Promise<ImportErgebnis> {
  const bestand = new Map((await repo.listEntities()).map((e) => [e.id, e] as const));
  const leer = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);
  const zuSchreiben: Entity[] = [];
  let neu = 0;
  let ergaenzt = 0;
  for (const datei of ausDatei.filter((e) => e.interfaces?.[0] === 'Layer')) {
    const alt = bestand.get(datei.id);
    if (!alt) {
      zuSchreiben.push(datei);
      neu += 1;
      continue;
    }
    if (alt.interfaces?.[0] !== 'Layer') continue;
    const components = { ...alt.components };
    let anders = false;
    for (const karte of ['Layer', 'Description'] as const) {
      const von = datei.components?.[karte] as Record<string, unknown> | undefined;
      if (!von) continue;
      const hier = { ...((components[karte] as Record<string, unknown> | undefined) ?? {}) };
      for (const [k, v] of Object.entries(von)) {
        if (leer(hier[k]) && !leer(v)) {
          hier[k] = v;
          anders = true;
        }
      }
      components[karte] = hier;
    }
    /* Hat die Leitung die Ebene an einen eigenen Herausgeber gehängt
       (T-094), bleibt es dabei: der des Importers kommt nicht dazu. */
    const verlag = (id: string) => groupingOf(bestand.get(id) ?? ausDatei.find((x) => x.id === id)) === PUBLISHER_GROUPING;
    const eigenerVerlag = (alt.relations ?? []).some((r) => r.type === 'partOf' && !IMPORTER_GRUPPE.test(r.to) && verlag(r.to));
    const soll = (datei.relations ?? []).filter((r) => r.type === 'partOf' && !(eigenerVerlag && verlag(r.to)));
    const bleiben = (alt.relations ?? []).filter((r) => r.type !== 'partOf' || !IMPORTER_GRUPPE.test(r.to) || soll.some((x) => x.to === r.to));
    const dazu = soll.filter((r) => !bleiben.some((x) => x.type === 'partOf' && x.to === r.to));
    if (dazu.length || bleiben.length !== (alt.relations ?? []).length) anders = true;
    if (!anders) continue;
    zuSchreiben.push({ ...alt, components, relations: [...bleiben, ...dazu] });
    ergaenzt += 1;
  }
  const danach = new Map(bestand);
  for (const e of zuSchreiben) danach.set(e.id, e);
  const arten = new Map([...danach.values()].map((e) => [e.id, e.interfaces?.[0] ?? ''] as const));
  const bekannt = new Set(arten.keys());
  const fehler: string[] = [];
  for (const e of zuSchreiben) {
    for (const issue of validateEntity(registry, e, { knownTypes: arten, knownIds: bekannt })) {
      fehler.push(`Layer „${e.name}" (${e.id}): ${issue.message}`);
    }
  }
  if (fehler.length) throw new ImportFehler(`${fehler.length} Fehler, nichts geschrieben:\n${fehler.slice(0, 30).join('\n')}`);
  const satz = `${neu} Ebenen neu, ${ergaenzt} ergänzt; kein Artikel und keine Registerzeile angefasst.`;
  if (dryRun) return { text: `Probelauf, nichts geschrieben — nur Ebenen: ${satz}`, geschrieben: 0, geloescht: 0 };
  for (const e of zuSchreiben) await repo.putEntity(e);
  await repo.appendEvent('import', undefined, { layers: true, written: zuSchreiben.length });
  return { text: `Nur Ebenen: ${satz}`, geschrieben: zuSchreiben.length, geloescht: 0 };
}

/**
 * Das Register mit `--only-new` (D71): je Teil die Zeilen der Datei, die
 * es noch nicht gibt, und darüber die bestehenden — eine Art, die die
 * Leitung am Server angepasst hat, bleibt angepasst.
 */
function nurNeueZeilen(aktuell: Registry, roh: Record<string, unknown>): Record<string, unknown> {
  const zusammen: Record<string, unknown> = { ...aktuell };
  for (const [teil, zeilen] of Object.entries(roh)) {
    const da = (aktuell as unknown as Record<string, unknown>)[teil];
    zusammen[teil] = zeilen && typeof zeilen === 'object' && !Array.isArray(zeilen) && da && typeof da === 'object'
      ? { ...(zeilen as Record<string, unknown>), ...(da as Record<string, unknown>) }
      : da ?? zeilen;
  }
  return zusammen;
}

/**
 * Die Ebene, die ersetzt wird: nach Id oder Name, unter den Artikeln der
 * Datei und des Bestands; `true` heisst die eine Ebene, auf die die Datei
 * zeigt. Zwei gleichnamige oder zwei in der Datei sind ein Fehler — die
 * falsche zu nehmen hiesse, die falschen Artikel zu löschen.
 */
function findeEbene(wahl: string | true, neu: Entity[], bestand: Entity[]): Entity {
  const ebenen = new Map<string, Entity>();
  for (const e of [...bestand, ...neu]) if (e.interfaces?.includes('Layer')) ebenen.set(e.id, e);
  if (wahl === true) {
    const ziele = new Set<string>();
    for (const e of neu) for (const r of e.relations ?? []) if (r.type === 'inLayer') ziele.add(r.to);
    const treffer = [...ziele].filter((id) => ebenen.has(id));
    if (treffer.length !== 1) {
      throw new ImportFehler(treffer.length
        ? `Die Datei bringt ${treffer.length} Ebenen (${treffer.join(', ')}) — welche ersetzt wird, sagt \`--replace-layer=<id oder Name>\`.`
        : 'Kein Artikel der Datei steht in einer Ebene — mit `--replace-layer` gäbe es nichts, woran sich das Löschen hält.');
    }
    return ebenen.get(treffer[0]!)!;
  }
  const nachId = ebenen.get(wahl);
  if (nachId) return nachId;
  const nachName = [...ebenen.values()].filter((e) => entityName(e) === wahl || (e.components['Identity'] as { id?: unknown } | undefined)?.id === wahl);
  if (nachName.length === 1) return nachName[0]!;
  if (nachName.length > 1) throw new ImportFehler(`Mehrere Ebenen heissen „${wahl}": ${nachName.map((e) => e.id).join(', ')} — die Id nennen.`);
  throw new ImportFehler(`Keine Ebene „${wahl}", weder in der Datei noch im Bestand.`);
}

/**
 * Bringt die Ebene diesen Artikel — und keine andere? Einer, der auch in
 * einer zweiten Ebene steht, bringt die auch; er bleibt.
 */
/** `e5_spell_x` → `e5_`; ohne Unterstrich keines. */
function idPraefix(id: string): string | undefined {
  return /^([a-z0-9]+_)/i.exec(id)?.[1];
}

/** Die Präfixe der Datei — `null`, wenn eine Id keines hat (dann schützt das Präfix nichts). */
function idPraefixe(ids: Iterable<string>): Set<string> | null {
  const raus = new Set<string>();
  for (const id of ids) {
    const p = idPraefix(id);
    if (!p) return null;
    raus.add(p);
  }
  return raus;
}

function nurInEbene(e: Entity, ebene: string): boolean {
  const ziele = (e.relations ?? []).filter((r) => r.type === 'inLayer').map((r) => r.to);
  return ziele.length > 0 && ziele.every((z) => z === ebene);
}

/** „Spell 12, Feature 3" — gelöscht je Art, die häufigste zuerst. */
function jeArt(liste: Entity[]): string {
  const n = new Map<string, number>();
  for (const e of liste) n.set(e.interfaces?.[0] ?? '?', (n.get(e.interfaces?.[0] ?? '?') ?? 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t, k]) => `${t} ${k}`).join(', ');
}

/**
 * **Was je Ebene neu ist** (T-296): ein Lauf über viele Quellen sagt sonst
 * nur eine Summe, und wer je Buch berichten muss, bräuchte je Buch einen
 * Lauf. Je Ebene eine Zeile, die grösste zuerst, darin je Art.
 */
export function jeEbene(neu: Entity[], alle: Map<string, Entity>): string {
  const nachEbene = new Map<string, Entity[]>();
  for (const e of neu) {
    const ebene = (e.relations ?? []).find((r) => r.type === 'inLayer')?.to ?? '';
    nachEbene.set(ebene, [...(nachEbene.get(ebene) ?? []), e]);
  }
  const zeilen = [...nachEbene].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])).map(([ebene, liste]) => {
    const l = alle.get(ebene);
    const name = ebene ? `${l ? entityName(l) : ebene} (${ebene})` : 'ohne Ebene';
    return `  ${name}: ${liste.length} — ${jeArt(liste)}`;
  });
  return `Neu je Ebene:\n${zeilen.join('\n')}`;
}

function kantenText(kanten: string[], was: string): string {
  const zeigen = kanten.slice(0, 50);
  return `${kanten.length} Kanten aus bleibenden Artikeln ${was}:\n  ${zeigen.join('\n  ')}${kanten.length > 50 ? `\n  … ${kanten.length - 50} weitere` : ''}`;
}

/**
 * Die Registerteile der Datei, die die Ablage kennt. Was sie nicht kennt,
 * kommt als Name zurück und steht in der Meldung — still weggelassen sähe
 * es aus wie übernommen. `enums` und `settings` kennt sie seit Migration 019.
 */
async function schreibeRegister(repo: Repository, roh: unknown, registry: Registry): Promise<string[]> {
  if (roh === undefined) return [];
  const teile = roh as Record<string, unknown>;
  const liegen = Object.keys(teile).filter((t) => t !== 'components' && !(TEILE as readonly string[]).includes(t));
  for (const teil of TEILE) {
    if (teile[teil] === undefined) continue;
    switch (teil) {
      case 'interfaces': await repo.putRegistryPart('interfaces', registry.interfaces); break;
      case 'relations': await repo.putRegistryPart('relations', registry.relations); break;
      case 'views': await repo.putRegistryPart('views', registry.views); break;
      case 'units': await repo.putRegistryPart('units', registry.units); break;
      case 'vars': await repo.putRegistryPart('vars', registry.vars); break;
      case 'enums': await repo.putRegistryPart('enums', registry.enums ?? {}); break;
      case 'settings': await repo.putRegistryPart('settings', registry.settings ?? {}); break;
    }
  }
  return liegen;
}

function liegenText(liegen: string[]): string {
  return liegen.length ? `\nNicht gespeichert, die Ablage kennt sie nicht: ${liegen.join(', ')}.` : '';
}

const direkt = process.argv[1]?.endsWith('import.ts') || process.argv[1]?.endsWith('import.js');
if (direkt) {
  const args = process.argv.slice(2);
  const datei = args.find((a) => !a.startsWith('--'));
  if (!datei) {
    console.error('import <datei> [--only-new [--additions] | --replace | --replace-layer[=<id|Name>] | --layers] [--dry-run]');
    process.exit(2);
  }
  const ebenenArg = args.find((a) => a === '--replace-layer' || a.startsWith('--replace-layer='));
  const replaceLayer = ebenenArg === undefined ? undefined : ebenenArg.includes('=') ? ebenenArg.slice(ebenenArg.indexOf('=') + 1) : true;
  if (replaceLayer === '') {
    console.error('`--replace-layer=` ohne Ebene — Id oder Name nennen, oder `--replace-layer` allein für die Ebene der Datei.');
    process.exit(2);
  }
  /* pnpm startet im Paketverzeichnis; ein relativer Pfad meint das, von wo
     aus jemand den Befehl getippt hat. */
  const pfad = resolve(process.env['INIT_CWD'] ?? process.cwd(), datei);
  const { closePool, getPool } = await import('./db.js');
  const { PgRepository } = await import('./repo.pg.js');
  const repo = new PgRepository(getPool());
  try {
    const daten = JSON.parse(readFileSync(pfad, 'utf8')) as unknown;
    const r = await runImport(repo, daten, { replace: args.includes('--replace'), replaceLayer, onlyNew: args.includes('--only-new'), additions: args.includes('--additions'), layers: args.includes('--layers'), dryRun: args.includes('--dry-run') });
    console.log(r.text);
  } catch (x) {
    console.error((x as Error).message);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}
