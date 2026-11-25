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

    it('lässt Eigenes in der Buchebene stehen, wenn die Datei ein Id-Präfix hat (T-270)', async () => {
      const repo = await mitKonto([ebene, in5e(regel('e5_alt', 'Alt')), in5e(regel('e_begriff', 'Reach')), in5e(regel('e5_bleibt', 'Bleibt'))]);
      const r = await runImport(repo, { format: 'nebelwacht/1', entities: [ebene, in5e(regel('e5_bleibt', 'Bleibt'))] }, { replaceLayer: true });
      const ids = (await repo.listEntities()).map((e) => e.id).sort();
      expect(ids).toEqual(['e5_bleibt', 'e5_layer', 'e_begriff']);
      expect(r.geloescht).toBe(1);
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

    /* T-169: die Kreatur eines benannten Statblocks ist neu, der Statblock
       steht schon. Namen erfunden. */
    it('hängt einen bestehenden Statblock an seine neue Kreatur — oder lässt sie weg, wenn er schon eine hat', async () => {
      const sb = (id: string, name: string): Entity => ({
        id, interfaces: ['Statblock'], name, relations: [{ id: `${id}-inLayer`, type: 'inLayer', to: ebene.id }],
        components: { Identity: { name, id: `statblock-${id}` }, Status: { status: 'ready' } },
      });
      const kreatur = (id: string, name: string): Entity => ({
        id, interfaces: ['Creature'], name, relations: [{ id: `${id}-inLayer`, type: 'inLayer', to: ebene.id }],
        components: { Identity: { name, id: `creature-${id}` }, Status: { status: 'ready' }, Creature: { kind: 'npc' } },
      });
      const eigene = kreatur('k-eigen', 'Tobin, von der Leitung');
      const schonVergeben: Entity = { ...sb('s2', 'Tobin'), relations: [...sb('s2', 'Tobin').relations!, { id: 's2~belongsTo-1', type: 'belongsTo', to: 'k-eigen' }] };
      const repo = await mitKonto([ebene, sb('s1', 'Morwen'), schonVergeben, eigene]);
      const mitKante = (e: Entity, to: string): Entity => ({ ...e, relations: [...e.relations!, { id: `${e.id}~belongsTo-9`, type: 'belongsTo', to }] });
      const datei = {
        format: 'nebelwacht/1', registry: seedRegistry,
        entities: [ebene, mitKante(sb('s1', 'Morwen'), 's1-creature'), mitKante(sb('s2', 'Tobin'), 's2-creature'), kreatur('s1-creature', 'Morwen'), kreatur('s2-creature', 'Tobin')],
        additions: ['s1-creature', 's2-creature'],
      };
      const probe = await runImport(repo, datei, { onlyNew: true, dryRun: true });
      expect(probe.text).toMatch(/1 neu.*1 bestehende Artikel bekommen eine Kante auf einen neuen \(belongsTo\).*1 neue nicht angelegt/);
      expect((await repo.getEntity('s1'))!.relations!.some((r) => r.type === 'belongsTo')).toBe(false);

      const r = await runImport(repo, datei, { onlyNew: true, additions: true });
      expect(r.geschrieben).toBe(1);
      expect(await repo.getEntity('s2-creature')).toBeUndefined();
      const s1 = (await repo.getEntity('s1'))!;
      expect(s1.relations!.filter((x) => x.type === 'belongsTo').map((x) => x.to)).toEqual(['s1-creature']);
      expect((await repo.getEntity('s2'))!.relations!.filter((x) => x.type === 'belongsTo').map((x) => x.to)).toEqual(['k-eigen']);

      /* Ein zweiter Lauf findet alles schon da. */
      const zweit = await runImport(repo, datei, { onlyNew: true });
      expect(zweit.geschrieben).toBe(0);
      expect(zweit.text).not.toMatch(/bekommen eine Kante/);
    });

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

    it('gibt einer Reihe, in der eine Nummer kollidiert, ganz neue Nummern in der Folge der Datei (T-296)', async () => {
      const kap = (id: string, nummer: string): Entity => ({
        id, interfaces: ['Rule'], name: id,
        components: { Identity: { name: id, id: nummer }, Status: { status: 'ready' } },
        relations: [{ id: `${id}-inLayer`, type: 'inLayer', to: ebene.id }],
      });
      const repo = await mitKonto([ebene, kap('alt', 'rule-0002')]);
      const r = await runImport(repo, { format: 'nebelwacht/1', registry: seedRegistry, entities: [ebene, kap('eins', 'rule-0001'), kap('zwei', 'rule-0002'), kap('drei', 'rule-0003')] }, { onlyNew: true });
      expect(r.geschrieben).toBe(3);
      const nummer = async (id: string) => ((await repo.getEntity(id))!.components['Identity'] as { id: string }).id;
      expect([await nummer('eins'), await nummer('zwei'), await nummer('drei')]).toEqual(['rule-0004', 'rule-0005', 'rule-0006']);
      expect(await nummer('alt')).toBe('rule-0002');
    });

    it('lässt den gehaltenen Bestand vor dem Schreiben los, nicht beim Probelauf (T-296)', async () => {
      const repo = await mitKonto([ebene]);
      const losgelassen: number[] = [];
      Object.assign(repo, { releaseHeld: () => losgelassen.push(1) });
      const datei = { format: 'nebelwacht/1', registry: seedRegistry, entities: [ebene, inEbene(regel('x', 'X'))] };
      await runImport(repo, datei, { onlyNew: true, dryRun: true });
      expect(losgelassen).toHaveLength(0);
      await runImport(repo, datei, { onlyNew: true });
      expect(losgelassen).toHaveLength(1);
    });

    it('sagt je Ebene, was neu ist (T-296)', async () => {
      const repo = await mitKonto([ebene]);
      const probe = await runImport(repo, { format: 'nebelwacht/1', registry: seedRegistry, entities: [ebene, inEbene(regel('x', 'X')), inEbene(regel('y', 'Y')), regel('z', 'Z')] }, { onlyNew: true, dryRun: true });
      expect(probe.text).toMatch(/Neu je Ebene:\n {2}D&D 5e \(2014\) \(e5_layer\): 2 — Rule 2\n {2}ohne Ebene: 1 — Rule 1/);
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

    it('legt Teile nur mit ihrem Ganzen an: steht das Kapitel schon, bleiben seine Teile, wie sie sind (T-108)', async () => {
      const kapitel = (id: string): Entity => ({
        id, interfaces: ['Chapter'], name: id, components: { Identity: { name: id, id: `chapter-${id}` } },
        relations: [{ id: `${id}-inLayer`, type: 'inLayer', to: ebene.id }],
      });
      const absatz = (id: string, ganzes: string, rank: number): Entity => ({
        id, interfaces: ['Paragraph'], name: id,
        components: { Identity: { name: id, id: `paragraph-${id}` }, Prose: { paragraph: [{ id: 'text', value: id }] } },
        relations: [{ id: `${id}-inLayer`, type: 'inLayer', to: ebene.id }, { id: `${id}-partOf`, type: 'partOf', to: ganzes, props: { rank } }],
      });
      /* Das alte Kapitel trägt schon seinen Text (aus der Migration), das neue nicht. */
      const repo = await mitKonto([ebene, kapitel('alt'), absatz('alt_text', 'alt', 1)]);
      const mehr = { ...datei, entities: [ebene, kapitel('alt'), absatz('p1', 'alt', 1), absatz('p2', 'alt', 2), kapitel('neu'), absatz('p3', 'neu', 1)] };
      const r = await runImport(repo, mehr, { onlyNew: true });
      expect(r).toMatchObject({ geschrieben: 2, uebersprungen: 4 });
      expect(r.text).toMatch(/davon 2 Teile, deren Kapitel oder Szene schon steht/);
      expect((await repo.listEntities()).map((e) => e.id).sort()).toEqual(['alt', 'alt_text', 'e5_layer', 'neu', 'p3']);
    });

    it('legt ein Bild im Text auch in ein Kapitel, das schon steht — es ist kein zweiter Text (T-284)', async () => {
      const kapitel: Entity = {
        id: 'alt', interfaces: ['Chapter'], name: 'alt', components: { Identity: { name: 'alt', id: 'chapter-alt' } },
        relations: [{ id: 'alt-inLayer', type: 'inLayer', to: ebene.id }],
      };
      const absatz: Entity = {
        id: 'alt_text', interfaces: ['Paragraph'], name: 'alt_text',
        components: { Identity: { name: 'alt_text', id: 'paragraph-alt' }, Prose: { paragraph: [{ id: 'text', value: 'x' }] } },
        relations: [{ id: 'alt_text-inLayer', type: 'inLayer', to: ebene.id }, { id: 'alt_text-partOf', type: 'partOf', to: 'alt', props: { rank: 1 } }],
      };
      const bild: Entity = {
        id: 'bild', interfaces: ['Illustration'], name: 'Die Burg',
        components: { Identity: { name: 'Die Burg', id: 'illustration-0001' }, Image: { caption: 'Die Burg' } },
        relations: [{ id: 'bild-inLayer', type: 'inLayer', to: ebene.id }, { id: 'bild-partOf', type: 'partOf', to: 'alt', props: { rank: 1.001 } }],
      };
      /* Ein Absatz in dasselbe Kapitel bleibt draussen (T-108) — das Bild kommt hinter den Absatz. */
      const nochEiner = { ...absatz, id: 'p2', relations: [{ id: 'p2-inLayer', type: 'inLayer', to: ebene.id }, { id: 'p2-partOf', type: 'partOf', to: 'alt', props: { rank: 2 } }] };
      const repo = await mitKonto([ebene, kapitel, absatz]);
      const r = await runImport(repo, { ...datei, entities: [ebene, kapitel, absatz, nochEiner, bild] }, { onlyNew: true });
      expect(r).toMatchObject({ geschrieben: 1 });
      expect(r.text).toMatch(/davon 1 Teile, deren Kapitel oder Szene schon steht/);
      expect((await repo.listEntities()).map((e) => e.id).sort()).toEqual(['alt', 'alt_text', 'bild', 'e5_layer']);
      expect((await repo.getEntity('bild'))?.relations.find((x) => x.type === 'partOf')?.props).toEqual({ rank: 1.001 });
    });

    it('gleicht Nummern und Verweise neuer Artikel an den Bestand an (T-087)', async () => {
      /* Der Bestand stammt aus einem älteren Lauf: Fireball trägt dort
         spell-0007, die Datei zählt ihn als spell-0001 — und unter
         spell-0002 steht im Bestand schon ein anderer Artikel. */
      const zauber = (id: string, name: string, nummer: string, text?: string): Entity => ({
        id, interfaces: ['Spell'], name,
        components: { Identity: { name, id: nummer }, Status: { status: 'ready' }, ...(text ? { Prose: { paragraph: [{ id: 'text', value: text }] } } : {}) },
        relations: [{ id: `${id}-inLayer`, type: 'inLayer', to: ebene.id }],
      });
      const repo = await mitKonto([ebene, zauber('fb', 'Fireball', 'spell-0007'), zauber('fremd', 'Eigener Zauber', 'spell-0002')]);
      const datei = {
        format: 'nebelwacht/1', registry: seedRegistry,
        entities: [
          ebene,
          zauber('fb', 'Fireball', 'spell-0001'),
          zauber('fb24', 'Fireball (XPHB)', 'spell-0002', 'Like [[spell-0001|Fireball]]; see [[spell-0003|Ice Storm (XPHB)]].'),
          zauber('is24', 'Ice Storm (XPHB)', 'spell-0003', 'After [[spell-0002|Fireball (XPHB)]].'),
        ],
      };
      const probe = await runImport(repo, structuredClone(datei), { onlyNew: true, dryRun: true });
      expect(probe.text).toMatch(/2 davon mit angeglichener Nummer/);
      const r = await runImport(repo, datei, { onlyNew: true });
      expect(r).toMatchObject({ geschrieben: 2, angeglichen: 2 });
      const fb24 = (await repo.getEntity('fb24'))!;
      const is24 = (await repo.getEntity('is24'))!;
      /* spell-0002 ist besetzt: der neue bekommt die nächste hinter allen —
         und mit ihm jeder neue derselben Reihe, damit die Folge der Datei
         bleibt (T-296). */
      expect(fb24.components['Identity']).toMatchObject({ id: 'spell-0008' });
      expect(is24.components['Identity']).toMatchObject({ id: 'spell-0009' });
      expect((fb24.components['Prose'] as { paragraph: { value: string }[] }).paragraph[0]!.value).toBe('Like [[spell-0007|Fireball]]; see [[spell-0009|Ice Storm (XPHB)]].');
      expect((is24.components['Prose'] as { paragraph: { value: string }[] }).paragraph[0]!.value).toBe('After [[spell-0008|Fireball (XPHB)]].');
      expect((await repo.getEntity('fremd'))?.components['Identity']).toMatchObject({ id: 'spell-0002' });
    });

    it('legt mit --additions nur die Neuzugänge an, mit dem, worauf sie zeigen; Verweise auf Weggelassenes suchen nach Namen (T-087)', async () => {
      const artikel = (id: string, name: string, nummer: string, ebeneId: string, text?: string, varianteVon?: string): Entity => ({
        id, interfaces: ['Spell'], name,
        components: { Identity: { name, id: nummer }, Status: { status: 'ready' }, ...(text ? { Prose: { paragraph: [{ id: 'text', value: text }] } } : {}) },
        relations: [{ id: `${id}-inLayer`, type: 'inLayer', to: ebeneId }, ...(varianteVon ? [{ id: `${id}-variantOf`, type: 'variantOf', to: varianteVon }] : [])],
      });
      const neueEbene: Entity = { ...ebene, id: 'e5_book_xphb', name: "Player's Handbook (2024)", components: { ...ebene.components, Identity: { name: "Player's Handbook (2024)", id: 'layer-0002' }, Layer: { kind: 'group' } } };
      /* Auf dem Server steht Fireball unter einer anderen Peg-Id als in der
         Datei, und unter spell-0001 ein ganz anderer Zauber. */
      const repo = await mitKonto([ebene, artikel('alt_fb', 'Fireball', 'spell-0005', ebene.id), artikel('fremd', 'Anderes', 'spell-0001', ebene.id)]);
      const datei = {
        format: 'nebelwacht/1', registry: seedRegistry,
        entities: [
          ebene,
          artikel('fb', 'Fireball', 'spell-0001', ebene.id),
          artikel('karte', 'Vizier', 'spell-0003', ebene.id),
          neueEbene,
          artikel('fb24', 'Fireball (XPHB)', 'spell-0002', neueEbene.id, 'Like [[spell-0001|Fireball]].'),
          artikel('karte24', 'Vizier (XPHB)', 'spell-0004', neueEbene.id, undefined, 'karte'),
        ],
        additions: [neueEbene.id, 'fb24', 'karte24'],
      };
      await expect(runImport(repo, datei, { additions: true })).rejects.toThrow(/gehört zu `--only-new`/);
      await expect(runImport(repo, { ...datei, additions: undefined }, { onlyNew: true, additions: true })).rejects.toThrow(/nennt keine Neuzugänge/);
      const r = await runImport(repo, datei, { onlyNew: true, additions: true });
      expect(r.geschrieben).toBe(4);
      expect(r.text).toMatch(/Nur Neuzugänge: 1 Artikel mit neuer Id aus dem Grundstand nicht angelegt; 1 davon kamen doch mit/);
      expect(await repo.getEntity('fb')).toBeUndefined();
      expect(await repo.getEntity('karte')).toBeDefined();
      const fb24 = (await repo.getEntity('fb24'))!;
      /* spell-0001 trägt dort „Anderes": der Verweis sucht nach dem Namen. */
      expect((fb24.components['Prose'] as { paragraph: { value: string }[] }).paragraph[0]!.value).toBe('Like [[Fireball]].');
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

/* Nur Ebenen (T-088): die Gruppen kommen, die Buchebene bekommt, was leer
   war, und ihre Gruppe des Importers wechselt — kein Artikel ändert sich. */
describe('import --layers', () => {
  const buch = (layer: Record<string, unknown>, partOf?: string, description?: string): Entity => ({
    id: 'e5_book_erlw',
    interfaces: ['Layer'],
    name: 'Eberron: Rising from the Last War',
    components: {
      Identity: { name: 'Eberron: Rising from the Last War', id: 'layer-0002' },
      Status: { status: 'ready' },
      Layer: layer,
      ...(description ? { Description: { description } } : {}),
    },
    relations: partOf ? [{ id: `e5_book_erlw~partOf-${partOf}`, type: 'partOf', to: partOf }] : [],
  });
  const gruppe = (k: string, name: string, n: number): Entity => ({
    id: `e5_group_${k}`,
    interfaces: ['Layer'],
    name,
    components: { Identity: { name, id: `layer-00${n}` }, Status: { status: 'ready' }, Layer: { kind: 'group', order: 0 } },
  });

  it('legt Gruppen an, füllt Leeres, richtet die Gruppe und lässt Artikel und Eigenes stehen', async () => {
    const artikel = { ...regel('r1', 'Alt'), relations: [{ id: 'r1~in', type: 'inLayer', to: 'e5_book_erlw' }] };
    const repo = await mitKonto([
      gruppe('supplement', 'Supplements', 90),
      buch({ kind: 'book', order: 0, abbreviation: 'ERLW', author: 'Von Hand' }, 'e5_group_supplement'),
      artikel,
    ]);
    const datei = {
      format: 'nebelwacht/1',
      entities: [
        gruppe('setting', 'Settings', 91),
        buch({ kind: 'book', order: 0, abbreviation: 'ERLW', published: '2019-11-19', author: 'Wizards RPG Team' }, 'e5_group_setting', 'ERLW — Eberron: Rising from the Last War'),
        { ...regel('r1', 'Neu aus der Datei'), relations: [{ id: 'r1~in', type: 'inLayer', to: 'e5_book_erlw' }] },
        regel('r2', 'Auch neu'),
      ],
    };
    const probe = await runImport(repo, datei, { layers: true, dryRun: true });
    expect(probe.text).toMatch(/1 Ebenen neu, 1 ergänzt/);
    expect(await repo.getEntity('e5_group_setting')).toBeFalsy();
    const r = await runImport(repo, datei, { layers: true });
    expect(r.geschrieben).toBe(2);
    const b = (await repo.getEntity('e5_book_erlw'))!;
    expect(b.components['Layer']).toMatchObject({ published: '2019-11-19', author: 'Von Hand' });
    expect(b.components['Description']).toEqual({ description: 'ERLW — Eberron: Rising from the Last War' });
    expect((b.relations ?? []).map((x) => x.to)).toEqual(['e5_group_setting']);
    expect((await repo.getEntity('r1'))!.name).toBe('Alt');
    expect(await repo.getEntity('r2')).toBeFalsy();
    /* Ein zweiter Lauf ändert nichts. */
    expect((await runImport(repo, datei, { layers: true })).geschrieben).toBe(0);
    await expect(runImport(repo, datei, { layers: true, onlyNew: true })).rejects.toThrow(/allein/);
  });

  it('hängt an den Herausgeber des Importers, ausser die Leitung hat einen eigenen gewählt (T-094)', async () => {
    const verlag = (id: string, name: string, n: number): Entity => ({
      id,
      interfaces: ['Layer'],
      name,
      components: { Identity: { name, id: `layer-00${n}` }, Status: { status: 'ready' }, Layer: { kind: 'group', order: 0, groupBy: 'publisher' } },
    });
    const mitBuch = (partOf: string[]) => ({
      ...buch({ kind: 'book', order: 0, abbreviation: 'ERLW' }),
      relations: partOf.map((to) => ({ id: `e5_book_erlw~partOf-${to}`, type: 'partOf', to })),
    });
    const datei = { format: 'nebelwacht/1', entities: [verlag('e5_publisher_official', 'Official', 92), mitBuch(['e5_publisher_official'])] };
    const repo = await mitKonto([mitBuch([])]);
    await runImport(repo, datei, { layers: true });
    expect(((await repo.getEntity('e5_book_erlw'))!.relations ?? []).map((x) => x.to)).toEqual(['e5_publisher_official']);
    const eigen = await mitKonto([verlag('ly_dritte', 'Third party', 93), mitBuch(['ly_dritte'])]);
    await runImport(eigen, datei, { layers: true });
    expect(((await eigen.getEntity('e5_book_erlw'))!.relations ?? []).map((x) => x.to)).toEqual(['ly_dritte']);
  });
});
