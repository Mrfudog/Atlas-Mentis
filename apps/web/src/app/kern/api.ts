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
import type { Entity, Registry } from '@nw/model';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues?: unknown,
  ) {
    super(message);
  }
}

export interface Me {
  user: { id: string; name: string; isGm: boolean; actorId?: string } | null;
  /** Steht nur auf einem frischen Server: wie man das erste Konto anlegt. */
  setup: string | null;
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
      headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    });
    const text = await res.text();
    const body: unknown = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const b = body as { error?: string; issues?: unknown } | null;
      throw new ApiError(res.status, b?.error ?? `Request failed (${res.status})`, b?.issues);
    }
    return body as T;
  }

  me(): Promise<Me> {
    return this.call<Me>('/api/me');
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
  entities(): Promise<Entity[]> {
    return this.call<Entity[]>('/api/entities');
  }
  entity(id: string): Promise<Entity> {
    return this.call<Entity>(`/api/entities/${encodeURIComponent(id)}`);
  }
}
