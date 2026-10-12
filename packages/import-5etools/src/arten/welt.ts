/**
 * **Tabellen, Gottheiten, Kulte, Gefahren** (Abgleich §4.2, Schritt 12 und
 * 13; M7, M8).
 *
 * Eine Nachschlagetabelle trägt ihre Spalten (`Table.columns`) und Zeilen
 * aus Zellen; steht in der ersten Spalte ein Würfel, wird aus den Spannen
 * das Gewicht der Zeile — die Bereiche rechnet die Seite wieder aus
 * (Prototyp, „Gewichte statt Bereiche"). Verweise in einer Zelle bleiben
 * Verweise im Text der Zeile; `entry`-Kanten auf Statblock und Gegenstand
 * legt der Importer nicht an, weil eine Zeile oft drei Dinge nennt.
 */

import type { Entity } from '@nw/model';
import type { Knoten } from '../copy.js';
import { zellText } from '../text.js';
import type { Werkbank } from '../werkbank.js';
import type { Zuordnung } from '../zuordnung.js';
import { gesinnung, liste, titel, zahl } from '../zuordnung.js';

const WUERFEL = /^\s*(\d*d\d+)\s*$/i;

/** Die Spanne „01–02", „3-4", „00" als Anzahl Augen. */
function spanne(s: string): number | undefined {
  const t = s.replace(/\s/g, '');
  const m = /^(\d+)(?:[–—-](\d+))?$/.exec(t);
  if (!m) return undefined;
  const von = Number(m[1]);
  const bis = m[2] !== undefined ? Number(m[2]) : von;
  const b = bis === 0 && von > 0 ? 100 : bis;
  const v = von === 0 ? 100 : von;
  return Math.max(1, b - v + 1);
}

/** Zeilen und Spalten einer 5e.tools-Tabelle in die Karte `Table`. */
export function fuelleTabelle(wb: Werkbank, ent: Entity, t: Knoten, art = 'generic'): void {
  const spalten = liste(t['colLabels']).map((c) => wb.zeile(String(c)).replace(/\*\*/g, ''));
  const zeilen = liste(t['rows']).map((r) => {
    const zellen = Array.isArray(r) ? r : liste((r as Knoten)?.['row']);
    return zellen.map((c) => zellText(c, wb.ctx));
  });
  const T = 'Table';
  wb.feld(ent, T, 'kind', art);
  wb.feld(ent, T, 'columns', spalten);
  const wuerfel = WUERFEL.exec(spalten[0] ?? '');
  if (wuerfel) wb.feld(ent, T, 'die', wuerfel[1]!.startsWith('d') ? `1${wuerfel[1]}` : wuerfel[1]);
  wb.feld(
    ent,
    T,
    'rows',
    zeilen.map((z) => {
      const zeile: Record<string, unknown> = { cells: z, text: (wuerfel ? z.slice(1) : z).join(' · ') };
      if (wuerfel) {
        const w = spanne(z[0] ?? '');
        if (w !== undefined) zeile['weight'] = w;
      }
      return zeile;
    }),
  );
  const fuss = [t['intro'] ? wb.text(t['intro']) : '', t['footnotes'] ? wb.text(t['footnotes']) : '', t['outro'] ? wb.text(t['outro']) : ''].filter(Boolean);
  if (fuss.length) wb.prosa(ent, fuss.join('\n\n'));
}

/** Eine Würfeltabelle aus `{min, max, result|item}`-Zeilen (Begegnungen, Namen, Beute). */
function wurfTabelle(wb: Werkbank, ent: Entity, zeilen: unknown[], wuerfel: string | undefined, art: string, feld = 'result'): void {
  const T = 'Table';
  wb.feld(ent, T, 'kind', art);
  if (wuerfel) wb.feld(ent, T, 'die', /^d/.test(wuerfel) ? `1${wuerfel}` : wuerfel);
  wb.feld(ent, T, 'columns', [wuerfel ?? 'Roll', titel(feld)]);
  wb.feld(
    ent,
    T,
    'rows',
    zeilen.map((z) => {
      const o = z as Knoten;
      const min = zahl(o['min']) ?? 0;
      const max = zahl(o['max']) ?? min;
      const text = typeof o[feld] === 'string' ? wb.zeile(o[feld]) : wb.text(o[feld]).replace(/\n+/g, ' ');
      return { cells: [min === max ? String(min) : `${min}–${max}`, text], text, weight: Math.max(1, max - min + 1) };
    }),
  );
}

