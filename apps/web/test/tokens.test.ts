/**
 * Die Token-Maske (T-112): sie bietet nur Daten an, die der Server nimmt,
 * und sagt, was in die Cloud-Umgebung gehört.
 */

import { describe, expect, it } from 'vitest';
import { ablaufSpanne, netzwerkSecret, tagAus } from '../src/app/konto/tokens';

describe('API-Token-Maske', () => {
  it('offers tomorrow to 365 days ahead, 30 days by default', () => {
    const jetzt = new Date('2026-10-14T10:00:00Z');
    expect(ablaufSpanne(jetzt)).toEqual({
      min: '2026-10-15',
      max: '2027-10-13',
      vorgabe: '2026-11-13',
    });
    expect(tagAus(jetzt)).toBe('2026-10-14');
  });

  it('names host, header and prefix of the network secret', () => {
    expect(netzwerkSecret('dev.example.org')).toEqual({
      host: 'dev.example.org',
      header: 'Authorization',
      prefix: 'Bearer',
    });
  });
});
