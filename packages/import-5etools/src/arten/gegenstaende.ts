/**
 * **Gegenstände** (Abgleich §4.2, Schritt 8; M4): Grundgegenstände, dann
 * magische, dann magische Varianten und Gruppen. `hasProperty` zeigt auf die
 * Eigenschaften aus Schritt 5, `casts` auf die Zauber aus Schritt 7,
 * `variantOf` auf den Grundgegenstand.
 *
 * Eine magische Variante („+1 Weapon") ist **ein** Artikel mit `appliesTo`;
 * das „+1 Longsword" entsteht am Tisch als Instanz des Grundgegenstands
 * (D82) und nicht hier — 5e.tools rechnet es beim Lesen aus, und wir
 * würden sonst zweitausend Schwerter speichern.
 */

import type { Entity } from '@nw/model';
import type { Knoten } from '../copy.js';
import type { Werkbank } from '../werkbank.js';
import type { Zuordnung } from '../zuordnung.js';
import { liste, SCHADEN, zahl } from '../zuordnung.js';

const ITEM_TYPE: Record<string, string> = {
  M: 'melee weapon', R: 'ranged weapon', A: 'ammunition', AF: 'ammunition', LA: 'light armor',
  MA: 'medium armor', HA: 'heavy armor', S: 'shield', G: 'adventuring gear', AT: 'artisan tools',
  T: 'tool', GS: 'gaming set', INS: 'instrument', MNT: 'mount', TAH: 'tack and harness',
  VEH: 'vehicle', SHP: 'vehicle', AIR: 'vehicle', SPC: 'vehicle', FD: 'food and drink',
  TG: 'trade good', $: 'treasure', $C: 'coinage', $A: 'art object', $G: 'gemstone', P: 'potion',
  SC: 'scroll', RG: 'ring', RD: 'rod', WD: 'wand', ST: 'staff', SCF: 'spellcasting focus',
  EXP: 'explosive', OTH: 'other', TB: 'trade good',
};

const RUESTUNG: Record<string, string> = { LA: 'light', MA: 'medium', HA: 'heavy', S: 'shield' };

const SELTENHEIT = new Set(['none', 'common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact', 'varies', 'unknown']);

const AUFLADUNG: Record<string, string> = {
  dawn: 'dawn', dusk: 'dusk', midnight: 'midnight', restShort: 'shortRest', restLong: 'longRest', special: 'special',
};

/* Flaggen, die eine Sorte sagen, und als Marke bleiben. */
const SORTEN = [
  'sword', 'axe', 'bow', 'crossbow', 'spear', 'hammer', 'mace', 'net', 'club', 'dagger', 'polearm',
  'lance', 'firearm', 'staff', 'wondrous', 'tattoo', 'curse', 'sentient', 'poison', 'focus',
];

const kurz = (s: unknown) => String(s ?? '').split('|')[0] ?? '';

export function typVon(e: Knoten): string {
  const t = kurz(e['type']);
  if (e['weapon'] || e['weaponCategory'] || t === 'M' || t === 'R') return 'Weapon';
  if (e['armor'] || RUESTUNG[t]) return 'Armor';
  return 'Item';
}

const GENUTZT_ITEM = [
  'name', 'entries', 'additionalEntries', 'type', 'rarity', 'tier', 'reqAttune', 'reqAttuneTags',
  'reqAttuneAlt', 'reqAttuneAltTags', 'charges', 'recharge', 'rechargeAmount', 'bonusWeapon',
  'bonusAc', 'bonusSpellAttack', 'bonusSavingThrow', 'value', 'weight', 'weaponCategory', 'dmg1',
  'dmg2', 'dmgType', 'range', 'ammoType', 'ac', 'strength', 'stealth', 'property', 'attachedSpells',
  'baseItem', 'weapon', 'armor', 'packContents', 'lootTables', 'valueMult', 'weightMult', 'ammo',
  'age', 'focus', 'scfType', 'grantsProficiency', 'grantsLanguage', 'light', ...SORTEN,
];