const tabelle: Zuordnung = {
  art: 'table',
  tag: 'table',
  typ: () => 'Table',
  name: (e) => String(e['name'] ?? e['caption'] ?? 'Table'),
  genutzt: ['name', 'caption', 'colLabels', 'colStyles', 'rows', 'intro', 'outro', 'footnotes', 'chapter', 'isNameGroup', 'isStriped', 'type', 'parentEntity'],
  fuellen(wb, ent, e) {
    fuelleTabelle(wb, ent, e);
    if (e['caption'] && e['caption'] !== e['name']) wb.feld(ent, 'Description', 'description', wb.zeile(e['caption']));
  },
};

export const WELT: Zuordnung[] = [
  tabelle,
  {
    art: 'tableGroup',
    tag: 'tableGroup',
    typ: () => 'Table',
    name: (e) => String(e['name']),
    genutzt: ['name', 'tables', 'type', 'chapter'],
    fuellen(wb, ent, e) {
      /* Die erste Tabelle trägt die Gruppe, die übrigen werden eigene
         Artikel mit der Gruppe als Marke — eine Tabelle mit zwei
         Spaltensätzen gibt es nicht. */
      const [erste, ...rest] = liste(e['tables']) as Knoten[];
      if (erste) fuelleTabelle(wb, ent, erste);
      rest.forEach((t, i) => {
        const neu = wb.anlegen('Table', `${ent.name}: ${String(t['caption'] ?? i + 2)}`, `tableGroup|${ent.id}|${i}`, e);
        fuelleTabelle(wb, neu, t);
        wb.marke(neu, ent.name);
      });
      wb.marke(ent, ent.name);
    },
  },
  {
    art: 'encounter',
    tag: 'encounter',
    typ: () => 'Table',
    name: (e) => String(e['name']),
    genutzt: ['name', 'tables'],
    fuellen(wb, ent, e) {
      /* Je Stufenband eine Tabelle; die erste trägt den Namen der Gruppe. */
      const tabellen = liste(e['tables']) as Knoten[];
      tabellen.forEach((t, i) => {
        const band = t['minlvl'] !== undefined ? ` (levels ${String(t['minlvl'])}–${String(t['maxlvl'])})` : t['caption'] ? ` (${String(t['caption'])})` : tabellen.length > 1 ? ` (${i + 1})` : '';
        const ziel = i === 0 ? ent : wb.anlegen('Table', `${ent.name}${band}`, `encounter|${ent.id}|${i}`, e);
        if (i === 0 && band) {
          ent.name = `${ent.name}${band}`;
          (ent.components['Identity'] as Record<string, unknown>)['name'] = ent.name;
        }
        wurfTabelle(wb, ziel, liste(t['table']), t['diceExpression'] ? String(t['diceExpression']) : undefined, 'encounter');
        wb.marke(ziel, 'encounter');
      });
    },
  },
  {
    art: 'name',
    tag: 'name',
    typ: () => 'Table',
    name: (e) => `${String(e['name'])} Names`,
    genutzt: ['name', 'tables'],
    fuellen(wb, ent, e) {
      const tabellen = liste(e['tables']) as Knoten[];
      tabellen.forEach((t, i) => {
        const teil = t['option'] ? ` (${String(t['option'])})` : '';
        const ziel = i === 0 ? ent : wb.anlegen('Table', `${String(e['name'])} Names${teil}`, `name|${ent.id}|${i}`, e);
        if (i === 0 && teil) {
          ent.name = `${ent.name}${teil}`;
          (ent.components['Identity'] as Record<string, unknown>)['name'] = ent.name;
        }
        wurfTabelle(wb, ziel, liste(t['table']), t['diceExpression'] ? String(t['diceExpression']) : undefined, 'name');
      });
    },
  },
  {
    art: 'magicItems',
    tag: 'table',
    typ: () => 'Table',
    name: (e) => String(e['name']),
    genutzt: ['name', 'type', 'table'],
    fuellen(wb, ent, e) {
      wurfTabelle(wb, ent, liste(e['table']), 'd100', 'loot', 'item');
    },
  },
  ...(['gems', 'artObjects'] as const).map(
    (art): Zuordnung => ({
      art,
      tag: 'table',
      typ: () => 'Table',
      name: (e) => String(e['name']),
      genutzt: ['name', 'type', 'table'],
      fuellen(wb, ent, e) {
        const zeilen = liste(e['table']).map((x, i) => ({ min: i + 1, max: i + 1, item: x }));
        wurfTabelle(wb, ent, zeilen, `d${zeilen.length}`, 'loot', 'item');
      },
    }),
  ),
  {
    art: 'deity',
    tag: 'deity',
    typ: () => 'Deity',
    name: (e) => String(e['name']),
    schluessel: (e) => [[e['name'], e['pantheon'], e['source']], [e['name'], e['source']]],
    herkunft: (e) => String(e['pantheon'] ?? ''),
    genutzt: [
      'name', 'pantheon', 'title', 'alignment', 'domains', 'symbol', 'province', 'plane', 'altNames',
      'entries', 'category', 'worshipers', 'piety', 'symbolImg', 'customExtensionOf', 'customProperties',
    ],
    fuellen(wb, ent, e) {
      const D = 'Deity';
      wb.feld(ent, D, 'pantheon', e['pantheon']);
      wb.feld(ent, D, 'title', e['title'] ? wb.zeile(e['title']) : undefined);
      wb.feld(ent, D, 'alignment', gesinnung(e['alignment']));
      wb.feld(ent, D, 'domains', liste(e['domains']).map(String).filter((d) => d !== 'None'));
      wb.feld(ent, D, 'symbol', e['symbol'] ? wb.zeile(e['symbol']) : undefined);
      wb.feld(ent, D, 'province', e['province'] ? wb.zeile(e['province']) : undefined);
      wb.feld(ent, D, 'plane', e['plane'] ? wb.zeile(e['plane']) : undefined);
      wb.feld(ent, 'Identity', 'aliases', liste(e['altNames']).map(String));
      if (e['category']) wb.marke(ent, String(e['category']));
      const teile = [wb.text(e['entries'])];
      if (e['worshipers']) teile.push(`**Worshipers:** ${wb.zeile(e['worshipers'])}`);
      wb.prosa(ent, teile.filter(Boolean).join('\n\n'));
    },
  },
  {
    art: 'cult',
    tag: 'cult',
    typ: () => 'Faction',
    name: (e) => String(e['name']),
    genutzt: ['name', 'type', 'entries', 'goal', 'cultists', 'signaturespells'],
    fuellen(wb, ent, e) {
      wb.feld(ent, 'Faction', 'kind', 'cult');
      if (e['type']) wb.marke(ent, String(e['type']));
      const g = e['goal'] as Knoten | undefined;
      if (g) wb.feld(ent, 'Faction', 'goal', wb.text(g['entries']));
      const teile = [wb.text(e['entries'])];
      const c = e['cultists'] as Knoten | undefined;
      if (c) teile.push(`## Typical Cultists\n\n${wb.text(c['entries'])}`);
      const s = e['signaturespells'] as Knoten | undefined;
      if (s) teile.push(`## Signature Spells\n\n${wb.text(s['entries'])}`);
      wb.prosa(ent, teile.filter(Boolean).join('\n\n'));
    },
  },
  ...(['trap', 'hazard'] as const).map(
    (art): Zuordnung => ({
      art,
      tag: art,
      typ: () => 'Hazard',
      name: (e) => String(e['name']),
      genutzt: ['name', 'entries', 'trapHazType', 'rating', 'trigger', 'effect', 'countermeasures', 'initiative', 'initiativeNote', 'eActive', 'eDynamic', 'eConstant', 'threat', 'duration'],
      fuellen(wb, ent, e) {
        const H = 'Hazard';
        wb.feld(ent, H, 'kind', art);
        const kat = String(e['trapHazType'] ?? '');
        if (['MECH', 'MAG', 'WTH', 'ENV', 'WLD'].includes(kat)) wb.feld(ent, H, 'category', kat);
        else if (kat) {
          const wort: Record<string, string> = { SMPL: 'simple', CMPX: 'complex', HAUNT: 'haunt', TRP: 'trap', EST: 'eldritch storm', GEN: 'generic' };
          wb.marke(ent, wort[kat] ?? kat.toLowerCase());
        }
        const r = (liste(e['rating'])[0] as Knoten | undefined) ?? {};
        if (['setback', 'dangerous', 'deadly'].includes(String(r['threat']))) wb.feld(ent, H, 'threat', r['threat']);
        else if (r['threat']) wb.notiz(`Gefahrgrad ${String(r['threat'])}`);
        if (r['tier']) wb.marke(ent, `tier ${String(r['tier'])}`);
        wb.feld(ent, H, 'trigger', wb.text(e['trigger']));
        const wirkung = [wb.text(e['effect']), e['eActive'] ? `**Active Elements.** ${wb.text(e['eActive'])}` : '', e['eDynamic'] ? `**Dynamic Elements.** ${wb.text(e['eDynamic'])}` : '', e['eConstant'] ? `**Constant Elements.** ${wb.text(e['eConstant'])}` : ''].filter(Boolean).join('\n\n');
        wb.feld(ent, H, 'effect', wirkung);
        wb.feld(ent, H, 'countermeasures', wb.text(e['countermeasures']));
        wb.feld(ent, H, 'initiative', zahl(e['initiative']));
        wb.prosa(ent, wb.text(e['entries']));
      },
    }),
  ),
];
