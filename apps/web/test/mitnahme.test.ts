import { describe, expect, it } from 'vitest';
import { mitnahmeLesen, mitnahmeParams } from '../src/app/figur/mitnahme';

/* T-095, Prüfung 20.10.: was „New article" schon kennt, fragt der Assistent nicht noch einmal. */
const karte = (p: Record<string, string>) => ({ keys: Object.keys(p), get: (k: string) => p[k] ?? null });

describe('Werte aus „New article" im Assistenten (T-095)', () => {
  it('Name, abweichende Ebene und gefüllte Pflichtfelder gehen mit', () => {
    const p = mitnahmeParams('  Basil  ', 'ly_tests', 'ly_kampagne', [{ ref: 'Creature.kind' }, { ref: 'Creature.size' }], { 'Creature.kind': 'pc', 'Creature.size': '' });
    expect(p).toEqual({ name: 'Basil', layer: 'ly_tests', 'f.Creature.kind': 'pc' });
    expect(mitnahmeLesen(karte(p))).toEqual({ name: 'Basil', layer: 'ly_tests', felder: { 'Creature.kind': 'pc' } });
  });

  it('die Schreibebene und Leeres gehen nicht mit', () => {
    expect(mitnahmeParams(' ', 'ly_kampagne', 'ly_kampagne', [], {})).toEqual({});
    expect(mitnahmeLesen(karte({}))).toEqual({ name: '', layer: '', felder: {} });
  });
});
