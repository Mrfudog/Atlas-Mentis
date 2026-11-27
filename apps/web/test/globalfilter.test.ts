/**
 * **Der Globalfilter** (REQ-408, REQ-412, T-496): im Popup der Kopfleiste
 * wählt ein Konto seine Kampagne und filtert für sich — Campaign view
 * nimmt aus dem Stapel heraus, My view stellt lesbare Ebenen zusammen,
 * „Reset“ stellt den Stapel der Kampagne her. Geschrieben wird nur an
 * `/api/me/…`, nie an die Kampagne.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LIVE_TRANSPORT } from '../src/app/kern/live';
import { Stapel } from '../src/app/kern/stapel';
import { Globalfilter } from '../src/app/verwaltung/globalfilter';

interface Ruf {
  url: string;
  method: string;
  body: unknown;
}
const gerufen: Ruf[] = [];
let sicht: Record<string, unknown>;
const kampagnen = () => ({
  campaigns: [],
  canCreate: false,
  isAdmin: false,
  choices: [
    { id: 'camp', name: 'Aus Nebel wacht', role: 'player' },
    { id: 'salz', name: 'Der Salzpfad', role: 'gm' },
  ],
  defaultCampaign: 'camp',
  chosen: false,
  current: { id: 'camp', name: 'Aus Nebel wacht', role: 'player', may: null, layers: 3, campaignLayers: 3, view: null },
});
const grund = () => ({
  campaign: { id: 'camp', name: 'Aus Nebel wacht' },
  mode: 'campaign',
  off: [],
  layers: [],
  fixed: 'ly_nebel',
  stack: [
    { id: 'ly_nebel', name: 'Nebel', group: false, inCampaign: true },
    { id: 'ly_regeln', name: 'Regeln', group: false, inCampaign: true },
  ],
  available: [
    { id: 'ly_nebel', name: 'Nebel', group: false, inCampaign: true },
    { id: 'ly_regeln', name: 'Regeln', group: false, inCampaign: true },
    { id: 'ly_frei', name: 'Bestiarium', group: false, inCampaign: false },
  ],
});

describe('the global filter (REQ-412)', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
    gerufen.length = 0;
    sicht = grund();
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      gerufen.push({ url, method, body });
      let raus: unknown = { ok: true };
      if (url === '/api/campaigns') raus = kampagnen();
      else if (url === '/api/me/layer-view' && method === 'PUT') {
        const b = body as { mode: string; off?: string[]; layers?: string[] };
        sicht = { ...sicht, mode: b.mode, off: b.off ?? [], layers: b.layers ?? [] };
        raus = sicht;
      } else if (url === '/api/me/layer-view' && method === 'DELETE') raus = sicht = grund();
      else if (url === '/api/me/layer-view') raus = sicht;
      else if (url === '/api/me/layer-sets') raus = { sets: [{ id: 's1', name: 'Nur Regeln', campaign: null, layers: ['ly_regeln'], off: [], savedAt: '' }] };
      return { ok: true, status: 200, headers: new Headers(), text: async () => JSON.stringify(raus) } as Response;
    });
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: LIVE_TRANSPORT, useValue: () => () => undefined }],
    });
  });

  async function aufbau() {
    await TestBed.inject(Stapel).laden();
    const f = TestBed.createComponent(Globalfilter);
    await vi.waitFor(() => expect(gerufen.some((r) => r.url === '/api/me/layer-view')).toBe(true));
    await f.whenStable();
    f.detectChanges();
    return { f, el: f.nativeElement as HTMLElement };
  }
  const haken = (el: HTMLElement, text: string) =>
    [...el.querySelectorAll<HTMLLabelElement>('label.option')].find((l) => l.textContent?.includes(text))!.querySelector('input')!;

  it('lets an account choose among its campaigns, only for itself', async () => {
    const { f, el } = await aufbau();
    const wahl = el.querySelector<HTMLSelectElement>('.wahl select')!;
    expect([...wahl.options].map((o) => o.textContent?.trim())).toEqual(['Aus Nebel wacht (player)', 'Der Salzpfad (gm)']);
    expect(el.textContent).toContain('Only for you');
    wahl.value = 'salz';
    wahl.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(gerufen.some((r) => r.url === '/api/me/campaign' && r.method === 'PUT')).toBe(true));
    expect(gerufen.find((r) => r.url === '/api/me/campaign')?.body).toEqual({ id: 'salz' });
    expect(gerufen.some((r) => r.url === '/api/campaigns/current')).toBe(false);
    await f.whenStable();
  });

  it('narrows the campaign view, keeps the campaign layer, and resets', async () => {
    const { f, el } = await aufbau();
    expect(el.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toContain('Campaign view');
    expect(haken(el, 'Nebel').disabled).toBe(true);
    haken(el, 'Regeln').click();
    await vi.waitFor(() => expect(gerufen.some((r) => r.method === 'PUT' && r.url === '/api/me/layer-view')).toBe(true));
    expect(gerufen.find((r) => r.method === 'PUT')?.body).toEqual({ mode: 'campaign', off: ['ly_regeln'] });
    await f.whenStable();
    f.detectChanges();
    expect(el.textContent).toContain('1 hidden for you');
    /* Geschrieben wird nie an die Kampagne. */
    expect(gerufen.some((r) => r.url.startsWith('/api/campaigns/') && r.method !== 'GET')).toBe(false);
    [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === 'Reset')!.click();
    await vi.waitFor(() => expect(gerufen.some((r) => r.method === 'DELETE')).toBe(true));
  });

  it('builds my view from readable layers, marked outside the campaign, and loads a saved selection', async () => {
    const { f, el } = await aufbau();
    [...el.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((b) => b.textContent?.includes('My view'))!.click();
    f.detectChanges();
    expect(el.textContent).toContain('Outside the campaign');
    expect(haken(el, 'Bestiarium').closest('label')?.textContent).toContain('not in campaign');
    haken(el, 'Bestiarium').click();
    await vi.waitFor(() => expect(gerufen.some((r) => r.method === 'PUT' && r.url === '/api/me/layer-view')).toBe(true));
    expect(gerufen.find((r) => r.method === 'PUT')?.body).toEqual({ mode: 'mine', layers: ['ly_regeln', 'ly_frei'] });
    /* Eine gespeicherte Auswahl lädt in My view, nicht in die Kampagne. */
    const sets = el.querySelector<HTMLDetailsElement>('details.sets')!;
    sets.open = true;
    sets.dispatchEvent(new Event('toggle'));
    await vi.waitFor(() => expect(gerufen.some((r) => r.url === '/api/me/layer-sets')).toBe(true));
    await f.whenStable();
    f.detectChanges();
    [...el.querySelectorAll<HTMLButtonElement>('.set button')].find((b) => b.textContent?.includes('Nur Regeln'))!.click();
    await vi.waitFor(() => expect(gerufen.filter((r) => r.method === 'PUT').at(-1)?.body).toEqual({ mode: 'mine', layers: ['ly_regeln'] }));
    expect(gerufen.some((r) => r.url.startsWith('/api/campaigns/') && r.method !== 'GET')).toBe(false);
  });
});
