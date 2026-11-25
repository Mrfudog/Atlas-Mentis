import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import {
  appliesScope,
  followPath,
  freeElementId,
  incomingIndex,
  adjustFrom,
  canMove,
  insertElement,
  moveToElement,
  tabsAsTree,
  treeAsTabs,
  isDesignedView,
  moveTree,
  pathIds,
  pathText,
  viewFor,
  viewsFor,
} from '../src/viewScope.js';
import { RegistrySchema } from '../src/validate.js';
import { forArticle } from '../src/views.js';
import type { Entity, LayoutElement, Registry, ViewDef } from '../src/types.js';

const durnan: Entity = { id: 'npc-0001', interfaces: ['Creature'], name: 'Durnan', components: { Creature: { kind: 'merchant' } } };
const varo: Entity = { id: 'npc-0002', interfaces: ['Creature'], name: 'Varo', components: {} };
const laden: Entity = {
  id: 'sho-0001',
  interfaces: ['Shop'],
  name: 'The Yawning Portal',
  components: {},
  relations: [
    { type: 'shopkeeper', to: 'npc-0001' },
    { type: 'sells', to: 'itm-0001', props: { price: '4 cp' } },
    { type: 'sells', to: 'itm-0002', props: { price: '5 sp' } },
  ],
};
const ale: Entity = { id: 'itm-0001', interfaces: ['Item'], name: 'Ale', components: {} };
const zimmer: Entity = { id: 'itm-0002', interfaces: ['Item'], name: 'Room', components: {} };
const alle = [durnan, varo, laden, ale, zimmer];
const nachId = new Map(alle.map((e) => [e.id, e]));
const rueck = incomingIndex(alle);

const shop: ViewDef = {
  label: 'Shop',
  fields: 'all',
  group: 'shop',
  applies: { types: ['Creature'], where: [{ incoming: 'shopkeeper' }] },
  layout: [
    { id: 'voice', el: 'quote', fields: ['Description.description'] },
    { id: 'wares', el: 'edgeTable', path: [{ relation: 'shopkeeper', dir: 'in' }, { relation: 'sells' }], props: ['price'] },
  ],
};
const nurDurnan: ViewDef = { label: 'Durnan full', fields: 'all', group: 'full', applies: { article: 'npc-0001' }, layout: [] };
const mitShop: Registry = { ...seedRegistry, views: { ...seedRegistry.views, shop, durnanFull: nurDurnan } };

