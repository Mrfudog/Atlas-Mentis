/**
 * **`_copy` auflösen** (Abgleich §4.2, Schritt 3).
 *
 * Ein Viertel der Monster steht in 5e.tools nicht ausgeschrieben, sondern
 * sagt „wie X, mit diesen Änderungen" — und die Änderungen (`_mod`) sind
 * Bearbeitungsschritte am Baum (`appendArr`, `replaceTxt`, `removeArr`),
 * keine Feldwerte. Bei uns gibt es diese zweite Vererbung nicht: eine
 * Instanz speichert *Feldwerte*, die abweichen (D82), und zwei Arten zu
 * erben wären zwei Wahrheiten. Also schreibt der Importer jeden Eintrag
 * **flach** und hält die Herkunft in `variantOf` fest.
 *
 * Nachgebaut nach dem Verhalten von 5e.tools (`DataUtil.generic`): erst
 * alles von der Vorlage übernehmen, was die Kopie nicht selbst setzt —
 * ausser den Angaben, die zur Vorlage als *Buchseite* gehören (Seite,
 * SRD-Flagge, Nachdrucke), die nur mit `_preserve` mitkommen —, dann die
 * Bearbeitungsschritte.
 */

export type Knoten = Record<string, unknown>;

/** Die Herkunft einer aufgelösten Kopie. Steht nur im Importer, nie im Artikel. */
export const KOPIE_VON = '__kopieVon';

/* Was ohne `_preserve` nicht von der Vorlage herüberkommt: die Angaben über
   die Fundstelle, nicht über die Sache. */
const NUR_MIT_PRESERVE = new Set([
  'page', 'otherSources', 'additionalSources', 'srd', 'srd52', 'basicRules', 'basicRules2024',
  'reprintedAs', 'hasFluff', 'hasFluffImages', 'hasToken', '_versions', 'referenceSources',
  // Monster
  'legendaryGroup', 'environment', 'soundClip', 'altArt', 'variant', 'dragonCastingColor',
  'familiar', 'isNpc', 'isNamedCreature', 'tokenCredit', 'tokenCustom',
  // Gegenstände
  'lootTables',
]);

/* Die Eigenschaften eines Monsters, die `*` meint. */
const STERN = [
  'action', 'bonus', 'reaction', 'trait', 'legendary', 'mythic', 'variant', 'spellcasting',
  'actionHeader', 'bonusHeader', 'reactionHeader', 'legendaryHeader', 'mythicHeader', 'entries',
];

const GROESSEN = ['F', 'D', 'T', 'S', 'M', 'L', 'H', 'G', 'C', 'V'];

const ATTR_VON_SKILL: Record<string, string> = {
  acrobatics: 'dex', 'animal handling': 'wis', arcana: 'int', athletics: 'str', deception: 'cha',
  history: 'int', insight: 'wis', intimidation: 'cha', investigation: 'int', medicine: 'wis',
  nature: 'int', perception: 'wis', performance: 'cha', persuasion: 'cha', religion: 'int',
  'sleight of hand': 'dex', stealth: 'dex', survival: 'wis',
};

/** Übungsbonus aus dem Herausforderungsgrad. */
export function profAusCr(cr: unknown): number {
  const roh = typeof cr === 'object' && cr !== null ? (cr as Knoten)['cr'] : cr;
  const s = String(roh ?? '0');
  const n = s.includes('/') ? 0 : Number(s);
  if (!Number.isFinite(n) || n < 5) return 2;
  return Math.min(9, 2 + Math.ceil((n - 4) / 4));
}

/** Was eine Bearbeitung nicht verstand. Wird im Bericht gezählt. */
export interface KopieMelder {
  (was: string): void;
}

function tiefKopie<T>(x: T): T {
  return x === undefined ? x : (JSON.parse(JSON.stringify(x)) as T);
}

function alsListe(x: unknown): unknown[] {
  return Array.isArray(x) ? x : x === undefined || x === null ? [] : [x];
}

function nameVon(x: unknown): string | undefined {
  if (typeof x === 'string') return x;
  if (x && typeof x === 'object' && typeof (x as Knoten)['name'] === 'string') return (x as Knoten)['name'] as string;
  return undefined;
}

