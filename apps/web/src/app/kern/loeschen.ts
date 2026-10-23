import { Injectable, inject } from '@angular/core';
import { deleteSummary } from '@nw/model';
import { Api, ApiError } from './api';

/** Was nach dem Löschen gesagt wird — und womit man es zurücknimmt. */
export interface Loeschergebnis {
  text: string;
  /** Der Lauf im Protokoll; `null`, wenn nichts gelöscht wurde. */
  lauf: string | null;
  /** Gelöscht (auch Teile, die mitgingen, zählen in `text`, nicht hier). */
  geloescht: string[];
  /** Abgewählt: die Auswahl soll danach nur noch diese enthalten — oder leer sein. */
  abgewaehlt: string[];
  /** Ein Hinweis, was man tun kann, z. B. die Schreibebene wechseln. */
  hinweis?: string;
}

/**
 * **Löschen aus der eigenen Ebene** (T-381) — einmal für Galerie und
 * Artikelseite: zuerst die Vorschau (`dryRun`), dann die Bestätigung mit
 * der Zahl, dann der Lauf mit `confirmDelete`. Was nicht in der
 * Schreibebene liegt, wird abgewählt; die Meldung sagt es
 * („3 deleted, 2 from other layers deselected“) und nennt den Weg.
 */
@Injectable({ providedIn: 'root' })
export class Loeschen {
  private readonly api = inject(Api);

  /**
   * Gibt `null` zurück, wenn die Bestätigung abgelehnt wurde; wirft
   * `ApiError` mit einer Meldung, die sagt, was zu tun ist.
   */
  async loeschen(ids: string[], frage: (n: number, abgewaehlt: number) => boolean = standardFrage): Promise<Loeschergebnis | null> {
    if (!ids.length) return { text: 'Nothing selected.', lauf: null, geloescht: [], abgewaehlt: [] };
    const vorschau = await this.api.deleteArticles(ids, { dryRun: true });
    const abgewaehlt = vorschau.deselected.map((d) => d.id);
    const hinweis = vorschau.deselected.some((d) => d.reason === 'other-layer')
      ? `Only articles in your write layer${vorschau.layer ? ` (${vorschau.layer.name})` : ''} can be deleted — switch it in the header to delete the others.`
      : undefined;
    if (!vorschau.deleted) {
      return { text: deleteSummary(0, vorschau.deselected), lauf: null, geloescht: [], abgewaehlt, ...(hinweis ? { hinweis } : {}) };
    }
    if (!frage(vorschau.deleted, abgewaehlt.length)) return null;
    try {
      const r = await this.api.deleteArticles(ids, vorschau.deleted > 1 ? { confirmDelete: vorschau.deleted } : {});
      const geloescht = ids.filter((id) => !r.deselected.some((d) => d.id === id));
      return {
        text: deleteSummary(r.deleted, r.deselected),
        lauf: r.id ?? null,
        geloescht,
        abgewaehlt: r.deselected.map((d) => d.id),
        ...(hinweis ? { hinweis } : {}),
      };
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        throw new ApiError(409, 'Something changed since the preview — select again and retry.', undefined, e.body);
      }
      throw e;
    }
  }
}

function standardFrage(n: number, abgewaehlt: number): boolean {
  if (typeof confirm !== 'function') return true;
  const rest = abgewaehlt ? `\n${abgewaehlt} selected ${abgewaehlt === 1 ? 'article is' : 'articles are'} not in your write layer and will be deselected.` : '';
  return confirm(`Delete ${n} ${n === 1 ? 'article' : 'articles'}? You can undo it right after.${rest}`);
}
