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

import { Injectable, signal } from '@angular/core';
import type { Entity, Registry, RegistryUsage, Relation } from '@nw/model';

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

export type TableRole = 'gm' | 'co-gm' | 'player' | 'spectator';
export const TABLE_ROLES: readonly TableRole[] = ['gm', 'co-gm', 'player', 'spectator'];

/**
 * Die Namen, die ein geöffneter Artikel braucht (W7): Kantenziele,
 * Verweisfelder, Sichtbarkeitslisten (`names`) und die Treffer jedes
 * `[[…]]` (`links`). Der Server rechnet sie beim Ausliefern, gespeichert
 * werden sie nie.
 */
export interface Bezuege {
  names: Record<string, string>;
  links: Record<string, { id: string; name: string }[]>;
  /**
   * **Ein älterer fertiger Stand gilt** (REQ-237, E-012): nur für wen den
   * Arbeitsstand sieht (Verfasserin, Leitung). `at` ist das Datum des
   * fertigen Stands, `old`, ob die Antwort dieser Stand ist (`?stand=ready`).
   */
  ready?: { at: string; old: boolean };
}

/** Eine Zeile „not ready, by players" (`GET /api/unready`, REQ-237). */
export interface Wartend {
  id: string;
  name: string;
  type: string;
  status: string;
  authors: string[];
  /** Gilt schon ein fertiger Stand, sein Datum. */
  readyAt: string | null;
  updatedAt: string | null;
  /** Ob dieser Betrachter „ready" setzen darf (`gm`, nicht `co-gm`). */
  canReady: boolean;
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
  /** Was fehlt, weil die laufende Kampagne seine Ebene nicht aufschaltet
   *  (T-069) — mit denselben Filtern gezählt; fehlt, wenn nichts fehlt. */
  unactivated?: Ausgeblendet;
}

export interface Ausgeblendet {
  campaign: { id: string; name: string };
  total: number;
  layers: { id: string; name: string; count: number; canActivate: boolean }[];
}

/** Eine Ebene auf der Kampagnenseite (`GET /api/campaigns/:c/layers`). */
export interface KampagnenEbene {
  id: string;
  name: string;
  kind: string;
  /** Bei einem Buch die Gruppe (`core`, `sourcebook`, `adventure`), sonst leer (T-081). */
  group: string;
  articles: number;
  active: boolean;
  /** Die anderen Kampagnen, die sie aufschalten. */
  alsoIn: string[];
  canActivate: boolean;
}
export interface KampagnenEbenen {
  campaign: { id: string; name: string };
  may: Recht;
  /** Die aufgeschalteten von unten nach oben, darunter die übrigen. */
  layers: KampagnenEbene[];
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
  /** Welche Umgebung antwortet (`ATLAS_ENV`); auf `dev` steht oben ein Band (T-070). */
  env?: 'dev' | 'prod' | null;
  /** Über welches API-Token gefragt wurde, sonst `null`. */
  token?: { name: string; scope: 'read' | 'write'; expiresAt: string } | null;
  /**
   * Ob dieser Betrachter das Register ändern darf (die Verwaltung und die
   * Leitung der laufenden Kampagne). Vom Server, der es beim Schreiben
   * ohnehin prüft.
   */
  registry?: boolean;
  /** Ob es überhaupt eine offene Einladung gibt — nur dann lohnt „Sign up". */
  invites?: boolean;
  /** Ob „New article" angeboten wird: die Verwaltung und Spielende der
   *  laufenden Kampagne (REQ-237). Vom Server, der es beim Anlegen prüft. */
  create?: boolean;
  /** Ob die Maske `ready` anbietet: die Verwaltung und die Leitung (`gm`).
   *  Spielende setzen es nicht (REQ-237, E-011); der Server prüft je Artikel. */
  ready?: boolean;
  /** Die eigene Figur samt Statblock und Inventar: dort setzt auch ein
   *  Spieler `ready` (E-014 d). */
  character?: string[];
  /** **In der Sicht eines Mitglieds** (REQ-241): wer gesehen wird und wer
   *  schaut. `user` ist dann das gesehene Konto, und nichts ist schreibbar. */
  viewAs?: { id: string; name: string; role: TableRole | null; by: { id: string; name: string } } | null;
  /** Der Kopf `X-View-As` galt nicht (mehr) — die Maske vergisst ihn. */
  viewAsRefused?: boolean;
}

/** Wo der Tab sich merkt, wessen Sicht er einnimmt: über Seitenwechsel und
 *  Neuladen, nicht über das Schliessen des Tabs (REQ-241). */
