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
  ) {
    super(message);
  }
}

/** Eine Kante, die auf einen Artikel zeigt — mit der Kurzfassung ihres Ursprungs. */
export interface Rueckbezug {
  from: Entity;
  relation: Relation;
}

/**
 * Die Namen, die ein geöffneter Artikel braucht (W7): Kantenziele,
 * Verweisfelder, Sichtbarkeitslisten (`names`) und die Treffer jedes
 * `[[…]]` (`links`). Der Server rechnet sie beim Ausliefern, gespeichert
 * werden sie nie.
 */
export interface Bezuege {
  names: Record<string, string>;
  links: Record<string, { id: string; name: string }[]>;
}

/** Ein Blatt der Liste (`GET /api/list`) — die Form steht in `apps/server/src/liste.ts`. */
export interface Liste {
  total: number;
  offset: number;
  limit: number;
  columns: { ref: string; label: string; kind: 'number' | 'bool' | 'list' | 'text' }[];
  rows: ListenZeile[];
  facets: {
    types: { type: string; label: string; area: string; count: number }[];
    layers: { id: string; name: string; count: number }[];
    fields: (
      | { ref: string; label: string; kind: 'enum'; options: { value: string; count: number }[] }
      | { ref: string; label: string; kind: 'range'; min: number; max: number }
    )[];
    partsHidden: number;
  };
}

export interface ListenZeile {
  id: string;
  name: string;
  type: string;
  layers: string[];
  source: string;
  status: string;
  /** Wie viele Artikel diesen über eine Abschnittskante nutzen. */
  users?: number;
  cols: Record<string, unknown>;
  tags?: string[];
  /** Die Ziele der Kantenarten, nach denen `rel=` fragte. */
  rels?: Record<string, string[]>;
}

/** Was die Liste gefragt wird. Leere Angaben fallen weg. */
export interface ListenFrage {
  area?: string | undefined;
  type?: string | undefined;
  of?: string[] | undefined;
  /** Nur diese Artikel. */
  ids?: string[] | undefined;
  /** Diese Kantenarten je Zeile mitschicken. */
  rel?: string[] | undefined;
  q?: string | undefined;
  layer?: string[] | undefined;
  nolayer?: string[] | undefined;
  parts?: boolean | undefined;
  sort?: string | undefined;
  offset?: number | undefined;
  limit?: number | undefined;
  /** `Typ.feld:Wert|Wert` oder `Typ.feld:1..3`. */
  f?: string[] | undefined;
}

/**
 * Eine Klasse samt allem, was ihre Ansicht braucht (W6, `GET /api/classes/:id`):
 * ihre Unterklassen, die Stufentabellen und die Merkmale, die eine davon
 * gewährt oder einbettet — ganz, gesiebt.
 */
export interface KlassenBuendel {
  class: Entity;
  subclasses: Entity[];
  tables: Entity[];
  features: Entity[];
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
  /** Ein Blatt der Liste — Kompendium, Bereiche und jede Auswahl (W7). */
  list(frage: ListenFrage, init: RequestInit = {}): Promise<Liste> {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(frage)) {
      if (v === undefined || v === '' || v === false || (Array.isArray(v) && !v.length)) continue;
      if (k === 'f') for (const f of v as string[]) p.append('f', f);
      else p.set(k, Array.isArray(v) ? v.join(',') : v === true ? '1' : String(v));
    }
    return this.call<Liste>(`/api/list?${p.toString()}`, init);
  }
  /** `[[Name]]` → `[[nummer|Name]]`, wo genau ein Artikel so heisst (M11). */
  links(texts: string[]): Promise<{ texts: string[]; open: string[] }> {
    return this.call('/api/links', { method: 'POST', body: JSON.stringify({ texts }) });
  }
  /** Einen Artikel anlegen; Id, Nummer und Vorgaben setzt der Server. */
  createEntity(
    type: string,
    name: string,
    fields: Record<string, unknown> = {},
    relations: { type: string; to: string; props?: Record<string, unknown> }[] = [],
  ): Promise<Entity> {
    return this.call<Entity>('/api/entities', {
      method: 'POST',
      body: JSON.stringify({ type, name, fields, relations }),
    });
  }
  backlinks(id: string): Promise<Rueckbezug[]> {
    return this.call<Rueckbezug[]>(`/api/entities/${encodeURIComponent(id)}/backlinks`);
  }
  klasse(id: string): Promise<KlassenBuendel> {
    return this.call<KlassenBuendel>(`/api/classes/${encodeURIComponent(id)}`);
  }
  /** Der ganze Artikel, gesiebt, mit den Namen, die er braucht (`refs`). */
  entity(id: string): Promise<Entity & { refs?: Bezuege }> {
    return this.call<Entity & { refs?: Bezuege }>(`/api/entities/${encodeURIComponent(id)}`);
  }
}
