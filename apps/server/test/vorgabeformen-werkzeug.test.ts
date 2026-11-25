/**
 * Das Werkzeug für den Datenlauf (T-394 Schritt 5): die Vorlage der
 * Leitung als ShapeDefaults — mit erfundenen Gegenständen und Gruppen, im
 * Format der Seite (items.json, gruppen-seed.json, Anpassungen je Dokument).
 */
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { defaultShapeOf, indexShapeDefaults, type Entity } from '@nw/model';
// @ts-expect-error — ein Skript ohne Typen
import { ausVorlage } from '../../../scripts/vorgabeformen.mjs';

function vorlage() {
  const dir = mkdtempSync(join(tmpdir(), 'vorlage-'));
  const db = join(dir, 'db');
  mkdirSync(join(db, 'gruppen'), { recursive: true });
  mkdirSync(join(db, 'artikel'), { recursive: true });
  writeFileSync(join(dir, 'items.json'), JSON.stringify([
    { id: 'a', n: 'Blade', t: 'Weapon', g: 'B', o: '#/#/#' },
    { id: 'b', n: '+1 Blade', t: 'Weapon', g: 'B', b: 'a' },
    { id: 'c', n: 'Pony', t: 'Item', g: 'K' },
    { id: 'd', n: 'Moved', t: 'Item', g: 'B', b: 'a' },
    { id: 'e', n: 'Statue', t: 'Item', g: 'ART', gp: 900 },
  ]));
  writeFileSync(join(dir, 'gruppen-seed.json'), JSON.stringify([
    { id: 'B', bereich: 'Weapons', name: 'Blades', form: '##', stapel: 1, tragbar: true, regel: 'blades', rank: 1, ref: 'a' },
    { id: 'K', bereich: 'None', name: 'Mounts', form: null, stapel: null, tragbar: false, rank: 0 },
    { id: 'ART', bereich: 'Items', name: 'Art', form: '#', stapel: 1, tragbar: true, rank: 2, formen: [{ form: '#', w: [100, 0] }, { form: '##/##', w: [0, 100] }], stufen: [0, 500] },
    { id: 'P', bereich: 'Items', name: 'Potions', form: '#', stapel: 4, tragbar: true, rank: 3 },
  ]));
  /* Anpassungen der Leitung: Stapel der Gruppe, ein Gegenstand in eine andere Gruppe. */
  writeFileSync(join(db, 'gruppen', 'B.json'), JSON.stringify({ data: { stapel: 2, notiz: 'longer' } }));
  writeFileSync(join(db, 'artikel', 'd.json'), JSON.stringify({ gruppe: 'P' }));
  return { dir, db };
}

describe('ausVorlage', () => {
  it('übersetzt Gruppen und Werte und rechnet wie die Seite', () => {
    const { dir, db } = vorlage();
    const plan = ausVorlage(dir, db);
    expect(plan.shapeGroups.find((g: { id: string }) => g.id === 'B')).toMatchObject({ name: 'Blades', section: 'Weapons', rows: ['##'], stackSize: 2, ref: 'a', note: 'longer', carryable: true });
    expect(plan.shapeGroups.find((g: { id: string }) => g.id === 'K')).toMatchObject({ carryable: false, rows: null });
    expect(plan.shapeItems).toContainEqual({ id: 'b', group: 'B', ref: 'a' });
    /* In eine andere Gruppe verschoben: die Referenz aus der Zuordnung fällt weg. */
    expect(plan.shapeItems).toContainEqual({ id: 'd', group: 'P' });

    const idx = indexShapeDefaults({ groups: plan.shapeGroups, items: plan.shapeItems });
    const ding = (id: string, gp?: number): Entity => ({ id, name: id, interfaces: ['Item'], components: { Item: gp ? { copperPrice: gp * 100 } : {} } });
    const alle = new Map(['a', 'b', 'c', 'd'].map((id) => [id, ding(id)]));
    alle.set('e', ding('e', 900));
    const von = (id: string) => defaultShapeOf(alle.get(id)!, idx, { item: (x) => alle.get(x) });
    expect(von('b')).toMatchObject({ rows: ['#', '#', '#'], source: 'reference' });
    expect(von('c')).toMatchObject({ rows: null, source: 'none' });
    expect(von('d')).toMatchObject({ rows: ['#'], stackSize: 4, source: 'group' });
    expect(von('e')).toMatchObject({ rows: ['##', '##'], source: 'random' });
  });
});