/** Ersetzt in allen Texten eines Teilbaums, Namen ausgenommen. */
function ersetzeText(wert: unknown, re: RegExp, mit: string, auchNamen: boolean): unknown {
  if (typeof wert === 'string') {
    /* „The ogre" bleibt am Satzanfang gross, auch wenn die Ersetzung klein
       geschrieben ist; mit `$1` darin gilt die Ersetzung, wie sie steht. */
    if (mit.includes('$')) return wert.replace(re, mit);
    return wert.replace(re, (m: string) => (/^[A-Z]/.test(m) && /^[a-z]/.test(mit) ? mit[0]!.toUpperCase() + mit.slice(1) : mit));
  }
  if (Array.isArray(wert)) return wert.map((w) => ersetzeText(w, re, mit, auchNamen));
  if (wert && typeof wert === 'object') {
    const o = wert as Knoten;
    for (const [k, v] of Object.entries(o)) {
      if (k === 'type' || k === 'source') continue;
      if (k === 'name' && !auchNamen) continue;
      o[k] = ersetzeText(v, re, mit, auchNamen);
    }
    return o;
  }
  return wert;
}

function setzePfad(o: Knoten, pfad: string, wert: unknown): void {
  const teile = pfad.split('.');
  let cur: Knoten = o;
  for (const t of teile.slice(0, -1)) {
    if (!cur[t] || typeof cur[t] !== 'object') cur[t] = {};
    cur = cur[t] as Knoten;
  }
  cur[teile[teile.length - 1]!] = wert;
}
function lesePfad(o: Knoten, pfad: string): unknown {
  let cur: unknown = o;
  for (const t of pfad.split('.')) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Knoten)[t];
  }
  return cur;
}

/** Eine Bearbeitung an einer Eigenschaft (`prop`) des Eintrags. */
function bearbeite(ziel: Knoten, prop: string, mod: Knoten, melde: KopieMelder): void {
  const modus = String(mod['mode'] ?? '');
  const arr = (): unknown[] => {
    if (!Array.isArray(ziel[prop])) ziel[prop] = alsListe(ziel[prop]);
    return ziel[prop] as unknown[];
  };
  switch (modus) {
    case 'remove':
      delete ziel[prop];
      return;
    case 'appendArr':
      arr().push(...tiefKopie(alsListe(mod['items'])));
      return;
    case 'prependArr':
      arr().unshift(...tiefKopie(alsListe(mod['items'])));
      return;
    case 'insertArr':
      arr().splice(Number(mod['index'] ?? 0), 0, ...tiefKopie(alsListe(mod['items'])));
      return;
    case 'appendIfNotExistsArr': {
      const a = arr();
      for (const it of alsListe(mod['items'])) {
        const s = JSON.stringify(it);
        if (!a.some((x) => JSON.stringify(x) === s)) a.push(tiefKopie(it));
      }
      return;
    }
    case 'replaceArr': case 'replaceOrAppendArr': {
      const a = arr();
      const was = mod['replace'];
      let i = -1;
      if (typeof was === 'string') i = a.findIndex((x) => nameVon(x) === was);
      else if (was && typeof was === 'object') {
        const w = was as Knoten;
        if (typeof w['index'] === 'number') i = w['index'];
        else if (typeof w['regex'] === 'string') {
          const re = new RegExp(w['regex'], String(w['flags'] ?? ''));
          i = a.findIndex((x) => re.test(nameVon(x) ?? ''));
        }
      }
      if (i < 0) {
        if (modus === 'replaceOrAppendArr') a.push(...tiefKopie(alsListe(mod['items'])));
        else melde(`replaceArr ohne Treffer in ${prop}`);
        return;
      }
      a.splice(i, 1, ...tiefKopie(alsListe(mod['items'])));
      return;
    }
    case 'removeArr': {
      const a = arr();
      const namen = alsListe(mod['names']).map(String);
      const stuecke = alsListe(mod['items']).map((x) => JSON.stringify(x));
      ziel[prop] = a.filter((x) => {
        const n = nameVon(x);
        if (namen.length && n !== undefined && namen.includes(n)) return false;
        if (stuecke.length && stuecke.includes(JSON.stringify(x))) return false;
        return true;
      });
      return;
    }
    case 'renameArr': {
      const a = arr();
      for (const r of alsListe(mod['renames']) as Knoten[]) {
        const x = a.find((y) => nameVon(y) === r['rename']);
        if (x && typeof x === 'object') (x as Knoten)['name'] = r['with'];
      }
      return;
    }
    case 'replaceTxt': {
      if (ziel[prop] === undefined) return;
      const re = new RegExp(String(mod['replace'] ?? ''), `g${String(mod['flags'] ?? '').replace('g', '')}`);
      const props = alsListe(mod['props']);
      ziel[prop] = ersetzeText(ziel[prop], re, String(mod['with'] ?? ''), props.includes('name'));
      return;
    }
    default:
      melde(`_mod ${modus || '(ohne mode)'} an ${prop}`);
  }
}

