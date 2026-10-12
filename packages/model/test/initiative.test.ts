import { describe, expect, it } from 'vitest';
import {
  entryTiming,
  expiresAt,
  hpWord,
  initiativeOrder,
  isNote,
  participantStats,
  redactParticipants,
  tickEntries,
  type ParticipantProps,
} from '../src/initiative.js';
import { redactEntity } from '../src/knowledge.js';
import type { Entity, EntityId, Relation } from '../src/types.js';

/* Eine Begegnung: Rook (Gruppe), der Magier (Gegner, aufgedeckt), zwei
   Wachen aus einer Vorlage (eine beteiligt, eine noch im Dunkeln). */
const ent = (id: string, typ: string, extra: Partial<Entity> = {}): Entity =>
  ({ id, interfaces: [typ], components: {}, relations: [], ...extra }) as Entity;

const party = ent('party', 'Party');
const rook = ent('rook', 'PlayerCharacter', { relations: [{ id: 'm1', type: 'memberOfParty', to: 'party' }] });
const rookSb = ent('sb-rook', 'Statblock', {
  components: { Statblock: { ac: 15, hp: 24 } },
  relations: [{ id: 'b1', type: 'belongsTo', to: 'rook' }],
});
const magier = ent('mage', 'Creature', { components: { Identity: { name: 'Vex', cover: 'Robed figure' } } });
const vorlage = ent('sb-guard', 'Statblock', { components: { Statblock: { ac: 16, hp: 11 } } });
const wache1 = ent('guard1', 'Creature', { components: { Identity: { name: 'Guard', cover: 'Soldier' } } });
const wache2 = ent('guard2', 'Creature', { components: { Identity: { name: 'Guard', cover: 'Soldier' } } });
const inst1 = ent('sb-g1', 'Statblock', {
  components: { Statblock: { hp: 18 } },
  relations: [
    { id: 'i1', type: 'instanceOf', to: 'sb-guard' },
    { id: 'b2', type: 'belongsTo', to: 'guard1' },
  ],
});
const alle = new Map<EntityId, Entity>(
  [party, rook, rookSb, magier, vorlage, wache1, wache2, inst1].map((e) => [e.id, e]),
);

const teil = (id: string, to: string, props: ParticipantProps): Relation =>
  ({ id, type: 'participates', to, props }) as Relation;

describe('Dauer der Einträge (REQ-212)', () => {
  it('ohne Anker zählt der eigene Zug am Ende — der Bestand bleibt gültig', () => {
    expect(entryTiming({ rule: 'x', rounds: 1 }, 'p1')).toEqual({ anchor: 'p1', at: 'end' });
    const r = [teil('p1', 'rook', { conditions: [{ rule: 'prone', rounds: 2, source: 'Vex' }] })];
    const nach = tickEntries(r, 'p1', 'end');
    expect((nach[0]!.props as ParticipantProps).conditions).toEqual([{ rule: 'prone', rounds: 1, source: 'Vex' }]);
    expect((tickEntries(r, 'p1', 'start')[0]!.props as ParticipantProps).conditions![0]!.rounds).toBe(2);
  });

  it('ein Anker zählt im Zug eines anderen Teilnehmers herunter', () => {
    const r = [
      teil('p1', 'rook', { conditions: [{ rule: 'frightened', rounds: 1, anchor: 'p2', at: 'start' }] }),
      teil('p2', 'mage', {}),
    ];
    expect((tickEntries(r, 'p1', 'end')[0]!.props as ParticipantProps).conditions).toHaveLength(1);
    expect((tickEntries(r, 'p2', 'start')[0]!.props as ParticipantProps).conditions).toEqual([]);
  });

  it('eine Notiz ist ein Eintrag mit Text, mit derselben Dauer', () => {
    const notiz = { text: 'Concentrating on Bless', rounds: 3, anchor: 'p2', at: 'end' as const };
    expect(isNote(notiz)).toBe(true);
    expect(isNote({ rule: 'prone' })).toBe(false);
    const r = [teil('p1', 'rook', { conditions: [notiz] }), teil('p2', 'mage', {})];
    expect((tickEntries(r, 'p2', 'end')[0]!.props as ParticipantProps).conditions![0]!.rounds).toBe(2);
  });

  it('ohne Dauer bleibt ein Eintrag stehen', () => {
    const r = [teil('p1', 'rook', { conditions: [{ rule: 'grappled' }] })];
    expect((tickEntries(r, 'p1', 'end')[0]!.props as ParticipantProps).conditions).toHaveLength(1);
  });

  it('sagt beim Setzen, wann der Eintrag abläuft', () => {
    const order = ['p1', 'p2', 'p3'];
    /* Im Zug von p2 gesetzt, Ende von p2: das Ende dieses Zuges zählt schon. */
    expect(expiresAt({ rounds: 1, anchor: 'p2', at: 'end' }, 'p3', order, 2, 1)).toEqual({ round: 2, anchor: 'p2', at: 'end' });
    expect(expiresAt({ rounds: 2, anchor: 'p2', at: 'end' }, 'p3', order, 2, 1)!.round).toBe(3);
    /* Der Anfang des laufenden Zuges ist vorbei. */
    expect(expiresAt({ rounds: 1, anchor: 'p2', at: 'start' }, 'p3', order, 2, 1)!.round).toBe(3);
    /* Ein früherer Teilnehmer kommt erst nächste Runde. */
    expect(expiresAt({ rounds: 1, anchor: 'p1', at: 'end' }, 'p3', order, 2, 1)!.round).toBe(3);
    /* Vor dem Kampf zählt Runde 1 ganz. */
    expect(expiresAt({ rounds: 1, anchor: 'p1', at: 'start' }, 'p3', order, 0, 0)!.round).toBe(1);
    expect(expiresAt({ rule: 'x' }, 'p3', order, 2, 1)).toBeNull();
  });
});

