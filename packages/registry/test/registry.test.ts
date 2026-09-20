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

  /* Ruf (REQ-030, 081). Eine Tat ist dreistellig — wer, was, bei wem — und
     eine Kante hat ein Ziel; also ist die Mitte ein Artikel mit zwei
     Kanten. Wandert das Gewicht an eine der beiden Kanten, ist die dritte
     Stelle wieder verloren, und niemand merkt es, bis die Zahlen nicht mehr
     stimmen. */
  it('keeps a deed a thing of its own, with both ends as edges', () => {
    expect(seedRegistry.interfaces.Deed.requires).toContain('DeedInfo');
    const tat = seedRegistry.components.DeedInfo.schema.properties ?? {};
    expect(tat.delta?.type).toBe('number');
    expect(tat.secret?.type).toBe('boolean'); // eine Tat, von der niemand weiss
    ['doneBy', 'regarding'].forEach((k) => {
      expect(seedRegistry.relations[k].from).toEqual(['Deed']);
      expect(seedRegistry.relations[k].cardinality).toBe('one');
    });
    // Der Ausgangswert steht am Urteilenden und trägt keinen Zähler daneben.
    const reg = seedRegistry.relations.regards;
    expect(reg.props?.properties?.value?.type).toBe('number');
    expect(Object.keys(reg.props?.properties ?? {})).toEqual(['value', 'note']);
    // Und eine Fraktion darf etwas erfahren — daran hängt, ob eine Tat zählt.
    expect(seedRegistry.relations.knownBy.to).toContain('Faction');
  });

  /* Ein laufender Handwerksgang (REQ-184). `put` ist die Zeile, an der
     alles hängt: ohne sie wüsste ein Fehlschlag nicht, was er kosten soll,
     und `onFailure` wäre Zierrat. */
  it('lets a craft actually run, on an edge and not in an article', () => {
    const gang = seedRegistry.relations.crafting;
    expect(gang.to).toEqual(['Recipe']);
    expect(Object.keys(gang.props?.properties ?? {})).toEqual(['day', 'days', 'put', 'rolls']);
    expect(Object.keys(seedRegistry.interfaces)).not.toContain('CraftJob');
    // Und eine Zahl neben dem Text, weil „2 Stunden" nicht rechnet.
    const rez = seedRegistry.components.RecipeInfo.schema.properties ?? {};
    expect(rez.days?.type).toBe('number');
    expect(rez.onFailure?.enum).toEqual(['materialsLost', 'halfLost', 'nothingLost']);
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

/**
 * Bezugstreue der Startzeilen (C4).
 *
 * Seit `emit-seed` das Register des Prototyps aus diesen Zeilen erzeugt,
 * ist das hier die einzige Quelle — und eine einzige Quelle ist nur so viel
 * wert, wie sie geprüft ist. Ein Tippfehler in einem `requires` erzeugte
 * vorher eine Artikelart, deren Pflichtfeld es nicht gibt; die Oberfläche
 * zeigte dann eine leere Maske und niemand wusste, warum.
 */
describe('seed registry, referential integrity', () => {
  const { components, interfaces, relations, views } = seedRegistry;
  const blockTypes = new Set<string>();
  Object.values(interfaces).forEach((i) =>
    (i.blockTypes ?? []).forEach((b) => blockTypes.add(b.replace(/^\+/, ''))),
  );

  it('names only components that exist', () => {
    const fehlt: string[] = [];
    Object.entries(interfaces).forEach(([n, i]) => {
      [...(i.requires ?? []), ...(i.allows ?? [])].forEach((c) => {
        if (!components[c]) fehlt.push(`${n} → ${c}`);
      });
    });
    expect(fehlt).toEqual([]);
  });

  it('extends only interfaces that exist, and never itself', () => {
    const fehlt: string[] = [];
    Object.entries(interfaces).forEach(([n, i]) => {
      (i.extends ?? []).forEach((p) => {
        if (!interfaces[p] || p === n) fehlt.push(`${n} → ${p}`);
      });
    });
    expect(fehlt).toEqual([]);
  });

  it('points relations at interfaces that exist', () => {
    const fehlt: string[] = [];
    Object.entries(relations).forEach(([n, r]) => {
      [...(r.from ?? []), ...(r.to ?? [])].forEach((t) => {
        if (t !== '*' && !interfaces[t]) fehlt.push(`${n} → ${t}`);
      });
    });
    expect(fehlt).toEqual([]);
  });

  /* Ein Layout-Element, das die Seite nicht kennt, zeichnet nichts — und
     die Ansicht ist dann leer, ohne dass irgendwo etwas schiefgeht. */
  it('uses only layout elements the schema knows', () => {
    expect(() => RegistrySchema.parse(seedRegistry)).not.toThrow();
    const ohne = Object.entries(views).filter(([, v]) => (v.layout ?? []).length === 0);
    // Ansichten ohne Layout fallen auf die Standardfolge zurück — das ist
    // in Ordnung, aber es soll niemand versehentlich tun.
    expect(ohne.map(([n]) => n).sort()).toEqual(
      ['combat', 'full', 'image', 'player', 'quick', 'stats'].sort(),
    );
  });

  it('refers to fields that exist', () => {
    const fehlt: string[] = [];
    Object.entries(views).forEach(([n, v]) => {
      const refs = Array.isArray(v.fields) ? v.fields : [];
      refs.forEach((ref) => {
        const [c, f] = String(ref).split('.');
        const def = components[c];
        if (!def) {
          fehlt.push(`${n} → ${ref}`);
          return;
        }
        if (f && !(def.schema?.properties ?? {})[f]) fehlt.push(`${n} → ${ref}`);
      });
    });
    expect(fehlt).toEqual([]);
  });

  it('refers to block types some interface declares', () => {
    const fehlt: string[] = [];
    Object.entries(views).forEach(([n, v]) => {
      (Array.isArray(v.blocks) ? v.blocks : []).forEach((b) => {
        if (!blockTypes.has(b)) fehlt.push(`${n} → ${b}`);
      });
      (v.layout ?? []).forEach((el) =>
        // `blocks` darf auch "all" heissen — dann steht da kein Name, der
        // falsch sein könnte.
        (Array.isArray(el.blocks) ? el.blocks : []).forEach((b) => {
          if (!blockTypes.has(b)) fehlt.push(`${n}/${el.id} → ${b}`);
        }),
      );
    });
    expect(fehlt).toEqual([]);
  });

  /* Ein abgeleiteter Wert bekommt keine Eingabe und keine Spalte (D8). Ihn
     zugleich zur Pflicht zu machen hiesse, ein Feld zu verlangen, das
     niemand ausfüllen kann. */
  it('never makes a derived property required', () => {
    const schlecht: string[] = [];
    Object.entries(components).forEach(([n, c]) => {
      const req = c.schema?.required ?? [];
      Object.entries(c.schema?.properties ?? {}).forEach(([p, def]) => {
        if ((def as { derived?: string }).derived && req.includes(p)) schlecht.push(`${n}.${p}`);
      });
    });
    expect(schlecht).toEqual([]);
  });

  /* Schweizer Rechtschreibung, überall. Kein ß — auch nicht in einem
     Aufzählungswert, der Kampagneninhalt ist. */
  it('spells everything the Swiss way', () => {
    expect(JSON.stringify(seedRegistry)).not.toMatch(/ß/);
  });

  /* Und die Variablennamen bleiben bei A–Z: `{VAR}` wird mit genau diesem
     Zeichensatz gesucht, und ein Name daneben würde nie ersetzt. */
  it('keeps variable names to what {VAR} can actually match', () => {
    const schlecht = Object.keys(seedRegistry.vars ?? {}).filter((k) => !/^[A-Z0-9_]+$/.test(k));
    expect(schlecht).toEqual([]);
  });
});