/** Die Felder eines Gegenstands, aus einem Eintrag oder dem `inherits` einer Variante. */
function felder(wb: Werkbank, ent: Entity, e: Knoten): void {
  const typ = ent.interfaces[0]!;
  const I = 'Item';
  const t = kurz(e['type']);
  const itemType = ITEM_TYPE[t] ?? (e['wondrous'] ? 'wondrous item' : undefined);
  /* `GV` ist die magische Variante selbst — keine Gegenstandsart. */
  if (t && t !== 'GV' && !ITEM_TYPE[t]) wb.notiz(`Gegenstandsart ${t}`);
  wb.feld(ent, I, 'itemType', itemType);
  const r = String(e['rarity'] ?? '').replace(/^unknown \(magic\)$/, 'unknown');
  if (r && SELTENHEIT.has(r)) wb.feld(ent, I, 'rarity', r);
  else if (r) wb.notiz(`Seltenheit ${r}`);
  if (e['tier'] === 'minor' || e['tier'] === 'major') wb.feld(ent, I, 'tier', e['tier']);
  if (e['reqAttune']) {
    wb.feld(ent, I, 'attunement', true);
    if (typeof e['reqAttune'] === 'string') wb.feld(ent, I, 'attunementNote', wb.zeile(e['reqAttune']));
  }
  wb.feld(ent, I, 'charges', zahl(e['charges']));
  if (e['recharge'] !== undefined) {
    const a = AUFLADUNG[String(e['recharge'])];
    if (a) wb.feld(ent, I, 'recharge', a);
    else wb.notiz(`Aufladung ${String(e['recharge'])}`);
  }
  if (e['rechargeAmount'] !== undefined) wb.feld(ent, I, 'rechargeAmount', typeof e['rechargeAmount'] === 'string' ? wb.zeile(e['rechargeAmount']) : String(e['rechargeAmount']));
  wb.feld(ent, I, 'bonusWeapon', zahl(e['bonusWeapon']));
  wb.feld(ent, I, 'bonusAc', zahl(e['bonusAc']));
  wb.feld(ent, I, 'bonusSpellAttack', zahl(e['bonusSpellAttack']));
  wb.feld(ent, I, 'bonusSave', zahl(e['bonusSavingThrow']));
  wb.feld(ent, I, 'copperPrice', zahl(e['value']));
  wb.feld(ent, I, 'weight', zahl(e['weight']));
  wb.marke(ent, ...SORTEN.filter((s) => e[s] === true));

  if (typ === 'Weapon') {
    const W = 'Weapon';
    if (e['weaponCategory'] === 'simple' || e['weaponCategory'] === 'martial') wb.feld(ent, W, 'category', e['weaponCategory']);
    wb.feld(ent, W, 'damage', e['dmg1']);
    wb.feld(ent, W, 'damage2', e['dmg2']);
    wb.feld(ent, W, 'damageType', SCHADEN[String(e['dmgType'] ?? '')]);
    wb.feld(ent, W, 'range', e['range'] !== undefined ? String(e['range']) : undefined);
    if (e['ammoType']) wb.feld(ent, W, 'ammoType', kurz(e['ammoType']));
  }
  if (typ === 'Armor') {
    const A = 'Armor';
    wb.feld(ent, A, 'ac', zahl(e['ac']));
    wb.feld(ent, A, 'strength', zahl(e['strength']));
    if (e['stealth']) wb.feld(ent, A, 'stealthDisadvantage', true);
    wb.feld(ent, A, 'armorType', RUESTUNG[t]);
  }

  for (const p of liste(e['property'])) {
    const roh = typeof p === 'string' ? p : String((p as Knoten)['uid'] ?? '');
    const [abk = '', quelle = ''] = roh.split('|');
    const ziel = wb.hole('itemProperty', abk, quelle || 'PHB') ?? wb.finde('itemProperty', [abk]);
    if (ziel) wb.kante(ent, 'hasProperty', ziel.id);
    else wb.ctx.insLeere('itemProperty', roh);
  }
  zauberAmGegenstand(wb, ent, e['attachedSpells']);
}

/** `attachedSpells` als `casts` mit `mode: item`. */
function zauberAmGegenstand(wb: Werkbank, ent: Entity, roh: unknown): void {
  if (!roh) return;
  const kante = (name: unknown, props: Record<string, unknown>) => {
    const [n = '', q = ''] = String(name).split('|');
    const ziel = wb.finde('spell', [n, q]);
    if (ziel) wb.kante(ent, 'casts', ziel.id, { mode: 'item', ...props });
    else wb.ctx.insLeere('spell', String(name));
  };
  if (Array.isArray(roh)) {
    for (const s of roh) kante(s, {});
    return;
  }
  const o = roh as Knoten;
  for (const s of liste(o['will'])) kante(s, { uses: 'at will' });
  for (const [k, v] of Object.entries((o['daily'] as Knoten | undefined) ?? {})) for (const s of liste(v)) kante(s, { uses: `${k.replace(/e$/, '')}/day` });
  for (const [k, v] of Object.entries((o['charges'] as Knoten | undefined) ?? {})) for (const s of liste(v)) kante(s, { charges: Number(k) });
  for (const [k, v] of Object.entries((o['rest'] as Knoten | undefined) ?? {})) for (const s of liste(v)) kante(s, { uses: `${k.replace(/e$/, '')}/rest` });
  for (const [k, v] of Object.entries((o['limited'] as Knoten | undefined) ?? {})) for (const s of liste(v)) kante(s, { uses: `${k.replace(/e$/, '')}/limited` });
  for (const s of liste(o['other'])) kante(s, {});
  for (const s of liste(o['ritual'])) kante(s, { uses: 'ritual' });
}

