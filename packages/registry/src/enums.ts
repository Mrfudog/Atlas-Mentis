import type { EnumDef } from '@nw/model';

/**
 * `enum` rows — **eine Liste von Wörtern, die einen Namen hat.**
 *
 * Eine Aufzählungszeile trägt keine Felder, also ist sie kein Typ mit
 * Schema; sie ist trotzdem eine Zeile im Register wie jede andere, und ein
 * Feld nennt sie über `enumRef`. Damit hat `Skill.ability` einen **Typ**
 * (`Ability`) statt einer eigenen Kopie derselben sechs Wörter.
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

  /**
   * **Die Fertigkeiten.** Welche es gibt, steht hier; **welches Attribut**
   * jede benutzt, steht in der Einstellung `skills` (`stealth:dex`). Zwei
   * Stellen, aber nicht zweimal dasselbe: die Zeile sagt, was es gibt, die
   * Einstellung sagt, wie gerechnet wird. Eine Fertigkeit ohne Eintrag in
   * der Einstellung rechnet auf `dex` und steht trotzdem in der Liste.
   *
   * Eines Tages ist eine Fertigkeit ein Artikel — dann hat sie ihren
   * Regeltext, ihr Attribut und ihre Kanten an einer Stelle, und beide hier
   * fallen weg. Bis dahin ist sie ein Wort in einer Liste.
   */
  Skill: {
    name: 'Skill',
    label: 'Skill',
    values: [
      'acrobatics', 'animalHandling', 'arcana', 'athletics', 'deception',
      'history', 'insight', 'intimidation', 'investigation', 'medicine',
      'nature', 'perception', 'performance', 'persuasion', 'religion',
      'sleightOfHand', 'stealth', 'survival',
    ],
  },

  /* Werkzeuge, Sprachen, Waffen- und Rüstungsgruppen: **Regelvokabular**,
     aus dem sich Übungen zusammensetzen. Sie stehen als Listen und nicht als
     Artikel, weil an einem Werkzeugnamen nichts weiter hängt als der Name;
     sobald ein Werkzeug einen Regeltext hätte, wäre es ein Artikel. */
  Tool: {
    name: 'Tool',
    label: 'Tool',
    values: [
      'Alchemistenwerkzeug', 'Diebeswerkzeug', 'Fälscherwerkzeug',
      'Kerzenzieherwerkzeug',
    ],
  },

  Language: {
    name: 'Language',
    label: 'Language',
    values: ['Gemeinsprache', 'Diebeszinken', 'Elfisch', 'Halblingisch'],
  },

  WeaponTraining: {
    name: 'WeaponTraining',
    label: 'Weapon training',
    values: ['Einfache Waffen', 'Kriegswaffen'],
  },

  ArmorTraining: {
    name: 'ArmorTraining',
    label: 'Armour training',
    values: ['Leichte Rüstung', 'Mittlere Rüstung', 'Schwere Rüstung', 'Schilde'],
  },

  /* Die Hausregel: worin sich jemand **auskennt**. Ein Anfang, der ersetzt
     werden soll — die Liste gehört der Kampagne, und sie steht hier, damit
     sie an einer Stelle steht und nicht in jedem Bogen neu erfunden wird. */
  KnowledgeField: {
    name: 'KnowledgeField',
    label: 'Field of knowledge',
    values: ['Kräuterkunde', 'Stadtgeschichte', 'Nebelkunde'],
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

  State: {
    name: 'State',
    label: 'State',
    values: ['idea', 'prepared', 'ready'],
  },
};
