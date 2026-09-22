import { describe, expect, it } from 'vitest';
import {
  RegistrySchema,
  enumGroups,
  enumOptions,
  linkedTypes,
  linkAccepts,
  linkTargets,
  unitByCode,
  enumSource,
  fieldsOf,
  proseFields,
  typeChain,
  relationsFrom,
  layoutFor,
  viewKeys,
} from '@nw/model';
import type { PropertySchema } from '@nw/model';
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

  /* Prosa ist ein Feld wie jedes andere — `many` und lange Eingabe. Eine
     Ansicht, die eines nennt, das keine Art erklärt, zeichnet nichts und
     sagt nicht warum. */
  it('every prose field a view names is declared by some type', () => {
    const da = new Set(
      Object.keys(seedRegistry.interfaces)
        .flatMap((name) => proseFields(seedRegistry, name).map((f) => `${f.type}.${f.key}`)),
    );
    const bad: string[] = [];
    for (const [key, view] of Object.entries(seedRegistry.views)) {
      for (const el of view.layout ?? []) {
        if (el.el !== 'prose' || !Array.isArray(el.fields)) continue;
        for (const ref of el.fields) if (!da.has(ref)) bad.push(`${key}: ${ref}`);
      }
    }
    expect(bad).toEqual([]);
  });

  /* **Es gibt keine Spieleransicht mehr.** Sie war die zweite Stelle, an
     der stand, was ein Spieler nicht sehen darf — und sie hielt einmal
     Felder zurück, sodass ein Spieler die Rüstungsklasse seiner eigenen
     Figur nicht sah. Zurückgehalten wird am Server (`redactEntity`) an den
     Daten, nicht an einer Feldliste; wer weniger sehen darf, sieht dieselbe
     Ansicht mit weniger darin. */
  it('has no player view — what is withheld is withheld at the server', () => {
    expect(seedRegistry.views['player']).toBeUndefined();
  });

  /* Drei Ansichten, nicht einundzwanzig. Vierzehn der alten gab es für
     genau eine Artikelart — das ist keine Auswahl, sondern eine Liste von
     Sonderfällen mit einem Dropdown davor. Und **die Anordnung wohnt am
     Typ**: was für eine Artikelart eigen ist, steht bei ihr. */
  it('keeps the views to how much, and the arrangement at the type', () => {
    expect(Object.keys(seedRegistry.views).sort()).toEqual(['full', 'overview', 'quick']);
    const mitEigener = Object.keys(seedRegistry.interfaces)
      .filter((n) => seedRegistry.interfaces[n]?.views?.['full']?.length);
    expect(mitEigener).toContain('Creature');
    expect(mitEigener).toContain('Map');
    /* Und nichts liegt mehr an der Ansicht: eine Anordnung dort wäre die
       zweite Stelle, an der stünde, wie eine Art gezeichnet wird. */
    for (const v of Object.values(seedRegistry.views)) {
      expect((v as unknown as Record<string, unknown>)['byInterface']).toBeUndefined();
    }
  });

  /* Die Liste der Ansichten wächst mit jedem Bereich. Fest einzutragen,
     welche es gibt, hiesse: dieser Test wird rot, sobald eine dazukommt —
     und sagt dabei nichts über das, was er prüfen soll. Geprüft wird die
     Reihenfolge, denn die ist die Zusage: `order` bestimmt sie, nicht der
     Zufall der Einfügereihenfolge. */
  /* Die Anordnung wird die `extends`-Kette hoch gesucht. Eine an `Creature`
     deckt damit die Spielerfigur mit ab, ohne dass die sie wiederholt — und
     wer sie ändert, ändert sie für beide, was der Sinn ist und trotzdem
     dastehen muss. */
  it('resolves a layout up the chain, and says where it came from', () => {
    const pc = layoutFor(seedRegistry, 'full', 'PlayerCharacter');
    expect(pc.from).toBe('Creature');
    expect(pc.layout[0]?.el).toBe('sheet');
    /* Sagt niemand in der Kette etwas, gilt die Grundanordnung der Ansicht
       — eine neu angelegte Art fängt nicht mit einer leeren Seite an. */
    const artikel = layoutFor(seedRegistry, 'full', 'Article');
    expect(artikel.from).toBe(null);
    expect(artikel.layout.length).toBeGreaterThan(0);
  });

  it('orders the facets by their order field', () => {
    const keys = viewKeys(seedRegistry);
    expect(new Set(keys)).toEqual(new Set(Object.keys(seedRegistry.views)));
    expect(keys[0]).toBe('overview');
    const orders = keys.map((k) => seedRegistry.views[k]?.order ?? 99);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });
});