/** Ein Zauberwirken, an das Zauber angefügt werden sollen. */
function zauberwirken(ziel: Knoten): Knoten {
  if (!Array.isArray(ziel['spellcasting']) || !(ziel['spellcasting'] as unknown[]).length) {
    ziel['spellcasting'] = [{ name: 'Spellcasting', type: 'spellcasting', headerEntries: [] }];
  }
  return (ziel['spellcasting'] as Knoten[])[0]!;
}

/** Die Bearbeitungen an der Wurzel (`_`): Sinne, Fertigkeiten, Zauber, Zahlen. */
function bearbeiteWurzel(ziel: Knoten, mod: Knoten, melde: KopieMelder): void {
  const modus = String(mod['mode'] ?? '');
  switch (modus) {
    case 'addSenses': {
      const sinne = alsListe(ziel['senses']).map(String);
      for (const s of alsListe(mod['senses']) as Knoten[]) {
        const typ = String(s['type'] ?? '');
        const i = sinne.findIndex((x) => x.toLowerCase().startsWith(typ.toLowerCase()));
        const neu = `${typ} ${s['range']} ft.`;
        if (i < 0) sinne.push(neu);
        else {
          const alt = Number(/(\d+)/.exec(sinne[i]!)?.[1] ?? 0);
          if (Number(s['range']) > alt) sinne[i] = neu;
        }
      }
      ziel['senses'] = sinne;
      return;
    }
    case 'addSkills': case 'addSaves': {
      const feld = modus === 'addSkills' ? 'skill' : 'save';
      const prof = profAusCr(ziel['cr']);
      const werte = { ...((ziel[feld] as Knoten | undefined) ?? {}) };
      const quelle = (modus === 'addSkills' ? mod['skills'] : mod['saves']) as Record<string, number>;
      for (const [k, stufe] of Object.entries(quelle ?? {})) {
        const attr = modus === 'addSkills' ? ATTR_VON_SKILL[k] : k;
        const wert = Number(ziel[attr ?? ''] ?? 10);
        const bonus = Math.floor((wert - 10) / 2) + prof * Number(stufe);
        const alt = Number(String(werte[k] ?? '').replace('+', ''));
        if (!Number.isFinite(alt) || bonus > alt || werte[k] === undefined) werte[k] = `${bonus >= 0 ? '+' : ''}${bonus}`;
      }
      ziel[feld] = werte;
      return;
    }
    case 'addSpells': {
      const sc = zauberwirken(ziel);
      if (mod['spells']) {
        const grade = (sc['spells'] ??= {}) as Record<string, Knoten>;
        for (const [g, neu] of Object.entries(mod['spells'] as Record<string, Knoten>)) {
          const alt = (grade[g] ??= { spells: [] });
          if (neu['slots'] !== undefined) alt['slots'] = neu['slots'];
          (alt['spells'] = alsListe(alt['spells'])).push(...alsListe(neu['spells']));
        }
      }
      if (mod['will']) (sc['will'] = alsListe(sc['will'])).push(...alsListe(mod['will']));
      for (const feld of ['daily', 'rest', 'weekly', 'yearly'] as const) {
        if (!mod[feld]) continue;
        const gruppe = (sc[feld] ??= {}) as Record<string, unknown[]>;
        for (const [k, v] of Object.entries(mod[feld] as Record<string, unknown[]>)) {
          (gruppe[k] = alsListe(gruppe[k])).push(...v);
        }
      }
      return;
    }
    case 'replaceSpells': case 'removeSpells': {
      const sc = zauberwirken(ziel);
      const tausche = (liste: unknown[], aenderung: unknown[]): unknown[] => {
        let out = [...liste];
        for (const a of aenderung) {
          if (modus === 'removeSpells') out = out.filter((x) => x !== a);
          else {
            const r = a as Knoten;
            const i = out.indexOf(r['replace']);
            if (i >= 0) out.splice(i, 1, ...alsListe(r['with']));
            else melde('replaceSpells ohne Treffer');
          }
        }
        return out;
      };
      if (mod['spells']) {
        const grade = (sc['spells'] ??= {}) as Record<string, Knoten>;
        for (const [g, aend] of Object.entries(mod['spells'] as Record<string, unknown[]>)) {
          if (!grade[g]) continue;
          grade[g]['spells'] = tausche(alsListe(grade[g]['spells']), aend);
        }
      }
      if (mod['will']) sc['will'] = tausche(alsListe(sc['will']), alsListe(mod['will']));
      for (const feld of ['daily', 'rest', 'weekly', 'yearly'] as const) {
        if (!mod[feld] || !sc[feld]) continue;
        const gruppe = sc[feld] as Record<string, unknown[]>;
        for (const [k, aend] of Object.entries(mod[feld] as Record<string, unknown[]>)) {
          if (gruppe[k]) gruppe[k] = tausche(gruppe[k], aend);
        }
      }
      return;
    }
    case 'scalarAddHit': case 'scalarAddDc': {
      const tag = modus === 'scalarAddHit' ? 'hit' : 'dc';
      const plus = Number(mod['scalar'] ?? 0);
      const re = new RegExp(`\\{@${tag} ([+-]?\\d+)`, 'g');
      for (const p of STERN) {
        if (ziel[p] === undefined) continue;
        ziel[p] = ersetzeMitFunktion(ziel[p], re, (_m, n: string) => `{@${tag} ${Number(n) + plus}`);
      }
      return;
    }
    case 'maxSize': {
      const max = GROESSEN.indexOf(String(mod['max']));
      ziel['size'] = alsListe(ziel['size']).map((s) => (GROESSEN.indexOf(String(s)) > max ? mod['max'] : s));
      return;
    }
    case 'setProp':
      setzePfad(ziel, String(mod['prop']), tiefKopie(mod['value']));
      return;
    case 'scalarAddProp': case 'scalarMultProp': {
      const pfad = String(mod['prop']);
      const ziele = pfad === '*' ? Object.keys(ziel) : [pfad];
      for (const p of ziele) {
        const alt = lesePfad(ziel, p);
        if (typeof alt !== 'number') continue;
        let neu = modus === 'scalarAddProp' ? alt + Number(mod['scalar']) : alt * Number(mod['scalar']);
        if (mod['floor']) neu = Math.floor(neu);
        setzePfad(ziel, p, neu);
      }
      return;
    }
    case 'prefixSuffixStringProp': {
      const pfad = String(mod['prop']);
      const alt = lesePfad(ziel, pfad);
      if (typeof alt === 'string') setzePfad(ziel, pfad, `${mod['prefix'] ?? ''}${alt}${mod['suffix'] ?? ''}`);
      return;
    }
    case 'scalarMultXp':
      return; // Erfahrungspunkte tragen wir nicht.
    default:
      melde(`_mod ${modus || '(ohne mode)'} an _`);
  }
}

