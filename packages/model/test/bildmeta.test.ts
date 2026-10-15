/**
 * Bilder (T-201): Masse aus dem Dateikopf, Seitenverhältnis, Karte aus
 * einem Bild, Adressen statt Assets.
 */
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { aspectRatio, describeAsset, formatBytes, imageAddresses, imageHeader, mapFromImage, runChecks, suggestGrid } from '../src/index.js';
import type { Entity } from '../src/index.js';

const bytes = (...teile: (number[] | string)[]): Uint8Array =>
  Uint8Array.from(teile.flatMap((t) => (typeof t === 'string' ? [...t].map((c) => c.charCodeAt(0)) : t)));
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const le16 = (n: number) => [n & 255, (n >>> 8) & 255];
const le24 = (n: number) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255];

describe('imageHeader', () => {
  it('reads PNG', () => {
    const png = bytes([0x89], 'PNG', [13, 10, 26, 10], be32(13), 'IHDR', be32(3035), be32(2223), [8, 6, 0, 0, 0]);
    expect(imageHeader(png)).toEqual({ mime: 'image/png', width: 3035, height: 2223 });
  });
  it('reads GIF', () => {
    expect(imageHeader(bytes('GIF89a', le16(640), le16(480), [0, 0, 0]))).toEqual({ mime: 'image/gif', width: 640, height: 480 });
  });
  it('reads JPEG past an APP segment', () => {
    const jpg = bytes([0xff, 0xd8], [0xff, 0xe0, 0, 16], 'JFIF', [0, 1, 1, 0, 0, 1, 0, 1, 0, 0], [0xff, 0xc0, 0, 17, 8], [0x08, 0xaf], [0x0b, 0xdb], [3, 1, 0x22, 0]);
    expect(imageHeader(jpg)).toEqual({ mime: 'image/jpeg', width: 3035, height: 2223 });
  });
  it('reads the three WebP kinds', () => {
    const riff = (art: string, rest: number[]) => bytes('RIFF', [0, 0, 0, 0], 'WEBP', art, [0, 0, 0, 0], rest);
    expect(imageHeader(riff('VP8X', [0, 0, 0, 0, ...le24(1919), ...le24(1079)]))).toEqual({ mime: 'image/webp', width: 1920, height: 1080 });
    const vp8 = riff('VP8 ', [0, 0, 0, 0x9d, 0x01, 0x2a, ...le16(800), ...le16(600)]);
    expect(imageHeader(vp8)).toEqual({ mime: 'image/webp', width: 800, height: 600 });
    const w = 400 - 1;
    const h = 300 - 1;
    const bits = (w | (h << 14)) >>> 0;
    const vp8l = riff('VP8L', [0x2f, bits & 255, (bits >>> 8) & 255, (bits >>> 16) & 255, (bits >>> 24) & 255, 0, 0, 0, 0, 0, 0]);
    expect(imageHeader(vp8l)).toEqual({ mime: 'image/webp', width: 400, height: 300 });
  });
  it('says nothing about what it does not know or what is cut off', () => {
    expect(imageHeader(bytes('<svg width="10" height="10">'))).toBeNull();
    expect(imageHeader(bytes([0xff, 0xd8, 0xff, 0xe0, 0, 16]))).toBeNull();
    expect(imageHeader(new Uint8Array())).toBeNull();
  });
});

describe('aspectRatio and the line about a file', () => {
  it('reduces, names the known ones, rounds the rest', () => {
    expect(aspectRatio(1920, 1080)).toBe('16:9');
    expect(aspectRatio(1080, 1920)).toBe('9:16');
    expect(aspectRatio(2100, 1400)).toBe('3:2');
    expect(aspectRatio(1366, 768)).toBe('16:9');
    expect(aspectRatio(3035, 2223)).toBe('1.37:1');
    expect(aspectRatio(0, 5)).toBeNull();
  });
  it('writes size, ratio, bytes and format, and leaves out what is missing', () => {
    expect(formatBytes(1934813)).toBe('1.8 MB');
    expect(describeAsset({ width: 1920, height: 1080, bytes: 655360, mime: 'image/webp' })).toBe('1920×1080 px · 16:9 · 640 KB · WEBP');
    expect(describeAsset({ mime: 'image/jpeg' })).toBe('JPEG');
  });
});

describe('mapFromImage', () => {
  const asset = (name: string, width: number, height: number): Entity => ({
    id: 'a1',
    interfaces: ['Asset'],
    name,
    components: { Asset: { ref: 'x.png', kind: 'map', width, height }, Image: { alt: 'A crypt' } },
    relations: [],
  });
  it('suggests the grid from the resolution or the name', () => {
    expect(suggestGrid(2100, 1400)).toEqual({ gridShape: 'square', gridSize: 70 });
    expect(suggestGrid(3000, 2000, 'Crypt 30x20')).toEqual({ gridShape: 'square', gridSize: 100 });
    expect(suggestGrid(3035, 2223)).toBeNull();
  });
  it('builds a battle map with a grid, a region without one', () => {
    expect(mapFromImage(asset('Crypt', 2100, 1400))).toEqual({
      type: 'Map',
      name: 'Crypt',
      fields: { 'Image.image': 'a1', 'Image.alt': 'A crypt', 'Map.gridShape': 'square', 'Map.gridSize': 70, 'Map.kind': 'battle' },
    });
    expect(mapFromImage(asset('Sewer', 3035, 2223), 'Sewer Hideout').fields).toEqual({ 'Image.image': 'a1', 'Image.alt': 'A crypt' });
  });
});

describe('imageAddresses', () => {
  it('finds addresses in asset fields only, and the check counts them', () => {
    const karte: Entity = {
      id: 'm1',
      interfaces: ['Map'],
      name: 'Cragmaw Hideout',
      components: { Image: { image: 'https://5e.tools/img/adventure/LMoP/map.webp', caption: 'https://example.org' } },
      relations: [],
    };
    const gut: Entity = { id: 'm2', interfaces: ['Map'], name: 'B', components: { Image: { image: 'a1' } }, relations: [] };
    expect(imageAddresses(seedRegistry, karte)).toEqual([{ field: 'Image.image', url: 'https://5e.tools/img/adventure/LMoP/map.webp' }]);
    expect(imageAddresses(seedRegistry, gut)).toEqual([]);
    const [r] = runChecks({ registry: seedRegistry, entities: [karte, gut], exists: new Map() }, { only: ['imageAddress'] });
    expect(r!.count).toBe(1);
    expect(r!.hits[0]!.id).toBe('m1');
  });
});
