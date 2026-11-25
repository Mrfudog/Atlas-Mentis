/**
 * Der Inhalt einer Quelle als Baum (T-189): je Art die Artikel mit ihrem
 * Stand in der laufenden Kampagne, die Lage der Ebene, eine Gruppe als
 * Liste ihrer Ebenen — und Spielende ohne Vorschau sehen nur, was im Spiel
 * ist. Geändert wird über die Routen von T-187; der Baum zeigt danach den
 * neuen Stand.
 */

import { describe, expect, it } from 'vitest';
import { aufbau } from './quellen-bestand.js';

interface Baum {
  state: { inPlay: boolean; own: boolean; compare?: true; brings?: { types?: string[] }; ruleFrom?: { id: string } };
  may: string | null;
  types?: { type: string; on: boolean; articles: { id: string; state: string }[] }[];
  layers?: { id: string; inPlay: boolean; articles: number }[];
  onlyInPlay?: true;
}
const baum = async (rufe: Awaited<ReturnType<typeof aufbau>>['rufe'], wer: string, layer: string) => {
  const res = await rufe(wer, 'GET', `/api/layers/${layer}/contents`);
  expect(res.statusCode).toBe(200);
  return res.json() as Baum;
};
const stand = (b: Baum) =>
  Object.fromEntries((b.types ?? []).flatMap((t) => t.articles.map((a) => [a.id, `${t.type}:${t.on ? 'on' : 'off'}:${a.state}`])));

describe('contents of a source (T-189)', () => {
  it('lists articles by type with their state in the campaign', async () => {
    const { rufe } = await aufbau();
    const b = await baum(rufe, 'Basil', 'ly_eins');
    expect(b.may).toBe('manage');
    expect(b.state).toMatchObject({ inPlay: true, own: true });
    expect(stand(b)).toEqual({ ort1: 'Place:on:layer', stab1: 'Item:on:layer' });
  });

  it('shows a type rule and a single enabled article from a compare layer', async () => {
    const { rufe } = await aufbau();
    expect((await rufe('Basil', 'PUT', '/api/campaigns/camp_a/rules/g_adv', { types: ['Item'] })).statusCode).toBe(200);
    const zwei = await baum(rufe, 'Basil', 'ly_zwei');
    expect(zwei.state.ruleFrom?.id).toBe('g_adv');
    expect(stand(zwei)).toEqual({ ort2: 'Place:off:off', regel2: 'Rule:off:off' });
    const drei = await baum(rufe, 'Basil', 'ly_drei');
    expect(drei.state).toMatchObject({ inPlay: false, compare: true });
    expect(stand(drei)).toEqual({ ort3: 'Place:off:off', stab3: 'Item:off:off' });
    expect((await rufe('Basil', 'PUT', '/api/campaigns/camp_a/enabled/stab3')).statusCode).toBe(200);
    expect(stand(await baum(rufe, 'Basil', 'ly_drei'))).toEqual({ ort3: 'Place:off:off', stab3: 'Item:off:enabled' });
  });

  it('shows a group as its layers', async () => {
    const { rufe } = await aufbau();
    const g = await baum(rufe, 'Admin', 'g_adv');
    expect(g.layers?.map((l) => [l.id, l.inPlay, l.articles])).toEqual([
      ['ly_eins', true, 2],
      ['ly_zwei', true, 2],
      ['ly_drei', false, 2],
    ]);
  });

  it('gives players only what is in play', async () => {
    const { rufe } = await aufbau();
    const b = await baum(rufe, 'Pia', 'ly_drei');
    expect(b.may).toBeNull();
    expect(b.onlyInPlay).toBe(true);
    expect(stand(b)).toEqual({});
    expect((await rufe('Basil', 'PUT', '/api/campaigns/camp_a/enabled/stab3')).statusCode).toBe(200);
    expect(stand(await baum(rufe, 'Pia', 'ly_drei'))).toEqual({ stab3: 'Item:off:enabled' });
  });
});