/* **Geteilte Aufzählungen.** Sie stehen im Register, weil mehrere Felder
   dieselbe Liste brauchen — und die Prüfung hier hält genau das fest: eine
   Zeile ohne Nutzer wäre der Umweg ohne den Gewinn, und ein Feld, das eine
   Zeile nennt, die es nicht gibt, hätte still keine Werte mehr. */
describe('shared choice lists', () => {
  /* Ein Feld darf **mehrere** Zeilen nennen, also wird flach gerechnet: je
     genannte Zeile ein Eintrag. */
  const felderMitRef = Object.entries(seedRegistry.interfaces).flatMap(([typ, def]) =>
    Object.entries(def.schema?.properties ?? {})
      .filter(([, p]) => p.enumRef)
      .flatMap(([key, p]) => {
        const refs = Array.isArray(p.enumRef) ? p.enumRef : [p.enumRef as string];
        return refs.map((nennt) => ({ ref: `${typ}.${key}`, nennt }));
      }),
  );

  it('every named row exists, and every row is named', () => {
    const zeilen = new Set(Object.keys(seedRegistry.enums ?? {}));
    expect(felderMitRef.filter((f) => !zeilen.has(f.nennt))).toEqual([]);
    const genannt = new Set(felderMitRef.map((f) => f.nennt));
    expect([...zeilen].filter((z) => !genannt.has(z))).toEqual([]);
  });

  /* Die sechs Attributkürzel standen wörtlich an der Fertigkeit und am
     Rezept. Dass beide jetzt dieselbe Zeile nennen, ist der ganze Punkt. */
  it('the ability list is named by the skill, the recipe and the saving throws', () => {
    const wer = felderMitRef.filter((f) => f.nennt === 'Ability').map((f) => f.ref).sort();
    expect(wer).toEqual(['Proficiencies.saves', 'Recipe.ability', 'Skill.ability']);
    expect(enumOptions(seedRegistry, { enumRef: 'Ability' })).toEqual([
      'str', 'dex', 'con', 'int', 'wis', 'cha',
    ]);
  });

  /* Ein Feld nennt eine Zeile **oder** trägt seine Wörter selbst. Beides
     zugleich wären zwei Antworten auf dieselbe Frage. */
  it('no field carries both its own words and a named row', () => {
    const beides = Object.entries(seedRegistry.interfaces).flatMap(([typ, def]) =>
      Object.entries(def.schema?.properties ?? {})
        .filter(([, p]) => p.enumRef && p.enum?.length)
        .map(([key]) => `${typ}.${key}`),
    );
    expect(beides).toEqual([]);
  });

  /* **Ein Feld, sechs Listen.** Worin jemand geübt ist, kommt aus
     Fertigkeiten, Werkzeugen, Sprachen, Waffen, Rüstungen und
     Wissensgebieten. Vorher stand je Sorte ein Feld — dieselbe Frage
     sechsmal, und die siebte Sorte hätte ein siebtes Feld gebraucht. */
  it('proficiencies draw on several lists, saving throws on one', () => {
    const p = seedRegistry.interfaces['Proficiencies']?.schema?.properties ?? {};
    expect(Object.keys(p)).toEqual(['proficient', 'expertise', 'saves']);
    expect(p['proficient']?.type).toBe('array');
    expect(enumGroups(seedRegistry, p['proficient']).map((g) => g.name)).toEqual([
      'Skill', 'Tool', 'Language', 'WeaponTraining', 'ArmorTraining', 'KnowledgeField',
    ]);
    /* Die Vereinigung hat jedes Wort einmal, und woher es kommt, bleibt
       lesbar — daran hängt, dass der Bogen gruppieren kann. */
    const alle = enumOptions(seedRegistry, p['proficient']) ?? [];
    expect(new Set(alle).size).toBe(alle.length);
    expect(enumSource(seedRegistry, p['proficient'], 'stealth')).toBe('Skill');
    expect(enumSource(seedRegistry, p['proficient'], 'Elfisch')).toBe('Language');
    /* Rettungswürfe sind Attribute und sonst nichts. */
    expect(p['saves']?.enumRef).toBe('Ability');
    expect(p['saves']?.type).toBe('array');
  });

  /* Die Fertigkeiten stehen als Liste **und** in der Einstellung, die sagt,
     worauf jede rechnet. Nicht zweimal dasselbe — aber die eine darf der
     anderen nicht widersprechen. */
  it('every skill in the setting is in the list', () => {
    const werte = seedRegistry.enums?.['Skill']?.values ?? [];
    const ausEinstellung = String(seedRegistry.settings?.['skills'] ?? '')
      .split(',').map((x) => x.split(':')[0]?.trim()).filter(Boolean);
    expect(ausEinstellung.filter((k) => !werte.includes(k as string))).toEqual([]);
    expect(werte.filter((k) => !ausEinstellung.includes(k))).toEqual([]);
  });

  /* **Der Sammelname ist weg.** `StatblockInfo` trug dreissig Felder von
     der Rüstungsklasse bis zu den Immunitäten — „alles, was an einem
     Statblock steht" ist keine Auskunft. Die sechs Werte stehen in
     `Abilities`, der Rest gehört dem Statblock selbst. */
  it('the statblock declares its own fields and takes the abilities in', () => {
    expect(seedRegistry.interfaces['StatblockInfo']).toBeUndefined();
    const sb = seedRegistry.interfaces['Statblock'];
    expect(sb?.extends).toContain('Abilities');
    const eigen = Object.keys(sb?.schema?.properties ?? {});
    expect(eigen).toContain('ac');
    expect(eigen).toContain('hp');
    expect(eigen).not.toContain('str');
    /* Und die gerechneten stehen bei ihren Werten: `mod(dex)` löst gegen
       die Nachbarn derselben Karte auf. */
    const ab = seedRegistry.interfaces['Abilities']?.schema?.properties ?? {};
    expect(ab['initiative']?.derived).toBe('mod(dex)');
    expect(Object.keys(ab)).toContain('dex');
  });

  /* Eine Spanne statt zwanzig Wörter: die Schwierigkeit ist eine Stufe. */
  it('difficulty is a range, and only one type declares it', () => {
    const feld = seedRegistry.interfaces['Difficulty']?.schema?.properties?.['difficulty'];
    expect(feld?.min).toBe(1);
    expect(feld?.max).toBe(20);
    const auch = Object.entries(seedRegistry.interfaces)
      .filter(([n, d]) => n !== 'Difficulty' && d.schema?.properties?.['difficulty'])
      .map(([n]) => n);
    expect(auch).toEqual([]);
  });
});

