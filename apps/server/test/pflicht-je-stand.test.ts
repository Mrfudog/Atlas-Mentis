/**
 * **Pflicht je Stand** (T-425, REQ-441, E-177, E-178): ein Feld, das für
 * `ready` Pflicht ist, verwehrt der Leitung `ready`, solange es leer ist —
 * beim Speichern und über `POST /api/entities/:id/ready` —, mit einer
 * Meldung, was zu tun ist. Wer `ready` schon hat, behält es. Ändert eine
 * Spielerin ihren fertigen Artikel, fällt er auf den höchsten Stand, den er
 * erreicht (D74).
 */
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity, Registry } from '@nw/model';
import { tisch } from './hilfen/tisch.js';

const id = (name: string, nr: string, status?: string) => ({
  Identity: { name, id: nr, aliases: [] },
  ...(status ? { Status: { status } } : {}),
});
const in_ = (x: string) => ({ id: `${x}~in`, type: 'inLayer', to: 'ly_a', props: {} });

/* Eine Kopie des Registers: Szenen brauchen für ready eine Beschreibung, für prepared einen Ort. */
function register(): Registry {
  const r = structuredClone(seedRegistry) as Registry;
  r.interfaces['Scene'] = { ...r.interfaces['Scene']!, requiredFor: { 'Description.description': 'ready' } };
  return r;
}

const ARTIKEL = (): Entity[] => [
  { id: 'ly_a', name: 'Runde A', interfaces: ['Layer'], components: { ...id('Runde A', 'layer-0001'), Layer: { kind: 'campaign', order: 50 } }, relations: [] },
  { id: 'camp_a', name: 'Nebel', interfaces: ['Campaign'], components: id('Nebel', 'campaign-0001'), relations: [{ id: 'camp_a~ac', type: 'activates', to: 'ly_a', props: { order: 10 } }] },
  { id: 'sc_leer', name: 'Bridge', interfaces: ['Scene'], components: id('Bridge', 'scene-0001', 'prepared'), relations: [in_('sc_leer')] },
  { id: 'sc_alt', name: 'Old mill', interfaces: ['Scene'], components: id('Old mill', 'scene-0002', 'ready'), relations: [in_('sc_alt')] },
];

const konten = { Mira: { roles: { camp_a: 'gm' as const } }, Sela: { roles: { camp_a: 'player' as const } } };

