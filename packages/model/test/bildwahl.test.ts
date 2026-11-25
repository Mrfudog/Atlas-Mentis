/**
 * Bildwähler (T-369): welche Formate ein Bild sein darf und was nach der
 * Wahl, vor dem Hochladen, abgelehnt wird.
 */
import { describe, expect, it } from 'vitest';
import { IMAGE_FORMATS, imageFileProblem } from '../src/index.js';

describe('IMAGE_FORMATS', () => {
  it('matches the formats the server takes, without HEIC or SVG', () => {
    expect(IMAGE_FORMATS.map((f) => f.mime)).toEqual(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
    expect(JSON.stringify(IMAGE_FORMATS)).not.toMatch(/hei[cf]|svg/i);
  });
});

describe('imageFileProblem', () => {
  it('accepts by media type', () => {
    expect(imageFileProblem({ name: 'map', type: 'image/png' })).toBeNull();
    expect(imageFileProblem({ name: 'x.bin', type: 'IMAGE/JPEG' })).toBeNull();
  });
  it('falls back to the extension when the type is empty (cloud files)', () => {
    expect(imageFileProblem({ name: 'Karte.JPG', type: '' })).toBeNull();
    expect(imageFileProblem({ name: 'a.webp' })).toBeNull();
  });
  it('does not trust the extension when the type says otherwise', () => {
    expect(imageFileProblem({ name: 'a.png', type: 'application/pdf' })).toMatch(/not a supported image/);
  });
  it('explains HEIC with a way out', () => {
    expect(imageFileProblem({ name: 'IMG_1.HEIC', type: 'image/heic' })).toMatch(/HEIC.*JPEG/);
    expect(imageFileProblem({ name: 'IMG_1.heif', type: '' })).toMatch(/HEIC/);
  });
  it('rejects SVG, other files and nothing', () => {
    expect(imageFileProblem({ name: 'a.svg', type: 'image/svg+xml' })).toMatch(/JPEG, PNG/);
    expect(imageFileProblem({ name: 'notes.txt', type: 'text/plain' })).toMatch(/not a supported image/);
    expect(imageFileProblem({})).toMatch(/not a supported image/);
  });
});
