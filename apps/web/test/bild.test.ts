/**
 * Bilder in der Oberfläche (T-114): woher ein Bild kommt, welche Eingabe
 * ein Bildfeld bekommt, und dass das Hochladen multipart schickt — nicht
 * JSON, wie jede andere Anfrage.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
import { Api } from '../src/app/kern/api';
import { bildAdresse, bildDes } from '../src/app/artikel/bild';
import { eingabeArt } from '../src/app/artikel/felder';

describe('bildAdresse', () => {
  it('turns an asset id into the server route, with the preview on request', () => {
    expect(bildAdresse('e_7f00aa')).toBe('/api/assets/e_7f00aa');
    expect(bildAdresse('e_7f00aa', 'thumb')).toBe('/api/assets/e_7f00aa?size=thumb');
  });

  it('keeps a web address as it is and refuses anything else', () => {
    expect(bildAdresse('https://example.org/karte.jpg', 'thumb')).toBe('https://example.org/karte.jpg');
    expect(bildAdresse('')).toBeNull();
    expect(bildAdresse(undefined)).toBeNull();
    expect(bildAdresse('javascript:alert(1)')).toBeNull();
    expect(bildAdresse('../../etc')).toBeNull();
  });
});

describe('bildDes', () => {
  const r = seedRegistry;
  it('shows Image.image of an article, with caption and alt text', () => {
    const e: Entity = {
      id: 'c1',
      interfaces: ['Creature'],
      name: 'Volo',
      components: { Image: { image: 'e_bild', caption: 'Volo am Hafen', alt: 'Ein Mann mit Hut' } },
      relations: [],
    };
    expect(bildDes(e, r)).toEqual({ wert: 'e_bild', caption: 'Volo am Hafen', alt: 'Ein Mann mit Hut' });
  });

  it('shows an asset as itself', () => {
    const a: Entity = { id: 'e_a', interfaces: ['Asset'], name: 'Karte', components: { Asset: { ref: `${'a'.repeat(64)}.png` } }, relations: [] };
    expect(bildDes(a, r)?.wert).toBe('e_a');
  });

  it('shows nothing where there is no image', () => {
    expect(bildDes({ id: 'x', interfaces: ['Place'], name: 'Ort', components: {}, relations: [] }, r)).toBeNull();
  });
});

describe('eingabeArt for images', () => {
  it('gives every asset field the image input, not a text box', () => {
    expect(eingabeArt(seedRegistry.interfaces['Image']?.schema?.properties['image'])).toBe('bild');
  });
});

describe('Api.uploadAsset', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });

  it('posts multipart with the article it comes from, and lets the browser set the type', async () => {
    let gesehen: RequestInit | undefined;
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      gesehen = init;
      return {
        ok: true,
        status: 201,
        headers: new Headers(),
        json: async () => ({ id: 'e_neu', interfaces: ['Asset'], url: '/api/assets/e_neu?v=1' }),
      } as unknown as Response;
    });
    const api = TestBed.inject(Api);
    const a = await api.uploadAsset(new File([new Uint8Array([1, 2, 3])], 'volo.png', { type: 'image/png' }), { for: 'c1' });
    expect(a.id).toBe('e_neu');
    expect(gesehen?.method).toBe('POST');
    expect(gesehen?.body).toBeInstanceOf(FormData);
    const form = gesehen!.body as FormData;
    expect(form.get('for')).toBe('c1');
    expect((form.get('file') as File).name).toBe('volo.png');
    expect(Object.keys((gesehen?.headers ?? {}) as Record<string, string>)).not.toContain('content-type');
  });
});