describe('viewsFor (T-268)', () => {
  it('lässt die heutigen Ansichten unverändert stehen', () => {
    const heute = viewsFor(varo, seedRegistry).map((v) => v.key);
    expect(new Set(heute)).toEqual(new Set(Object.keys(seedRegistry.views)));
    /* Kreatur sagt für `full` etwas Eigenes: Typ, nicht global. */
    expect(viewsFor(varo, seedRegistry).find((v) => v.key === 'full')?.scope).toBe('type');
  });

  it('bietet den Shop nur dem, der einen hat — über die eingehende Kante', () => {
    const fuer = (e: Entity) => viewsFor(e, mitShop, { incoming: rueck.get(e.id) ?? [] }).map((v) => v.key);
    expect(fuer(durnan)).toContain('shop');
    expect(fuer(varo)).not.toContain('shop');
    /* Ohne Rückbezüge gilt keine Bedingung auf eingehende Kanten. */
    expect(viewsFor(durnan, mitShop).map((v) => v.key)).not.toContain('shop');
  });

  it('ordnet genaueste zuerst: Artikel > Bedingung > Typ > global', () => {
    const l = viewsFor(durnan, mitShop, { incoming: rueck.get(durnan.id) ?? [] });
    expect(l[0]?.key).toBe('durnanFull');
    expect(l[0]?.scope).toBe('article');
    expect(l[1]?.scope).toBe('condition');
    const rang = l.map((v) => ['article', 'condition', 'type', 'global'].indexOf(v.scope));
    expect([...rang].sort((a, b) => a - b)).toEqual(rang);
  });

  it('viewFor wählt die genaueste der Gruppe, sonst die Gruppe selbst', () => {
    expect(viewFor(durnan, mitShop, 'full')).toBe('durnanFull');
    expect(viewFor(varo, mitShop, 'full')).toBe('full');
    expect(viewFor(durnan, mitShop, 'full', { designed: false })).toBe('full');
  });

  it('designed: false lässt gestaltete Ansichten weg', () => {
    /* Seit T-462 bringt das Register selbst gestaltete Ansichten (die
       Masken „Roleplay“ und „Fight“) — ohne sie sind beide Listen gleich. */
    expect(viewsFor(durnan, mitShop, { incoming: rueck.get(durnan.id) ?? [], designed: false }).map((v) => v.key)).toEqual(
      viewsFor(durnan, seedRegistry, { designed: false }).map((v) => v.key),
    );
    expect(viewsFor(durnan, seedRegistry).map((v) => v.key)).toEqual(expect.arrayContaining(['roleplay', 'fight']));
    expect(isDesignedView(shop)).toBe(true);
    expect(isDesignedView(seedRegistry.views['full'])).toBe(false);
  });

  it('nennt die Genauigkeit aus dem, was dasteht', () => {
    expect(appliesScope(undefined)).toBe('global');
    expect(appliesScope({ types: ['Creature'] })).toBe('type');
    expect(appliesScope({ types: ['Creature'], where: [{ field: 'Creature.kind', has: ['merchant'] }] })).toBe('condition');
    expect(appliesScope({ article: 'x', types: ['Creature'] })).toBe('article');
  });

  it('prüft Feldwerte', () => {
    const haendler: Registry = {
      ...seedRegistry,
      views: { ...seedRegistry.views, h: { label: 'Merchant', fields: 'all', applies: { where: [{ field: 'Creature.kind', has: ['merchant'] }] } } },
    };
    expect(viewsFor(durnan, haendler).map((v) => v.key)).toContain('h');
    expect(viewsFor(varo, haendler).map((v) => v.key)).not.toContain('h');
  });

  it('die Registerzeile übersteht die Prüfung samt Baum, Pfad und Geltung', () => {
    const parsed = RegistrySchema.parse(mitShop);
    expect(parsed.views['shop']).toEqual(shop);
  });
});

