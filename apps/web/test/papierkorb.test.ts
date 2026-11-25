/**
 * Die Seite „Deleted" (T-400): je Löschlauf eine Gruppe, Restore je Artikel
 * und je Lauf, „Empty trash" nur nach Rückfrage.
 */
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { Api, type KorbLauf } from '../src/app/kern/api';
import { Papierkorb } from '../src/app/papierkorb/papierkorb';

const lauf = (id: string, own: boolean, items: [string, boolean][]): KorbLauf => ({
  id,
  at: '2026-10-28T20:00:00.000Z',
  expires: '2026-11-27T20:00:00.000Z',
  by: { id: own ? 'u_me' : 'u_sela', name: own ? 'Mira' : 'Sela' },
  own,
  items: items.map(([name, restored]) => ({ id: `p_${name}`, name, type: 'Place', layers: [{ id: 'ly', name: 'Nebel' }], parts: 0, restored })),
});

async function erzeuge(api: Partial<Record<'trash' | 'restoreTrash' | 'emptyTrash', ReturnType<typeof vi.fn>>>) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: Api, useValue: api }] });
  const fixture = TestBed.createComponent(Papierkorb);
  const warte = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
  };
  await warte();
  return { el: fixture.nativeElement as HTMLElement, warte };
}

const knopf = (el: HTMLElement, text: string) =>
  [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === text || b.getAttribute('aria-label') === text) as HTMLButtonElement | undefined;

describe('nw-papierkorb (T-400)', () => {
  it('lists runs with their articles, restored ones linked, and who deleted others', async () => {
    const trash = vi.fn().mockResolvedValue({ days: 30, runs: [lauf('l1', true, [['Markt', false], ['Hafen', true]]), lauf('l2', false, [['Hütte', false]])] });
    const { el } = await erzeuge({ trash });
    expect(el.querySelectorAll('section.lauf')).toHaveLength(2);
    expect(el.textContent).toContain('by Sela');
    expect(el.textContent).toContain('also see what others deleted');
    expect(el.querySelector('li.zurueck a')?.textContent).toContain('Hafen');
    expect(knopf(el, 'Restore Markt')).toBeTruthy();
    expect(knopf(el, 'Restore Hafen')).toBeUndefined();
    /* „Restore all" nur, wo mehr als einer offen ist. */
    expect(knopf(el, 'Restore all')).toBeUndefined();
  });

  it('restores one article and reloads', async () => {
    const trash = vi.fn()
      .mockResolvedValueOnce({ days: 30, runs: [lauf('l1', true, [['Markt', false], ['Hafen', false]])] })
      .mockResolvedValueOnce({ days: 30, runs: [lauf('l1', true, [['Markt', false], ['Hafen', true]])] });
    const restoreTrash = vi.fn().mockResolvedValue({ restored: ['p_Hafen'], done: false });
    const { el, warte } = await erzeuge({ trash, restoreTrash });
    knopf(el, 'Restore Hafen')!.click();
    await warte();
    expect(restoreTrash).toHaveBeenCalledWith('l1', ['p_Hafen']);
    expect(el.querySelector('[role="status"]')?.textContent).toContain('Restored “Hafen”.');
    expect(el.querySelector('li.zurueck')?.textContent).toContain('Hafen');
  });

  it('empties the trash only after confirming', async () => {
    const trash = vi.fn().mockResolvedValue({ days: 30, runs: [lauf('l1', true, [['Markt', false]])] });
    const emptyTrash = vi.fn().mockResolvedValue({ emptied: 1 });
    const { el, warte } = await erzeuge({ trash, emptyTrash });
    const frage = vi.spyOn(globalThis, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    knopf(el, 'Empty trash')!.click();
    await warte();
    expect(emptyTrash).not.toHaveBeenCalled();
    knopf(el, 'Empty trash')!.click();
    await warte();
    expect(frage).toHaveBeenLastCalledWith(expect.stringMatching(/Delete 1 article for good/));
    expect(emptyTrash).toHaveBeenCalled();
    frage.mockRestore();
  });

  it('says so when nothing is deleted', async () => {
    const { el } = await erzeuge({ trash: vi.fn().mockResolvedValue({ days: 30, runs: [] }) });
    expect(el.textContent).toContain('Nothing deleted in the last 30 days.');
    expect(knopf(el, 'Empty trash')!.disabled).toBe(true);
  });
});
