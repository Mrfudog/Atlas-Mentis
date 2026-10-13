/**
 * Der Ladebefehl (P5): eine Ausfuhrdatei in den Bestand, durch
 * `validateEntity`, über das Repository — und nicht, solange niemand den
 * Bestand verwalten kann.
 */
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
import { InMemoryRepository } from '../src/repo.js';
import { runImport } from '../src/import.js';

const regel = (id: string, name: string): Entity => ({
  id,
  interfaces: ['Rule'],
  name,
  components: { Identity: { name, id: `rule-${id}` }, Status: { status: 'ready' } },
});
const ebene: Entity = {
  id: 'e5_layer',
  interfaces: ['Layer'],
  name: 'D&D 5e (2014)',
  components: { Identity: { name: 'D&D 5e (2014)', id: 'layer-0001' }, Status: { status: 'ready' }, Layer: { kind: 'system' } },
};
const inEbene = (e: Entity): Entity => ({ ...e, relations: [{ id: 'inLayer-1', type: 'inLayer', to: ebene.id }] });

async function mitKonto(entities: Entity[] = [], admin = true, actorIds: string[] = []) {
  const repo = new InMemoryRepository(seedRegistry, entities);
  await repo.putUser({ id: randomUUID(), name: 'Basil', passwordHash: 'x', isAdmin: admin, actorIds, roles: {} });
  return repo;
}

