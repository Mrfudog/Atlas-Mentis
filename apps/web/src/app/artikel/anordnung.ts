/**
 * **Was eine Ansicht von einem Artikel zeichnet** — die Feldzellen, die
 * Prosa und wie die Elemente der Anordnung sie unter sich aufteilen.
 *
 * Stand in der Artikelseite. Seit T-110 zeichnen der Druck und die Vorschau
 * im Register dieselbe Ansicht für andere Orte, und zwei Abschriften
 * derselben Zuteilung liefen beim ersten neuen Element auseinander.
 */

import {
  BOOK_CARDS,
  choicesOf,
  choiceText,
  effectText,
  elementTakes,
  entriesOf,
  entryRef,
  fieldText,
  fieldTitle,
  primaryInterface,
  proseFields,
  storedEffects,
  typeChain,
  unitsFor,
} from '@nw/model';
import type { Entity, LayoutElement, Registry } from '@nw/model';
import { anzeigeWert, sindZeilen, tabelleAlsText, verweisZiele } from './felder';

/** Was schon anderswo steht: der Name als Überschrift, Nummer, Sichtbarkeit und Quelle. */
export const SCHON_ANDERSWO = ['Identity', 'Visibility', 'Source'];

export interface Zelle {
  ref: string;
  comp: string;
  prop: string;
  label: string;
  wert: string;
  /** An einer Instanz: der Wert kommt von der Vorlage. */
  geerbt?: boolean;
  /** Ein langes Textfeld: gezeichnet als Markdown (M10), nicht als Zeile. */
  lang?: boolean;
  /** Ein Verweisfeld: Namen als Links statt Ids (T-068). */
  links?: { ziel: string; text: string }[];
  /** Hier leer, aber eine andere Fassung füllt es (T-103): „hier —", daneben ihr Wert. */
  leer?: boolean;
  /** Leer, und die Ansicht zeigt leere Felder (`ViewDef.empty: 'show'`, T-110). */
  fehlt?: boolean;
  /** Ein Bildfeld (`format: 'asset'`, T-114): gezeichnet als Vorschau, nicht als Id. */
  bild?: string;
}

export interface Prosa {
  ref: string;
  type: string;
  key: string;
  label: string;
  wert: string;
  /** Hier kein Eintrag, aber eine andere Fassung hat einen (T-103). */
  leer?: boolean;
}

/** Ein Stück der gezeichneten Seite — ein Layout-Element, aufgelöst. */
export interface Stueck {
  id: string;
  art:
    | 'statblock'
    | 'stats'
    | 'token'
    | 'spell'
    | 'item'
    | 'beschreibung'
    | 'felder'
    | 'prosa'
    | 'teile'
    | 'fluss'
    /** Die Leseansicht (T-191): das Buch der Ebene, über die ganze Breite. */
    | 'leser'
    /** Der Inhalt einer Quelle als Baum mit der Wahl der Kampagne (T-189). */
    | 'inhalt'
    /** Die Klassenübersicht (T-191). */
    | 'klasse'
    /** Die Übersicht einer Herkunft oder eines Hintergrunds (T-191). */
    | 'herkunft'
    | 'ueberschrift'
    | 'absatz'
    | 'kanten'
    | 'handwerk'
    | 'laden'
    | 'wissen'
    | 'bild'
    | 'karte'
    | 'liegen'
    | 'regeln'
    | 'verlinkt'
    /** Der Kopf der Spielerseite (T-247). */
    | 'bogen'
    /** „Your turn" (T-247). */
    | 'zug'
    /** Die Zauber einer Figur (T-246). */
    | 'zauberliste'
    /** Was die Kampagne einer Figur gezeigt hat (T-247). */
    | 'kampagne';
  text?: string;
  /** Der Reiter, in dem das Stück steht (T-247); ohne steht es über allen. */
  reiter?: string;
  /** Das Bild (`Image.image` oder das Asset selbst, T-114) mit Unterschrift und Alternativtext. */
  bild?: { wert: string; caption: string; alt: string; version?: string };
  zellen?: Zelle[];
  prosa?: Prosa[];
  /** `verlinkt`: nur diese Arten am anderen Ende, oder alle ausser diesen (T-125). */
  nur?: string[];
  ausser?: string[];
}

/** Reiter gibt es auf einem Blatt nicht: ihre Gruppen stehen nacheinander. */
export function flach(layout: readonly LayoutElement[]): LayoutElement[] {
  return mitReiter(layout).map((x) => x.el);
}

