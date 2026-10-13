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

export type TableRole = 'gm' | 'co-gm' | 'player' | 'spectator';
export const TABLE_ROLES: readonly TableRole[] = ['gm', 'co-gm', 'player', 'spectator'];

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
    actorIds?: string[];
    /** Kampagnen-Id → Rolle darin. Steht am Konto und in keinem Artikel. */
    roles?: Record<string, TableRole>;
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
  /** Ob es überhaupt eine offene Einladung gibt — nur dann lohnt „Sign up". */
  invites?: boolean;
}

/* ---- Verwaltung (W3). Was ein Konto an einer Kampagne darf, sagt der
   Server (`may`): `manage` ändert, `see` liest nur (co-gm). ---- */
export type Recht = 'manage' | 'see' | null;
export interface Figur {
  id: string;
  /** `null`: die Figur gibt es als Artikel nicht mehr. */
  name: string | null;
}
export interface KampagneKurz {
  id: string;
  name: string;
  exists: boolean;
  role: TableRole | null;
  may: Recht;
}
export interface Kampagnen {
  campaigns: KampagneKurz[];
  canCreate: boolean;
  isAdmin: boolean;
}
export interface Mitglied {
  id: string;
  name: string;
  role: TableRole;
  isAdmin: boolean;
  disabled: boolean;
  self: boolean;
  actors: Figur[];
}
export interface Mitglieder {
  campaign: { id: string; name: string; exists: boolean };
  may: Recht;
  members: Mitglied[];
  /** Die Figuren, die diese Kampagne vergeben darf. */
  characters: { id: string; name: string }[];
}
export interface Einladung {
  label: string | null;
  isAdmin: boolean;
  actorId: string | null;
  actorName: string | null;
  campaignId: string | null;
  role: TableRole | null;
  usesLeft: number | null;
  expiresAt: string | null;
  createdAt: string | null;
  may: Recht;
  handle: string;
}
export interface NeueEinladung {
  campaignId?: string;
  role?: TableRole;
  actorId?: string;
  label?: string;
  uses?: number;
  days?: number;
}
export interface Konto {
  id: string;
  name: string;
  isAdmin: boolean;
  disabled: boolean;
  self: boolean;
  actors: Figur[];
  roles: { campaign: string; name: string; role: TableRole }[];
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
  register(name: string, password: string, invite: string): Promise<{ user: Me['user'] }> {
    return this.call('/api/register', {
      method: 'POST',
      body: JSON.stringify({ name, password, invite }),
    });
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
  /** Diese Artikel ganz, gesiebt — die Teile eines Statblocks (W2). */
  entitiesById(ids: readonly string[]): Promise<Entity[]> {
    return this.call<Entity[]>(`/api/entities?ids=${ids.map(encodeURIComponent).join(',')}`);
  }
  backlinks(id: string): Promise<Rueckbezug[]> {
    return this.call<Rueckbezug[]>(`/api/entities/${encodeURIComponent(id)}/backlinks`);
  }
  klasse(id: string): Promise<KlassenBuendel> {
    return this.call<KlassenBuendel>(`/api/classes/${encodeURIComponent(id)}`);
  }
  entity(id: string): Promise<Entity> {
    return this.call<Entity>(`/api/entities/${encodeURIComponent(id)}`);
  }

  // ------------------------------------------------------- Verwaltung
  campaigns(): Promise<Kampagnen> {
    return this.call<Kampagnen>('/api/campaigns');
  }
  createCampaign(name: string, lead: boolean): Promise<{ id: string; name: string }> {
    return this.call('/api/campaigns', { method: 'POST', body: JSON.stringify({ name, lead }) });
  }
  members(campaign: string): Promise<Mitglieder> {
    return this.call<Mitglieder>(`/api/campaigns/${encodeURIComponent(campaign)}/members`);
  }
  addMember(
    campaign: string,
    wer: { name?: string; user?: string },
    role: TableRole,
  ): Promise<unknown> {
    return this.call(`/api/campaigns/${encodeURIComponent(campaign)}/members`, {
      method: 'POST',
      body: JSON.stringify({ ...wer, role }),
    });
  }
  setRole(campaign: string, user: string, role: TableRole): Promise<unknown> {
    return this.call(
      `/api/campaigns/${encodeURIComponent(campaign)}/members/${encodeURIComponent(user)}`,
      {
        method: 'PUT',
        body: JSON.stringify({ role }),
      },
    );
  }
  removeMember(campaign: string, user: string): Promise<unknown> {
    return this.call(
      `/api/campaigns/${encodeURIComponent(campaign)}/members/${encodeURIComponent(user)}`,
      {
        method: 'DELETE',
      },
    );
  }
  setActors(campaign: string, user: string, actorIds: string[]): Promise<unknown> {
    return this.call(
      `/api/campaigns/${encodeURIComponent(campaign)}/members/${encodeURIComponent(user)}/actors`,
      { method: 'PUT', body: JSON.stringify({ actorIds }) },
    );
  }
  users(): Promise<Konto[]> {
    return this.call<Konto[]>('/api/users');
  }
  invites(): Promise<Einladung[]> {
    return this.call<Einladung[]>('/api/invites');
  }
  createInvite(neu: NeueEinladung): Promise<{ code: string; handle: string }> {
    return this.call('/api/invites', { method: 'POST', body: JSON.stringify(neu) });
  }
  dropInvite(handle: string): Promise<unknown> {
    return this.call(`/api/invites/${encodeURIComponent(handle)}`, { method: 'DELETE' });
  }
}
