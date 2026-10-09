import type { EnumDef } from '@nw/model';

/**
 * `enum` rows — **eine Liste von Wörtern, die einen Namen hat.**
 *
 * Eine Aufzählungszeile trägt keine Felder, also ist sie kein Typ mit
 * Schema; sie ist trotzdem eine Zeile im Register wie jede andere, und ein
 * Feld nennt sie über `enumRef`. Damit hat `Skill.ability` einen **Typ**
 * (`Ability`) statt einer eigenen Kopie derselben sechs Wörter. Ein Feld
 * darf statt einer Zeile auch eine **Artikelart** nennen (M6): dann sind
 * die Werte die Namen ihrer Artikel.
 *
 * Hier stehen nur die Listen, die **mehr als ein Feld** braucht. Was einem
 * Feld allein gehört, bleibt an ihm (`enum: [...]`): eine Zeile für eine
 * Liste mit einem Nutzer wäre der Umweg ohne den Gewinn — und der Gewinn
 * ist, dass sie sich an einer Stelle ändert.
 */
export const enums: Record<string, EnumDef> = {
  /* Die sechs Werte. Sie standen wörtlich an `SkillInfo.ability` und an
     `RecipeInfo.ability` — dieselbe Liste zweimal, und die eine, die
     niemand nachzieht, ist danach still falsch. */
  Ability: {
    name: 'Ability',
    label: 'Ability',
    values: ['str', 'dex', 'con', 'int', 'wis', 'cha'],
  },

  /* **Fertigkeiten, Sprachen, Werkzeuge, Waffen- und Rüstungsgruppen und
     Wissensgebiete standen hier als Zeilen** (`Skill`, `Language`, `Tool`,
     `WeaponTraining`, `ArmorTraining`, `KnowledgeField`). Seit M6 (D50)
     zieht `Proficiencies` aus Artikeln: eine Fertigkeit trägt ihr Attribut
     selbst (`Skill.ability`), eine Sprache ihre Schrift, ein Werkzeug ist
     ein Gegenstand, und die Gruppen sind die Listen von `Weapon.category`
     und `Armor.armorType`. Ein Wissensgebiet (Hausregel) ist eine
     Fertigkeit mit eigenem Artikel. Eine Zeile mit dem Wort daneben wäre
     die zweite Stelle für dieselbe Sache. */

  /**
   * **Die Grösse einer Kreatur**, englisch wie das Regelwerk (E3). Zwei
   * Felder nennen sie: der Statblock und die Abstammung (M3, M5).
   */
  Size: {
    name: 'Size',
    label: 'Size',
    values: ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'],
  },

  /**
   * **Die Schadensarten.** Waffe, Aktion und Zauber nennen sie — drei
   * Felder, und an der Waffe stand bis P4 ein freies Wort, das anbot, was
   * schon dastand.
   */
  DamageType: {
    name: 'DamageType',
    label: 'Damage type',
    values: [
      'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic',
      'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder',
    ],
  },

  /**
   * **Der Vorbereitungsstand eines Artikels** — nicht, was im Spiel mit ihm
   * geschehen ist.
   *
   * Drei Wörter: eine Idee, etwas Vorbereitetes, etwas Fertiges. `used` und
   * `discarded` standen hier einmal mit; das sind Ereignisse und keine
   * Zustände — dass eine Begegnung gespielt wurde, gehört ins Kampagnenlog
   * und nicht in ein Feld, das danach für immer „benutzt" sagt.
   */
  /**
   * **Was es kostet, etwas hervorzuholen.** Die Leiter steht am Tisch
   * ohnehin — eine freie Handlung, eine Bonushandlung, eine Handlung, ein
   * ganzer Zug, eine Runde —, und im Behälter sagt sie, wie lange es
   * dauert, bis das Ding in der Hand ist. Als Zeile und nicht im Code:
   * eine Kampagne mit einer anderen Leiter ist eine andere Zeile und kein
   * Codewechsel.
   */
  DrawTime: {
    name: 'DrawTime',
    label: 'Draw time',
    values: ['free action', 'bonus action', 'action', 'turn', 'round'],
  },

  /**
   * **Die Regeln ohne Träger (D48).** Zustand, Aktion, Merkmal, Talent,
   * Fertigkeit, Zauber haben eigene Arten; was übrig bleibt, trägt hier ein
   * Wort: `rule` (Variantregeln), `travel` (was eine Figur an einem
   * Reiseknoten tun kann, REQ-171), `sense`, `reward`, `boon`, `option`.
   */
  RuleKind: {
    name: 'RuleKind',
    label: 'Rule kind',
    values: ['rule', 'travel', 'sense', 'reward', 'boon', 'option'],
  },

  State: {
    name: 'State',
    label: 'State',
    values: ['idea', 'prepared', 'ready'],
  },
};
