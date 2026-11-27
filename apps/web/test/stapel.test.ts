/**
 * Kampagne und Ebenen in der Kopfleiste (T-143): der Knopf nennt die
 * laufende Kampagne und wie viele Ebenen im Spiel sind; das Popup sagt
 * Spielenden, dass die Leitung wählt, und schliesst mit Escape. Ein
 * Häkchen zählt `stand` weiter — daran fragen die Listen neu.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LIVE_TRANSPORT } from '../src/app/kern/live';
import { Stapel } from '../src/app/kern/stapel';
import { StapelKnopf } from '../src/app/verwaltung/stapel-knopf';

let antwort: unknown;
/* Die Schreibebene (T-161): eine Spielerin mit ihrer Spielerebene als Vorgabe. */
const schreib = {
  campaign: { id: 'camp', name: 'Aus Nebel wacht' },
  layer: { id: 'ly_sela', name: 'Sela · Aus Nebel wacht' },
  default: { id: 'ly_sela', name: 'Sela · Aus Nebel wacht' },
  chosen: false,
  dropped: null,
  none: false,
  options: [
    { id: 'ly_sela', name: 'Sela · Aus Nebel wacht', reason: 'player', selectable: true },
    { id: 'ly_notizen', name: 'Notes', reason: 'owner', selectable: false, why: 'Not switched on in this campaign.' },
  ],
};
const gefragt: string[] = [];
/* Die eigene Sicht (T-496, REQ-412): zwei Ebenen der Kampagne und eine dritte zum freien Wählen. */
let sicht: Record<string, unknown>;
const gesendet: { url: string; method: string; body: unknown }[] = [];
const sichtVon = (o: Record<string, unknown> = {}) => ({
  campaign: { id: 'camp', name: 'Aus Nebel wacht' },
  mode: 'campaign',
  hide: [],
  mine: [],
  stack: [
    { id: 'ly_rules', name: 'Rules', group: false, inCampaign: true },
    { id: 'ly_camp', name: 'Aus Nebel wacht', group: false, inCampaign: true },
  ],
  layers: [
    { id: 'ly_rules', name: 'Rules', group: false, inCampaign: true },
    { id: 'ly_camp', name: 'Aus Nebel wacht', group: false, inCampaign: true },
    { id: 'ly_extra', name: 'Extra', group: false, inCampaign: false },
  ],
  ...o,
});