describe('Pflicht je Stand am Server (T-425, E-178)', () => {
  it('verwehrt der Leitung ready ohne Beschreibung und sagt, was fehlt; mit Beschreibung geht es', async () => {
    const t = await tisch({ kampagne: 'camp_a', artikel: ARTIKEL(), konten, registry: register() });
    const e = await t.json<Entity>('Mira', 'GET', '/api/entities/sc_leer');
    const ready = { ...e, components: { ...e.components, Status: { status: 'ready' } } };
    const nein = await t.als('Mira', 'PUT', '/api/entities/sc_leer', { payload: ready });
    expect(nein.statusCode).toBe(422);
    const issue = (nein.json() as { issues: { code: string; message: string }[] }).issues.find((i) => i.code === 'state_gaps');
    expect(issue?.message).toBe('To set ready, fill in: Description. Keep a lower state until then.');

    const knopf = await t.als('Mira', 'POST', '/api/entities/sc_leer/ready');
    expect(knopf.statusCode).toBe(422);
    expect((knopf.json() as { error: string }).error).toBe('To set ready, fill in: Description. Keep a lower state until then.');

    const voll = { ...ready, components: { ...ready.components, Description: { description: 'A rope bridge over the gorge.' } } };
    const ja = await t.als('Mira', 'PUT', '/api/entities/sc_leer', { payload: voll });
    expect(ja.statusCode).toBe(200);
  });

  it('wer ready schon hat, behält es — die Werkbank listet ihn unter Ready with gaps', async () => {
    const t = await tisch({ kampagne: 'camp_a', artikel: ARTIKEL(), konten, registry: register() });
    const e = await t.json<Entity>('Mira', 'GET', '/api/entities/sc_alt');
    const ok = await t.als('Mira', 'PUT', '/api/entities/sc_alt', { payload: { ...e, name: 'Old mill (burnt)' } });
    expect(ok.statusCode).toBe(200);
    const pruefung = await t.json<{ checks: { key: string; hits: { id: string }[] }[] }>('Mira', 'GET', '/api/checks?check=readyWithGaps');
    expect(pruefung.checks.find((c) => c.key === 'readyWithGaps')?.hits.map((h) => h.id)).toContain('sc_alt');
  });

  it('ändert die Spielerin ihren fertigen Artikel, fällt er auf den höchsten erreichbaren Stand', async () => {
    const r = register();
    r.interfaces['Scene'] = { ...r.interfaces['Scene']!, requiredFor: { 'Description.description': 'prepared' } };
    const t = await tisch({ kampagne: 'camp_a', artikel: ARTIKEL(), konten, registry: r });
    await t.repo.addAuthored(t.ids.get('Sela')!, 'sc_alt');
    const e = await t.json<Entity>('Sela', 'GET', '/api/entities/sc_alt');
    const put = await t.als('Sela', 'PUT', '/api/entities/sc_alt', { payload: { ...e, name: 'Old mill, haunted' } });
    expect(put.statusCode).toBe(200);
    /* prepared verlangt die Beschreibung: also idea, nicht prepared. */
    expect((await t.repo.getEntity('sc_alt'))?.components?.['Status']).toEqual({ status: 'idea' });
  });

  /* T-436, E-176: die Figur entsteht im Assistenten gleich; ein offener
     Entscheid hält sie auf idea, auch für die Spielerin, die sie sonst
     selbst fertig setzt (D74). */
  it('ein offener Entscheid der Figur verwehrt den Aufstieg, beantwortet geht es', async () => {
    const klasse: Entity = {
      id: 'cl_f', name: 'Fighter', interfaces: ['Class'],
      components: { ...id('Fighter', 'class-0001', 'ready'), Choices: { choices: [{ id: 'skills', kind: 'proficiency', count: 1, from: { values: ['Athletics', 'Survival'] } }] } },
      relations: [in_('cl_f')],
    };
    const figur: Entity = {
      id: 'pc_t', name: 'Thorin', interfaces: ['PlayerCharacter'],
      components: id('Thorin', 'pc-0001', 'idea'),
      relations: [in_('pc_t'), { id: 'pc_t~k', type: 'hasClass', to: 'cl_f', props: { level: 1 } }],
    };
    const t = await tisch({
      kampagne: 'camp_a', artikel: [...ARTIKEL(), klasse, figur], registry: register(),
      konten: { ...konten, Sela: { ...konten.Sela, actorIds: ['pc_t'] } },
    });
    const e = await t.json<Entity>('Sela', 'GET', '/api/entities/pc_t');
    const ready = { ...e, components: { ...e.components, Status: { status: 'ready' } } };
    const nein = await t.als('Sela', 'PUT', '/api/entities/pc_t', { payload: ready });
    expect(nein.statusCode).toBe(422);
    const issue = (nein.json() as { issues: { code: string; message: string }[] }).issues.find((i) => i.code === 'state_gaps');
    expect(issue?.message).toBe('To set ready, decide: Fighter · Skill proficiencies. Keep a lower state until then.');

    const gewaehlt = { ...ready, relations: [...(ready.relations ?? []), { id: 'pc_t~w', type: 'chose', to: 'cl_f', props: { choice: 'skills', picks: ['Survival'] } }] };
    const ja = await t.als('Sela', 'PUT', '/api/entities/pc_t', { payload: gewaehlt });
    expect(ja.statusCode).toBe(200);
  });
});