/**
 * **Flach, aber mit dem Reiter, in dem ein Element steht** (T-247). Die
 * Artikelseite zeichnet Reiter als Reiter — am Tisch schaut man auf einen,
 * und zwischen Kampf und Zaubern zu scrollen ist der Weg, den die Leitung
 * nicht will. Ein Blatt (Druck) liest weiter alles nacheinander. Reiter in
 * Reitern zählen zum äussersten.
 */
export function mitReiter(layout: readonly LayoutElement[], reiter?: string): { el: LayoutElement; reiter?: string }[] {
  return layout.flatMap((el) =>
    el.el === 'tabs'
      ? (el.tabs ?? []).flatMap((t) => mitReiter(t.layout, reiter ?? t.id))
      : [{ el, ...(reiter ? { reiter } : {}) }],
  );
}

/** Die Reiter einer Anordnung, in ihrer Reihenfolge (nur die äussersten). */
export function reiterVon(layout: readonly LayoutElement[]): { id: string; label: string }[] {
  return layout.flatMap((el) => (el.el === 'tabs' ? (el.tabs ?? []).map((t) => ({ id: t.id, label: t.label })) : []));
}

/**
 * **Jede Feldzelle des Artikels**, in der Reihenfolge, in der die Art ihre
 * Felder erklärt. Welche davon wo stehen, sagt die Anordnung (`anordnen`).
 * Ein Mass steht mit Einheit da, umgerechnet nach `units` (D8) — „Range
 * 150" ohne Einheit gibt es nicht.
 */
export function feldZellen(r: Registry, e: Entity, name: (id: string) => string | undefined): Zelle[] {
  const typ = primaryInterface(e);
  const mode = unitsFor(r, typ);
  const out: Zelle[] = [];
  /* Ein Prosafeld steht nicht in der Feldtabelle, es gehört dem Absatz
     darunter (`prosa`) — hier stand es als „[object Object]" (W1). */
  const prosa = new Set(proseFields(r, typ).map((f) => `${f.type}.${f.key}`));
  for (const [comp, karte] of Object.entries(e.components ?? {})) {
    /* Was schon anderswo steht: der Name als Überschrift, Aliasse und
       Nummer darüber und darunter, Sichtbarkeit und Quelle in der
       Seitenspalte. Zweimal dasselbe liest sich wie ein Fehler. */
    if (SCHON_ANDERSWO.includes(comp)) continue;
    const def = r.interfaces[comp];
    const werte = (karte ?? {}) as Record<string, unknown>;
    const reihe = [
      ...Object.keys(def?.schema?.properties ?? {}).filter((k) => k in werte),
      ...Object.keys(werte).filter((k) => !(k in (def?.schema?.properties ?? {}))),
    ];
    /* Tabellenzeilen (`Table.rows`) werden eine Tabelle, ihr Kopf
       (`columns`) steht darin und nicht noch einmal als Zeile. */
    const zeilen = Object.keys(werte).find((k) => sindZeilen(werte[k]));
    for (const prop of reihe) {
      const wert = werte[prop];
      if (prosa.has(`${comp}.${prop}`)) continue;
      if (zeilen && prop === 'columns') continue;
      if (wert === null || wert === undefined || wert === '') continue;
      const schema = def?.schema?.properties?.[prop];
      /* Ein Prosafeld gehört dem Element `prose`, nicht der Tabelle. */
      if (schema?.many && schema.format === 'long') continue;
      /* Ein Schlüssel zum Ordnen liest niemand (`editOnly`, T-126). */
      if (schema?.editOnly) continue;
      /* Tabellenzeilen und Objekte liest `anzeigeWert` — `fieldText`
         kennt Masse und Einheiten, aber keine Karten in einer Liste (W1). */
      const tabelle = prop === zeilen && sindZeilen(wert);
      const objekt =
        typeof wert === 'object' &&
        (!Array.isArray(wert) || wert.some((x) => x !== null && typeof x === 'object'));
      /* Eine Wahl liest sich als Satz („Choose 2 from …", REQ-238),
         nicht als ihre Schlüssel. */
      const text = tabelle
        ? tabelleAlsText(werte['columns'], wert)
        : comp === 'Choices' && prop === 'choices'
          ? choicesOf(e).map((c) => `${c.level && c.level > 1 ? `Level ${c.level}: ` : ''}${choiceText(c)}`).join('; ')
          : /* Ebenso eine Wirkung („Strength becomes 19", E-025 a). */
            comp === 'Effects' && prop === 'effects'
            ? storedEffects(e).map(effectText).join('; ')
            : objekt
              ? anzeigeWert(wert)
              : fieldText(r, schema, wert, mode);
      if (!text) continue;
      /* Ein Verweisfeld zeigt Namen, die auf ihren Artikel führen, und
         nicht die Id (T-068) — auch eine Liste davon. */
      const links = schema?.format === 'link' ? verweisZiele(wert, name) : undefined;
      out.push({
        ...(links?.length ? { links } : {}),
        ...(schema?.format === 'asset' && typeof wert === 'string' ? { bild: wert } : {}),
        ref: `${comp}.${prop}`,
        comp,
        prop,
        lang: tabelle || (schema?.format === 'long' && typeof wert === 'string'),
        label: schema ? fieldTitle(r, typ, { type: comp, key: prop, prop: schema }) : prop,
        wert: text,
        geerbt: e.fromTemplate?.fields.includes(`${comp}.${prop}`) ?? false,
      });
    }
  }
  return out;
}

