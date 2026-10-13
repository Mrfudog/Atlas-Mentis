/**
 * Der einzige Weg ans Backend.
 *
 * Alles geht über `fetch` mit `credentials: 'include'` — der Sitzungskeks
 * ist `httpOnly` und wird vom Browser mitgeschickt; die Anwendung sieht ihn
 * nie und kann ihn deshalb auch nicht verlieren.
 *
 * Fehler kommen als `ApiError` mit dem Status zurück, nicht als geworfener
 * Text: „401" und „422" heissen am Tisch Verschiedenes, und eine Maske, die
 * beides gleich behandelt, sagt dem Nutzer das Falsche.
 */

import { Injectable } from '@angular/core';
import type { Entity, Registry, Relation } from '@nw/model';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues?: unknown,
    /** Die ganze Antwort — eine abgelehnte Massenänderung sagt darin, was und warum. */
    readonly body?: unknown,
  ) {
    super(message);
  }
}

/* ------------------------------------------------------------ Werkbank (W9) */

export interface CheckHit {
  id: string;
  name: string;
  type: string;
  reason: string;
  group?: string[];
}
export interface CheckResult {
  key: string;
  label: string;
  description: string;
  count: number;
  hits: CheckHit[];
  ms: number;
}
export interface ChecksAntwort {
  total: number;
  ms: number;
  checks: CheckResult[];
}
export interface BulkZeile {
  id: string;
  name: string;
  type: string;
  change: 'update' | 'delete' | 'create';
  summary: string[];
}
export interface BulkAntwort {
  dryRun: boolean;
  selected: number;
  changed: number;
  deleted: number;
  examples: BulkZeile[];
  rejected: { id: string; name: string; type: string; issues: string[] }[];
  rejectedCount: number;
  skipped: { id: string; name: string; type: string; reason: string }[];
  skippedCount: number;
  ms: number;
  id?: string | null;
  error?: string;
}
export interface BulkLauf {
  id: string;
  at: string;
  undone: boolean;
  by?: { id: string; name: string };
  token?: string | null;
  changed: number;
  deleted: number;
  summary?: string[];
}
export interface UndoAntwort {
  dryRun?: boolean;
  restored: number;
  conflicts: { id: string; name: string; reason: string }[];
  rejected: { id: string; name: string; issues: string[] }[];
  error?: string;
}
export interface TokenZeile {
  id: string;
  name: string;
  scope: 'read' | 'write';
  expiresAt: string;
  createdAt: string | null;
  lastUsedAt: string | null;
  /** Nur in der Antwort auf das Anlegen — einmal. */
  token?: string;
}

/** Eine Kante, die auf einen Artikel zeigt — mit der Kurzfassung ihres Ursprungs. */
export interface Rueckbezug {
  from: Entity;
  relation: Relation;
}

export interface Me {
  user: {
    id: string;
    name: string;
    isAdmin: boolean;
    actorId?: string;
    /** Kampagnen-Id → Rolle darin. Steht am Konto und in keinem Artikel. */
    roles?: Record<string, 'gm' | 'co-gm' | 'player' | 'spectator'>;
  } | null;
  /**
   * Welche Artikel dieser Betrachter schreiben darf. **`null` heisst alles**
   * (die Spielleitung), eine Liste heisst genau diese. Sie kommt vom Server,
   * weil er die Regel ohnehin anwenden muss — sie hier nachzurechnen wäre
   * die zweite Stelle, an der jemand eine Kante vergisst.
   */
  writable: string[] | null;
  /** Steht nur auf einem frischen Server: wie man das erste Konto anlegt. */
  setup: string | null;
  /** Über welches API-Token gefragt wurde, sonst `null`. */
  token?: { name: string; scope: 'read' | 'write'; expiresAt: string } | null;
}

@Injectable({ providedIn: 'root' })
export class Api {
  /** Leer heisst: derselbe Ursprung. Im Betrieb liefert der Server die
   *  Oberfläche selbst aus, in der Entwicklung steht ein Proxy davor. */
  readonly base = '';

  private async call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(this.base + path, {
      ...init,
      credentials: 'include',
      /* Der Typ nur mit Körper: Fastify lehnt ein leeres JSON ab (DELETE). */
      headers: { ...(init.body ? { 'content-type': 'application/json' } : {}), ...(init.headers ?? {}) },
    });
    const text = await res.text();
    const body: unknown = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const b = body as { error?: string; issues?: unknown } | null;
      throw new ApiError(res.status, b?.error ?? `Request failed (${res.status})`, b?.issues, body);
    }
    return body as T;
  }

  me(): Promise<Me> {
    return this.call<Me>('/api/me');
  }
  putEntity(entity: Entity): Promise<Entity> {
    return this.call<Entity>(`/api/entities/${encodeURIComponent(entity.id)}`, {
      method: 'PUT',
      body: JSON.stringify(entity),
    });
  }
  login(name: string, password: string): Promise<{ user: Me['user'] }> {
    return this.call('/api/login', { method: 'POST', body: JSON.stringify({ name, password }) });
  }
  logout(): Promise<{ ok: true }> {
    return this.call('/api/logout', { method: 'POST' });
  }
  registry(): Promise<Registry> {
    return this.call<Registry>('/api/registry');
  }
  /** Die Kurzfassung des Bestands (`summaryOf`), nicht die Artikel selbst. */
  entities(): Promise<Entity[]> {
    return this.call<Entity[]>('/api/entities?as=summary');
  }
  backlinks(id: string): Promise<Rueckbezug[]> {
    return this.call<Rueckbezug[]>(`/api/entities/${encodeURIComponent(id)}/backlinks`);
  }
  entity(id: string): Promise<Entity> {
    return this.call<Entity>(`/api/entities/${encodeURIComponent(id)}`);
  }

  /** Prüfungen; `limit` 0 heisst nur die Zahlen, `'all'` jeden Treffer. */
  checks(check?: string, limit: number | 'all' = 0): Promise<ChecksAntwort> {
    const q = new URLSearchParams({ limit: String(limit) });
    if (check) q.set('check', check);
    return this.call<ChecksAntwort>(`/api/checks?${q.toString()}`);
  }
  bulk(auftrag: unknown): Promise<BulkAntwort> {
    return this.call<BulkAntwort>('/api/bulk', { method: 'POST', body: JSON.stringify(auftrag) });
  }
  bulks(): Promise<BulkLauf[]> {
    return this.call<BulkLauf[]>('/api/bulk?limit=20');
  }
  undo(id: string, force = false): Promise<UndoAntwort> {
    return this.call<UndoAntwort>(`/api/bulk/${encodeURIComponent(id)}/undo`, {
      method: 'POST',
      body: JSON.stringify({ force }),
    });
  }
  tokens(): Promise<TokenZeile[]> {
    return this.call<TokenZeile[]>('/api/tokens');
  }
  createToken(name: string, scope: 'read' | 'write', days: number): Promise<TokenZeile> {
    return this.call<TokenZeile>('/api/tokens', { method: 'POST', body: JSON.stringify({ name, scope, days }) });
  }
  dropToken(id: string): Promise<{ ok: true }> {
    return this.call(`/api/tokens/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }
}