function ersetzeMitFunktion(wert: unknown, re: RegExp, f: (m: string, n: string) => string): unknown {
  if (typeof wert === 'string') return wert.replace(re, f as (s: string, ...a: string[]) => string);
  if (Array.isArray(wert)) return wert.map((w) => ersetzeMitFunktion(w, re, f));
  if (wert && typeof wert === 'object') {
    for (const [k, v] of Object.entries(wert as Knoten)) (wert as Knoten)[k] = ersetzeMitFunktion(v, re, f);
  }
  return wert;
}

/* Schritte, die am Objekt selbst arbeiten und nicht an einer Liste. */
const WURZEL_MODI = new Set([
  'addSenses', 'addSkills', 'addSaves', 'addSpells', 'replaceSpells', 'removeSpells', 'scalarAddHit',
  'scalarAddDc', 'maxSize', 'setProp', 'scalarAddProp', 'scalarMultProp', 'prefixSuffixStringProp', 'scalarMultXp',
]);

/** Alle `_mod`-Einträge eines Blocks anwenden. */
export function wendeMods(wurzel: Knoten, mods: Knoten | undefined, melde: KopieMelder): void {
  if (!mods) return;
  for (const [pfad, roh] of Object.entries(mods)) {
    /* `inherits.entries`: ein Pfad, und bearbeitet wird sein letztes Glied. */
    let ziel = wurzel;
    let prop = pfad;
    if (pfad.includes('.') && pfad !== '_' && pfad !== '*') {
      const teile = pfad.split('.');
      prop = teile.pop()!;
      for (const t of teile) {
        if (!ziel[t] || typeof ziel[t] !== 'object') ziel[t] = {};
        ziel = ziel[t] as Knoten;
      }
    }
    for (const einer of alsListe(roh)) {
      const mod: Knoten = typeof einer === 'string' ? { mode: einer } : (einer as Knoten);
      const modus = String(mod['mode'] ?? '');
      if (modus === 'setProp' && mod['prop'] === undefined && prop !== '_' && prop !== '*') {
        ziel[prop] = tiefKopie(mod['value']);
        continue;
      }
      if (prop === '_') bearbeiteWurzel(ziel, mod, melde);
      else if (WURZEL_MODI.has(modus)) {
        /* Ein Wurzelschritt an einer Eigenschaft gilt in ihr: `scalarAddDc`
           unter `action` zählt nur dort auf, `setProp` unter `inherits`
           setzt einen Pfad darin. */
        if (prop === '*') bearbeiteWurzel(ziel, mod, melde);
        else if (ziel[prop] && typeof ziel[prop] === 'object') {
          if (modus === 'scalarAddHit' || modus === 'scalarAddDc') {
            const tag = modus === 'scalarAddHit' ? 'hit' : 'dc';
            const plus = Number(mod['scalar'] ?? 0);
            ziel[prop] = ersetzeMitFunktion(ziel[prop], new RegExp(`\\{@${tag} ([+-]?\\d+)`, 'g'), (_m, n: string) => `{@${tag} ${Number(n) + plus}`);
          } else bearbeiteWurzel(ziel[prop] as Knoten, mod, melde);
        } else if (modus !== 'scalarAddHit' && modus !== 'scalarAddDc') melde(`_mod ${modus} an fehlendem ${prop}`);
      } else if (prop === '*') {
        for (const p of STERN) if (ziel[p] !== undefined) bearbeite(ziel, p, mod, melde);
      } else bearbeite(ziel, prop, mod, melde);
    }
  }
}

