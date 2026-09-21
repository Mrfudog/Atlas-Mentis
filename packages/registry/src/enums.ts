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
   * **Der Vorbereitungsstand eines Artikels** — nicht, was im Spiel mit ihm
   * geschehen ist.
   *
   * Drei Wörter: eine Idee, etwas Vorbereitetes, etwas Fertiges. `used` und
   * `discarded` standen hier einmal mit; das sind Ereignisse und keine
   * Zustände — dass eine Begegnung gespielt wurde, gehört ins Kampagnenlog
   * und nicht in ein Feld, das danach für immer „benutzt" sagt.
   */
  State: {
    name: 'State',
    label: 'State',
    values: ['idea', 'prepared', 'ready'],
  },
};