describe('pnpm --filter @nw/server run import', () => {
  it('verweigert, solange kein Verwaltungskonto existiert — auch mit einem Spielerkonto', async () => {
    for (const repo of [new InMemoryRepository(seedRegistry, []), await mitKonto([], false)]) {
      await expect(runImport(repo, { format: 'nebelwacht/1', entities: [ebene] })).rejects.toThrow(/Verwaltungskonto/);
      expect(await repo.countEntities()).toBe(0);
    }
  });

  it('schreibt die Artikel einer Datei zum Bestand dazu', async () => {
    const repo = await mitKonto([regel('alt', 'Alt')]);
    const r = await runImport(repo, { format: 'nebelwacht/1', registry: seedRegistry, entities: [ebene, inEbene(regel('neu', 'Neu'))] });
    expect(r.geschrieben).toBe(2);
    expect((await repo.listEntities()).map((e) => e.id).sort()).toEqual(['e5_layer', 'alt', 'neu'].sort());
    /* Seit Migration 019 kennt die Ablage auch enums und settings. */
    expect(r.text).not.toMatch(/Nicht gespeichert/);
  });

  it('ersetzt mit --replace den Bestand und sagt, welche Figur an einem Konto verwaist', async () => {
    const repo = await mitKonto([regel('alt', 'Alt')], true, ['pc_rook']);
    const r = await runImport(repo, { format: 'nebelwacht/1', entities: [ebene] }, { replace: true });
    expect(r.geloescht).toBe(1);
    expect((await repo.listEntities()).map((e) => e.id)).toEqual(['e5_layer']);
    expect(r.text).toMatch(/Basil: pc_rook/);
  });

  it('nimmt eine Datei ohne `entities` als Registerlieferung und lässt den Bestand stehen, auch mit --replace', async () => {
    const repo = await mitKonto([regel('alt', 'Alt')]);
    const r = await runImport(repo, { format: 'nebelwacht/1', registry: { interfaces: seedRegistry.interfaces } }, { replace: true });
    expect(r.text).toMatch(/Register übernommen/);
    expect(await repo.countEntities()).toBe(1);
    expect(Object.keys((await repo.getRegistry()).interfaces)).toContain('Spell');
  });

  it('schreibt nichts, wenn ein einziger Artikel die Prüfung nicht besteht', async () => {
    const repo = await mitKonto();
    const kaputt: Entity = { ...regel('x', 'X'), relations: [{ id: 'r', type: 'inLayer', to: 'gibt-es-nicht' }] };
    const ohneName: Entity = { id: 'y', interfaces: ['Rule'], name: 'Y', components: { Status: { status: 'ready' } } };
    await expect(runImport(repo, { entities: [ebene, kaputt, ohneName] })).rejects.toThrow(/3 Fehler, nichts geschrieben[\s\S]*gibt-es-nicht[\s\S]*Identity\.name is required/);
    expect(await repo.countEntities()).toBe(0);
  });

  it('lehnt ein fremdes Format und eine doppelte Id ab', async () => {
    const repo = await mitKonto();
    await expect(runImport(repo, { format: 'foundry/9', entities: [] })).rejects.toThrow(/Unbekanntes Format/);
    await expect(runImport(repo, { entities: [ebene, ebene] })).rejects.toThrow(/zweimal/);
  });

  it('übernimmt Aufzählungen und Einstellungen und nennt sie nicht mehr als liegengeblieben', async () => {
    const repo = await mitKonto();
    const r = await runImport(repo, { format: 'nebelwacht/1', registry: seedRegistry, entities: [ebene] });
    expect(r.text).not.toMatch(/Nicht gespeichert/);
    const reg = await repo.getRegistry();
    expect(reg.enums?.['Size']?.values).toContain('gargantuan');
    expect(reg.settings?.['slotDraw']).toBe(seedRegistry.settings?.['slotDraw']);
  });

  it('lehnt zwei Kanten mit derselben Id ab, bevor etwas geschrieben ist', async () => {
    const repo = await mitKonto();
    /* So kam die erste 5e.tools-Datei: je Artikel gezählt, `inLayer-1` an allen. */
    const a = inEbene(regel('a', 'A'));
    const b = inEbene(regel('b', 'B'));
    await expect(runImport(repo, { format: 'nebelwacht/1', registry: seedRegistry, entities: [ebene, a, b] }))
      .rejects.toThrow(/Kante inLayer-1: steht an a und an b/);
    expect(await repo.countEntities()).toBe(0);
  });

  describe('--replace-layer: ersetzt nur, was die Ebene bringt (W8)', () => {
    /* Je Artikel eine eigene Kanten-Id, wie der Importer sie schreibt. */
    const in5e = (e: Entity): Entity => ({ ...e, relations: [...(e.relations ?? []), { id: `${e.id}-inLayer`, type: 'inLayer', to: ebene.id }] });
    const heim: Entity = {
      id: 'heim_layer',
      interfaces: ['Layer'],
      name: 'Nebelwacht',
      components: { Identity: { name: 'Nebelwacht', id: 'layer-0002' }, Status: { status: 'ready' }, Layer: { kind: 'campaign' } },
    };
    const inHeim = (e: Entity): Entity => ({ ...e, relations: [...(e.relations ?? []), { id: `${e.id}-heim`, type: 'inLayer', to: heim.id }] });
    const ident = (name: string, id: string) => ({ Identity: { name, id }, Status: { status: 'ready' } });
    const vorlage = in5e({ id: 'sb_wache', interfaces: ['Statblock'], name: 'Guard', components: { ...ident('Guard', 'statblock-0001'), Statblock: { ac: 16, hp: 11 } } });
    const instanz: Entity = {
      id: 'sb_brom', interfaces: ['Statblock'], name: 'Brom', components: { ...ident('Brom', 'statblock-0002'), Statblock: { hp: 18 } },
      relations: [{ id: 'brom-i', type: 'instanceOf', to: 'sb_wache' }],
    };

    async function bestand() {
      return mitKonto([
        ebene, heim,
        in5e(regel('bleibt', 'Bleibt')),
        in5e(regel('geht', 'Geht')),
        in5e(regel('geht2', 'Geht auch')),
        inHeim(in5e(regel('beide', 'In beiden'))),
        /* Ein eigener Artikel ohne Ebene, der auf einen zeigt, der geht. */
        {
          id: 'eigen', interfaces: ['Event'], name: 'Der Fall von Kanalgang', components: ident('Der Fall von Kanalgang', 'event-0001'),
          relations: [{ id: 'eigen-r', type: 'involves', to: 'geht' }],
        },
        inHeim(regel('heim1', 'Kampagnenregel')),
        vorlage, instanz,
      ]);
    }
    const datei = { format: 'nebelwacht/1', entities: [ebene, in5e(regel('bleibt', 'Bleibt, neu')), in5e(regel('neu', 'Neu'))] };

    it('löscht nur, was nur die Ebene bringt und in der Datei fehlt, und zählt es je Art', async () => {
      const repo = await bestand();
      const r = await runImport(repo, datei, { replaceLayer: true });
      const ids = (await repo.listEntities()).map((e) => e.id).sort();
      expect(ids).toEqual(['e5_layer', 'heim_layer', 'bleibt', 'neu', 'beide', 'eigen', 'heim1', 'sb_brom'].sort());
      expect(r.geloescht).toBe(3);
      expect(r.text).toMatch(/Ebene „D&D 5e \(2014\)" \(e5_layer\): 3 Artikel geschrieben, 3 gelöscht \(Rule 2, Statblock 1\)/);
      expect((await repo.getEntity('bleibt'))?.name).toBe('Bleibt, neu');
    });

    it('zählt die Kanten aus bleibenden Artikeln auf, die danach ins Leere zeigen', async () => {
      const repo = await bestand();
      const r = await runImport(repo, datei, { replaceLayer: 'D&D 5e (2014)' });
      expect(r.verwaisteKanten).toEqual(['Der Fall von Kanalgang (eigen) —involves→ Geht (geht)']);
      expect(r.text).toMatch(/1 Kanten aus bleibenden Artikeln zeigen jetzt ins Leere:\n {2}Der Fall von Kanalgang \(eigen\) —involves→ Geht \(geht\)/);
    });

    it('löst eine bleibende Instanz von ihrer gelöschten Vorlage, statt ihr die Zahlen zu nehmen', async () => {
      const repo = await bestand();
      const r = await runImport(repo, datei, { replaceLayer: 'e5_layer' });
      const brom = await repo.getEntity('sb_brom');
      expect(brom?.relations?.some((x) => x.type === 'instanceOf')).toBe(false);
      expect(brom?.components['Statblock']).toMatchObject({ ac: 16, hp: 18 });
      expect(r.text).toMatch(/1 Instanzen von ihrer gelöschten Vorlage gelöst[^\n]*Brom \(sb_brom\)/);
      expect(r.verwaisteKanten).not.toContainEqual(expect.stringContaining('sb_brom'));
    });

    it('sagt im Probelauf dasselbe und schreibt nichts', async () => {
      const repo = await bestand();
      const vorher = await repo.listEntities();
      const r = await runImport(repo, datei, { replaceLayer: true, dryRun: true });
      expect(r.text).toMatch(/Probelauf, nichts geschrieben — Ebene „D&D 5e \(2014\)" \(e5_layer\): 3 Artikel würden geschrieben, 3 gelöscht/);
      expect(r.text).toMatch(/würden ins Leere zeigen/);
      expect(await repo.listEntities()).toEqual(vorher);
    });

    it('verlangt eine eindeutige Ebene und verbietet sich mit --replace', async () => {
      const repo = await bestand();
      await expect(runImport(repo, datei, { replace: true, replaceLayer: true })).rejects.toThrow(/schliessen sich aus/);
      await expect(runImport(repo, datei, { replaceLayer: 'Gibt es nicht' })).rejects.toThrow(/Keine Ebene „Gibt es nicht"/);
      await expect(runImport(repo, { entities: [regel('lose', 'Lose')] }, { replaceLayer: true })).rejects.toThrow(/steht in einer Ebene/);
      const zwei = { entities: [ebene, heim, in5e(regel('a', 'A')), inHeim(regel('b', 'B'))] };
      await expect(runImport(repo, zwei, { replaceLayer: true })).rejects.toThrow(/2 Ebenen \(e5_layer, heim_layer\)/);
      /* Nach Id, Name oder Bezeichner — der Name steht in Postgres nur in der Identity-Karte. */
      for (const wahl of ['e5_layer', 'D&D 5e (2014)', 'layer-0001']) {
        expect((await runImport(repo, datei, { replaceLayer: wahl, dryRun: true })).text).toMatch(/\(e5_layer\)/);
      }
      expect(await repo.countEntities()).toBe(10);
    });
  });

  describe('--only-new: nur ergänzen, was es noch nicht gibt (D71)', () => {
    /* Je Artikel eine eigene Kanten-Id, wie der Importer sie schreibt. */
    const inEbene = (e: Entity): Entity => ({ ...e, relations: [{ id: `${e.id}-inLayer`, type: 'inLayer', to: ebene.id }] });
    const datei = { format: 'nebelwacht/1', registry: seedRegistry, entities: [ebene, inEbene(regel('a', 'A')), inEbene(regel('b', 'B'))] };

    it('legt beim zweiten Lauf mit derselben Datei nichts an, und ein geänderter Artikel bleibt geändert', async () => {
      const repo = await mitKonto();
      const erst = await runImport(repo, datei, { onlyNew: true });
      expect(erst).toMatchObject({ geschrieben: 3, uebersprungen: 0, geloescht: 0 });
      const a = (await repo.getEntity('a'))!;
      await repo.putEntity({ ...a, name: 'A, von der Leitung', components: { ...a.components, Identity: { ...a.components['Identity'] as object, name: 'A, von der Leitung' } } });
      const eigen = regel('eigen', 'Eigen');
      await repo.putEntity(eigen);

      const zweit = await runImport(repo, datei, { onlyNew: true });
      expect(zweit).toMatchObject({ geschrieben: 0, uebersprungen: 3, geloescht: 0 });
      expect(zweit.text).toMatch(/Nur ergänzt: 0 neu, 3 übersprungen/);
      expect((await repo.getEntity('a'))?.name).toBe('A, von der Leitung');
      expect(await repo.countEntities()).toBe(4);
    });

    it('ergänzt einen neuen Artikel neben bestehenden und sagt im Probelauf dasselbe, ohne zu schreiben', async () => {
      const repo = await mitKonto([ebene, inEbene(regel('a', 'A, geändert'))]);
      const mehr = { ...datei, entities: [...datei.entities, inEbene(regel('c', 'C'))] };
      const probe = await runImport(repo, mehr, { onlyNew: true, dryRun: true });
      expect(probe.text).toMatch(/nur ergänzen: 2 neu, 2 übersprungen/);
      expect(await repo.countEntities()).toBe(2);
      const r = await runImport(repo, mehr, { onlyNew: true });
      expect(r).toMatchObject({ geschrieben: 2, uebersprungen: 2 });
      expect((await repo.listEntities()).map((e) => e.id).sort()).toEqual(['a', 'b', 'c', 'e5_layer']);
      expect((await repo.getEntity('a'))?.name).toBe('A, geändert');
    });

    it('lässt eine angepasste Registerzeile stehen und nimmt nur fehlende dazu', async () => {
      const repo = await mitKonto();
      const { Spell: _weg, ...ohneSpell } = seedRegistry.interfaces;
      const rule = { ...seedRegistry.interfaces['Rule']!, label: 'Regel der Leitung' };
      await repo.putRegistryPart('interfaces', { ...ohneSpell, Rule: rule });
      await runImport(repo, datei, { onlyNew: true });
      const danach = (await repo.getRegistry()).interfaces;
      expect(danach['Rule']?.label).toBe('Regel der Leitung');
      expect(danach['Spell']).toBeDefined();
    });

    it('prüft vor dem ersten Schreiben und schliesst --replace und --replace-layer aus', async () => {
      const repo = await mitKonto();
      const kaputt: Entity = { ...regel('x', 'X'), relations: [{ id: 'r', type: 'inLayer', to: 'gibt-es-nicht' }] };
      await expect(runImport(repo, { entities: [ebene, kaputt] }, { onlyNew: true })).rejects.toThrow(/nichts geschrieben/);
      expect(await repo.countEntities()).toBe(0);
      await expect(runImport(repo, datei, { onlyNew: true, replace: true })).rejects.toThrow(/schliesst/);
      await expect(runImport(repo, datei, { onlyNew: true, replaceLayer: true })).rejects.toThrow(/schliesst/);
    });
  });
});