/* ---- Ein Verweis nennt sein Ziel, ein Mass seine Einheit ----
   Beides sagte das Register nicht: vier Verweisfelder ohne Zieltyp und
   drei Masse ohne Ausgangsmass. Ein Feld, das „link" heisst und sonst
   nichts, nimmt alles; ein Feld, das „measure" heisst und sonst nichts,
   rechnet nichts — und das sieht aus wie eine richtige Zahl. */
describe('links name their target, measures name their unit', () => {
  const felder = (): { art: string; feld: string; p: PropertySchema }[] => {
    const out: { art: string; feld: string; p: PropertySchema }[] = [];
    Object.entries(seedRegistry.interfaces).forEach(([art, def]) => {
      Object.entries(def.schema?.properties ?? {}).forEach(([feld, p]) => {
        out.push({ art, feld, p });
      });
    });
    return out;
  };

  it('gives every measure field the unit its numbers are in', () => {
    const ohne = felder()
      .filter(({ p }) => p.format === 'measure' && !p.unit)
      .map(({ art, feld }) => `${art}.${feld}`);
    expect(ohne).toEqual([]);
  });

  /* Eine Einheit, die keine Zeile hat, ist ein Tippfehler mit dem Aussehen
     einer Angabe: `unit: 'feet'` ginge noch (Schreibweise von `ft`),
     `unit: 'fuß'` nicht. */
  it('names only units the registry knows', () => {
    const fremd = felder()
      .filter(({ p }) => p.unit && !unitByCode(seedRegistry, p.unit))
      .map(({ art, feld, p }) => `${art}.${feld}: ${p.unit}`);
    expect(fremd).toEqual([]);
  });

  it('gives every link field a target type that exists', () => {
    const verweise = felder().filter(({ p }) => p.format === 'link');
    expect(verweise.length).toBeGreaterThan(0);
    const ohne = verweise
      .filter(({ p }) => !(p.target?.interfaces ?? []).length)
      .map(({ art, feld }) => `${art}.${feld}`);
    expect(ohne).toEqual([]);
    const fremd: string[] = [];
    verweise.forEach(({ art, feld, p }) => {
      (p.target?.interfaces ?? []).forEach((n) => {
        if (!seedRegistry.interfaces[n]) fremd.push(`${art}.${feld} → ${n}`);
      });
    });
    expect(fremd).toEqual([]);
  });

  /* Der Zieltyp gilt wie bei einer Kante die `extends`-Kette hoch: was die
     Sitzung als Karte zeigt, darf eine Unterart von `Map` sein. */
  it('accepts a subtype of the named type and refuses a stranger', () => {
    const p = seedRegistry.interfaces['Session']?.schema?.properties['activeMap'];
    expect(linkTargets(p)).toEqual(['Map']);
    expect(linkAccepts(seedRegistry, p, 'Map')).toBe(true);
    expect(linkAccepts(seedRegistry, p, 'Armor')).toBe(false);
  });

  /* Die Prüfung am Schema hält die Lücke zu: `measure` ohne `unit` kommt
     nicht durch die Speichergrenze zurück. */
  it('refuses a measure row without a unit at the storage boundary', () => {
    const kaputt = {
      ...seedRegistry,
      interfaces: {
        ...seedRegistry.interfaces,
        Probe: {
          name: 'Probe',
          schema: { type: 'object', properties: { weit: { type: 'string', format: 'measure' } } },
        },
      },
    };
    expect(RegistrySchema.safeParse(kaputt).success).toBe(false);
  });
});

