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
const buchDruck = (el: LayoutElement['el'], drop: string[] = []): TypeLayout => ({
  adjust: { ...(drop.length ? { drop } : {}), extra: [{ id: `p-${el}`, el }], order: [`p-${el}`] },
});

export const typeViews: Record<string, Record<string, TypeLayout>> = {
  /* Regeln */
  Spell: { quick: karte('Spell.level', 'Spell.school', 'Spell.concentration', 'Spell.ritual'), print: buchDruck('spell') },
  Class: { quick: karte('Class.hitDie', 'Class.primaryAbility') },
  Ancestry: { quick: karte('Ancestry.size') },
  Feat: { quick: karte('Feat.prerequisite') },
  Rule: { quick: karte('Rule.kind') },
  Statblock: { print: buchDruck('statblock', ['p-c']) },
  /* Welt */
  Item: { quick: karte('Item.itemType', 'Item.rarity', 'Item.attunement'), print: buchDruck('item') },
  Weapon: { quick: karte('Weapon.category', 'Weapon.damage', 'Weapon.damageType') },
  Armor: { quick: karte('Armor.armorType', 'Armor.ac') },
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
  },
  Place: { quick: karte('Place.kind', 'Place.environment') },
  Faction: { quick: karte('Faction.kind', 'Faction.goal') },
  Deity: { quick: karte('Deity.pantheon', 'Deity.alignment') },
  Hazard: { quick: karte('Hazard.kind', 'Hazard.threat') },
  /* Geschichte */
  Scene: { quick: karte('Scene.mode', 'Difficulty') },
  Quest: { quick: karte('Quest.progress', 'Quest.reward') },
};