describe('followPath (T-268)', () => {
  const ctx = { get: (id: string) => nachId.get(id), incoming: (id: string) => rueck.get(id) ?? [] };
  it('geht über die Gegenrichtung und dann vorwärts: shopkeeper › Shop › sells › Item', () => {
    const hits = followPath(seedRegistry, durnan, shop.layout![1]!.path, ctx);
    expect(hits.map((h) => h.entity.name)).toEqual(['Ale', 'Room']);
    expect(hits.map((h) => h.props['price'])).toEqual(['4 cp', '5 sp']);
  });
  it('ohne Pfad ist der Artikel selbst das Ende; ein Typ engt ein', () => {
    expect(followPath(seedRegistry, durnan, undefined, ctx).map((h) => h.entity.id)).toEqual(['npc-0001']);
    expect(followPath(seedRegistry, durnan, [{ relation: 'shopkeeper', dir: 'in', type: 'Faction' }], ctx)).toEqual([]);
  });
  it('schreibt den Pfad in Worten', () => {
    expect(pathText(shop.layout![1]!.path, 'Creature')).toBe('Creature › ← shopkeeper › sells');
  });

  /**
   * **Ein Schritt über mehrere Kantenarten** (T-454): die Session zeigte
   * die Leute aus Szene (`features`) und Kampf (`participates`) in zwei
   * Sammlungen, und wer in beiden vorkam, stand zweimal. Ein Schritt nennt
   * jetzt eine Art oder mehrere, und ein Treffer steht einmal.
   */
  describe('ein Schritt über mehrere Kantenarten (T-454)', () => {
    const szene: Entity = {
      id: 'sc-0001', interfaces: ['Scene'], name: 'The tavern', components: {},
      relations: [{ type: 'features', to: 'npc-0001' }, { type: 'features', to: 'npc-0002' }],
    };
    const kampf: Entity = {
      id: 'en-0001', interfaces: ['Encounter'], name: 'Brawl', components: {},
      relations: [{ type: 'participates', to: 'npc-0002', props: { ally: false } }, { type: 'participates', to: 'npc-0003' }],
    };
    const rook: Entity = { id: 'npc-0003', interfaces: ['Creature'], name: 'Rook', components: {} };
    const alle2 = [durnan, varo, rook, szene, kampf];
    const ctx2 = { get: (id: string) => alle2.find((e) => e.id === id), incoming: (id: string) => incomingIndex(alle2).get(id) ?? [] };

    it('folgt beiden Arten, und wer über beide kommt, steht einmal', () => {
      const hits = followPath(seedRegistry, szene, [{ relation: ['features', 'participates'] }], ctx2);
      expect(hits.map((h) => h.entity.id)).toEqual(['npc-0001', 'npc-0002']);
      const beide = followPath(seedRegistry, { ...szene, relations: [...szene.relations!, ...kampf.relations!] }, [{ relation: ['features', 'participates'] }], ctx2);
      expect(beide.map((h) => h.entity.id)).toEqual(['npc-0001', 'npc-0002', 'npc-0003']);
      /* Die Werte der Kante kommen vom ersten Treffer: Varo über `features`, ohne `ally`. */
      expect(beide[1]!.props).toEqual({});
    });

    it('auch rückwärts: ← features | participates von der Kreatur aus', () => {
      const hits = followPath(seedRegistry, varo, [{ relation: ['features', 'participates'], dir: 'in' }], ctx2);
      expect(hits.map((h) => h.entity.id).sort()).toEqual(['en-0001', 'sc-0001']);
      expect(followPath(seedRegistry, varo, [{ relation: ['features', 'participates'], dir: 'in', type: 'Encounter' }], ctx2).map((h) => h.entity.id)).toEqual(['en-0001']);
    });

    it('eine Art als Liste mit einem Eintrag ist dasselbe wie ein Wort', () => {
      expect(followPath(seedRegistry, szene, [{ relation: ['features'] }], ctx2)).toEqual(followPath(seedRegistry, szene, [{ relation: 'features' }], ctx2));
    });

    it('nennt die Arten im Text mit einem Strich dazwischen', () => {
      expect(pathText([{ relation: 'partOf', dir: 'in' }, { relation: ['features', 'participates'] }], 'Session')).toBe('Session › ← partOf › features | participates');
      expect(pathText([{ relation: ['features', 'participates'], dir: 'in', type: 'Story' }])).toBe('← features | participates › Story');
    });

    it('die Ids, die ein Schritt braucht, kommen aus allen Arten', () => {
      expect(pathIds({ ...szene, relations: [...szene.relations!, ...kampf.relations!] }, [{ relation: ['features', 'participates'] }], ctx2.incoming)).toEqual(['npc-0001', 'npc-0002', 'npc-0002', 'npc-0003']);
      expect(pathIds(varo, [{ relation: ['features', 'participates'], dir: 'in' }], ctx2.incoming).sort()).toEqual(['en-0001', 'sc-0001']);
    });

    it('das Register nimmt beide Schreibweisen an', () => {
      const mitListe: Registry = {
        ...seedRegistry,
        views: { ...seedRegistry.views, people: { label: 'People', fields: 'all', layout: [{ id: 'p', el: 'collection', path: [{ relation: ['features', 'participates'] }] }] } },
      };
      expect(RegistrySchema.safeParse(mitListe).success).toBe(true);
      const leer: Registry = { ...mitListe, views: { ...mitListe.views, people: { ...mitListe.views['people']!, layout: [{ id: 'p', el: 'collection', path: [{ relation: [] }] }] } } };
      expect(RegistrySchema.safeParse(leer).success).toBe(false);
    });
  });
});