describe('Zahlen aus dem Statblock (REQ-211)', () => {
  it('liest RK und Maximum von der Instanz, mit der Vorlage darunter', () => {
    expect(participantStats(alle, teil('p', 'guard1', { hp: 3 }))).toEqual({ ac: 16, hpMax: 18 });
    expect(participantStats(alle, teil('p', 'rook', {}))).toEqual({ ac: 15, hpMax: 24 });
  });
  it('nimmt die alte Abschrift nur, wo kein Statblock hängt', () => {
    expect(participantStats(alle, teil('p', 'guard2', { hpMax: 9 }))).toEqual({ ac: undefined, hpMax: 9 });
  });
});

describe('Spieleransicht (REQ-213)', () => {
  it('Trefferpunkte als Wort', () => {
    expect(hpWord(10, 10)).toBe('unhurt');
    expect(hpWord(undefined, 10)).toBe('unhurt');
    expect(hpWord(4, 10)).toBe('bloodied');
    expect(hpWord(0, 10)).toBe('down');
    expect(hpWord(undefined, undefined)).toBeUndefined();
  });

  const kampf = [
    teil('p1', 'rook', { label: 'Rook', hp: 20, init: 15, note: 'inspired' }),
    teil('p2', 'mage', { label: 'Vex', hp: 5, hpMax: 12, revealed: true, conditions: [
      { rule: 'prone', rounds: 1 }, { text: 'Has the key', hidden: true }, { text: 'Concentrating', rounds: 10 },
    ], note: 'flees at 3 hp' }),
    teil('p3', 'guard1', { label: 'Guard 1', involved: true }),
    teil('p4', 'guard2', { label: 'Guard 2', revealed: true, identified: true, hp: 0, hpMax: 11 }),
    teil('p5', 'guard1', { label: 'Guard 3' }),
    { id: 'o', type: 'onMap', to: 'map' } as Relation,
  ];

  it('zeigt die Gruppe und was aufgedeckt oder beteiligt ist', () => {
    const r = redactParticipants(alle, kampf);
    expect(r.map((x) => x.id)).toEqual(['p1', 'p2', 'p3', 'p4', 'o']);
  });

  it('die Gruppe mit Zahlen, Gegner mit Wort, Ungekannte mit Decknamen', () => {
    const r = redactParticipants(alle, kampf);
    const p = (i: number) => r[i]!.props as ParticipantProps;
    expect(p(0)).toMatchObject({ label: 'Rook', hp: 20, hpMax: 24 });
    expect(p(1).label).toBe('Robed figure');
    expect(r[1]!.to).toBe('');
    expect(p(1).hp).toBeUndefined();
    expect(p(1).hpMax).toBeUndefined();
    expect(p(1).hpState).toBe('bloodied');
    expect(p(1).note).toBeUndefined();
    expect(p(1).conditions!.map((c) => c.rule ?? c.text)).toEqual(['prone', 'Concentrating']);
    expect(p(2).label).toBe('Soldier');
    expect(p(2).hpState).toBe('unhurt');
    expect(p(3)).toMatchObject({ label: 'Guard 2', hpState: 'down' });
    expect(r[3]!.to).toBe('guard2');
  });

  it('greift in redactEntity, nicht erst in der Maske', () => {
    const begegnung = ent('enc', 'Encounter', { relations: kampf, components: { Encounter: { round: 2, turn: 0 } } });
    const alle2 = new Map(alle);
    alle2.set('enc', begegnung);
    const fuerSpieler = redactEntity({ interfaces: {} }, alle2, begegnung, 'rook');
    expect(fuerSpieler.relations!.filter((r) => r.type === 'participates')).toHaveLength(4);
    expect(JSON.stringify(fuerSpieler)).not.toContain('Has the key');
    expect(JSON.stringify(fuerSpieler)).not.toContain('flees');
    /* Die Leitung bekommt alles. */
    expect(redactEntity({ interfaces: {} }, alle2, begegnung)).toBe(begegnung);
  });
});

