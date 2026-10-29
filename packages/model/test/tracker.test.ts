import { describe, expect, it } from 'vitest';
import { redactParticipants, type ParticipantProps } from '../src/initiative.js';
import {
  DEFAULT_INITIATIVE_RULES,
  applyTrackerOp,
  delayTurn,
  fightOf,
  initiativeRulesOf,
  nextTurn,
  previousTurn,
  setTurn,
  trackerView,
} from '../src/tracker.js';
import type { Entity, EntityId, Relation } from '../src/types.js';

const ent = (id: string, typ: string, extra: Partial<Entity> = {}): Entity =>
  ({ id, interfaces: [typ], components: {}, relations: [], ...extra }) as Entity;
const teil = (id: string, to: string, props: ParticipantProps): Relation => ({ id, type: 'participates', to, props }) as Relation;

const party = ent('party', 'Party');
const rook = ent('rook', 'PlayerCharacter', { name: 'Rook', relations: [{ id: 'm', type: 'memberOfParty', to: 'party' }] });
const ork = ent('ork', 'Creature', { name: 'Ork', components: { Identity: { name: 'Ork', cover: 'Brute' } } });
const sb = ent('sb', 'Statblock', { components: { Statblock: { ac: 13, hp: 15 }, Abilities: { dex: 14 } }, relations: [{ id: 'b', type: 'belongsTo', to: 'ork' }] });
const wolf = ent('wolf', 'Creature', { name: 'Wolf' });
const alle = new Map<EntityId, Entity>([party, rook, ork, sb, wolf].map((e) => [e.id, e]));

const kampf = (round = 1, turn = 0, rel: Relation[] = [teil('a', 'rook', { init: 20 }), teil('b', 'ork', { init: 15, hp: 15 }), teil('c', 'wolf', { init: 10 })]): Entity =>
  ent('enc', 'Encounter', { components: { Encounter: { round, turn, phase: 'running' } }, relations: rel });
const props = (e: Entity, id: string) => (e.relations!.find((r) => r.id === id)!.props ?? {}) as ParticipantProps;
const deps = { d20: () => 10, newId: () => 'neu' };

describe('Kampagneneinstellung (T-022)', () => {
  it('ohne Angabe gilt, was vor T-022 galt', () => {
    expect(initiativeRulesOf(null)).toEqual(DEFAULT_INITIATIVE_RULES);
  });
  it('liest die Felder und verwirft Unbekanntes', () => {
    const c = ent('c', 'Campaign', { components: { Campaign: { combat: 'off', initHealth: 'exact', initColumns: ['hp', 'nonsense', 'init'] } } });
    expect(initiativeRulesOf(c)).toMatchObject({ combat: 'off', health: 'exact', names: 'cover', columns: ['init', 'hp'] });
  });
});

describe('Initiative als Regelsystem (T-334)', () => {
  it('„D&D 5e (standard)" läuft, solange der Tracker an ist, und kennt kein Verzögern', () => {
    expect(initiativeRulesOf(null).system).toBe('dnd5e');
    const c = ent('c', 'Campaign', { components: { Campaign: { initQuickActions: ['damage', 'delay', 'remove'] } } });
    expect(initiativeRulesOf(c).quickActions).toEqual(['damage', 'remove']);
    expect(initiativeRulesOf(ent('o', 'Campaign', { components: { Campaign: { combat: 'off' } } })).system).toBeNull();
  });
});

describe('Zug frei setzen (T-334)', () => {
  const mitBless = () => kampf(1, 0, [teil('a', 'rook', { init: 20, conditions: [{ text: 'Bless', rounds: 1 }] }), teil('b', 'ork', { init: 15 }), teil('c', 'wolf', { init: 10 })]);
  it('setzt eine Zeile, überspringt und geht zum Anfang, ohne etwas zu zählen', () => {
    let e = setTurn(alle, mitBless(), { edge: 'c' });
    expect(fightOf(e)).toEqual({ round: 1, turn: 2 });
    e = setTurn(alle, e, 'skip');
    expect(fightOf(e)).toEqual({ round: 2, turn: 0 });
    e = setTurn(alle, setTurn(alle, e, 'skip'), 'top');
    expect(fightOf(e)).toEqual({ round: 2, turn: 0 });
    expect(props(e, 'a').conditions).toHaveLength(1);
  });
  it('vor Runde 1 und für Unbekannte bleibt alles, wie es ist', () => {
    expect(fightOf(setTurn(alle, kampf(0, 0), 'skip'))).toEqual({ round: 0, turn: 0 });
    expect(fightOf(setTurn(alle, kampf(1, 1), { edge: 'nix' }))).toEqual({ round: 1, turn: 1 });
  });
  it('ohne Stand sind die Trefferpunkte voll, für die Leitung und die Gruppe', () => {
    const e = kampf(1, 0, [teil('a', 'rook', { init: 20 }), teil('b', 'ork', { init: 15 })]);
    const v = trackerView(alle, e, { ...DEFAULT_INITIATIVE_RULES, columns: ['hp'] }, true);
    expect([v.rows[1]!.hp, v.rows[1]!.hpMax]).toEqual([15, 15]);
    expect([v.turn, v.turns]).toEqual([1, 2]);
    const roh = redactParticipants(alle, e.relations!, { round: 1, turn: 0 }, { health: 'exact' });
    expect(roh).toHaveLength(1);
  });
});

