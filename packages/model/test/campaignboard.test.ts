import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import {
  boardQueryOf,
  campaignBoardOf,
  liveArticles,
  newCampaignBoard,
  playerStartOf,
  queryIsEmpty,
  sessionsOf,
  storedQuery,
} from '../src/index.js';
import type { Entity, Relation } from '../src/types.js';

/* Erfundene Artikel: eine Kampagne mit Arc, Szene, drei Sitzungen und einer Gruppe. */
const a = (id: string, typ: string, extra: Record<string, unknown> = {}, rel: Relation[] = []): Entity => ({
  id,
  name: id,
  interfaces: [typ],
  components: { Identity: { name: id, id: `${typ.toLowerCase()}-${id}` }, ...extra },
  relations: rel,
});
const teil = (to: string): Relation => ({ id: `po-${to}-${Math.random()}`, type: 'partOf', to, props: {} });

const liste: Entity[] = [
  a('k', 'Campaign'),
  a('k2', 'Campaign'),
  a('arc', 'Arc', {}, [teil('k')]),
  a('sz', 'Scene', {}, [teil('arc')]),
  a('s1', 'Session', { Time: { sort: 1 }, Session: { activeScene: 'sz' } }, [teil('k')]),
  a('s2', 'Session', { Time: { sort: 2 } }, [teil('k')]),
  a('fremd', 'Session', { Time: { sort: 5 }, Session: { activeMap: 'm' } }, [teil('k2')]),
  a('pt', 'Party', {}, [{ id: 'pt-of', type: 'partyOf', to: 'k', props: {} }]),
  a('pc', 'PlayerCharacter', {}, [{ id: 'pc-m', type: 'memberOfParty', to: 'pt', props: {} }]),
  a('q1', 'Quest', { Quest: { progress: 'accepted' } }),
  a('q2', 'Quest', { Quest: { progress: 'rumoured' } }),
  a('q3', 'Quest', { Quest: { progress: 'offered' } }, [teil('k2')]),
];
const map = new Map(liste.map((e) => [e.id, e]));

describe('Kampagnenboard (T-342)', () => {
  it('findet die laufende Sitzung an dem, was an ihr im Spiel steht, und die nächste danach', () => {
    const s = sessionsOf(map, 'k');
    expect(s.all.map((e) => e.id)).toEqual(['s1', 's2']);
    expect(s.current?.id).toBe('s1');
    expect(s.next?.id).toBe('s2');
  });

  it('beantwortet die laufenden Quellen aus dem Bestand der Kampagne', () => {
    const live = (q: string[]) => liveArticles(seedRegistry, map, 'k', q).sort();
    expect(live(['scene', 'arc'])).toEqual(['arc', 'sz']);
    expect(live(['session'])).toEqual(['s1']);
    expect(live(['nextSession'])).toEqual(['s2']);
    expect(live(['party'])).toEqual(['pc']);
    /* Offen heisst angeboten oder angenommen — und nicht einer anderen Kampagne. */
    expect(live(['quests'])).toEqual(['q1']);
    expect(liveArticles(seedRegistry, map, null, ['quests'])).toEqual([]);
  });

  it('liest und speichert die laufenden Quellen als Wörter, Unbekanntes fällt weg', () => {
    const q = boardQueryOf({ current: ['scene', 'nope', 'scene'] });
    expect(q.current).toEqual(['scene']);
    expect(queryIsEmpty(q)).toBe(false);
    expect(storedQuery(q)).toEqual({ current: ['scene'] });
  });

  it('legt das Board aus der Vorlage an und findet es an der Kampagne', () => {
    const b = newCampaignBoard(liste, map.get('k')!, 'ly_k');
    expect(b.id).toBe('bd_k');
    const m = new Map(map).set(b.id, b);
    expect(campaignBoardOf(m, 'k')?.id).toBe('bd_k');
    expect(campaignBoardOf(m, 'k2')).toBeNull();
    const kacheln = (b.relations ?? []).filter((r) => r.type === 'placed');
    expect(kacheln.some((r) => r.to === 'k')).toBe(true);
    expect(kacheln.filter((r) => r.to === 'bd_k').length).toBe(5);
  });

  it('lässt Spielende ohne Angabe auf dem Board landen', () => {
    expect(playerStartOf(map.get('k'))).toBe('board');
    expect(playerStartOf({ ...map.get('k')!, components: { Campaign: { playerStart: 'compendium' } } })).toBe('compendium');
  });
});