const SICHT_SCHLUESSEL = 'atlas.viewAs';
function leseSicht(): string | null {
  try {
    return globalThis.sessionStorage?.getItem(SICHT_SCHLUESSEL) || null;
  } catch {
    return null;
  }
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
  /** Ob „View as" angeboten wird — der Server sagt es (`mayViewAs`, REQ-241). */
  viewAs?: boolean;
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

/** Die Teile des Registers, die `PUT /api/registry/:part` nimmt. */
export type RegisterTeil = 'interfaces' | 'relations' | 'views' | 'vars' | 'enums' | 'settings';

/** Wie das Banner nennt, was eine Anfrage lädt. */
export function wasLaedt(path: string): string {
  if (path.startsWith('/api/registry')) return 'registry';
  if (path.startsWith('/api/list')) return 'list';
  if (path.startsWith('/api/entities') || path.startsWith('/api/links')) return 'articles';
  if (path.startsWith('/api/classes')) return 'classes';
  if (path.startsWith('/api/campaigns')) return 'campaign';
  if (path.startsWith('/api/checks') || path.startsWith('/api/bulk')) return 'workbench';
  return 'data';
}

@Injectable({ providedIn: 'root' })
export class Api {
  /** Leer heisst: derselbe Ursprung. Im Betrieb liefert der Server die
   *  Oberfläche selbst aus, in der Entwicklung steht ein Proxy davor. */
  readonly base = '';

  /** Was gerade geladen wird, je laufender Anfrage ein Wort (`registry`,
   *  `articles`, `list` …) — das Banner nennt es ab 300 ms, statt die Seite
   *  still stehen zu lassen (T-086, REQ-246). */
  readonly laufend = signal<string[]>([]);
  /** Der Server startet gerade und liest so viele Artikel (503 mit
   *  `starting`). Die Anfrage wartet und fragt nach, statt zu scheitern. */
  readonly anlauf = signal<number | null>(null);
  /** Eine Leseanfrage kam nicht durch (Netz weg, Server 5xx). Sie wartet,
   *  bis jemand „Retry" drückt, und wer sie gestellt hat, bekommt dann die
   *  Antwort — die Seite muss dafür nichts wissen. */
  readonly fehler = signal<{ was: string; nochmal: () => void } | null>(null);
  /** Der Server liefert eine neuere Oberfläche aus als die, die hier läuft
   *  (`X-Atlas-Build`, T-086): nach einem Deploy fehlen die alten Teile,
   *  und ein Seitenwechsel lädt ins Leere. Die Seite sagt es, statt still
   *  neu zu laden — wer gerade tippt, verlöre sonst seine Eingabe. */
  readonly neueVersion = signal(false);
  private bau: string | null = null;

  /**
   * **Wessen Sicht dieser Tab einnimmt** (REQ-241, E-019 a): eine Konto-Id,
   * die als `X-View-As` an jeder Anfrage steht. Gerechnet wird am Server —
   * hier steht nur, wen man fragt.
   */
  readonly viewAs = signal<string | null>(leseSicht());
  setViewAs(id: string | null): void {
    this.viewAs.set(id);
    try {
      if (id) globalThis.sessionStorage?.setItem(SICHT_SCHLUESSEL, id);
      else globalThis.sessionStorage?.removeItem(SICHT_SCHLUESSEL);
    } catch {
      /* Ohne Speicher hält die Sicht nur bis zum Neuladen. */
    }
  }
  private sichtKopf(): Record<string, string> {
    const id = this.viewAs();
    return id ? { 'x-view-as': id } : {};
  }

  /** `halten: false` — ein Ausfall geht gleich an den Aufrufer, statt auf
   *  „Retry" zu warten: die Sitzung muss sich auch ohne Server festlegen,
   *  sonst bliebe die Seite ohne Kopfleiste stehen. */
  private async call<T>(path: string, init: RequestInit = {}, halten = true): Promise<T> {
    const was = wasLaedt(path);
    this.laufend.update((l) => [...l, was]);
    try {
      for (;;) {
        try {
          const antwort = await this.rufe<T>(path, init);
          this.anlauf.set(null);
          return antwort;
        } catch (e) {
          const start = (e as ApiError).body as { starting?: { articles?: number } } | undefined;
          if (e instanceof ApiError && e.status === 503 && start?.starting) {
            this.anlauf.set(start.starting.articles ?? 0);
            await new Promise((r) => setTimeout(r, 1000));
            continue;
          }
          /* Nur Lesen wird wiederholt: ein Schreiben zweimal zu schicken
             könnte zweimal schreiben. Ein 4xx ist eine Antwort, kein
             Ausfall. */
          const ausfall = !(e instanceof ApiError) || e.status >= 500;
          if (!halten || (init.method ?? 'GET') !== 'GET' || !ausfall) throw e;
          this.anlauf.set(null);
          await new Promise<void>((r) => this.fehler.set({ was, nochmal: r }));
          this.fehler.set(null);
        }
      }
    } finally {
      this.laufend.update((l) => {
        const i = l.indexOf(was);
        return i < 0 ? l : [...l.slice(0, i), ...l.slice(i + 1)];
      });
    }
  }

  private merkeBau(res: Response): void {
    const bau = res.headers?.get?.('x-atlas-build');
    if (!bau) return;
    if (this.bau === null) this.bau = bau;
    else if (bau !== this.bau) this.neueVersion.set(true);
  }

  private async rufe<T>(path: string, init: RequestInit): Promise<T> {
    const res = await fetch(this.base + path, {
      ...init,
      credentials: 'include',
      /* Der Typ nur mit Körper: Fastify lehnt ein leeres JSON ab (DELETE). */
      headers: {
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...this.sichtKopf(),
        ...(init.headers ?? {}),
      },
    });
    this.merkeBau(res);
    const text = await res.text();
    const body: unknown = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const b = body as { error?: string; issues?: unknown } | null;
      throw new ApiError(res.status, b?.error ?? `Request failed (${res.status})`, b?.issues, body);
    }
    return body as T;
  }

  me(): Promise<Me> {
    return this.call<Me>('/api/me', {}, false);
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
  /** Einen Teil des Registers ganz schreiben; der Server prüft ihn im Zusammenhang. */
  putRegistry<T extends RegisterTeil>(part: T, value: Registry[T]): Promise<{ ok: true; part: T }> {
    return this.call(`/api/registry/${part}`, { method: 'PUT', body: JSON.stringify(value ?? {}) });
  }
  /** Was der Bestand an jeder Zeile trägt — nur für wer das Register ändert. */
  registryUsage(): Promise<RegistryUsage> {
    return this.call<RegistryUsage>('/api/registry/usage');
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
  /** Der ganze Artikel, gesiebt, mit den Namen, die er braucht (`refs`). */
  entity(id: string): Promise<Entity & { refs?: Bezuege }> {
    return this.call<Entity & { refs?: Bezuege }>(`/api/entities/${encodeURIComponent(id)}`);
  }

  /** Der letzte fertige Stand (E-012) — für Verfasserin und Leitung. */
  readyVersion(id: string): Promise<Entity & { refs?: Bezuege }> {
    return this.call<Entity & { refs?: Bezuege }>(`/api/entities/${encodeURIComponent(id)}?stand=ready`);
  }

  /** Was Spielende angelegt haben und noch nicht `ready` ist (REQ-237). */
  unready(): Promise<{ rows: Wartend[] }> {
    return this.call<{ rows: Wartend[] }>('/api/unready');
  }

  /** „ready" per Knopf (REQ-237); der Server prüft, wer darf. */
  setReady(id: string): Promise<Entity> {
    return this.call<Entity>(`/api/entities/${encodeURIComponent(id)}/ready`, { method: 'POST' });
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

  // ------------------------------------------------------- Verwaltung
  /**
   * Die Kampagne als Datei (T-077): der Körper als Blob, der Name aus
   * `content-disposition` — den Namen sagt der Server, nicht ein zweites
   * Mal die Seite.
   */
  async exportCampaign(campaign: string): Promise<{ blob: Blob; name: string }> {
    const res = await fetch(`${this.base}/api/export?campaign=${encodeURIComponent(campaign)}`, {
      credentials: 'include',
      headers: this.sichtKopf(),
    });
    if (!res.ok) {
      const b = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new ApiError(res.status, b?.error ?? `Request failed (${res.status})`, undefined, b);
    }
    const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'campaign.json';
    return { blob: await res.blob(), name };
  }

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
  /** Die Ebenen einer Kampagne, aufgeschaltet oder nicht (T-069). */
  campaignLayers(campaign: string): Promise<KampagnenEbenen> {
    return this.call<KampagnenEbenen>(`/api/campaigns/${encodeURIComponent(campaign)}/layers`);
  }
  /** Der ganze Stapel, von unten nach oben; was fehlt, ist danach aus. */
  setCampaignLayers(campaign: string, layers: string[]): Promise<{ ok: true; layers: string[] }> {
    return this.call(`/api/campaigns/${encodeURIComponent(campaign)}/layers`, {
      method: 'PUT',
      body: JSON.stringify({ layers }),
    });
  }
  /** Eine Ebene dazuschalten; der Server sucht ihr den Platz im Stapel. */
  activateLayer(campaign: string, layer: string): Promise<{ ok: true; layers: string[] }> {
    return this.call(
      `/api/campaigns/${encodeURIComponent(campaign)}/layers/${encodeURIComponent(layer)}`,
      { method: 'POST' },
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