describe('Züge', () => {
  it('beginnt vor Runde 1 mit dem ersten und zählt nach dem letzten die Runde hoch', () => {
    let e = nextTurn(alle, kampf(0, 0));
    expect(fightOf(e)).toEqual({ round: 1, turn: 0 });
    e = nextTurn(alle, nextTurn(alle, nextTurn(alle, e)));
    expect(fightOf(e)).toEqual({ round: 2, turn: 0 });
  });
  it('zählt Ende des laufenden und Anfang des nächsten Zuges', () => {
    const rel = [
      teil('a', 'rook', { init: 20, conditions: [{ text: 'Bless', rounds: 1 }, { rule: 'x', rounds: 1, anchor: 'b', at: 'start' }] }),
      teil('b', 'ork', { init: 15 }),
    ];
    const e = nextTurn(alle, kampf(1, 0, rel));
    expect(props(e, 'a').conditions).toEqual([]);
  });
  it('zurück zählt nichts zurück und bleibt vor dem ersten Zug stehen', () => {
    expect(fightOf(previousTurn(alle, kampf(2, 0)))).toEqual({ round: 1, turn: 2 });
    expect(fightOf(previousTurn(alle, kampf(1, 0)))).toEqual({ round: 1, turn: 0 });
  });
  it('verzögern rückt einen Platz nach hinten, und der nächste ist dran', () => {
    const e = delayTurn(alle, kampf(1, 0));
    expect(props(e, 'a').init).toBe(12.5);
    expect(trackerView(alle, e, DEFAULT_INITIATIVE_RULES, true).rows.map((r) => [r.edge, r.current])).toEqual([
      ['b', true],
      ['a', false],
      ['c', false],
    ]);
  });
});

describe('Änderungen', () => {
  it('heilt bis zum Maximum am Statblock, Schaden darf darunter', () => {
    const geheilt = applyTrackerOp(alle, kampf(1, 0, [teil('b', 'ork', { init: 15, hp: 10 })]), { op: 'hp', edge: 'b', delta: 9 }, deps);
    expect('encounter' in geheilt && props(geheilt.encounter, 'b').hp).toBe(15);
    const tief = applyTrackerOp(alle, kampf(1, 0, [teil('b', 'ork', { init: 15, hp: 3 })]), { op: 'hp', edge: 'b', delta: -8 }, deps);
    expect('encounter' in tief && props(tief.encounter, 'b').hp).toBe(-5);
  });
  it('würfelt neu mit Geschicklichkeit und hält den laufenden Zug', () => {
    const r = applyTrackerOp(alle, kampf(1, 1), { op: 'init', edge: 'b', reroll: true }, deps);
    if (!('encounter' in r)) throw new Error(r.error);
    expect(props(r.encounter, 'b').init).toBe(12);
    expect(trackerView(alle, r.encounter, DEFAULT_INITIATIVE_RULES, true).rows.find((x) => x.current)!.edge).toBe('b');
  });
  it('ein Entfernter nimmt seinen Anker mit: die Einträge zählen am eigenen Zug', () => {
    const rel = [teil('a', 'rook', { init: 20, conditions: [{ text: 'Mark', rounds: 2, anchor: 'b' }] }), teil('b', 'ork', { init: 15 })];
    const r = applyTrackerOp(alle, kampf(1, 0, rel), { op: 'remove', edge: 'b' }, deps);
    if (!('encounter' in r)) throw new Error(r.error);
    expect(props(r.encounter, 'a').conditions).toEqual([{ text: 'Mark', rounds: 2 }]);
  });
  it('ein Effekt braucht einen Zustand oder Text und einen Anker in der Begegnung', () => {
    expect(applyTrackerOp(alle, kampf(), { op: 'effect', edge: 'a', entry: {} }, deps)).toHaveProperty('error');
    expect(applyTrackerOp(alle, kampf(), { op: 'effect', edge: 'a', entry: { text: 'x', anchor: 'zz' } }, deps)).toHaveProperty('error');
  });
});

