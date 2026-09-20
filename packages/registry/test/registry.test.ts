import { describe, expect, it } from 'vitest';
import {
  RegistrySchema,
  fieldsOf,
  blockTypesFor,
  typeChain,
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

  it('gives every required field a schema to live in', () => {
    const missing: string[] = [];
    for (const [name, def] of Object.entries(seedRegistry.interfaces)) {
      for (const key of def.schema?.required ?? []) {
        if (!def.schema?.properties[key]) missing.push(`${name} → ${key}`);
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

  it('every field a view names exists on its type', () => {
    const bad: string[] = [];
    for (const [key, view] of Object.entries(seedRegistry.views)) {
      if (!Array.isArray(view.fields)) continue;
      for (const entry of view.fields) {
        const [type, property] = entry.split('.');
        const def = type ? seedRegistry.interfaces[type] : undefined;
        if (!def) {
          bad.push(`${key}: unbekannte Art ${type}`);
          continue;
        }
        if (property && !def.schema?.properties[property]) {
          bad.push(`${key}: ${type} hat kein Feld ${property}`);
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

  /* Die Spielerstufe hält **Blöcke** zurück, keine Felder mehr.
     Zurückgehalten wird, was einer Information gehört, die dieser Spieler
     nicht hat — das entscheidet `redactEntity` an den Daten und nicht eine
     Feldliste an der Ansicht. Eine Feldliste hier hiesse: ein Spieler sieht
     die Rüstungsklasse **seiner eigenen Figur** nicht, und das war der
     Fehler, den die Stufe hatte. */
  it('the player view withholds the GM block types, not the fields', () => {
    const player = seedRegistry.views['player'];
    expect(player).toBeDefined();
    expect(Array.isArray(player!.blocks) && player!.blocks.includes('secret')).toBe(false);
    expect(Array.isArray(player!.blocks) && player!.blocks.includes('tactics')).toBe(false);
    // Die eigene Figur muss lesbar bleiben, sonst ist das Blatt wertlos.
    expect(showField(player!, 'StatblockInfo', 'ac')).toBe(true);
  });

  /* Drei Stufen, nicht einundzwanzig. Vierzehn der alten gab es für genau
     eine Artikelart — das ist keine Auswahl, sondern eine Liste von
     Sonderfällen mit einem Dropdown davor. Was für eine Artikelart eigen
     ist, steht seither in `byInterface`. */
  it('keeps the facets to how much and for whom', () => {
    expect(Object.keys(seedRegistry.views).sort()).toEqual(['full', 'player', 'quick']);
    const proTyp = seedRegistry.views['full']?.byInterface ?? {};
    expect(Object.keys(proTyp)).toContain('Creature');
    expect(Object.keys(proTyp)).toContain('Map');
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
  it('gathers the fields of every type up the extends chain', () => {
    const felder = fieldsOf(seedRegistry, 'NPC');
    const wo = (k: string) => felder.find((f) => f.key === k)?.type;
    expect(wo('name')).toBe('Identity'); // von Identity
    expect(wo('species')).toBe('Creature'); // von Creature
    /* Seit dem Charakterbogen darf ein Geschöpf seine Zahlen auch selbst
       tragen: ein Spielercharakter tut das, ein NSC borgt sie meist über
       `belongsTo`. Beides muss gehen — der Bogen liest erst die eigene
       Karte, dann die geliehene. */
    expect(typeChain(seedRegistry, 'NPC')).toContain('StatblockInfo');
    /* Und die Vereinigung sammelt nicht alles ein: eine fremde Linie hat
       hier nichts verloren. */
    expect(typeChain(seedRegistry, 'NPC')).not.toContain('Map');
    expect(typeChain(seedRegistry, 'NPC')).not.toContain('Quest');
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
    const karte = seedRegistry.interfaces.Map.schema.properties ?? {};
    expect(karte.fog?.type).toBe('boolean');
    expect(karte.reveal?.type).toBe('array'); // aufgedeckt bleibt aufgedeckt
    expect(karte.walls?.type).toBe('array');
    expect(karte.lighting?.enum).toEqual(['bright', 'dim', 'dark']);
    // Beleuchtetes wird nie gespeichert — es gibt kein Feld dafür.
    expect(Object.keys(karte)).not.toContain('lit');

    const marker = seedRegistry.relations.marker.props?.properties ?? {};
    expect(marker.light?.type).toBe('number');
    expect(marker.dim?.type).toBe('number');
    /* Drehung und Seitenverhältnis stehen an der Kante und nicht am Asset:
       dasselbe Fass steht auf einer Karte quer und auf der nächsten längs,
       und ein gedrehtes Bild als eigenes Asset wäre ein zweites Fass. */
    expect(marker.rot?.type).toBe('number');
    expect(marker.ratio?.type).toBe('number');
    expect(seedRegistry.interfaces.Asset.schema.properties ?? {})
      .not.toHaveProperty('rot');

    const terr = seedRegistry.relations.territory;
    expect(terr.from).toEqual(['Map']);
    expect(terr.props?.properties?.kind?.enum).toEqual(['rect', 'circle', 'poly']);
    expect(relationsFrom(seedRegistry, 'Map').map((r) => r.type)).toContain('territory');
  });

  /* Beziehung (REQ-030, 081). Eine Kante mit Marken, und sonst nichts.
     Die Prüfung sucht deshalb zuerst nach dem Gegenteil: einer Zahl, aus
     der jemand wieder eine Leiter bauen könnte, und der Maschinerie, die
     hier einmal stand. Gäbe es sie, wäre „simpel" nur eine Behauptung. */
  it('keeps a relationship one edge with tags, and nothing more', () => {
    const reg = seedRegistry.relations.regards;
    expect(Object.keys(reg.props?.properties ?? {})).toEqual(['tags', 'note']);
    expect(reg.props?.properties?.tags?.type).toBe('array');
    // Marken sind Worte, keine Aufzählung: was jemand denkt, ist Inhalt.
    expect(reg.props?.properties?.tags?.enum).toBeUndefined();
    // Sie steht beim Urteilenden und darf in beide Richtungen verschieden sein.
    expect(reg.from).toContain('Faction');
    expect(reg.to).toContain('Party');

    // Die Taten sind weg — mit ihnen die gerechnete Leiter.
    expect(seedRegistry.interfaces.Deed).toBeUndefined();
    expect(seedRegistry.interfaces.DeedInfo).toBeUndefined();
    ['doneBy', 'regarding'].forEach((k) => {
      expect(seedRegistry.relations[k]).toBeUndefined();
    });
    // Und keine Kante zeigt mehr auf etwas, das es nicht mehr gibt.
    Object.values(seedRegistry.relations).forEach((r) => {
      expect(r.from ?? []).not.toContain('Deed');
      expect(r.to ?? []).not.toContain('Deed');
    });
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
    const rez = seedRegistry.interfaces.Recipe.schema.properties ?? {};
    expect(rez.days?.type).toBe('number');
    expect(rez.onFailure?.enum).toEqual(['materialsLost', 'halfLost', 'nothingLost']);
  });

  /* Kachelkarten (REQ-138): ohne Spalten und Zeilen ist ein Muster nur eine
     Zeichenkette, und die Seite wüsste nicht, wie gross das Bild ist. */
  it('describes a tiled map completely enough to draw it', () => {
    const karte = seedRegistry.interfaces.Map.schema.properties ?? {};
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
  const { interfaces, relations, views } = seedRegistry;
  const blockTypes = new Set<string>();
  Object.values(interfaces).forEach((i) =>
    (i.blockTypes ?? []).forEach((b) => blockTypes.add(b.replace(/^\+/, ''))),
  );

  /* Eine Art ohne eigene Felder ist in Ordnung — `NPC` erbt alles von
     `Creature`. Eine Art mit einem leeren Schema dagegen ist eine Zeile, die
     etwas behauptet und nichts sagt. */
  it('carries no empty schema', () => {
    const leer = Object.entries(interfaces)
      .filter(([, i]) => i.schema && Object.keys(i.schema.properties).length === 0)
      .map(([n]) => n);
    expect(leer).toEqual([]);
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
  it('uses only layout elements the schema knows, and writes them out', () => {
    expect(() => RegistrySchema.parse(seedRegistry)).not.toThrow();
    /* Keine Ansicht fällt mehr auf die alte Schalterform zurück. Die gibt
       es weiterhin, damit eine von Hand geschriebene Zeile lesbar bleibt —
       aber die Startzeilen sollen sagen, was sie meinen. */
    const ohne = Object.entries(views).filter(([, v]) => (v.layout ?? []).length === 0);
    expect(ohne.map(([n]) => n)).toEqual([]);
  });

  it('refers to fields that exist', () => {
    const fehlt: string[] = [];
    Object.entries(views).forEach(([n, v]) => {
      const refs = Array.isArray(v.fields) ? v.fields : [];
      refs.forEach((ref) => {
        const [c, f] = String(ref).split('.');
        const def = interfaces[c];
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
    Object.entries(interfaces).forEach(([n, c]) => {
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

/* Reiter auf dem Charakterbogen. Zwei Dinge gehen hier still schief: ein
   Reiter, dessen Inhalt woanders auch steht (dann bearbeitet man zweimal
   dasselbe), und die Zahlen im Reiter statt darüber (dann muss man am Tisch
   umschalten, um die Trefferpunkte zu sehen). */
describe('the character sheet has tabs', () => {
  const creature = seedRegistry.views.full?.byInterface?.['Creature'] ?? [];
  const tabsEl = creature.find((x) => x.el === 'tabs');

  it('keeps the sheet above the tabs, not inside one', () => {
    expect(creature[0]?.el).toBe('sheet');
    expect(tabsEl).toBeTruthy();
    expect(creature.indexOf(tabsEl!)).toBeGreaterThan(0);
    for (const t of tabsEl?.tabs ?? []) {
      expect(t.layout.map((x) => x.el)).not.toContain('sheet');
    }
  });

  it('starts on the overview, and the overview carries the field table', () => {
    const erste = tabsEl?.tabs?.[0];
    expect(erste?.id).toBe('about');
    /* Wer etwas ändern will, soll nicht erst umschalten. Ein eigener Reiter
       für die Felder sah aufgeräumt aus und versteckte das Bearbeiten. */
    expect(erste?.layout.map((x) => x.el)).toContain('fields');
  });

  it('shows nothing twice', () => {
    const wo = new Map<string, string[]>();
    for (const t of tabsEl?.tabs ?? []) {
      for (const x of t.layout) {
        wo.set(x.el, [...(wo.get(x.el) ?? []), t.id]);
      }
    }
    for (const [el, tabs] of wo) expect(`${el}: ${tabs.join(',')}`).toBe(`${el}: ${tabs[0]}`);
  });

  it('gives every tab a label and something to draw', () => {
    for (const t of tabsEl?.tabs ?? []) {
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.layout.length).toBeGreaterThan(0);
    }
  });
});

/* Beute ist nicht nur, was man einstecken kann. Was jemand erfährt, ist
   genauso ein Fund — und manchmal der einzige, den es zu machen gab. */
describe('loot is more than items', () => {
  const loot = seedRegistry.relations['loot'];

  it('reaches knowledge, feats and skills as well as items', () => {
    expect(loot.to).toEqual(expect.arrayContaining(['Item', 'Information', 'Feat', 'Skill']));
  });

  /* Eine Lauernde Aktion ist auch eine Regel. Zeigte die Kante auf `Rule`,
     dürfte man sie erbeuten, und die Auswahl im Feld wäre voller Unsinn. */
  it('does not reach every rule', () => {
    expect(loot.to).not.toContain('Rule');
  });

  it('is recordable on a quest, not only on an encounter', () => {
    expect(loot.from).toEqual(expect.arrayContaining(['Encounter', 'Story', 'Quest']));
  });

  it('lets a feat and a skill be articles of their own, below Rule', () => {
    for (const n of ['Feat', 'Skill']) {
      expect(seedRegistry.interfaces[n]?.extends).toContain('Rule');
      expect(seedRegistry.interfaces[n]?.abstract).toBeFalsy();
    }
    expect(seedRegistry.interfaces['Feat']).toBeTruthy();
    expect(seedRegistry.interfaces['Skill']).toBeTruthy();
  });

  /* `RuleInfo.kind` ist Pflicht. Gäbe es die beiden Werte nicht, liesse sich
     kein Talent anlegen, das die Validierung besteht. */
  it('leaves a feat and a skill a kind they may carry', () => {
    const kind = seedRegistry.interfaces['Rule'].schema.properties['kind'];
    expect(kind.enum).toEqual(expect.arrayContaining(['feat', 'skill']));
  });
});

/* Was der Umbau erreicht hat, als Zusicherung und nicht als Behauptung. */
describe('one registry of types', () => {
  it('has no component part left', () => {
    expect((seedRegistry as unknown as { components?: unknown }).components).toBeUndefined();
  });

  /* Der Grund, weshalb die Werte nach Art gruppiert bleiben und nicht alle
     in einen Topf wandern: `hp` heisst am Statblock die Trefferpunkte, die
     dort stehen, und an der Kreatur die, die sie gerade noch hat. Beides
     ohne Umbenennung, weil es zwei Karten sind. */
  it('keeps hp at the creature apart from hp at the statblock', () => {
    const felder = fieldsOf(seedRegistry, 'PlayerCharacter').filter((f) => f.key === 'hp');
    expect(felder.map((f) => f.type).sort()).toEqual(['StatblockInfo', 'Vitals']);
  });

  /* Kein Feldname darf zweimal in derselben Karte stehen — das kann nicht
     passieren, seit eine Karte ein Schema ist. Wohl aber, dass zwei Arten
     einer Kette dasselbe Feld erklären, und dann muss klar bleiben, welche
     gemeint ist. Geprüft wird deshalb, dass die Art immer dabeisteht. */
  it('says which type declares each field', () => {
    for (const n of Object.keys(seedRegistry.interfaces)) {
      for (const f of fieldsOf(seedRegistry, n)) {
        expect(seedRegistry.interfaces[f.type]?.schema?.properties[f.key]).toBeTruthy();
      }
    }
  });

  /* Die sieben, die mehrere Arten teilen. Sie sind abstrakt, weil niemand
     einen Artikel „Zugriff" anlegt — und sie tragen Felder, sonst wären sie
     eine Zeile ohne Inhalt. */
  it('keeps the shared ones abstract and full', () => {
    for (const n of ['Vars', 'StatblockInfo', 'Access', 'Vitals', 'Skills']) {
      const d = seedRegistry.interfaces[n];
      expect(d?.abstract).toBe(true);
      expect(Object.keys(d?.schema?.properties ?? {}).length).toBeGreaterThan(0);
    }
  });

  /* Marken gehören einem Bestandteil und nicht der Entität. Jede Artikelart
     muss ihn erben — sonst gäbe es Artikel, die sich nicht markieren
     lassen, ohne dass irgendwo stünde, warum. */
  it('gives every article type its tags', () => {
    const arten = Object.keys(seedRegistry.interfaces)
      .filter((n) => !seedRegistry.interfaces[n]?.abstract);
    expect(arten.length).toBeGreaterThan(20);
    for (const n of arten) {
      expect(fieldsOf(seedRegistry, n).some((f) => f.type === 'Tags' && f.key === 'tags')).toBe(true);
    }
  });
});