/**
 * Alle Kopien einer Art auflösen. `schluessel` sagt, woran ein Eintrag
 * erkannt wird (`name|source`, bei Unterklassen mehr); die Vorlage darf in
 * einer anderen Datei stehen und eine Kopie einer Kopie sein.
 *
 * `vorlagen` sind die Schablonen (`monsterTemplate`), auf die ein
 * `_copy._templates` zeigt.
 */
export function loeseKopien(
  eintraege: Knoten[],
  schluessel: (e: Knoten) => string,
  melde: KopieMelder,
  vorlagen: Map<string, Knoten> = new Map(),
): Knoten[] {
  const nachSchluessel = new Map<string, Knoten>();
  for (const e of eintraege) nachSchluessel.set(schluessel(e), e);
  const fertig = new Map<Knoten, Knoten>();
  const inArbeit = new Set<Knoten>();

  const loese = (e: Knoten): Knoten => {
    const schon = fertig.get(e);
    if (schon) return schon;
    const meta = e['_copy'] as Knoten | undefined;
    if (!meta) {
      fertig.set(e, e);
      return e;
    }
    if (inArbeit.has(e)) {
      melde('_copy im Kreis');
      return e;
    }
    inArbeit.add(e);
    const quelleRoh = nachSchluessel.get(schluessel({ ...e, ...meta }));
    if (!quelleRoh) {
      melde('_copy ohne Vorlage');
      const ohne = { ...e };
      delete ohne['_copy'];
      fertig.set(e, ohne);
      inArbeit.delete(e);
      return ohne;
    }
    const quelle = loese(quelleRoh);
    const neu: Knoten = tiefKopie(e);
    delete neu['_copy'];
    const behalte = (meta['_preserve'] as Knoten | undefined) ?? {};
    for (const [k, v] of Object.entries(quelle)) {
      if (k === KOPIE_VON || k === '_copy') continue;
      if (neu[k] === null) {
        delete neu[k];
        continue;
      }
      if (neu[k] !== undefined) continue;
      if (NUR_MIT_PRESERVE.has(k) && !behalte['*'] && !behalte[k]) continue;
      neu[k] = tiefKopie(v);
    }
    for (const t of alsListe(meta['_templates']) as Knoten[]) {
      const v = vorlagen.get(`${String(t['name']).toLowerCase()}|${String(t['source']).toLowerCase()}`);
      if (!v) {
        melde('_templates ohne Schablone');
        continue;
      }
      const apply = (v['apply'] as Knoten | undefined) ?? {};
      for (const [k, w] of Object.entries((apply['_root'] as Knoten | undefined) ?? {})) neu[k] = tiefKopie(w);
      wendeMods(neu, apply['_mod'] as Knoten | undefined, melde);
    }
    wendeMods(neu, meta['_mod'] as Knoten | undefined, melde);
    for (const k of Object.keys(neu)) if (neu[k] === null) delete neu[k];
    neu[KOPIE_VON] = schluessel({ ...e, ...meta });
    fertig.set(e, neu);
    inArbeit.delete(e);
    return neu;
  };

  return eintraege.map(loese);
}
