import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
// @ts-expect-error — ein Skript ohne Typen, wie die übrigen unter scripts/
import { leseAnforderungen, leseFrontmatter, leseStoryBody, satz, schreibeFrontmatter, schreibeStory } from '../scripts/stories-lib.mjs';

/* T-154: die Anforderungen sind Notizen im Vault. Bricht eine — Story ohne
   Feature, Verweis ins Leere, doppelte Nummer —, bricht dieser Test, nicht
   erst die Übersicht, die am nächsten Tag jemand erzeugt. */
describe('Anforderungen als Stories (T-154)', () => {
  const { epics, features, stories, fehler } = leseAnforderungen(resolve(__dirname, '..', '..', '..'));

  it('reads every note without a break', () => {
    expect(fehler).toEqual([]);
    expect(epics.length).toBeGreaterThan(0);
    expect(features.every((f: { epicId: string }) => f.epicId)).toBe(true);
  });

  it('keeps the numbers without gaps — nothing is deleted, only dropped', () => {
    const nummern = stories.map((s: { id: string }) => Number(s.id.slice(4)));
    expect(nummern).toEqual(nummern.map((_: number, i: number) => i + 1));
  });

  it('words every story that still counts as a story, with acceptance criteria', () => {
    const offen = stories
      .filter((s: { status: string }) => s.status !== 'dropped')
      .filter((s: { rolle: string | null; satz: string; akzeptanz: string[] }) => !s.rolle || !s.satz.startsWith('**Als**') || !s.akzeptanz.length)
      .map((s: { id: string }) => s.id);
    expect(offen).toEqual([]);
  });

  it('round-trips a note through frontmatter and body', () => {
    const fm = { id: 'REQ-999', title: 'Eigenes Token bewegen', typ: 'story', abhaengig: ['REQ-206'], prio: 2, v1: null };
    const teile = { satz: satz('Spieler', 'mein Token verschieben', 'meine Bewegung widergespiegelt wird'), akzeptanz: ['Nur eigene Tokens.'], anmerkungen: 'Notiz', wortlaut: 'alt' };
    const text = schreibeStory(fm, teile);
    const { fm: fm2, body } = leseFrontmatter(text);
    expect(fm2).toMatchObject({ id: 'REQ-999', abhaengig: ['REQ-206'], prio: 2, v1: null });
    expect(leseStoryBody(body)).toEqual(teile);
    expect(schreibeFrontmatter({ title: 'a "b"' }, 'story')).toContain('title: "a \\"b\\""');
  });
});
