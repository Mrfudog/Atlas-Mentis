import { describe, expect, it } from 'vitest';
import type { Entity } from '@nw/model';
import { readingOrder } from '@nw/model';
import type { Knoten } from '../src/copy.js';
import type { Datenstand } from '../src/lesen.js';
import { lauf } from '../src/lauf.js';
import { kapitelTitel } from '../src/arten/buch.js';
import { buchEbeneId } from '../src/werkbank.js';

/**
 * Ein erfundenes Regelbuch in der Form von 5e.tools (T-108) — keine Daten
 * von dort: ein Kapitel mit Überschriften in drei Tiefen, einem Kasten,
 * einer Tabelle, die schon eine `Table` ist, einem eingebetteten Zauber
 * und einem Abschnitt, der schon eine Regel ist.
 */
function datenstand(ohneBilder = false): Datenstand {
  const arten = new Map<string, Knoten[]>();
  arten.set('spell', [{ name: 'Sleep', source: 'TRB', level: 1, school: 'E', entries: ['Zzz.'] }]);
  arten.set('condition', [{ name: 'Dazed', source: 'TRB', entries: ['You are dazed.'] }]);
  arten.set('table', [{ name: 'Weather', source: 'TRB', colLabels: ['d6', 'Weather'], rows: [['1', 'Rain']] }]);
  const daten: Knoten[] = [
    {
      type: 'section', name: 'Fighting', id: '000', page: 10,
      entries: [
        'Combat is quick. Cast {@spell sleep|TRB} if you must.',
        { type: 'inset', name: 'Step by Step', entries: ['Roll initiative.'] },
        {
          type: 'entries', name: 'Order', id: '001', page: 11,
          entries: [
            'First this.',
            { type: 'entries', name: 'Surprise', entries: ['Maybe.', { type: 'entries', name: 'Deep', entries: ['Very deep.'] }] },
          ],
        },
        { type: 'table', caption: 'Weather', colLabels: ['d6', 'Weather'], rows: [['1', 'Rain']] },
        { type: 'statblock', tag: 'spell', name: 'Sleep', source: 'TRB' },
        { type: 'entries', name: 'Dazed', entries: ['You are dazed.'] },
        { type: 'image', href: { type: 'internal', path: 'book/TRB/art.webp' }, title: 'A Duel', credit: 'Someone' },
        { type: 'gallery', images: [{ type: 'image', href: { type: 'internal', path: 'book/TRB/g1.webp' } }, { type: 'image', href: { type: 'external', url: 'https://example.org/x.png' } }] },
        { type: 'insetReadaloud', entries: ['Hear me.'] },
      ],
    },
    {
      type: 'section', name: 'Appendix A: Odds', id: '002', page: 20,
      entries: ['Odd.', { type: 'inset', name: 'Aside', entries: ['Look.', { type: 'image', href: { type: 'internal', path: 'book/TRB/inset.webp' } }] }],
    },
    { type: 'section', name: 'Credits', id: '003', entries: ['Thanks.'] },
  ];
  /* Dasselbe Buch ohne Bilder: so stand es vor T-210 auf dev. */
  const ohne = (x: unknown): unknown =>
    Array.isArray(x)
      ? x.filter((y) => !(y && typeof y === 'object' && ['image', 'gallery'].includes(String((y as Knoten)['type'])))).map(ohne)
      : x && typeof x === 'object'
        ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, ohne(v)]))
        : x;
  return {
    arten,
    quellen: new Map([['trb', { id: 'TRB', name: 'The Rule Book', published: '2015-01-01', art: 'book' }]]),
    buecher: new Map([
      ['trb', {
        id: 'TRB',
        kopf: {
          name: 'The Rule Book', id: 'TRB', source: 'TRB',
          contents: [{ name: 'Fighting', ordinal: { type: 'chapter', identifier: 9 } }, { name: 'Appendix A: Odds', ordinal: { type: 'appendix', identifier: 'A' } }, { name: 'Credits' }],
        },
        daten: ohneBilder ? (ohne(daten) as Knoten[]) : daten,
      }],
    ]),
  };
}

