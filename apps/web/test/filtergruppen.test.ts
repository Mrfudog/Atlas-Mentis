/**
 * Filtergruppen je Seite (T-137): welche Gruppe auf einer Seite gilt.
 * Ohne `view` die Vorgabe, mit `view=all` keine — und eine Gruppe einer
 * anderen Seite gilt hier nie, auch wenn jemand ihre Id in die Adresse
 * tippt.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ALLE, Filtergruppen } from '../src/app/kern/filtergruppen';
import { ListenFilter } from '../src/app/kern/filter';

const gruppe = (id: string, page: string, extra: Record<string, unknown> = {}) => ({
  id,
  page,
  name: id,
  scope: 'campaign',
  filter: {},
  default: false,
  rank: 0,
  canEdit: true,
  ...extra,
});

describe('Filtergruppen', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
    vi.stubGlobal('fetch', async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          campaign: 'camp_a',
          canManage: true,
          groups: [
            gruppe('ohne-items', 'world', { default: true, filter: { notype: ['Item'] } }),
            gruppe('orte', 'world', { filter: { of: ['Place'], q: 'fog' } }),
            gruppe('zauber', 'rules'),
          ],
        }),
    }));
  });

  it('picks the default, a named group or none', async () => {
    const g = TestBed.inject(Filtergruppen);
    await g.laden();
    expect(g.aktiv('world', undefined)?.id).toBe('ohne-items');
    expect(g.aktiv('world', 'orte')?.id).toBe('orte');
    expect(g.aktiv('world', ALLE)).toBeNull();
    expect(g.aktiv('world', 'zauber')).toBeNull();
    expect(g.aktiv('story', undefined)).toBeNull();
    expect(g.jeSeite('world').map((x) => x.id)).toEqual(['ohne-items', 'orte']);
  });

  it('seeds the sidebar once per group, then the page owns it', () => {
    const f = TestBed.inject(ListenFilter);
    f.betrete('world|orte');
    f.saeen('orte', { q: 'fog', f: ['Place.kind:city'] });
    expect(f.suche()).toBe('fog');
    expect(f.felder()).toEqual({ 'Place.kind': { values: ['city'] } });
    f.suche.set('gate');
    /* Zurück vom Artikel: dieselbe Gruppe sät nicht noch einmal. */
    f.betrete('world|orte');
    f.saeen('orte', { q: 'fog' });
    expect(f.suche()).toBe('gate');
    /* Ein anderer Reiter fängt neu an. */
    f.betrete('world|');
    f.saeen('ohne-items', {});
    expect(f.suche()).toBe('');
  });
});