function text(wb: Werkbank, ent: Entity, e: Knoten, ersetze?: (s: string) => string): void {
  let roh = [...liste(e['entries']), ...liste(e['additionalEntries'])];
  if (ersetze) roh = JSON.parse(ersetze(JSON.stringify(roh))) as unknown[];
  const teile = [wb.text(roh)];
  const inhalt = liste(e['packContents']).map((p) => {
    if (typeof p === 'string') return `- ${wb.zeile(`{@item ${p}}`)}`;
    const o = p as Knoten;
    if (o['item']) return `- ${wb.zeile(`{@item ${String(o['item'])}}`)}${o['quantity'] ? ` (${String(o['quantity'])})` : ''}`;
    return `- ${wb.zeile(String(o['special'] ?? ''))}${o['quantity'] ? ` (${String(o['quantity'])})` : ''}`;
  });
  if (inhalt.length) teile.push(`**Contents**\n\n${inhalt.join('\n')}`);
  wb.prosa(ent, teile.filter(Boolean).join('\n\n'));
}

const gegenstand = (art: string): Zuordnung => ({
  art,
  tag: 'item',
  typ: (e) => typVon(e),
  name: (e) => String(e['name']),
  genutzt: GENUTZT_ITEM,
  fuellen(wb, ent, e) {
    felder(wb, ent, e);
    if (e['baseItem']) {
      const [n = '', q = ''] = String(e['baseItem']).split('|');
      const basis = wb.finde('item', [n, q || 'PHB']);
      if (basis && basis.id !== ent.id) wb.kante(ent, 'variantOf', basis.id);
      else wb.ctx.insLeere('item', String(e['baseItem']));
    }
    text(wb, ent, e);
  },
});

export const GEGENSTAENDE: Zuordnung[] = [
  gegenstand('baseitem'),
  gegenstand('item'),
  {
    art: 'magicvariant',
    tag: 'item',
    /* Eine Beschreibung, die auf Waffen passt, ist keine Waffe. */
    typ: () => 'Item',
    name: (e) => String(e['name']),
    genutzt: ['name', 'type', 'requires', 'excludes', 'inherits', 'entries', 'ammo'],
    fuellen(wb, ent, e) {
      const i = (e['inherits'] as Knoten | undefined) ?? {};
      felder(wb, ent, { ...i, type: e['type'] });
      const gilt: string[] = [];
      for (const r of liste(e['requires'])) {
        for (const [k, v] of Object.entries(r as Knoten)) {
          if (v === true) gilt.push(k);
          else if (k === 'type') gilt.push(ITEM_TYPE[kurz(v)] ?? kurz(v));
          else gilt.push(`${k}:${String(v)}`);
        }
      }
      wb.feld(ent, 'Item', 'appliesTo', [...new Set(gilt)]);
      /* `{=bonusWeapon}` ist ein Platzhalter, den 5e.tools beim Lesen füllt;
         die Werte stehen am selben Eintrag. */
      /* `{=baseName}` ist der Grundgegenstand, den es hier nicht gibt — die
         Variante gilt für jeden; dann steht da die Sorte. */
      const ersatz: Record<string, string> = { baseName: gilt[0] ?? 'item', dmgType: 'its' };
      const ersetze = (s: string) =>
        s.replace(/\{=(\w+)(?:\/[^}]*)?\}/g, (m, k: string) => (i[k] !== undefined ? String(i[k]) : ersatz[k] ?? m));
      text(wb, ent, { entries: i['entries'] }, ersetze);
      for (const k of Object.keys(i)) {
        if (!GENUTZT_ITEM.includes(k) && !['namePrefix', 'nameSuffix', 'source', 'page', 'srd', 'basicRules', 'reprintedAs', 'srd52', 'basicRules2024', 'lootTables', 'nameRemove'].includes(k)) {
          wb.notiz(`inherits.${k} nicht übernommen`);
        }
      }
    },
  },
  {
    art: 'itemGroup',
    tag: 'item',
    typ: (e) => typVon(e),
    name: (e) => String(e['name']),
    genutzt: [...GENUTZT_ITEM, 'items'],
    fuellen(wb, ent, e) {
      felder(wb, ent, e);
      text(wb, ent, e);
      /* Die Mitglieder zeigen auf die Gruppe — es sei denn, sie zeigen
         schon auf ihren Grundgegenstand (`variantOf` ist eine Kante). */
      for (const m of liste(e['items'])) {
        const [n = '', q = ''] = String(m).split('|');
        const mitglied = wb.finde('item', [n, q]);
        if (!mitglied) {
          wb.ctx.insLeere('item', String(m));
          continue;
        }
        if ((mitglied.relations ?? []).some((r) => r.type === 'variantOf')) wb.notiz('Mitglied hat schon einen Grundgegenstand');
        else wb.kante(mitglied, 'variantOf', ent.id);
      }
    },
  },
];