describe('der Baum des Designers (T-268)', () => {
  const baum: LayoutElement[] = [
    { id: 'a', el: 'section', children: [{ id: 'b', el: 'fields' }] },
    { id: 'c', el: 'quote' },
  ];
  it('→ in den Behälter darüber, ← wieder hinaus', () => {
    const rein = moveTree(baum, 'c', 'into');
    expect(rein.map((e) => e.id)).toEqual(['a']);
    expect(rein[0]!.children!.map((e) => e.id)).toEqual(['b', 'c']);
    const raus = moveTree(rein, 'c', 'out');
    expect(raus.map((e) => e.id)).toEqual(['a', 'c']);
  });
  it('↑ und ×; was nicht geht, bleibt', () => {
    expect(moveTree(baum, 'c', 'up').map((e) => e.id)).toEqual(['c', 'a']);
    expect(moveTree(baum, 'a', 'up')).toEqual(baum);
    expect(moveTree(baum, 'a', 'out')).toEqual(baum);
    expect(moveTree(baum, 'b', 'remove')[0]!.children).toEqual([]);
    /* Die Eingabe bleibt unberührt. */
    expect(baum[0]!.children!.length).toBe(1);
  });
  it('fügt in den gewählten Behälter ein und vergibt freie Ids', () => {
    const neu = insertElement(baum, { id: freeElementId(baum, 'b'), el: 'badges' }, 'a');
    expect(neu[0]!.children!.map((e) => e.id)).toEqual(['b', 'b-2']);
    expect(insertElement(baum, { id: 'x', el: 'text' }, 'c').map((e) => e.id)).toEqual(['a', 'c', 'x']);
  });
  it('forArticle siebt auch Kinder', () => {
    const l = forArticle([{ id: 's', el: 'section', children: [{ id: 'k', el: 'text', when: { incoming: 'shopkeeper' } }] }], durnan, rueck.get(durnan.id));
    expect(l[0]!.children!.length).toBe(1);
    expect(forArticle([{ id: 's', el: 'section', children: [{ id: 'k', el: 'text', when: { incoming: 'shopkeeper' } }] }], varo)[0]!.children).toEqual([]);
  });
});

