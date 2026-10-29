/**
 * „Change" an einer Regel (T-141): der Reiter Rules & options lädt erst —
 * auf dev gut zweieinhalb Sekunden —, und gesprungen wird, sobald das System
 * dasteht, nicht nach einer festen kurzen Frist.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { springeZu } from '../src/app/verwaltung/entscheidungen';

describe('jump to a decision', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('waits for a section that appears only after the rules have loaded', () => {
    vi.useFakeTimers();
    const gesprungen = vi.fn();
    springeZu('regel-combat');
    vi.advanceTimersByTime(5000);
    const el = document.createElement('section');
    el.id = 'regel-combat';
    el.scrollIntoView = gesprungen;
    document.body.append(el);
    vi.advanceTimersByTime(500);
    expect(gesprungen).toHaveBeenCalledOnce();
  });

  it('gives up after a while instead of jumping later out of nowhere', () => {
    vi.useFakeTimers();
    springeZu('regel-none');
    vi.advanceTimersByTime(20000);
    expect(vi.getTimerCount()).toBe(0);
  });
});