/**
 * **Die leeren Felder dazu** (`ViewDef.empty: 'show'`, T-110): jedes Feld,
 * das die Art erklärt und der Artikel nicht füllt, als „—" hinter der
 * letzten Zelle derselben Karte. Nicht dabei: was gerechnet wird (es hat
 * immer einen Wert oder keinen Sinn), Prosa (sie gehört dem Element
 * `prose`), die Beschreibung (sie ist ein eigenes Element) und was schon
 * anderswo steht.
 */
export function mitLeeren(r: Registry, e: Entity, zellen: readonly Zelle[]): Zelle[] {
  const typ = primaryInterface(e);
  const da = new Set(zellen.map((z) => z.ref));
  const out = [...zellen];
  for (const comp of typeChain(r, typ)) {
    if (SCHON_ANDERSWO.includes(comp)) continue;
    for (const [prop, schema] of Object.entries(r.interfaces[comp]?.schema?.properties ?? {})) {
      const ref = `${comp}.${prop}`;
      if (da.has(ref) || schema.derived || schema.editOnly || (schema.many && schema.format === 'long')) continue;
      if (ref === 'Description.description') continue;
      const zelle: Zelle = {
        ref,
        comp,
        prop,
        label: fieldTitle(r, typ, { type: comp, key: prop, prop: schema }),
        wert: '—',
        fehlt: true,
      };
      let hinter = -1;
      out.forEach((z, i) => {
        if (z.comp === comp) hinter = i;
      });
      if (hinter < 0) out.push(zelle);
      else out.splice(hinter + 1, 0, zelle);
      da.add(ref);
    }
  }
  return out;
}

/**
 * Die Prosa dieses Artikels. Sie steht in Feldern mit `many` und langer
 * Eingabe — es gibt keine zweite Sorte Inhalt mehr neben den Karten —,
 * und jeder Eintrag trägt die Id, an der die Wissensfreigabe hängt.
 */
export function prosaVon(r: Registry, e: Entity): Prosa[] {
  const typ = primaryInterface(e);
  const out: Prosa[] = [];
  for (const f of proseFields(r, typ)) {
    const karte = (e.components?.[f.type] ?? {}) as Record<string, unknown>;
    for (const eintrag of entriesOf(karte[f.key])) {
      out.push({
        ref: entryRef(f.type, f.key, eintrag.id),
        type: f.type,
        key: f.key,
        label: fieldTitle(r, typ, f),
        wert: eintrag.value,
      });
    }
  }
  return out;
}

/**
 * **Die Seite, wie die Anordnung sie sagt.** Ein Statblock zeichnet sich
 * wie im Buch, weil das Register an `Statblock` das Element `statblock`
 * setzt — hier steht kein Artname (W2).
 *
 * Jedes Element nimmt, was es zeichnet, aus dem Rest; **was keines
 * zeichnet, steht am Ende, wenn die Ansicht es sagt** (`ViewDef.rest`,
 * T-110). Die Artikelseite tut es: sie kennt noch nicht jedes Element
 * (Bogen, Inventar, Karte …), und ein Feld, das nur dort stünde, wäre
 * sonst nirgends zu lesen. Eine Karte tut es nicht.
 */
