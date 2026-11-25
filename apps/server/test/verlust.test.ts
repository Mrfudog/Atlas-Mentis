/**
 * Migrationen und Seed löschen nie still (T-076, REQ-191): was ein Schritt
 * entfernen würde und der Bestand trägt, wird vorher gezählt; ohne Freigabe
 * bricht der Start ab, mit Freigabe läuft er und meldet den Verlust.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Entity, Registry } from '@nw/model';
import { InMemoryRepository } from '../src/repo.js';
import { schreibeRegisterteil, seedRegistryInto } from '../src/seed.js';
import {
  DatenverlustError,
  entferntDaten,
  pruefabfragen,
  pruefeVerlust,
  registerVerlust,
} from '../src/verlust.js';

const reg: Registry = {
  interfaces: {
    Thing: {
      name: 'Thing',
      schema: {
        type: 'object',
        properties: {
          colour: { type: 'string' },
          mood: { type: 'string', enum: ['calm', 'angry'] },
          ability: { type: 'string', enumRef: 'Ability' },
          spare: { type: 'string' },
        },
      },
    },
  },
  relations: { knows: { type: 'knows', from: ['Thing'], to: ['Thing'], cardinality: 'many' } },
  enums: { Ability: { name: 'Ability', values: ['str', 'dex'] } },
  views: {},
  units: {},
  vars: {},
} as unknown as Registry;

const ding: Entity = {
  id: 't1',
  interfaces: ['Thing'],
  components: { Thing: { colour: 'red', mood: 'angry', ability: 'dex' } },
  relations: [{ id: 'r1', type: 'knows', to: 't1', props: {} }],
} as unknown as Entity;

const ohneFeld = (feld: string) => {
  const { [feld]: _weg, ...rest } = reg.interfaces['Thing']!.schema!.properties!;
  return { Thing: { ...reg.interfaces['Thing']!, schema: { type: 'object', properties: rest } } } as Registry['interfaces'];
};

describe('registerVerlust', () => {
  const artikel = async () => [ding];

  it('zählt ein entferntes Feld, das ein Artikel trägt', async () => {
    expect(await registerVerlust(reg, 'interfaces', ohneFeld('colour'), artikel)).toEqual([
      { was: 'Feld Thing.colour', anzahl: 1 },
    ]);
  });

  it('übergeht ein Feld, das niemand füllt', async () => {
    expect(await registerVerlust(reg, 'interfaces', ohneFeld('spare'), artikel)).toEqual([]);
  });

  it('liest keine Artikel, wenn nichts wegfällt', async () => {
    expect(await registerVerlust(reg, 'vars', { a: '1' }, async () => {
      throw new Error('nichts fällt weg, also nichts lesen');
    })).toEqual([]);
  });

  it('zählt Arten, Listenwerte, Kantenarten und Werte einer Aufzählungszeile', async () => {
    expect(await registerVerlust(reg, 'interfaces', {}, artikel)).toEqual([
      { was: 'Art Thing (Artikel und Karten)', anzahl: 2 },
    ]);
    const ruhig = structuredClone(reg.interfaces);
    ruhig['Thing']!.schema!.properties!['mood']!.enum = ['calm'];
    expect(await registerVerlust(reg, 'interfaces', ruhig, artikel)).toEqual([
      { was: 'Wert Thing.mood = angry', anzahl: 1 },
    ]);
    expect(await registerVerlust(reg, 'relations', {}, artikel)).toEqual([
      { was: 'Kantenart knows', anzahl: 1 },
    ]);
    expect(
      await registerVerlust(reg, 'enums', { Ability: { name: 'Ability', values: ['str'] } }, artikel),
    ).toEqual([{ was: 'Wert Ability = dex', anzahl: 1 }]);
  });
});

describe('der Seed', () => {
  it('bricht ab, wenn er ein Feld entfernt, das ein Artikel trägt', async () => {
    const repo = new InMemoryRepository(reg, [ding]);
    await expect(
      schreibeRegisterteil(repo, 'interfaces', ohneFeld('colour'), { env: {} }),
    ).rejects.toBeInstanceOf(DatenverlustError);
    expect((await repo.getRegistry()).interfaces['Thing']!.schema!.properties!['colour']).toBeDefined();
  });

  it('läuft mit Freigabe und zählt den Verlust im Log', async () => {
    const repo = new InMemoryRepository(reg, [ding]);
    const log: string[] = [];
    await schreibeRegisterteil(repo, 'interfaces', ohneFeld('colour'), {
      env: { ATLAS_ALLOW_DATA_LOSS: 'seed' },
      log: (m) => log.push(m),
    });
    expect((await repo.getRegistry()).interfaces['Thing']!.schema!.properties!['colour']).toBeUndefined();
    expect(log).toEqual(['seed: freigegebener Verlust, 1 Werte — Feld Thing.colour: 1']);
  });

  it('ersetzt keine Kantenarten still, wenn eine Datenbank ohne Arten schon Kanten trägt', async () => {
    const repo = new InMemoryRepository({ ...reg, interfaces: {} }, [ding]);
    const fremd = { ...reg, relations: {} } as Registry;
    await expect(seedRegistryInto(repo, { env: {} }, fremd)).rejects.toThrow(/Kantenart knows: 1/);
  });

  it('meldet, wie man freigibt', () => {
    expect(() => pruefeVerlust('024_x.sql', [{ was: 'q', anzahl: 3 }], { env: {} })).toThrow(
      /ATLAS_ALLOW_DATA_LOSS=024_x\.sql/,
    );
    expect(pruefeVerlust('024_x.sql', [{ was: 'q', anzahl: 3 }], {
      env: { ATLAS_ALLOW_DATA_LOSS: 'seed, 024_x' },
      log: () => {},
    })).toBe(3);
  });
});

describe('Migrationen', () => {
  it('liest die Prüfabfragen aus dem Kopf', () => {
    expect(
      pruefabfragen(`-- Was weg ist\n-- verlust: select count(*) from component where type = 'X';\nselect 1;`),
    ).toEqual(["select count(*) from component where type = 'X'"]);
  });

  /* Die Regel aus CLAUDE.md: jede Migration, die entfernt, nennt ihre
     Prüfabfrage. Die bis 023 sind gelaufen, überall — sie nachzurüsten
     prüfte nichts mehr. */
  it('jede neue Migration, die entfernt, nennt ihre Prüfabfrage', () => {
    const ordner = join(import.meta.dirname, '..', 'migrations');
    const ohne = readdirSync(ordner)
      .filter((f) => f.endsWith('.sql') && f > '024')
      .filter((f) => {
        const sql = readFileSync(join(ordner, f), 'utf8');
        return entferntDaten(sql) && !pruefabfragen(sql).length;
      });
    expect(ohne).toEqual([]);
    expect(entferntDaten("update component set payload = payload - 'x';")).toBe(true);
    expect(entferntDaten('-- delete from x\ncreate table y (a int);')).toBe(false);
  });
});
