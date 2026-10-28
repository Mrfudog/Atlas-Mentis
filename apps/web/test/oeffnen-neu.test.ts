/**
 * Der erste Schaden nach dem Öffnen des Bogens (T-371): der Bogen öffnet
 * die Figur mit Rückbezügen; kommt das Speichern, bevor dieses erste Laden
 * fertig ist, fragte `oeffnen(id, true)` nicht neu, sondern bekam das noch
 * laufende Laden zurück — mit dem Stand von **vor** dem Speichern. Die
 * Anzeige blieb auf 34/34, obwohl der Server 30 hielt.
 *
 * Geprüft wird: `neu` holt immer neu, und ein älteres Laden, das später
 * ankommt, überschreibt das jüngere nicht.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Bestand } from '../src/app/kern/bestand';
import { LIVE_TRANSPORT } from '../src/app/kern/live';

const figur = (hp: number) => ({
  id: 'pc_barbar',
  interfaces: ['PlayerCharacter'],
  name: 'Test Barbar',
  components: { Identity: { name: 'Test Barbar' }, Vitals: { hp } },
  relations: [],
  refs: { names: {}, links: {} },
});

describe('opening anew while the first load still runs (T-371)', () => {
  let hpAmServer: number;
  let freigeben: (() => void)[];

  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
    hpAmServer = 34;
    freigeben = [];
    /* Jede Antwort hält den Stand zur Zeit der Anfrage fest und wartet, bis
       der Test sie freigibt — wie ein langsamer erster Abruf. */
    vi.stubGlobal('fetch', async (url: string) => {
      const body = url.endsWith('/backlinks') ? [] : figur(hpAmServer);
      await new Promise<void>((r) => freigeben.push(r));
      return { ok: true, status: 200, headers: new Headers(), text: async () => JSON.stringify(body) } as Response;
    });
    TestBed.configureTestingModule({ providers: [{ provide: LIVE_TRANSPORT, useValue: () => () => undefined }] });
  });

  const hp = (b: Bestand) => (b.voll().get('pc_barbar')?.components['Vitals'] as { hp: number } | undefined)?.hp;

  it('fetches again after a save, even while the first load is under way', async () => {
    const b = TestBed.inject(Bestand);
    /* Der Bogen öffnet die Figur (mit Rückbezügen) … */
    const erst = b.oeffnen('pc_barbar');
    await vi.waitFor(() => expect(freigeben).toHaveLength(2));
    /* … „− Damage" speichert 30, und danach wird neu geholt. */
    hpAmServer = 30;
    const danach = b.oeffnen('pc_barbar', true, false);
    await vi.waitFor(() => expect(freigeben).toHaveLength(3));
    /* Das jüngere Laden kommt zuerst an, das alte danach. */
    freigeben[2]!();
    await danach;
    expect(hp(b)).toBe(30);
    freigeben[0]!();
    freigeben[1]!();
    await erst;
    expect(hp(b)).toBe(30);
  });

  it('still shares one load when nothing asks for a fresh one', async () => {
    const b = TestBed.inject(Bestand);
    const a = b.oeffnen('pc_barbar');
    const c = b.oeffnen('pc_barbar');
    await vi.waitFor(() => expect(freigeben).toHaveLength(2));
    for (const f of freigeben) f();
    await Promise.all([a, c]);
    expect(hp(b)).toBe(34);
    expect(freigeben).toHaveLength(2);
  });
});
