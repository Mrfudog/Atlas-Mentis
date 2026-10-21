import type { LayoutElement, TypeLayout } from '@nw/model';

/**
 * **Die ersten sinnvollen Ansichten je Art** (T-110 Schritt 7, REQ-256).
 *
 * Bis T-110 sagte fast jede Art nur ihre `overview` (die Spalten im
 * Kompendium) und manche ihre `full`; die Karte (`quick`) zeigte überall
 * Beschreibung und Absatz — beim Zauber nicht einmal den Grad —, und den
 * Druck gab es nicht. Hier steht, was dazukommt, und zwar **als Anpassung**
 * (`{ adjust }`): die Karte nimmt die zwei, drei Werte, an denen man eine
 * Sache erkennt, der Druck setzt Statblock, Zauber und Gegenstand wie im
 * Buch obenan. Ändert sich die Ansicht, gilt die Anpassung über dem Neuen.
 *
 * Die Einträge werden in `index.ts` an ihre Art gehängt — die Anordnung
 * wohnt am Typ, im Register wie in der Datenbank; hier stehen sie nur
 * beieinander, weil Migration 052 dieselben Zeilen in bestehende
 * Datenbanken bringt (nur, wo die Art für die Ansicht noch nichts sagt) und
 * ein Test prüft, dass beide gleich sind — samt den Migrationen, die eine
 * Zeile später nachziehen (`Creature.quick`, T-206: Migration 083).
 *
 * Ausgewählt nach dem, was die Karte ohne Einheit lesbar zeigt: die Karte
 * druckt Rohwerte („60" ohne Fuss), also keine Masse; was gerechnet wird,
 * steht auf der Seite.
 */

/** Felder, die die Karte (`quick`, Element `q-f`) für eine Art dazunimmt. */
const karte = (...felder: string[]): TypeLayout => ({ adjust: { add: { 'q-f': felder } } });

/**
 * Der Druck mit einem Buch-Element obenan: es nimmt seine Karten, die
 * Feldtabelle den Rest. `drop` für Elemente, die das Buch-Element schon
 * zeichnet — der Statblock setzt seine Abschnitte (Aktionen …) selbst.
 */
/**
 * Die Artikelseite mit einer Übersicht gleich unter Bild und Beschreibung
 * (T-191): Klasse, Herkunft und Hintergrund zeigen sich so, wie es die
 * eigenen Seiten taten. Die Feldtabelle bleibt für den Rest.
 */
const uebersicht = (el: LayoutElement['el']): TypeLayout => ({
  adjust: { extra: [{ id: `l-${el}`, el }], order: ['l-img', 'l-desc', `l-${el}`] },
});

const buchDruck = (el: LayoutElement['el'], drop: string[] = []): TypeLayout => ({
  adjust: { ...(drop.length ? { drop } : {}), extra: [{ id: `p-${el}`, el }], order: [`p-${el}`] },
});

/**
 * **Der Handzettel einer Art** (T-234): die Werte, die man den Spielenden
 * mit der Sache in die Hand gibt — Seltenheit eines Gegenstands, Art eines
 * Orts —, nie, was nur die Leitung braucht (Haltung, Taktik, Ziel einer
 * Fraktion). Was zurückgehalten ist, kommt ohnehin nicht an; der Zettel
 * lässt auch weg, was die Leitung beim Drucken für sich sähe.
 */
const zettel = (...felder: string[]): TypeLayout => ({ adjust: { add: { 'h-f': felder } } });

/**
 * Das Buch-Element als Karte auf dem Zettel: ein Zauber, wie man ihn
 * austeilt. Es zeichnet die Beschreibung selbst — ohne `drop` stünde sie
 * zweimal da.
 */
const buchZettel = (el: LayoutElement['el']): TypeLayout => ({
  adjust: { drop: ['h-desc'], extra: [{ id: `h-${el}`, el }], order: ['h-img', `h-${el}`] },
});

/**
 * **Das „+" der Suche** (T-138, T-234) nimmt dieselben Werte wie die Karte:
 * beide beantworten „was habe ich da vor mir?". Abgeleitet, damit eine
 * neue Kartenzeile nicht vergessen wird.
 */
const suche = (quick: TypeLayout | undefined): TypeLayout | undefined => {
  const felder = quick && 'adjust' in quick ? quick.adjust.add?.['q-f'] : undefined;
  return felder?.length ? { adjust: { add: { 's-f': [...felder] } } } : undefined;
};