const art = (e: Entity) => e.interfaces[0];
const teileVon = (es: Entity[], ganzes: Entity) =>
  es
    .map((e) => ({ e, r: (e.relations ?? []).find((x) => x.type === 'partOf' && x.to === ganzes.id) }))
    .filter((x) => x.r)
    .sort((a, b) => Number(a.r!.props?.['rank']) - Number(b.r!.props?.['rank']))
    .map((x) => x.e);

describe('Bücher als Kapitel aus Teilen (T-108)', () => {
  const { entities } = lauf(datenstand()).datei;
  const kapitel = entities.filter((e) => art(e) === 'Chapter');

  it('legt je Kapitel ein Chapter in der Ebene des Buchs an, ohne Credits', () => {
    expect(kapitel.map((k) => k.name)).toEqual(['Chapter 9: Fighting', 'Appendix A: Odds']);
    expect(kapitel[0]!.components['Chapter']).toEqual({ ordinal: 'Chapter 9' });
    expect(kapitel.every((k) => k.relations?.some((r) => r.type === 'inLayer' && r.to === buchEbeneId('TRB')))).toBe(true);
    /* Kein Vorbereitungsstand an Kapitel und Teilen. */
    expect(kapitel[0]!.components['Status']).toBeUndefined();
  });

  it('zerlegt den Text in Teile nach Rang, Überschriften bis zur dritten Stufe', () => {
    const t = teileVon(entities, kapitel[0]!);
    expect(t.map((e) => `${art(e)}:${art(e) === 'Heading' ? `${String(e.components['Heading']?.['level'])} ${e.name}` : ''}`)).toEqual([
      'Paragraph:',
      'Paragraph:',
      'Heading:2 Order',
      'Paragraph:',
      'Heading:3 Surprise',
      'Paragraph:',
      'Paragraph:',
      'Embed:',
      'Embed:',
      'Embed:',
      'Illustration:',
      'Illustration:',
      'ReadAloudText:',
    ]);
    /* Ein Verweis im Absatz nennt die Nummer; der Kasten ist eine Randnotiz. */
    expect(String(t[0]!.components['Prose']?.['paragraph'] && (t[0]!.components['Prose']['paragraph'] as { value: string }[])[0]!.value)).toMatch(/\[\[spell-\d+\|sleep\]\]/i);
    expect(t[1]!.components['Paragraph']).toEqual({ kind: 'sidebar' });
    /* Tiefer als drei: der Name als fetter Satzanfang. */
    expect((t[6]!.components['Prose']?.['paragraph'] as { value: string }[])[0]!.value).toMatch(/^\*\*Deep\.\*\* Very deep\./);
  });

  it('verdoppelt nichts, was schon ein Artikel ist', () => {
    const embeds = teileVon(entities, kapitel[0]!).filter((e) => art(e) === 'Embed');
    const ziele = embeds.map((e) => entities.find((x) => x.id === e.components['Embed']?.['target']));
    expect(ziele.map((z) => `${art(z!)} ${z!.name}`)).toEqual(['Table Weather', 'Spell Sleep', 'Condition Dazed']);
  });

  it('liest sich in der Leseansicht in derselben Reihenfolge', () => {
    const o = readingOrder(entities, buchEbeneId('TRB'));
    expect(o.filter((n) => n.toc !== false).map((n) => entities.find((e) => e.id === n.id)!.name)).toEqual([
      'Chapter 9: Fighting', 'Order', 'Surprise', 'Appendix A: Odds',
    ]);
  });

  it('schreibt bei zwei Läufen dieselben Ids', () => {
    const zweiter = lauf(datenstand()).datei.entities.filter((e) => ['Chapter', 'Paragraph', 'Heading', 'Embed'].includes(art(e))).map((e) => e.id);
    expect(zweiter).toEqual(entities.filter((e) => ['Chapter', 'Paragraph', 'Heading', 'Embed'].includes(art(e))).map((e) => e.id));
  });

  it('nennt den Buchtext eines 2014-Buchs als Neuzugang, seine Artikel nicht (T-145)', () => {
    const { datei } = lauf(datenstand());
    const neu = new Set(datei.additions);
    const text = datei.entities.filter((e) => ['Chapter', 'Heading', 'Paragraph', 'ReadAloudText', 'Embed', 'Illustration'].includes(art(e)));
    expect(text.length).toBeGreaterThan(10);
    for (const e of text) expect(neu.has(e.id), `${art(e)} ${e.name}`).toBe(true);
    /* Was der Text einbettet, ist Grundstand und bleibt draussen. */
    for (const t of ['Spell', 'Condition', 'Table']) {
      for (const e of datei.entities.filter((x) => art(x) === t)) expect(neu.has(e.id), `${t} ${e.name}`).toBe(false);
    }
  });

  it('setzt ein Bild im Text als Teil mit Rang zwischen zwei bestehenden (T-210)', () => {
    const t = teileVon(entities, kapitel[0]!);
    const bilder = t.filter((e) => art(e) === 'Illustration');
    const rang = (e: Entity) => Number(e.relations!.find((r) => r.type === 'partOf')!.props?.['rank']);
    /* Hinter dem dritten Verweis (Rang 10), vor dem Vorlesetext (Rang 11). */
    expect(bilder.map(rang)).toEqual([10.001, 10.002]);
    expect(bilder[0]!.name).toBe('A Duel');
    expect(bilder[0]!.components['Image']).toEqual({ caption: 'A Duel · Art by Someone', alt: 'A Duel' });
    /* Ohne Titel heisst es nach seinem Ganzen; die Datei kommt erst mit dem Hochladen. */
    expect(bilder[1]!.name).toBe('Chapter 9: Fighting (illustration)');
    expect(bilder[1]!.components['Image']?.['image']).toBeUndefined();
    /* Ein Bild in einem Kasten steht dahinter. */
    const anhang = teileVon(entities, kapitel[1]!);
    expect(anhang.map((e) => art(e))).toEqual(['Paragraph', 'Paragraph', 'Illustration']);
  });

  it('ändert an den übrigen Teilen nichts — Ids, Ränge und Text wie ohne Bilder (T-210)', () => {
    const ohne = lauf(datenstand(true)).datei.entities;
    const kurz = (es: Entity[]) =>
      es.filter((e) => art(e) !== 'Illustration').map((e) => JSON.stringify([e.id, e.components, e.relations]));
    expect(kurz(entities)).toEqual(kurz(ohne));
  });

  it('nennt jedes Bild im Bildplan mit Ganzem, Vorgänger und Rang (T-210)', () => {
    const { bilder } = lauf(datenstand());
    const im = bilder.eintraege.filter((b) => b.ganzes);
    expect(im.map((b) => b.pfad)).toEqual(['book/TRB/art.webp', 'book/TRB/g1.webp', 'book/TRB/inset.webp']);
    const t = teileVon(entities, kapitel[0]!);
    const erstes = im[0]!;
    expect(erstes).toMatchObject({ klasse: 'image', feld: 'Image.image', ganzes: kapitel[0]!.id, rang: 10.001, quelle: 'TRB' });
    expect(t.find((e) => e.id === erstes.ziel)?.interfaces[0]).toBe('Illustration');
    expect(entities.find((e) => e.id === erstes.vorher)?.interfaces[0]).toBe('Embed');
    /* Das zweite Bild folgt dem ersten. */
    expect(im[1]!.vorher).toBe(erstes.ziel);
  });

  it('nennt ein Kapitel wie 5e.tools', () => {
    expect(kapitelTitel('Combat', { type: 'chapter', identifier: 9 })).toEqual({ titel: 'Chapter 9: Combat', ordinal: 'Chapter 9' });
    expect(kapitelTitel('Appendix A: Conditions', { type: 'appendix', identifier: 'A' })).toEqual({ titel: 'Appendix A: Conditions', ordinal: 'Appendix A' });
    expect(kapitelTitel('Introduction', undefined)).toEqual({ titel: 'Introduction' });
  });
});