export function anordnen(
  layout: readonly LayoutElement[],
  zellen: readonly Zelle[],
  prosa: readonly Prosa[],
  opt: {
    beschreibung: string | null;
    beschreibungZeigen?: boolean;
    rest: boolean;
    /** Das Bild des Artikels (`bildDes`, T-114) — fürs Element `image`. */
    bild?: { wert: string; caption: string; alt: string; version?: string } | null;
  },
): Stueck[] {
  const felderDa = new Set<string>();
  const prosaDa = new Set<string>();
  const da = (typ: string, feld: string) => felderDa.has(typ) || felderDa.has(`${typ}.${feld}`);
  const out: Stueck[] = [];

  for (const { el, reiter } of mitReiter(layout)) {
    const vorher = out.length;
    switch (el.el) {
      case 'statblock':
      case 'spell':
      case 'item': {
        for (const karte of BOOK_CARDS[el.el] ?? []) felderDa.add(karte);
        /* Der Zauber zeichnet seinen Text selbst, weil „At Higher Levels"
           dahinter steht. */
        if (el.el === 'spell') {
          felderDa.add('Description.description');
          prosa.filter((b) => b.type === 'Prose' && b.key === 'paragraph').forEach((b) => prosaDa.add(b.ref));
        }
        out.push({ id: el.id, art: el.el });
        break;
      }
      case 'stats':
        /* Die Kennzahlen (T-206) nehmen kein Feld aus der Tabelle: sie sind
           ein Auszug, und der Bogen oder die Tabelle zeigt dieselben Werte. */
        out.push({ id: el.id, art: 'stats' });
        break;
      case 'token':
        /* Das Token (T-297) holt sich, was es braucht (`refs.token`). */
        out.push({ id: el.id, art: 'token' });
        break;
      case 'description': {
        const text = opt.beschreibung;
        felderDa.add('Description.description');
        /* Auch leer, wenn eine andere Fassung eine hat (T-103). */
        if (text || opt.beschreibungZeigen) out.push({ id: el.id, art: 'beschreibung', text: text ?? '' });
        break;
      }
      case 'fields': {
        /* „Alle Felder" heisst nicht Bild, Unterschrift und Alternativtext:
           die gehören dem Element `image` (T-114), und eine Unterschrift
           ohne Bild sagt nichts (T-090). Wer sie einzeln nennt, bekommt sie. */
        const alle = el.fields === undefined || el.fields === 'all';
        const hier = zellen.filter(
          (z) => !da(z.comp, z.prop) && elementTakes(el, z.comp, z.prop) && !(alle && z.comp === 'Image'),
        );
        hier.forEach((z) => felderDa.add(z.ref));
        if (hier.length) out.push({ id: el.id, art: 'felder', zellen: hier });
        break;
      }
      case 'prose': {
        const hier = prosa.filter((b) => !prosaDa.has(b.ref) && elementTakes(el, b.type, b.key));
        hier.forEach((b) => prosaDa.add(b.ref));
        if (hier.length) out.push({ id: el.id, art: 'prosa', prosa: hier });
        break;
      }
      case 'composed':
        out.push({ id: el.id, art: 'teile' });
        break;
      /* Das Handwerk: der Fertigungswert am Rezept (T-122, `refs.craft`)
         und die Werkbank (T-128) — am Rezept einen Auftrag starten, am
         Auftrag Proben und Abschluss (`nw-werkstatt`). */
      case 'crafting':
        /* Fortschritt, Ausgang und Proben eines Auftrags zeichnet die
           Werkbank selbst — als lose Felder stünden sie doppelt da. */
        felderDa.add('CraftingOrder');
        out.push({ id: el.id, art: 'handwerk' });
        break;
      /* Was an der Sitzung läuft (`live`): bisher zeichnet die Seite davon
         das Liegengelassene und „End session" (T-140); Szene, Kampf und
         Karte stehen in den Feldern, bis Play sie übernimmt. */
      case 'live':
        out.push({ id: el.id, art: 'liegen' });
        break;
      /* Die Waren eines Ladens (T-129): gerechnet am Server (`refs.shop`). */
      case 'wares':
        out.push({ id: el.id, art: 'laden' });
        break;
      /* Was ein Wissen vereint (T-287): die Komponente fragt selbst. */
      case 'knowledgeContents':
        out.push({ id: el.id, art: 'wissen' });
        break;
      /* Die Teile eines Kapitels oder einer Szene (T-108): die Komponente
         fragt selbst und zeichnet nichts, wo nichts hängt. */
      case 'parts':
        out.push({ id: el.id, art: 'fluss' });
        break;
      /* Die Leseansicht und die Übersichten (T-191): was früher eigene
         Seiten waren, zeichnet jetzt die Artikelseite an ihrer Stelle.
         Übungen und Wahlen stehen in der Übersicht und nicht noch einmal
         in der Tabelle (`BOOK_CARDS`). */
      case 'reader':
        out.push({ id: el.id, art: 'leser' });
        break;
      /* Der Inhalt einer Quelle (T-189): die Komponente fragt den Server. */
      case 'contents':
        out.push({ id: el.id, art: 'inhalt' });
        break;
      case 'classOverview':
      case 'originOverview':
        for (const karte of BOOK_CARDS[el.el] ?? []) felderDa.add(karte);
        out.push({ id: el.id, art: el.el === 'classOverview' ? 'klasse' : 'herkunft' });
        break;
      /* Die Regeloptionen (T-190): die genannten Felder stehen unter dem
         Reiter „Rules & options"; hier nur der Verweis dorthin. Die Zellen
         reiten mit, damit ein Blatt ohne Reiter sie als Felder zeichnet. */
      case 'rules': {
        const hier = el.fields?.length ? zellen.filter((z) => !da(z.comp, z.prop) && elementTakes(el, z.comp, z.prop)) : [];
        hier.forEach((z) => felderDa.add(z.ref));
        out.push({ id: el.id, art: 'regeln', zellen: hier });
        break;
      }
      case 'heading':
        if (el.text) out.push({ id: el.id, art: 'ueberschrift', text: el.text });
        break;
      /* Das Bild des Artikels (T-114): `Image.image`, und an einem Asset
         die eigene Datei. Seine Felder stehen dann nicht noch einmal da. */
      case 'image':
        ['Image.image', 'Image.caption', 'Image.alt'].forEach((x) => felderDa.add(x));
        if (opt.bild) out.push({ id: el.id, art: 'bild', bild: opt.bild });
        break;
      /* Die Karte (T-115): ihr Bild ist `Image.image`, und das zeichnet
         sie selbst — als Kartenbild mit Gitter und Markern auf der Seite,
         als Bild auf dem Blatt. */
      case 'map':
        felderDa.add('Image.image');
        out.push({ id: el.id, art: 'karte', ...(opt.bild ? { bild: opt.bild } : {}) });
        break;
      case 'text':
        if (el.text) out.push({ id: el.id, art: 'absatz', text: el.text });
        break;
      /* Die Kanten: die Artikelseite hat sie in der Seitenspalte und
         zeichnet das Stück nicht; ein Blatt ohne Spalte schon. */
      case 'relations':
        out.push({ id: el.id, art: 'kanten' });
        break;
      /* Was über eine `asField`-Kante hängt (T-125): der Statblock einer
         Kreatur, ihr Inventar — gezeichnet an ihrem Ort, mit Eingaben,
         die in seinen Artikel schreiben. `except` nennt Arten am anderen
         Ende; das Inventar hat an der Kreatur seinen eigenen Reiter. */
      case 'linked':
        out.push({ id: el.id, art: 'verlinkt', ausser: [...(el.except ?? [])] });
        break;
      /* Das Inventar (T-125, Darstellung): am Träger das über `carries`
         getragene, an einem Inventar das, was es selbst hält — gezeichnet
         von `nw-inventar` (T-127: Raster, Gewicht oder Slots, Verschieben). */
      case 'inventory':
        out.push({ id: el.id, art: 'verlinkt', nur: ['Inventory'] });
        break;
      /* Die Spielerseite (T-247, T-246): Kopf, Zug, Zauber, Kampagne —
         jede Komponente fragt selbst und zeichnet nichts, wo nichts ist. */
      case 'sheet':
        felderDa.add('Vitals');
        out.push({ id: el.id, art: 'bogen' });
        break;
      case 'turn':
        out.push({ id: el.id, art: 'zug' });
        break;
      case 'spells':
        out.push({ id: el.id, art: 'zauberliste' });
        break;
      case 'campaign':
        out.push({ id: el.id, art: 'kampagne' });
        break;
      default:
        /* Board, Haltung … zeichnet noch niemand (W4 und
           später). Was sie tragen, steht im Rest, wo die Ansicht ihn will. */
        break;
    }
    if (reiter) for (let i = vorher; i < out.length; i++) out[i]!.reiter = reiter;
  }

  if (opt.rest) {
    /* Bild, Unterschrift und Alternativtext gehören dem Element `image`
       (T-114). Zeichnet die Ansicht keines, stehen sie nicht als lose
       Felder im Rest — eine Unterschrift ohne Bild sagt nichts (T-090). */
    const rest = zellen.filter((z) => !da(z.comp, z.prop) && z.comp !== 'Image');
    /* Mit Reitern steht der Rest im ersten — sonst hinge er unter jedem. */
    const erster = reiterVon(layout)[0]?.id;
    const im = erster ? { reiter: erster } : {};
    if (rest.length) out.push({ id: 'rest-f', art: 'felder', zellen: rest, ...im });
    const restProsa = prosa.filter((b) => !prosaDa.has(b.ref));
    if (restProsa.length) out.push({ id: 'rest-p', art: 'prosa', prosa: restProsa, ...im });
  }
  return out;
}
