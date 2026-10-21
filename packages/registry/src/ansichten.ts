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
 * **Die Karte nennt die Kennwerte einer Art** (T-346): drei bis sechs, die
 * man beim Öffnen sucht — beim Zauber Grad, Schule, Zeit und Reichweite,
 * beim Gegenstand Seltenheit und Gewicht. Sie stehen oben, das Bild steht
 * zuletzt (`quick` in `views.ts`). Masse rechnet die Karte um wie die
 * Seite; was gerechnet wird, steht auf der Seite. Den Preis nennt sie
 * nicht: er steht in Kupfer, und eine Währung als Einheit gibt es nicht.
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

const grund: Record<string, Record<string, TypeLayout>> = {
  /* Regeln */
  Spell: {
    quick: karte('Spell.level', 'Spell.school', 'Spell.castingAction', 'Spell.range', 'Spell.concentration', 'Spell.ritual'),
    print: buchDruck('spell'),
    handout: buchZettel('spell'),
  },
  Class: { quick: karte('Class.hitDie', 'Class.primaryAbility', 'Class.spellAbility'), full: uebersicht('classOverview') },
  Ancestry: { quick: karte('Ancestry.size', 'Ancestry.speed', 'Ancestry.creatureType', 'Ancestry.darkvision'), full: uebersicht('originOverview') },
  Background: { full: uebersicht('originOverview') },
  Feat: { quick: karte('Feat.prerequisite', 'Feat.repeatable') },
  Rule: { quick: karte('Rule.kind') },
  Statblock: { print: buchDruck('statblock', ['p-c']) },
  /* Welt */
  Item: {
    quick: karte('Item.itemType', 'Item.rarity', 'Item.attunement', 'Item.weight'),
    print: buchDruck('item'),
    handout: zettel('Item.itemType', 'Item.rarity', 'Item.attunement'),
  },
  Weapon: { quick: karte('Weapon.category', 'Weapon.damage', 'Weapon.damageType'), handout: zettel('Weapon.category', 'Weapon.damage', 'Weapon.damageType') },
  Armor: { quick: karte('Armor.armorType', 'Armor.ac', 'Armor.strength', 'Armor.stealthDisadvantage'), handout: zettel('Armor.armorType', 'Armor.ac') },
  /* Eine Kreatur zeigt auf der Karte zuerst die Kennzahlen ihres
     Statblocks und ihren Stand (T-206) — das Bild steht zuletzt (T-346). */
  Creature: {
    quick: {
      adjust: {
        add: { 'q-f': ['Creature.kind', 'Creature.species', 'Creature.role', 'Creature.attitude'] },
        extra: [{ id: 'c-q-stats', el: 'stats' }],
        order: ['c-q-stats'],
      },
    },
    /* Wer jemand ist, nicht wie man zu ihm steht: Haltung und Rolle sind
       Sache der Leitung. */
    handout: zettel('Creature.species'),
  },
  Place: { quick: karte('Place.kind', 'Place.environment', 'Place.state'), handout: zettel('Place.kind', 'Place.environment') },
  /* Das Ziel einer Fraktion ist oft ihr Geheimnis — auf dem Zettel nur, was sie ist. */
  /* Die Seite einer Fraktion zeigt ihre Struktur (T-341): Mitglieder mit
     Rang, Unterfraktionen, was sie beherrscht, wen sie wie sieht. */
  Faction: {
    quick: karte('Faction.kind', 'Faction.goal'),
    handout: zettel('Faction.kind'),
    full: { adjust: { extra: [{ id: 'fac-structure', el: 'structure' }] } },
  },
  Deity: { quick: karte('Deity.pantheon', 'Deity.title', 'Deity.alignment', 'Deity.domains'), handout: zettel('Deity.pantheon', 'Deity.domains') },
  Hazard: { quick: karte('Hazard.kind', 'Hazard.tier', 'Hazard.threat', 'Hazard.trigger') },
  /* Was bis T-234 auf der Karte nur Bild und Satz zeigte: Begegnung und
     Karte erkennt man an Art und Stand, ein Rezept am Beruf, eine Gruppe an
     Stufe und Motto, ein Ereignis an Art und Datum. */
  Encounter: { quick: karte('Encounter.kind', 'Encounter.phase', 'Difficulty') },
  Map: { quick: karte('Map.kind') },
  Recipe: { quick: karte('Recipe.trade', 'Recipe.tool', 'Recipe.dc', 'Recipe.time') },
  Party: { quick: karte('Party.level', 'Party.motto') },
  Event: { quick: karte('Event.kind', 'Time.display') },
  /* Geschichte */
  /* Eine Geschichte (und damit Arc und Sitzung) zeigt, was für eine und wann. */
  Story: { quick: karte('Story.kind', 'Story.played') },
  Arc: { quick: karte('Arc.levelFrom', 'Arc.levelTo') },
  Scene: { quick: karte('Scene.mode', 'Difficulty') },
  Quest: { quick: karte('Quest.progress', 'Quest.reward', 'Quest.deadline'), handout: zettel('Quest.progress', 'Quest.reward') },
  /* Eine Ebene liest sich an ihr selbst als Buch (T-191): die Leseansicht
     ist ein Element ihrer Seite und keine eigene. Darüber steht, was sie
     bringt, als Baum mit der Wahl der Kampagne (T-189). */
  Layer: { full: { adjust: { extra: [{ id: 'l-contents', el: 'contents' }, { id: 'l-reader', el: 'reader' }] } } },
};

/* Die Anordnungen je Art, in `index.ts` an ihre Art gehängt. Das „+" der
   Suche liest seit T-346 `quick` und hat keine eigenen mehr. */
export const typeViews: Record<string, Record<string, TypeLayout>> = grund;
