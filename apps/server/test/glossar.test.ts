/**
 * Das Glossar (T-242): `GET /api/glossary` legt die Wörter der App und die
 * sichtbaren Glossarartikel zusammen; `GET /api/glossary/:id/uses` zählt
 * Nennungen nach dem Sieb. Erfundene Artikel und Wörter.
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity, GlossaryEntry } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

const PASSWORT = 'nebel-wacht-am-tor';
const ident = (name: string, id: string, status = 'ready', aliases: string[] = []) => ({ Identity: { name, id, aliases }, Status: { status } });
const im = (id: string, ebene = 'ly_a') => ({ id: `${id}_in`, type: 'inLayer', to: ebene, props: {} });

function bestand(): Entity[] {
  return [
    { id: 'ly_a', name: 'ly_a', interfaces: ['Layer'], components: { ...ident('Ebene A', 'layer-0001'), Layer: { kind: 'campaign', order: 50 } }, relations: [] },
    { id: 'ly_aus', name: 'ly_aus', interfaces: ['Layer'], components: { ...ident('Ebene aus', 'layer-0002'), Layer: { kind: 'book', order: 20 } }, relations: [] },
    { id: 'camp_a', name: 'Runde A', interfaces: ['Campaign'], components: ident('Runde A', 'campaign-0001'), relations: [{ id: 'camp_a_ac', type: 'activates', to: 'ly_a', props: {} }] },
    { id: 'c_glum', name: 'Glum', interfaces: ['Condition'], components: ident('Glum', 'condition-0001'), relations: [im('c_glum')] },
    { id: 'c_geheim', name: 'Hushed', interfaces: ['Condition'], components: ident('Hushed', 'condition-0002', 'idea'), relations: [im('c_geheim')] },
    {
      id: 'g_glum',
      name: 'Glum',
      interfaces: ['GlossaryTerm'],
      components: {
        ...ident('Glum', 'glossaryterm-0001', 'ready', ['Gloomy']),
        Description: { description: 'Feeling low.' },
        GlossaryTerm: { sort: 'condition', effect: 'You sigh a lot.', example: [{ id: 'a', value: 'The bard is glum.' }], translations: [{ id: 'de', lang: 'de', term: 'Trübsinnig' }] },
      },
      relations: [im('g_glum'), { id: 'g_glum_ex', type: 'explains', to: 'c_glum', props: {} }, { id: 'g_glum_ex2', type: 'explains', to: 'c_geheim', props: {} }],
    },
    /* Nicht im Stapel. */
    { id: 'g_aus', name: 'Sprightly', interfaces: ['GlossaryTerm'], components: ident('Sprightly', 'glossaryterm-0002'), relations: [im('g_aus', 'ly_aus')] },
    /* Nennt den Begriff offen, per Alias und per Verweis — und einmal nur im Geheimnis. */
    { id: 'n_offen', name: 'Fenwick', interfaces: ['Creature'], components: { ...ident('Fenwick', 'creature-0001'), Description: { description: 'Always gloomy.' } }, relations: [im('n_offen')] },
    { id: 'n_link', name: 'Moss', interfaces: ['Creature'], components: { ...ident('Moss', 'creature-0002'), Description: { description: 'See [[glossaryterm-0001|this]].' } }, relations: [im('n_link')] },
    { id: 'n_entwurf', name: 'Draft', interfaces: ['Creature'], components: { ...ident('Draft', 'creature-0003', 'idea'), Description: { description: 'Glum.' } }, relations: [im('n_entwurf')] },
    { id: 'n_nichts', name: 'Pip', interfaces: ['Creature'], components: { ...ident('Pip', 'creature-0004'), Description: { description: 'Glummer is no match.' } }, relations: [im('n_nichts')] },
  ];
}

async function aufbau() {
  const registry = { ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), campaign: 'camp_a' } };
  const repo = new InMemoryRepository(registry, bestand());
  const app = buildApp({ repo });
  const konto = async (name: string, roles: Record<string, 'gm' | 'player'>) =>
    repo.putUser({ id: randomUUID(), name, passwordHash: await hashPassword(PASSWORT), isAdmin: false, actorIds: [], roles });
  await konto('Gwen', { camp_a: 'gm' });
  await konto('Sela', { camp_a: 'player' });
  const get = async (name: string, url: string) => {
    const login = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
    const cookie = `nw_session=${login.cookies.find((x) => x.name === 'nw_session')?.value ?? ''}`;
    return app.inject({ method: 'GET', url, headers: { cookie } });
  };
  return { get };
}

describe('GET /api/glossary (T-242)', () => {
  it('legt die Wörter der App und die Glossarartikel im Stapel zusammen', async () => {
    const { get } = await aufbau();
    const r = await get('Sela', '/api/glossary');
    expect(r.statusCode).toBe(200);
    const terms = r.json().terms as GlossaryEntry[];
    const glum = terms.find((t) => t.id === 'g_glum')!;
    expect(glum).toMatchObject({
      term: 'Glum',
      number: 'glossaryterm-0001',
      aliases: ['Gloomy'],
      sort: 'condition',
      definition: 'Feeling low.',
      effect: 'You sigh a lot.',
      examples: ['The bard is glum.'],
      translations: [{ lang: 'de', term: 'Trübsinnig' }],
      autolink: true,
      article: true,
    });
    /* Das Ziel, das Spielende nicht sehen, steht nicht da. */
    expect(glum.explains).toEqual([{ id: 'c_glum', name: 'Glum' }]);
    expect(terms.some((t) => t.id === 'g_aus')).toBe(false);
    const ebene = terms.find((t) => t.id === 'app:layer')!;
    expect(ebene).toMatchObject({ sort: 'app', article: false, autolink: false });
    expect(terms.find((t) => t.id === 'app:creature')?.types).toEqual(['Creature']);
  });

  it('zeigt der Leitung auch das Ziel im Entwurf', async () => {
    const { get } = await aufbau();
    const glum = ((await get('Gwen', '/api/glossary')).json().terms as GlossaryEntry[]).find((t) => t.id === 'g_glum')!;
    expect(glum.explains.map((x) => x.id).sort()).toEqual(['c_geheim', 'c_glum']);
  });
});

describe('GET /api/glossary/:id/uses (T-242)', () => {
  it('zählt Nennungen als Wort, Alias und Verweis — nach dem Sieb', async () => {
    const { get } = await aufbau();
    const spieler = (await get('Sela', '/api/glossary/g_glum/uses')).json();
    expect(spieler.counted).toBe(true);
    expect(spieler.rows.map((x: { id: string }) => x.id).sort()).toEqual(['n_link', 'n_offen']);
    const leitung = (await get('Gwen', '/api/glossary/g_glum/uses')).json();
    expect(leitung.total).toBe(3);
    expect(leitung.rows.map((x: { id: string }) => x.id)).toContain('n_entwurf');
  });

  it('zählt die Wörter der App nicht und kennt keinen Begriff ausserhalb des Stapels', async () => {
    const { get } = await aufbau();
    expect((await get('Sela', '/api/glossary/app:layer/uses')).json()).toEqual({ counted: false, total: 0, rows: [] });
    expect((await get('Sela', '/api/glossary/g_aus/uses')).statusCode).toBe(404);
  });
});