describe('interface inheritance', () => {
  it('gathers the fields of every type up the extends chain', () => {
    const felder = fieldsOf(seedRegistry, 'Creature');
    const wo = (k: string) => felder.find((f) => f.key === k)?.type;
    expect(wo('name')).toBe('Identity'); // von Identity
    expect(wo('species')).toBe('Creature'); // von Creature
    /* **Die Zahlen wohnen am Statblock**, auch die eines
       Spielercharakters. Eine Kreatur trägt sie nicht mehr selbst: das
       waren zwei Formen für dasselbe, und wer eine Kreatur änderte, musste
       wissen, in welcher der beiden ihre Zahlen gerade standen. */
    expect(typeChain(seedRegistry, 'Creature')).not.toContain('Abilities');
    expect(typeChain(seedRegistry, 'PlayerCharacter')).not.toContain('Abilities');
    expect(typeChain(seedRegistry, 'Statblock')).toContain('Abilities');
    /* `Vitals` bleibt bei der Figur: das ist, was sich während der Sitzung
       ändert, und es gehört ihr und nicht ihrem Bogen. */
    expect(typeChain(seedRegistry, 'PlayerCharacter')).toContain('Vitals');
    /* Und die Vereinigung sammelt nicht alles ein: eine fremde Linie hat
       hier nichts verloren. */
    expect(typeChain(seedRegistry, 'Creature')).not.toContain('Map');
    expect(typeChain(seedRegistry, 'Creature')).not.toContain('Quest');
  });

  /* Was einmal `blockTypes: ['+secret']` war, ist jetzt ein Bestandteil:
     `Secrets` bringt das Feld `secret` mit, und wer Geheimnisse trägt,
     nimmt ihn dazu. Die Frage „welche Prosa hat diese Art" beantwortet
     damit dieselbe Vererbung wie jede andere Frage. */
  it('inherits its prose fields like every other field', () => {
    const npc = proseFields(seedRegistry, 'Creature').map((f) => `${f.type}.${f.key}`);
    expect(npc).toContain('Prose.paragraph'); // über Identity
    expect(npc).toContain('Secrets.secret'); // über Creature
    expect(npc).toContain('Creature.personality'); // eigenes Feld von Creature
    /* Eine Regel hat Text und Notizen und sonst nichts — kein Geheimnis,
       keine Taktik. */
    const rule = proseFields(seedRegistry, 'Rule').map((f) => `${f.type}.${f.key}`);
    expect(rule.sort()).toEqual(['Notes.note', 'Prose.paragraph']);
  });

  /* Die sieben Prosanamen sind immer ein Sack mit Einträgen. Einer davon
     als einzelner Absatz wäre ein Feld, an dem keine Freigabe hängen kann —
     und daran hing sie vorher. `Scene.readaloud` war genau das: ein
     einzelner Vorlesetext, der mit `ReadAloud.readaloud` ein zweites Mal
     hereinkam, sobald die Blockarten Felder wurden. */
  it('keeps every prose name a bag with ids', () => {
    const teile = ['Prose', 'Notes', 'Lore', 'Secrets', 'ReadAloud', 'Facts', 'Tactics'];
    const namen = new Set<string>();
    for (const t of teile) {
      const props = Object.entries(seedRegistry.interfaces[t]?.schema?.properties ?? {});
      expect(props.length).toBe(1);
      const [key, prop] = props[0] as [string, { many?: boolean; format?: string }];
      expect([t, prop.many, prop.format]).toEqual([t, true, 'long']);
      namen.add(key);
    }
    /* Und kein anderer Typ nennt denselben Namen als langen Text: das war
       `Scene.readaloud` — ein einzelner Vorlesetext, der neben dem Sack
       stand und gleich hiess. Ein kurzes `note` an einer Zugriffszeile ist
       etwas anderes und darf bleiben. */
    const doppelt: string[] = [];
    for (const [name, def] of Object.entries(seedRegistry.interfaces)) {
      if (teile.includes(name)) continue;
      for (const [key, prop] of Object.entries(def.schema?.properties ?? {})) {
        if (namen.has(key) && prop.format === 'long') doppelt.push(`${name}.${key}`);
      }
    }
    expect(doppelt).toEqual([]);
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

  /* Eine Art ohne eigene Felder ist in Ordnung — `Consumable` erbt alles
     von `Item`. Eine Art mit einem leeren Schema dagegen ist eine Zeile,
     die etwas behauptet und nichts sagt. */
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
  const creature = seedRegistry.interfaces['Creature']?.views?.['full'] ?? [];
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
     in einen Topf wandern: `hp` heisst am Statblock das Maximum und an der
     Figur, was sie gerade noch hat. Beides ohne Umbenennung, weil es zwei
     Karten an zwei Artikeln sind — und seit die Zahlen am Statblock wohnen,
     ist die Namensgleichheit keine Falle mehr, sondern die Wahrheit. */
  it('keeps hp at the creature apart from hp at the statblock', () => {
    expect(fieldsOf(seedRegistry, 'PlayerCharacter').filter((f) => f.key === 'hp')
      .map((f) => f.type)).toEqual(['Vitals']);
    expect(fieldsOf(seedRegistry, 'Statblock').filter((f) => f.key === 'hp')
      .map((f) => f.type)).toEqual(['Statblock']);
  });

  /* **Eine Kante, die sich wie ein Feld liest.** Die Zahlen einer Kreatur
     stehen am Statblock, und der ist ein eigener Artikel — austauschbar,
     wiederverwendbar. Für die Kreatur ist er trotzdem kein Verweis auf
     etwas Fremdes, sondern der Teil von ihr, der woanders wohnt. */
  it('the statblock and the inventory read like fields at the creature', () => {
    const l = linkedTypes(seedRegistry, 'Creature');
    expect(l.map((x) => x.type).sort()).toEqual(['Inventory', 'Statblock']);
    /* Die Richtung sagt, wo die Kante **liegt**: `belongsTo` am Statblock,
       `carries` an der Kreatur. Gespeichert wird nur vorwärts. */
    expect(l.find((x) => x.type === 'Statblock')?.direction).toBe('in');
    expect(l.find((x) => x.type === 'Inventory')?.direction).toBe('out');
    /* Und am anderen Ende ist es keines: die Kreatur ist nicht der Teil
       ihres Statblocks, der woanders wohnt. */
    expect(linkedTypes(seedRegistry, 'Statblock')).toEqual([]);
  });

  /* Ein Verweis auf etwas, das für sich steht, bleibt eine Kante: den
     Gegenstand, den ein Rezept liefert, gäbe es auch ohne das Rezept. */
  it('and a reference to something that stands on its own does not', () => {
    const wie = Object.values(seedRegistry.relations).filter((r) => r.asField);
    expect(wie.map((r) => r.type).sort()).toEqual(['belongsTo', 'carries']);
    /* Jede davon ist eins-zu-eins — „irgendeiner von vielen" wäre eine
       Auswahl und kein Feld. */
    expect(wie.every((r) => r.cardinality === 'one')).toBe(true);
    /* Und das Element, das sie zeichnet, steht in der Grundanordnung von
       `full`: sonst stünden die Felder nirgends. */
    const voll = seedRegistry.views['full']?.layout ?? [];
    expect(voll.some((x) => x.el === 'linked')).toBe(true);
  });

  /* Und die Kante reicht bis zum Spielercharakter. Solange sie nur auf
     den NSC zeigte, konnte er gar keinen Statblock haben. */
  it('lets a statblock belong to any creature', () => {
    expect(seedRegistry.relations['belongsTo']?.to).toEqual(['Creature']);
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
    for (const n of ['Vars', 'Abilities', 'Access', 'Vitals', 'Proficiencies']) {
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