describe('Spieleransicht nach Einstellung', () => {
  const rel = [teil('a', 'rook', { init: 20, hp: 9 }), teil('b', 'ork', { init: 15, hp: 7, revealed: true, conditions: [{ text: 'Burning' }] })];
  it('Gesundheit keine, grob, genau', () => {
    const b = (health: 'none' | 'coarse' | 'exact') => redactParticipants(alle, rel, undefined, { health }).find((r) => r.id === 'b')!.props as ParticipantProps;
    expect(b('none')).not.toHaveProperty('hpState');
    expect(b('none').hp).toBeUndefined();
    expect(b('coarse').hpState).toBe('bloodied');
    expect(b('exact')).toMatchObject({ hp: 7, hpMax: 15 });
  });
  it('Namen und Effekte', () => {
    const b = (view: Parameters<typeof redactParticipants>[3]) => redactParticipants(alle, rel, undefined, view).find((r) => r.id === 'b')!;
    expect((b({}).props as ParticipantProps).label).toBe('Brute');
    expect(b({ names: 'real' })).toMatchObject({ to: '', props: { label: 'Ork' } });
    expect((b({ effects: 'party' }).props as ParticipantProps).conditions).toEqual([]);
  });
});

describe('Mehrere auf einmal (T-333)', () => {
  let n = 0;
  const zaehler = { d20: () => 10, newId: () => `k${++n}` };
  const teilnehmer = (e: Entity) => (e.relations ?? []).filter((r) => r.type === 'participates');
  it('legt je Kämpfer eine eigene Kante an und nummeriert die Namen', () => {
    const r = applyTrackerOp(alle, kampf(0, 0, []), { op: 'add', to: 'wolf', count: 3 }, zaehler);
    if (!('encounter' in r)) throw new Error(r.error);
    const t = teilnehmer(r.encounter);
    expect(t.map((x) => (x.props as ParticipantProps).label)).toEqual(['Wolf 1', 'Wolf 2', 'Wolf 3']);
    expect(new Set(t.map((x) => x.id)).size).toBe(3);
  });
  it('zählt weiter, wo schon welche stehen, und nimmt den Namen am Tisch', () => {
    const rel = [teil('w1', 'wolf', { init: 5, label: 'Wolf 1' }), teil('w2', 'wolf', { init: 5, label: 'Wolf 2' })];
    const r = applyTrackerOp(alle, kampf(0, 0, rel), { op: 'add', to: 'wolf', count: 2 }, zaehler);
    if (!('encounter' in r)) throw new Error(r.error);
    expect(teilnehmer(r.encounter).map((x) => (x.props as ParticipantProps).label)).toEqual(['Wolf 1', 'Wolf 2', 'Wolf 3', 'Wolf 4']);
    const g = applyTrackerOp(alle, kampf(0, 0, []), { op: 'add', to: 'ork', count: 2, label: 'Guard', ally: true }, zaehler);
    if (!('encounter' in g)) throw new Error(g.error);
    expect(teilnehmer(g.encounter).map((x) => x.props)).toEqual([
      { init: 12, ally: true, label: 'Guard 1' },
      { init: 12, ally: true, label: 'Guard 2' },
    ]);
  });
  it('einer bleibt ohne Nummer, mehr als zwanzig oder keiner ist ein Fehler', () => {
    const r = applyTrackerOp(alle, kampf(0, 0, []), { op: 'add', to: 'wolf', count: 1 }, zaehler);
    if (!('encounter' in r)) throw new Error(r.error);
    expect((teilnehmer(r.encounter)[0]!.props as ParticipantProps).label).toBeUndefined();
    expect(applyTrackerOp(alle, kampf(0, 0, []), { op: 'add', to: 'wolf', count: 21 }, zaehler)).toHaveProperty('error');
    expect(applyTrackerOp(alle, kampf(0, 0, []), { op: 'add', to: 'wolf', count: 0 }, zaehler)).toHaveProperty('error');
  });
});

describe('Die Karte der Begegnung im Tracker (T-333)', () => {
  it('nennt der Leitung die Karte, auf der gekämpft wird, und Spielenden nicht', () => {
    const e = kampf(0, 0, [teil('a', 'rook', { init: 20 }), { id: 'm', type: 'onMap', to: 'karte' } as Relation]);
    expect(trackerView(alle, e, DEFAULT_INITIATIVE_RULES, true).map).toBe('karte');
    expect(trackerView(alle, e, DEFAULT_INITIATIVE_RULES, false).map).toBeUndefined();
    expect(trackerView(alle, kampf(0, 0), DEFAULT_INITIATIVE_RULES, true).map).toBeUndefined();
  });
});
