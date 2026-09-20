import { describe, expect, it } from 'vitest';
import {
  RegistrySchema,
  allowedComponents,
  blockTypesFor,
  relationsFrom,
  showField,
  viewKeys,
} from '@nw/model';
import { seedRegistry } from '../src/index.js';

/**
 * The registry is data, so nothing but a test stops a typo in it from
 * silently producing an article type with no fields. These checks are the
 * reason the "add a kind of thing without touching code" claim is safe.
 */
describe('seed registry', () => {
  it('matches the registry schema', () => {
    expect(() => RegistrySchema.parse(seedRegistry)).not.toThrow();
  });

  it('every component an interface names exists', () => {
    const missing: string[] = [];
    for (const [name, def] of Object.entries(seedRegistry.interfaces)) {
      for (const component of [...(def.requires ?? []), ...(def.allows ?? [])]) {
        if (!seedRegistry.components[component]) missing.push(`${name} → ${component}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('every interface an interface extends exists', () => {
    const missing: string[] = [];
    for (const [name, def] of Object.entries(seedRegistry.interfaces)) {
      for (const parent of def.extends ?? []) {
        if (!seedRegistry.interfaces[parent]) missing.push(`${name} → ${parent}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('every relation endpoint names a real interface', () => {
    const bad: string[] = [];
    for (const [type, def] of Object.entries(seedRegistry.relations)) {
      for (const end of [...(def.from ?? []), ...(def.to ?? [])]) {
        if (end === '*' || end === 'same') continue;
        if (!seedRegistry.interfaces[end]) bad.push(`${type} → ${end}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('every relation carries both labels, so backlinks read correctly', () => {
    for (const [type, def] of Object.entries(seedRegistry.relations)) {
      expect(def.label, `${type}.label`).toBeTruthy();
      expect(def.inverseLabel, `${type}.inverseLabel`).toBeTruthy();
      expect(def.inverseLabel, `${type} labels must differ`).not.toBe(def.label);
    }
  });

  it('every field a view names exists on its component', () => {
    const bad: string[] = [];
    for (const [key, view] of Object.entries(seedRegistry.views)) {
      if (!Array.isArray(view.fields)) continue;
      for (const entry of view.fields) {
        const [component, property] = entry.split('.');
        const def = component ? seedRegistry.components[component] : undefined;
        if (!def) {
          bad.push(`${key}: unbekannte Komponente ${component}`);
          continue;
        }
        if (property && !def.schema.properties[property]) {
          bad.push(`${key}: ${component} hat kein Feld ${property}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('every block type a view names is accepted by some interface', () => {
    const accepted = new Set(
      Object.keys(seedRegistry.interfaces).flatMap((name) => blockTypesFor(seedRegistry, name)),
    );
    const bad: string[] = [];
    for (const [key, view] of Object.entries(seedRegistry.views)) {
      if (!Array.isArray(view.blocks)) continue;
      for (const type of view.blocks) {
        if (!accepted.has(type)) bad.push(`${key}: ${type}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('the player view withholds secrets', () => {
    const player = seedRegistry.views['player'];
    expect(player).toBeDefined();
    expect(Array.isArray(player!.blocks) && player!.blocks.includes('secret')).toBe(false);
    expect(showField(player!, 'StatblockInfo', 'ac')).toBe(false);
  });

  /* Die Liste der Ansichten wächst mit jedem Bereich. Fest einzutragen,
     welche es gibt, hiesse: dieser Test wird rot, sobald eine dazukommt —
     und sagt dabei nichts über das, was er prüfen soll. Geprüft wird die
     Reihenfolge, denn die ist die Zusage: `order` bestimmt sie, nicht der
     Zufall der Einfügereihenfolge. */
  it('orders the facets by their order field', () => {
    const keys = viewKeys(seedRegistry);
    expect(new Set(keys)).toEqual(new Set(Object.keys(seedRegistry.views)));
    expect(keys[0]).toBe('quick');
    const orders = keys.map((k) => seedRegistry.views[k]?.order ?? 99);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });
});

describe('interface inheritance', () => {
  it('unions components up the extends chain', () => {
    const forNpc = allowedComponents(seedRegistry, 'NPC');
    expect(forNpc).toContain('Name'); // from Base.requires
    expect(forNpc).toContain('Status'); // from Base.allows
    expect(forNpc).toContain('CreatureInfo'); // its own
    /* Seit dem Charakterbogen darf ein Geschöpf seine Zahlen auch selbst
       tragen: ein Spielercharakter tut das, ein NSC borgt sie meist über
       `belongsTo`. Beides muss gehen — der Bogen liest erst die eigene
       Karte, dann die geliehene. Geprüft bleibt, dass die Vereinigung nicht
       alles einsammelt: eine Karte einer fremden Linie hat hier nichts
       verloren. */
    expect(forNpc).toContain('StatblockInfo');
    expect(forNpc).not.toContain('MapInfo');
    expect(forNpc).not.toContain('QuestInfo');
  });

  it('adds `+x` block types to the inherited set', () => {
    const forNpc = blockTypesFor(seedRegistry, 'NPC');
    expect(forNpc).toContain('paragraph'); // inherited from Base
    expect(forNpc).toContain('secret'); // added with +secret
    expect(blockTypesFor(seedRegistry, 'Rule')).toEqual(['paragraph', 'note']);
  });

  it('offers only the relations whose source matches', () => {
    const fromStatblock = relationsFrom(seedRegistry, 'Statblock').map((r) => r.type);
    expect(fromStatblock).toContain('composedOf');
    expect(fromStatblock).toContain('describedIn'); // from: ['*']
    expect(fromStatblock).not.toContain('livesIn');
  });

  /* Nebel, Licht und Gebiete trennen sich schon im Register, und genau da
     muss die Trennung halten: was bleibt, ist ein Feld der Karte; was von
     beiden Enden abhängt, steht an der Kante; was auf einen Artikel zeigt,
     ist eine eigene Kantenart. Wandert eines davon an die falsche Stelle,
     fällt es am Tisch niemandem auf — und im Modell ist es dann zu spät. */
  it('keeps fog on the map, light on the edge, territory as its own edge', () => {
    const karte = seedRegistry.components.MapInfo.schema.properties ?? {};
    expect(karte.fog?.type).toBe('boolean');
    expect(karte.reveal?.type).toBe('array'); // aufgedeckt bleibt aufgedeckt
    expect(karte.walls?.type).toBe('array');
    expect(karte.lighting?.enum).toEqual(['bright', 'dim', 'dark']);
    // Beleuchtetes wird nie gespeichert — es gibt kein Feld dafür.
    expect(Object.keys(karte)).not.toContain('lit');

    const marker = seedRegistry.relations.marker.props?.properties ?? {};
    expect(marker.light?.type).toBe('number');
    expect(marker.dim?.type).toBe('number');

    const terr = seedRegistry.relations.territory;
    expect(terr.from).toEqual(['Map']);
    expect(terr.props?.properties?.kind?.enum).toEqual(['rect', 'circle', 'poly']);
    expect(relationsFrom(seedRegistry, 'Map').map((r) => r.type)).toContain('territory');
  });

  /* Kachelkarten (REQ-138): ohne Spalten und Zeilen ist ein Muster nur eine
     Zeichenkette, und die Seite wüsste nicht, wie gross das Bild ist. */
  it('describes a tiled map completely enough to draw it', () => {
    const karte = seedRegistry.components.MapInfo.schema.properties ?? {};
    ['tiles', 'tileCols', 'tileRows', 'tileSize'].forEach((k) => {
      expect(Object.keys(karte)).toContain(k);
    });
  });
});
