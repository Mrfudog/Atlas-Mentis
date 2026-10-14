/**
 * Bilder in der Oberfläche (T-114): woher ein Bild kommt, welche Eingabe
 * ein Bildfeld bekommt, und dass das Hochladen multipart schickt — nicht
 * JSON, wie jede andere Anfrage.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
import { Api } from '../src/app/kern/api';
import { Bild, bildAdresse, bildDes } from '../src/app/artikel/bild';
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

describe('managing images (T-119)', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });

  const antwort = (b: unknown) =>
    ({ ok: true, status: 200, headers: new Headers(), json: async () => b, text: async () => JSON.stringify(b) }) as unknown as Response;

  it('sends the class and the old image for a new version', async () => {
    let body: FormData | undefined;
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      body = init.body as FormData;
      return antwort({ id: 'e_neu' });
    });
    await TestBed.inject(Api).uploadAsset(new File([new Uint8Array([1])], 'a.png'), { kind: 'token', variantOf: 'e_alt' });
    expect(body?.get('kind')).toBe('token');
    expect(body?.get('variantOf')).toBe('e_alt');
  });

  it('replaces the source with PUT against the revision it read', async () => {
    let url = '';
    let init: RequestInit | undefined;
    vi.stubGlobal('fetch', async (u: string, i: RequestInit) => {
      url = u;
      init = i;
      return antwort({ id: 'e_a' });
    });
    await TestBed.inject(Api).replaceAssetFile('e_a', new File([new Uint8Array([1])], 'b.png'), 7);
    expect(url).toMatch(/\/api\/assets\/e_a\/file$/);
    expect(init?.method).toBe('PUT');
    expect((init?.body as FormData).get('revision')).toBe('7');
  });

  it('asks the list for tags and unused images', async () => {
    let url = '';
    vi.stubGlobal('fetch', async (u: string) => {
      url = u;
      return antwort({ total: 0, offset: 0, limit: 60, columns: [], rows: [], facets: { types: [], layers: [], fields: [], partsHidden: 0 } });
    });
    await TestBed.inject(Api).list({ type: 'Asset', tag: ['stadt', 'wache'], unused: true, f: ['Asset.kind:token'] });
    const q = new URL(url, 'http://x').searchParams;
    expect(q.get('tag')).toBe('stadt,wache');
    expect(q.get('unused')).toBe('1');
    expect(q.get('f')).toBe('Asset.kind:token');
  });
});

describe('loading indicator (T-126)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  const zeichne = (groesse: 'full' | 'thumb') => {
    const f = TestBed.createComponent(Bild);
    /* JIT kennt `input()` nicht (siehe text.test.ts): die Signale vor dem ersten Zeichnen ersetzen. */
    Object.assign(f.componentInstance, { wert: signal('https://example.org/karte.jpg'), groesse: signal(groesse) });
    f.detectChanges();
    return f;
  };

  it('spins over a large image until it has loaded', () => {
    const f = zeichne('full');
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('nw-ladeanzeige')).not.toBeNull();
    el.querySelector('img')!.dispatchEvent(new Event('load'));
    f.detectChanges();
    expect(el.querySelector('nw-ladeanzeige')).toBeNull();
  });

  it('leaves a preview alone, and stops when the image fails', () => {
    expect((zeichne('thumb').nativeElement as HTMLElement).querySelector('nw-ladeanzeige')).toBeNull();
    const f = zeichne('full');
    const el = f.nativeElement as HTMLElement;
    el.querySelector('img')!.dispatchEvent(new Event('error'));
    f.detectChanges();
    expect(el.querySelector('nw-ladeanzeige')).toBeNull();
  });
});
