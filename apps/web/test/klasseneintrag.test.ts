/**
 * Ein Eintrag je Klasse (T-095): die Antworten einer Figur stehen bei der
 * Klasse, Abstammung oder dem Hintergrund, die fragen — auch bei zwei
 * Klassen und bei einem gewählten Talent, das selbst fragt.
 */

import { describe, expect, it } from 'vitest';
import type { Entity } from '@nw/model';
import { antwortenJeEintrag, antwortText } from '../src/app/artikel/klasseneintrag';

const k = (id: string, type: string, to: string, props: Record<string, unknown> = {}) => ({ id, type, to, props });

describe('one entry per class (T-095)', () => {
  it('hangs each answer on the edge of its class, subclass, ancestry or background', () => {
    const kanten = [
      k('c1', 'hasClass', 'barbarian', { level: 3, subclass: 'berserker' }),
      k('c2', 'hasClass', 'wizard', { level: 1 }),
      k('bg', 'hasBackground', 'sage'),
      k('a1', 'chose', 'barbarian', { choice: 'skills', picks: ['Athletics', 'Survival'] }),
      k('a2', 'chose', 'berserker', { choice: 'style', picks: ['x'] }),
      k('a3', 'chose', 'wizard', { choice: 'skills', picks: ['Arcana'] }),
      k('a4', 'chose', 'sage', { choice: 'origin-feat', picks: ['tough'] }),
      k('a5', 'chose', 'tough', { choice: 'ability', picks: ['con'] }),
      k('a6', 'chose', 'gone', { choice: 'skills', picks: ['Stealth'] }),
    ];
    const zu = antwortenJeEintrag(kanten);
    expect(Object.fromEntries(zu)).toEqual({ a1: 'c1', a2: 'c1', a3: 'c2', a4: 'bg', a5: 'bg' });
    /* Verwaist bleibt eine eigene Zeile. */
    expect(zu.has('a6')).toBe(false);
  });

  it('names an answer by its choice and shows ids as names', () => {
    const quelle: Entity = {
      id: 'barbarian',
      interfaces: ['Class'],
      name: 'Barbarian',
      components: {
        Choices: {
          choices: [
            { id: 'skills', kind: 'proficiency', count: 2, from: { values: ['Athletics', 'Survival'] } },
            { id: 'primal-path', kind: 'subclass', level: 3, from: { interfaces: ['Subclass'] } },
            { id: 'gear', kind: 'equipment', note: 'Starting gear', from: { options: [{ key: 'a', label: 'Greataxe' }] } },
          ],
        },
      },
      relations: [],
    };
    const name = (id: string) => ({ berserker: 'Path of the Berserker' })[id];
    expect(antwortText(quelle, 'skills', ['Athletics', 'Survival'], name)).toEqual({ label: 'Skills', text: 'Athletics, Survival' });
    expect(antwortText(quelle, 'primal-path', ['berserker'], name)).toEqual({ label: 'Primal path', text: 'Path of the Berserker' });
    expect(antwortText(quelle, 'gear', ['a'], name)).toEqual({ label: 'Starting gear', text: '(a) Greataxe' });
    expect(antwortText(undefined, 'feat-4', ['berserker'], name).label).toBe('Feat');
    /* Eine alte Sprachwahl heisst nach ihrer Liste, nicht nach ihrem langen Satz. */
    const sage = { ...quelle, components: { Choices: { choices: [{ id: 'proficiencies', kind: 'proficiency', note: '2 any standard languages of your choice' }] } } };
    expect(antwortText(sage, 'proficiencies', ['Elvish', 'Dwarvish'], name)).toEqual({ label: 'Languages', text: 'Elvish, Dwarvish' });
  });
});