describe('the campaign in the bar (T-143)', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
    gefragt.length = 0;
    gesendet.length = 0;
    sicht = sichtVon();
    antwort = {
      campaigns: [],
      canCreate: false,
      isAdmin: false,
      current: { id: 'camp', name: 'Aus Nebel wacht', role: 'player', may: null, layers: 4 },
    };
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      gefragt.push(url);
      const method = init?.method ?? 'GET';
      const gesandt = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
      if (method !== 'GET') gesendet.push({ url, method, body: gesandt });
      if (url === '/api/me/view' && method === 'PUT') sicht = sichtVon(gesandt);
      const body = url === '/api/layers/write' ? schreib : url === '/api/me/view' ? sicht : url === '/api/me/campaign' ? { ok: true } : antwort;
      return { ok: true, status: 200, headers: new Headers(), text: async () => JSON.stringify(body) } as Response;
    });
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: LIVE_TRANSPORT, useValue: () => () => undefined }],
    });
  });

  it('names the running campaign and its layers, and tells a player who chooses', async () => {
    await TestBed.inject(Stapel).laden();
    const f = TestBed.createComponent(StapelKnopf);
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    const knopf = el.querySelector<HTMLButtonElement>('.knopf')!;
    expect(knopf.textContent).toContain('Aus Nebel wacht');
    expect(knopf.textContent).toContain('4 layers');
    /* Wohin geschrieben wird, steht immer da (T-161). */
    expect(knopf.textContent).toContain('Sela · Aus Nebel wacht');
    knopf.click();
    /* Der Inhalt der Reiter kommt nachgeladen (P6). */
    await vi.waitFor(async () => {
      await f.whenStable();
      expect(el.querySelector('[role="dialog"]')?.textContent).toContain('The GM chooses which');
    });
    const wahl = el.querySelector('.schreibwahl')!;
    expect(wahl.textContent).toContain('Your player layer');
    /* Die Vorgabe steht einmal; was nicht im Spiel ist, ist nicht wählbar und sagt warum. */
    const radios = [...wahl.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    expect(radios.map((r) => [r.checked, r.disabled])).toEqual([
      [true, false],
      [false, true],
    ]);
    expect(wahl.textContent).toContain('Not switched on in this campaign.');
    /* Die Ebenenliste fragt nur, wer sie sehen darf. */
    expect(el.querySelector('nw-kampagnen-ebenen')).toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await f.whenStable();
    expect(el.querySelector('[role="dialog"]')).toBeNull();
  });

  it('counts every change, so the lists ask again, and fetches the count anew', async () => {
    const s = TestBed.inject(Stapel);
    await s.laden();
    const vorher = s.stand();
    antwort = { ...(antwort as object), current: { id: 'camp', name: 'Aus Nebel wacht', role: 'gm', may: 'manage', layers: 1 } };
    s.geaendert();
    expect(s.stand()).toBe(vorher + 1);
    await vi.waitFor(() => expect(s.laufend()?.layers).toBe(1));
    expect(gefragt.filter((u) => u === '/api/campaigns')).toHaveLength(2);
  });

  it('narrows the campaign view for me only, and resets it (REQ-412)', async () => {
    await TestBed.inject(Stapel).laden();
    const f = TestBed.createComponent(StapelKnopf);
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>('.knopf')!.click();
    await vi.waitFor(() => expect(el.querySelector('nw-meine-sicht fieldset')).not.toBeNull());
    await f.whenStable();
    const tabs = [...el.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    expect(tabs.map((t) => [t.textContent?.trim(), t.getAttribute('aria-selected')])).toEqual([
      ['Campaign view', 'true'],
      ['My view', 'false'],
    ]);
    const haken = [...el.querySelectorAll<HTMLInputElement>('nw-meine-sicht input[type="checkbox"]')];
    expect(haken.map((h) => h.checked)).toEqual([true, true]);
    haken[0]!.click();
    await vi.waitFor(() => expect(gesendet.at(-1)).toEqual({ url: '/api/me/view', method: 'PUT', body: { mode: 'campaign', hide: ['ly_rules'] } }));
    await f.whenStable();
    expect(el.querySelector('nw-meine-sicht')?.textContent).toContain('1 hidden for you');
    /* Die Kampagne selbst schaltet dieser Knopf nicht: kein Schreiben an ihr. */
    expect(gesendet.some((g) => g.url.startsWith('/api/campaigns/'))).toBe(false);
    const reset = [...el.querySelectorAll<HTMLButtonElement>('nw-meine-sicht button')].find((b) => b.textContent?.trim() === 'Reset')!;
    reset.click();
    await vi.waitFor(() => expect(gesendet.at(-1)?.body).toEqual({ mode: 'campaign', hide: [] }));
  });

  it('“My view” starts from the campaign’s layers, then takes any readable one', async () => {
    await TestBed.inject(Stapel).laden();
    const f = TestBed.createComponent(StapelKnopf);
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>('.knopf')!.click();
    await vi.waitFor(() => expect(el.querySelector('nw-meine-sicht fieldset')).not.toBeNull());
    el.querySelectorAll<HTMLButtonElement>('[role="tab"]')[1]!.click();
    await vi.waitFor(() => expect(gesendet.at(-1)?.body).toEqual({ mode: 'mine', mine: ['ly_rules', 'ly_camp'] }));
    const finde = () => [...el.querySelectorAll<HTMLLabelElement>('nw-meine-sicht label.option')].find((l) => l.textContent?.includes('Extra'));
    await vi.waitFor(async () => {
      await f.whenStable();
      expect(finde()).toBeDefined();
    });
    const extra = finde()!;
    expect(extra.textContent).toContain('not in this campaign');
    extra.querySelector('input')!.click();
    await vi.waitFor(() => expect(gesendet.at(-1)?.body).toEqual({ mode: 'mine', mine: ['ly_rules', 'ly_camp', 'ly_extra'] }));
  });

  it('lets a player with two campaigns switch for her account only (REQ-408)', async () => {
    antwort = {
      ...(antwort as object),
      choices: [
        { id: 'camp', name: 'Aus Nebel wacht', role: 'player' },
        { id: 'camp2', name: 'Der Salzpfad', role: 'player' },
      ],
      default: 'camp',
    };
    await TestBed.inject(Stapel).laden();
    const f = TestBed.createComponent(StapelKnopf);
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>('.knopf')!.click();
    await vi.waitFor(async () => {
      await f.whenStable();
      expect(el.querySelector('.wahl select')).not.toBeNull();
    });
    const wahl = el.querySelector<HTMLSelectElement>('.wahl select')!;
    expect([...wahl.options].map((o) => o.textContent?.trim())).toEqual(['Aus Nebel wacht (player)', 'Der Salzpfad (player)']);
    expect(el.textContent).toContain('Only for your account');
    /* Den Knopf für die Vorgabe der Installation hat nur die Verwaltung. */
    expect(el.textContent).not.toContain('Make this the default');
    wahl.value = 'camp2';
    wahl.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(gesendet.at(-1)).toEqual({ url: '/api/me/campaign', method: 'PUT', body: { id: 'camp2' } }));
  });

  it('marks my own view in the bar', async () => {
    antwort = { ...(antwort as object), current: { id: 'camp', name: 'Aus Nebel wacht', role: 'player', may: null, layers: 1, view: 'mine' } };
    await TestBed.inject(Stapel).laden();
    const f = TestBed.createComponent(StapelKnopf);
    await f.whenStable();
    expect((f.nativeElement as HTMLElement).querySelector('.knopf .sichtmarke')?.textContent).toBe('my view');
  });

  it('shows nothing without a running campaign', async () => {
    antwort = { campaigns: [], canCreate: false, isAdmin: false, current: null };
    await TestBed.inject(Stapel).laden();
    const f = TestBed.createComponent(StapelKnopf);
    await f.whenStable();
    expect((f.nativeElement as HTMLElement).querySelector('.knopf')).toBeNull();
  });
});