describe('der Baum des Designers: Reiter, ↓ und Anpassung (T-276)', () => {
  const mitReitern: LayoutElement[] = [
    { id: 'kopf', el: 'heading' },
    { id: 'reiter', el: 'tabs', tabs: [
      { id: 't1', label: 'Stats', layout: [{ id: 'f', el: 'fields', fields: ['Statblock'] }] },
      { id: 't2', label: 'Story', layout: [] },
    ] },
  ];
  it('Reiter werden Knoten und wieder Reiter', () => {
    const baum = tabsAsTree(mitReitern);
    expect(baum[1]!.children!.map((k) => [k.el, k.text])).toEqual([['tab', 'Stats'], ['tab', 'Story']]);
    expect(baum[1]!.tabs).toBeUndefined();
    expect(treeAsTabs(baum)).toEqual(mitReitern);
  });
  it('→ in eine Reiterleiste heisst: in ihren letzten Reiter; ← aus dem Reiter hinter die Leiste', () => {
    const baum = tabsAsTree([...mitReitern, { id: 'q', el: 'quote' }]);
    expect(canMove(baum, 'q', 'into')).toBe(true);
    const rein = moveTree(baum, 'q', 'into');
    expect(rein[1]!.children![1]!.children!.map((e) => e.id)).toEqual(['q']);
    const raus = moveTree(rein, 'q', 'out');
    expect(raus.map((e) => e.id)).toEqual(['kopf', 'reiter', 'q']);
    /* Ein Reiter verlässt seine Leiste nicht, und nichts anderes steht direkt in ihr. */
    expect(canMove(baum, 't1', 'out')).toBe(false);
    expect(canMove(baum, 'kopf', 'into')).toBe(false);
  });
  it('↓ und was nicht geht', () => {
    const baum = tabsAsTree(mitReitern);
    expect(moveTree(baum, 'kopf', 'down').map((e) => e.id)).toEqual(['reiter', 'kopf']);
    expect(canMove(baum, 'reiter', 'down')).toBe(false);
    expect(moveTree(baum, 'reiter', 'down')).toEqual(baum);
  });
  it('ein neuer Reiter kommt in die Leiste, ein Element in ihren letzten Reiter', () => {
    const baum = tabsAsTree(mitReitern);
    const mitTab = insertElement(baum, { id: 't3', el: 'tab' as LayoutElement['el'], text: 'More', children: [] }, 'reiter');
    expect(mitTab[1]!.children!.map((k) => k.id)).toEqual(['t1', 't2', 't3']);
    const mitText = insertElement(baum, { id: 'x', el: 'text' }, 'reiter');
    expect(mitText[1]!.children![1]!.children!.map((k) => k.id)).toEqual(['x']);
  });
  it('Ziehen: hinein, dahinter, nie in sich selbst', () => {
    const baum: LayoutElement[] = [
      { id: 'a', el: 'section', children: [{ id: 'b', el: 'fields' }] },
      { id: 'c', el: 'quote' },
    ];
    expect(moveToElement(baum, 'c', 'a', 'into')[0]!.children!.map((e) => e.id)).toEqual(['b', 'c']);
    expect(moveToElement(baum, 'b', 'c', 'after').map((e) => e.id)).toEqual(['a', 'c', 'b']);
    expect(moveToElement(baum, 'a', 'b', 'into')).toEqual(baum);
    expect(moveToElement(baum, 'c', 'c', 'after')).toEqual(baum);
  });
  it('adjustFrom sagt die Abweichung, und applyAdjust gibt den Baum zurück', () => {
    const basis: LayoutElement[] = [
      { id: 'h', el: 'heading' },
      { id: 'f', el: 'fields', fields: ['Identity'] },
      { id: 'p', el: 'prose' },
    ];
    const baum: LayoutElement[] = [
      { id: 'q', el: 'quote', fields: ['Description.description'] },
      { id: 'f', el: 'fields', fields: ['Identity', 'Status.status'] },
      { id: 'h', el: 'heading' },
    ];
    const adj = adjustFrom(basis, baum)!;
    expect(adj.drop).toEqual(['p']);
    expect(adj.add).toEqual({ f: ['Status.status'] });
    expect(adj.extra!.map((e) => e.id)).toEqual(['q']);
    expect(adj.order).toEqual(['q', 'f', 'h']);
    /* Unverändert: keine Abweichung. */
    expect(adjustFrom(basis, basis)).toEqual({});
  });
  it('was sich nicht als Anpassung sagen lässt, gibt null', () => {
    const basis: LayoutElement[] = [{ id: 'h', el: 'heading', text: 'A' }];
    expect(adjustFrom(basis, [{ id: 'h', el: 'heading', text: 'B' }])).toBeNull();
  });
});

describe('pathOptions (T-268)', () => {
  it('bietet an der Kreatur die Gegenrichtung von shopkeeper an, am Shop sells vorwärts', async () => {
    const { pathOptions } = await import('../src/viewScope.js');
    const k = pathOptions(seedRegistry, 'Creature').find((o) => o.step.relation === 'shopkeeper');
    expect(k?.step).toEqual({ relation: 'shopkeeper', dir: 'in', type: 'Shop' });
    /* Zwei Ziele (REQ-439): je Ziel ein Schritt, damit `sells › Item` wählbar bleibt. */
    const s = pathOptions(seedRegistry, 'Shop').filter((o) => o.step.relation === 'sells');
    expect(s.map((o) => o.step)).toEqual([
      { relation: 'sells', type: 'Collection' },
      { relation: 'sells', type: 'Item' },
    ]);
  });
});