describe('Erste Runde (REQ-226, D58)', () => {
  /* Reihe: Rook 18, Wache 1 15, Vex 12, Wache 2 8, Wache 3 5 (nie aufgedeckt). */
  const kampf = [
    teil('p1', 'rook', { label: 'Rook', init: 18 }),
    teil('p2', 'mage', { label: 'Vex', init: 12, revealed: true }),
    teil('p3', 'guard1', { label: 'Guard 1', init: 15, revealed: true }),
    teil('p4', 'guard2', { label: 'Guard 2', init: 8, revealed: true }),
    teil('p5', 'guard1', { label: 'Guard 3', init: 5 }),
  ];
  const ids = (r: Relation[]) => r.map((x) => x.id);

  it('sortiert wie der Prototyp', () => {
    expect(ids(initiativeOrder(alle, kampf))).toEqual(['p1', 'p3', 'p2', 'p4', 'p5']);
  });

  it('vor Runde 1 steht nur die Gruppe', () => {
    expect(ids(redactParticipants(alle, kampf, { round: 0, turn: 0 }))).toEqual(['p1']);
  });

  it('in Runde 1 erscheint ein Gegner, wenn sein Zug beginnt, und bleibt', () => {
    expect(ids(redactParticipants(alle, kampf, { round: 1, turn: 0 }))).toEqual(['p1']);
    expect(ids(redactParticipants(alle, kampf, { round: 1, turn: 1 }))).toEqual(['p1', 'p3']);
    expect(ids(redactParticipants(alle, kampf, { round: 1, turn: 3 }))).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  it('wer nie aufgedeckt wurde, bleibt verborgen, auch in seinem Zug', () => {
    expect(ids(redactParticipants(alle, kampf, { round: 1, turn: 4 }))).not.toContain('p5');
    expect(ids(redactParticipants(alle, kampf, { round: 3, turn: 4 }))).not.toContain('p5');
  });

  it('ab Runde 2 gilt aufgedeckt/beteiligt wie in U1', () => {
    expect(ids(redactParticipants(alle, kampf, { round: 2, turn: 0 }))).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  it('ein Verbündeter ist kein Gegner und steht gleich', () => {
    const mit = [...kampf, teil('p6', 'guard2', { label: 'Ally', init: 1, ally: true, revealed: true })];
    expect(ids(redactParticipants(alle, mit, { round: 1, turn: 0 }))).toContain('p6');
  });

  it('wer dran ist, trägt die Marke — und nur, wenn er gezeigt wird', () => {
    const r = redactParticipants(alle, kampf, { round: 1, turn: 1 });
    expect(r.filter((x) => (x.props as ParticipantProps).current).map((x) => x.id)).toEqual(['p3']);
    const verborgen = redactParticipants(alle, kampf, { round: 2, turn: 4 });
    expect(verborgen.some((x) => (x.props as ParticipantProps).current)).toBe(false);
  });

  it('redactEntity schickt keine Zugnummer, die Verborgene mitzählt', () => {
    const begegnung = ent('enc', 'Encounter', {
      relations: kampf,
      components: { Encounter: { round: 1, turn: 2, phase: 'running' } },
    });
    const alle2 = new Map(alle);
    alle2.set('enc', begegnung);
    const fuerSpieler = redactEntity({ interfaces: {} }, alle2, begegnung, 'rook');
    expect(fuerSpieler.components!['Encounter']).toEqual({ round: 1, phase: 'running' });
    expect(ids(fuerSpieler.relations!)).toEqual(['p1', 'p2', 'p3']);
    expect((fuerSpieler.relations!.find((x) => x.id === 'p2')!.props as ParticipantProps).current).toBe(true);
    expect(redactEntity({ interfaces: {} }, alle2, begegnung).components!['Encounter']).toMatchObject({ turn: 2 });
  });
});