const grund: Record<string, Record<string, TypeLayout>> = {
  /* Regeln */
  Spell: {
    quick: karte('Spell.level', 'Spell.school', 'Spell.concentration', 'Spell.ritual'),
    print: buchDruck('spell'),
    handout: buchZettel('spell'),
  },
  Class: { quick: karte('Class.hitDie', 'Class.primaryAbility'), full: uebersicht('classOverview') },
  Ancestry: { quick: karte('Ancestry.size'), full: uebersicht('originOverview') },
  Background: { full: uebersicht('originOverview') },
  Feat: { quick: karte('Feat.prerequisite') },
  Rule: { quick: karte('Rule.kind') },
  Statblock: { print: buchDruck('statblock', ['p-c']) },
  /* Welt */
  Item: {
    quick: karte('Item.itemType', 'Item.rarity', 'Item.attunement'),
    print: buchDruck('item'),
    handout: zettel('Item.itemType', 'Item.rarity', 'Item.attunement'),
  },
  Weapon: { quick: karte('Weapon.category', 'Weapon.damage', 'Weapon.damageType'), handout: zettel('Weapon.category', 'Weapon.damage', 'Weapon.damageType') },
  Armor: { quick: karte('Armor.armorType', 'Armor.ac'), handout: zettel('Armor.armorType', 'Armor.ac') },
  /* Eine Kreatur zeigt auf der Karte die Kennzahlen ihres Statblocks und
     ihren Stand (T-206), gleich unter dem Bild. */
  Creature: {
    quick: {
      adjust: {
        add: { 'q-f': ['Creature.kind', 'Creature.species', 'Creature.role', 'Creature.attitude'] },
        extra: [{ id: 'c-q-stats', el: 'stats' }],
        order: ['q-img', 'c-q-stats'],
      },
    },
    /* Wer jemand ist, nicht wie man zu ihm steht: Haltung und Rolle sind
       Sache der Leitung. */
    handout: zettel('Creature.species'),
  },
  Place: { quick: karte('Place.kind', 'Place.environment'), handout: zettel('Place.kind', 'Place.environment') },
  /* Das Ziel einer Fraktion ist oft ihr Geheimnis — auf dem Zettel nur, was sie ist. */
  Faction: { quick: karte('Faction.kind', 'Faction.goal'), handout: zettel('Faction.kind') },
  Deity: { quick: karte('Deity.pantheon', 'Deity.alignment'), handout: zettel('Deity.pantheon', 'Deity.domains') },
  Hazard: { quick: karte('Hazard.kind', 'Hazard.threat') },
  /* Was bis T-234 auf der Karte nur Bild und Satz zeigte: Begegnung und
     Karte erkennt man an Art und Stand, ein Rezept am Beruf, eine Gruppe an
     Stufe und Motto, ein Ereignis an Art und Datum. */
  Encounter: { quick: karte('Encounter.kind', 'Encounter.phase', 'Difficulty') },
  Map: { quick: karte('Map.kind') },
  Recipe: { quick: karte('Recipe.trade', 'Recipe.time') },
  Party: { quick: karte('Party.level', 'Party.motto') },
  Event: { quick: karte('Event.kind', 'Time.display') },
  /* Geschichte */
  /* Eine Geschichte (und damit Arc und Sitzung) zeigt, was für eine und wann. */
  Story: { quick: karte('Story.kind', 'Story.played') },
  Arc: { quick: karte('Arc.levelFrom', 'Arc.levelTo') },
  Scene: { quick: karte('Scene.mode', 'Difficulty') },
  Quest: { quick: karte('Quest.progress', 'Quest.reward'), handout: zettel('Quest.progress', 'Quest.reward') },
  /* Eine Ebene liest sich an ihr selbst als Buch (T-191): die Leseansicht
     ist ein Element ihrer Seite und keine eigene. Darüber steht, was sie
     bringt, als Baum mit der Wahl der Kampagne (T-189). */
  Layer: { full: { adjust: { extra: [{ id: 'l-contents', el: 'contents' }, { id: 'l-reader', el: 'reader' }] } } },
};

/* Je Art mit Kartenwerten dieselben Werte unter dem „+" der Suche. */
export const typeViews: Record<string, Record<string, TypeLayout>> = Object.fromEntries(
  Object.entries(grund).map(([art, vs]) => {
    const s = suche(vs['quick']);
    return [art, s ? { ...vs, search: s } : vs];
  }),
);
