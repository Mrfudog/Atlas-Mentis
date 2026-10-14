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

import type { Effect, Entity } from '@nw/model';
import { effectId } from '@nw/model';
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

/* Was 5e.tools strukturiert über die Wirkung eines Gegenstands sagt (E-025 a). */
const WIRKUNGEN = [
  'ability', 'resist', 'immune', 'vulnerable', 'conditionImmune', 'modifySpeed', 'bonusSpellSaveDc',
  'critThreshold', 'containerCapacity', 'carryingCapacity', 'bonusWeaponAttack', 'bonusWeaponDamage', 'bonusSpellDamage',
  'bonusAbilityCheck', 'bonusProficiencyBonus', 'bonusSavingThrowConcentration',
];

const GENUTZT_ITEM = [
  'name', 'entries', 'additionalEntries', 'type', 'rarity', 'tier', 'reqAttune', 'reqAttuneTags',
  'reqAttuneAlt', 'reqAttuneAltTags', 'charges', 'recharge', 'rechargeAmount', 'bonusWeapon',
  'bonusAc', 'bonusSpellAttack', 'bonusSavingThrow', 'value', 'weight', 'weaponCategory', 'dmg1',
  'dmg2', 'dmgType', 'range', 'ammoType', 'ac', 'strength', 'stealth', 'property', 'mastery', 'attachedSpells',
  'baseItem', 'weapon', 'armor', 'packContents', 'hasRefs', 'lootTables', 'valueMult', 'weightMult', 'ammo',
  'age', 'focus', 'scfType', 'grantsProficiency', 'grantsLanguage', 'light', ...WIRKUNGEN, ...SORTEN,
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
  wirkungen(wb, ent, e);

  if (typ === 'Weapon') {
    const W = 'Weapon';
    if (e['weaponCategory'] === 'simple' || e['weaponCategory'] === 'martial') wb.feld(ent, W, 'category', e['weaponCategory']);
    wb.feld(ent, W, 'damage', e['dmg1']);
    wb.feld(ent, W, 'damage2', e['dmg2']);
    wb.feld(ent, W, 'damageType', SCHADEN[String(e['dmgType'] ?? '')]);
    wb.feld(ent, W, 'range', e['range'] !== undefined ? String(e['range']) : undefined);
    /* Die Munition ist ein Verweis auf ihren Gegenstand (T-078); findet
       sie keinen, steht das Wort als Notiz. */
    if (e['ammoType']) {
      const [n = '', q = ''] = String(e['ammoType']).split('|');
      const munition = wb.finde('item', [n, q]);
      if (munition) wb.feld(ent, W, 'ammoType', munition.id);
      else {
        wb.anmerkung(ent, 'ammunition', `Ammunition: ${n}`);
        wb.ctx.insLeere('item', String(e['ammoType']));
      }
    }
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
  /* Die Waffenmeisterschaft (2024, T-087) ist eine Eigenschaft mit der
     Marke `mastery`. Nicht im Grundstand: dort gibt es sie nicht. */
  if (!wb.grund) {
    for (const m of liste(e['mastery'])) {
      const roh = typeof m === 'string' ? m : String((m as Knoten)['uid'] ?? '');
      const [name = '', quelle = ''] = roh.split('|');
      const ziel = wb.hole('itemMastery', name, quelle || 'XPHB');
      if (ziel) wb.kante(ent, 'hasProperty', ziel.id);
      else wb.ctx.insLeere('itemMastery', roh);
    }
  }
  zauberAmGegenstand(wb, ent, e['attachedSpells']);
}

/**
 * **Die Wirkungen eines Gegenstands** (REQ-238, REQ-063, E-025 a): was
 * 5e.tools strukturiert sagt, wird ein Eintrag in `Effects.effects`. Die
 * Bedingung bleibt meist leer — dann gilt „eingestimmt, wenn verlangt,
 * sonst getragen" beim Lesen. Was sich nicht als Wirkung schreiben lässt
 * (Geschwindigkeit verdoppeln, ein Attribut nach Wahl), steht als Notiz
 * und im Bericht.
 */
export function wirkungen(wb: Werkbank, ent: Entity, e: Knoten): void {
  const neu: Omit<Effect, 'id'>[] = [];
  const ab = e['ability'];
  if (ab && typeof ab === 'object') {
    for (const [k, v] of Object.entries(ab as Knoten)) {
      if (k === 'static' && v && typeof v === 'object') {
        for (const [a, n] of Object.entries(v as Knoten)) if (zahl(n) !== undefined) neu.push({ target: `ability.${a}`, op: 'set', value: zahl(n)! });
      } else if (/^(str|dex|con|int|wis|cha)$/.test(k) && zahl(v) !== undefined) neu.push({ target: `ability.${k}`, op: 'add', value: zahl(v)! });
      else wb.notiz(`Wirkung ability.${k} nicht übernommen`);
    }
  }
  for (const ziel of ['resist', 'immune', 'vulnerable', 'conditionImmune'] as const) {
    for (const w of liste(e[ziel])) {
      if (typeof w === 'string') neu.push({ target: ziel, op: 'grant', value: w });
      else wb.notiz(`Wirkung ${ziel} mit Form nicht übernommen`);
    }
  }
  const tempo = e['modifySpeed'];
  if (tempo && typeof tempo === 'object') {
    for (const [art, werte] of Object.entries(tempo as Knoten)) {
      for (const [modus, w] of Object.entries((werte as Knoten | undefined) ?? {})) {
        const ziel = `speed.${modus}`;
        if (art === 'bonus' && zahl(w) !== undefined) neu.push({ target: ziel, op: 'add', value: zahl(w)! });
        else if (art === 'static' && zahl(w) !== undefined) neu.push({ target: ziel, op: 'set', value: zahl(w)! });
        else if (art === 'equal' && typeof w === 'string') neu.push({ target: ziel, op: 'set', value: w });
        else {
          wb.notiz(`Wirkung modifySpeed.${art} nicht übernommen`);
          wb.anmerkung(ent, `speed-${art}-${modus}`, `Speed: ${art} ${modus} ${String(w)}`);
        }
      }
    }
  }
  /* Boni, für die der Gegenstand kein Feld hat (T-089): nur der Angriff
     oder nur der Schaden der Waffe, der Schaden der Zauber, Attributsproben,
     der Übungsbonus, Rettungswürfe für die Konzentration. An einer Waffe
     (oder einer Variante, die auf eine gelegt wird) gehört der Waffenbonus
     ihr selbst; an Armschienen gilt er der Figur, die sie trägt. */
  const selbst = ent.interfaces[0] === 'Weapon' || kurz(e['type']) === 'GV' ? { when: 'self' as const } : {};
  if (zahl(e['bonusWeaponAttack']) !== undefined) neu.push({ target: 'weapon.attack', op: 'add', value: zahl(e['bonusWeaponAttack'])!, ...selbst });
  if (zahl(e['bonusWeaponDamage']) !== undefined) neu.push({ target: 'weapon.damage', op: 'add', value: zahl(e['bonusWeaponDamage'])!, ...selbst });
  if (zahl(e['bonusSpellDamage']) !== undefined) neu.push({ target: 'spellDamage', op: 'add', value: zahl(e['bonusSpellDamage'])! });
  if (zahl(e['bonusAbilityCheck']) !== undefined) neu.push({ target: 'check', op: 'add', value: zahl(e['bonusAbilityCheck'])! });
  if (zahl(e['bonusProficiencyBonus']) !== undefined) neu.push({ target: 'prof', op: 'add', value: zahl(e['bonusProficiencyBonus'])! });
  if (zahl(e['bonusSavingThrowConcentration']) !== undefined) neu.push({ target: 'save.concentration', op: 'add', value: zahl(e['bonusSavingThrowConcentration'])! });
  if (zahl(e['bonusSpellSaveDc']) !== undefined) neu.push({ target: 'spellSaveDc', op: 'add', value: zahl(e['bonusSpellSaveDc'])! });
  if (zahl(e['critThreshold']) !== undefined) neu.push({ target: 'critThreshold', op: 'set', value: zahl(e['critThreshold'])! });
  /* Fassungsvermögen und Tragkraft gehören dem Gegenstand selbst (dem
     Beutel, dem Wagen) und keiner Figur, die ihn trägt: `self`. */
  const fass = e['containerCapacity'] as Knoten | undefined;
  if (fass && typeof fass === 'object') {
    const lb = liste(fass['weight']).map(zahl).filter((n): n is number => n !== undefined);
    if (lb.length) {
      neu.push({ target: 'capacity', op: 'set', value: lb.reduce((a, b) => a + b, 0), when: 'self', ...(fass['weightless'] ? { note: 'contents weigh nothing' } : {}) });
    }
  }
  if (zahl(e['carryingCapacity']) !== undefined) neu.push({ target: 'carry', op: 'set', value: zahl(e['carryingCapacity'])!, when: 'self' });
  if (!neu.length) return;
  const karte = wb.karte(ent, 'Effects');
  const alle = (karte['effects'] as Effect[] | undefined) ?? [];
  for (const w of neu) alle.push({ id: effectId(w.target, w.value, alle.map((x) => x.id)), ...w });
  karte['effects'] = alle;
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

/** Eine Liste als Satzteil: „acid", „acid and fire", „acid, cold, and fire". */
function aufzaehlung(v: unknown): string {
  const w = liste(v).map((x) => (typeof x === 'string' ? x : '')).filter(Boolean);
  if (w.length < 3) return w.join(' and ');
  return `${w.slice(0, -1).join(', ')}, and ${w[w.length - 1]}`;
}

/**
 * **Die Textschablone einsetzen** (T-089): `{#itemEntry Name|Quelle}` steht
 * als ganzer Eintrag im Text und meint den Text der Schablone, mit den
 * Werten des Gegenstands darin (`{{item.resist}}`, `{{item.detail1}}`,
 * `{{getFullImmRes item.resist}}`). Ohne Quelle ist es die des
 * Gegenstands, sonst die des DMG — so liest 5e.tools es auch. Eine
 * Schablone, die es nicht gibt, bleibt als Marke stehen und steht im
 * Bericht.
 */
export function setzeSchablonen(wb: Werkbank, roh: unknown[], e: Knoten): unknown[] {
  const werte = (s: string) =>
    s.replace(/\{\{(?:getFullImmRes\s+)?item\.(\w+)\}\}/g, (m, k: string) => (e[k] === undefined ? m : aufzaehlung(e[k]) || String(e[k])));
  const ein = (x: unknown): unknown[] => {
    if (typeof x === 'string') {
      const m = /^\{#itemEntry ([^|}]+)(?:\|([^}]*))?\}$/.exec(x.trim());
      if (!m) return [x];
      const name = m[1]!.trim().toLowerCase();
      const q = [m[2], e['source'], 'DMG'].map((v) => String(v ?? '').trim().toLowerCase()).filter(Boolean);
      const t = q.map((v) => wb.schablonen.get(`${name}|${v}`)).find(Boolean);
      if (!t) {
        wb.notiz('Textschablone nicht gefunden');
        return [x];
      }
      return liste(t['entriesTemplate']).flatMap(ein).map((y) => (typeof y === 'string' ? werte(y) : JSON.parse(werte(JSON.stringify(y)))));
    }
    if (x && typeof x === 'object' && Array.isArray((x as Knoten)['entries'])) {
      return [{ ...(x as Knoten), entries: ((x as Knoten)['entries'] as unknown[]).flatMap(ein) }];
    }
    return [x];
  };
  return roh.flatMap(ein);
}

function text(wb: Werkbank, ent: Entity, e: Knoten, ersetze?: (s: string) => string): void {
  let roh = setzeSchablonen(wb, [...liste(e['entries']), ...liste(e['additionalEntries'])], e);
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
      text(wb, ent, { ...i, entries: i['entries'], additionalEntries: undefined }, ersetze);
      for (const k of Object.keys(i)) {
        if (!GENUTZT_ITEM.includes(k) && !['namePrefix', 'nameSuffix', 'source', 'page', 'srd', 'basicRules', 'reprintedAs', 'srd52', 'basicRules2024', 'lootTables', 'nameRemove', 'hasRefs'].includes(k)) {
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
      /* Eine Gruppe ohne eigenen Text (Dragon Scale Mail, Belt of Giant
         Strength: der Text steht an jeder Sorte, T-124) nennt ihre Sorten —
         sonst stünde sie leer da, und wer sie öffnet, fände den Weg zur
         Sorte nicht. */
      const sorten = liste(e['items']).map((m) => `{@item ${String(m)}}`);
      if (!liste(e['entries']).length && sorten.length) {
        text(wb, ent, { ...e, entries: ['This item comes in the following kinds:', { type: 'list', items: sorten }] });
      } else text(wb, ent, e);
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
