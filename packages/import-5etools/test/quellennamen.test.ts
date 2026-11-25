/**
 * Volle Namen für Quellen ohne Kopf in `books.json`/`adventures.json`
 * (T-420): auf dev hiessen 65 Ebenen nur nach ihrem Kürzel („DrDe",
 * „ESK", „MCV2DC"). 5e.tools führt jeden Titel in `js/parser.js`
 * (`Parser.SOURCE_JSON_TO_FULL`), auch zusammengesetzte; daraus liest der
 * Importer, was die Kopfdateien nicht sagen.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { lies, quellenNamenAusParser } from '../src/lesen.js';

const PARSER = `
Parser.SRC_DrDe = "DrDe";
Parser.SRC_ESK = "ESK";
Parser.SRC_MCVX_PREFIX = "MCV";
Parser.SRC_MCV2DC = \`\${Parser.SRC_MCVX_PREFIX}2DC\`;
Parser.MCVX_PREFIX = "Monstrous Compendium Volume ";
Parser.SOURCE_JSON_TO_FULL[Parser.SRC_DrDe] = "Dragon Delves";
Parser.SOURCE_JSON_TO_FULL[Parser.SRC_ESK] = "Essentials Kit";
Parser.SOURCE_JSON_TO_FULL[Parser.SRC_MCV2DC] = \`\${Parser.MCVX_PREFIX}2: Dragonlance Creatures\`;
Parser.SOURCE_JSON_TO_FULL[Parser.SRC_UNBEKANNT] = "Niemand";
`;

function checkout(): string {
  const wurzel = mkdtempSync(join(tmpdir(), 'nw-5et-'));
  mkdirSync(join(wurzel, 'data'));
  mkdirSync(join(wurzel, 'js'));
  writeFileSync(join(wurzel, 'js', 'parser.js'), PARSER);
  writeFileSync(join(wurzel, 'data', 'books.json'), JSON.stringify({ book: [{ id: 'PHB', source: 'PHB', name: "Player's Handbook", published: '2014-08-19' }] }));
  writeFileSync(join(wurzel, 'data', 'adventures.json'), JSON.stringify({ adventure: [] }));
  return join(wurzel, 'data');
}

describe('full names of sources from js/parser.js (T-420)', () => {
  it('reads plain and composed titles, keyed by the lower-case source', () => {
    const namen = quellenNamenAusParser(PARSER);
    expect(namen.get('drde')).toBe('Dragon Delves');
    expect(namen.get('esk')).toBe('Essentials Kit');
    expect(namen.get('mcv2dc')).toBe('Monstrous Compendium Volume 2: Dragonlance Creatures');
    /* Ein Name ohne auflösbares Kürzel wird nicht geraten. */
    expect([...namen.values()]).not.toContain('Niemand');
  });

  it('gives lies() the names the header files lack, without overriding them', () => {
    const stand = lies(checkout());
    expect(stand.quellen.get('phb')?.name).toBe("Player's Handbook");
    expect(stand.quellenNamen?.get('drde')).toBe('Dragon Delves');
    expect(stand.quellenNamen?.has('phb')).toBe(false);
  });
});
