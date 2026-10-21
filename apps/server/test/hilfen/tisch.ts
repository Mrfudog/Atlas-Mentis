/**
 * **Ein Tisch für Integrationstests** (T-356): Server mit
 * `InMemoryRepository`, Konten mit Rollen und `app.inject` als eines davon.
 *
 *   const t = await tisch({
 *     kampagne: 'camp_nebel',
 *     artikel: [ebene, runde, geheim],
 *     konten: { Mira: { roles: { camp_nebel: 'gm' } }, Sela: { roles: { camp_nebel: 'player' } } },
 *   });
 *   expect((await t.als('Sela', 'GET', '/api/entities/p_geheim')).statusCode).toBe(404);
 *
 * Jede Route soll ihre Siebung in einem Test zeigen — Leitung und
 * Spielerin nebeneinander. Bisher baute jede Testdatei das selbst
 * (Konto, Anmelden, Keks); hier steht es einmal. Die Sitzung wird direkt
 * angelegt, ohne Passwort: geprüft wird die Route, nicht Argon2 — das
 * Anmelden selbst prüft `access.test.ts`.
 */
import { randomUUID } from 'node:crypto';
import { seedRegistry } from '@nw/registry';
import type { Entity, Registry } from '@nw/model';
import { buildApp, type AppOptions } from '../../src/app.js';
import { InMemoryRepository } from '../../src/repo.js';
import { hashToken, newSessionToken, sessionExpiry } from '../../src/auth.js';

export type Tischrolle = 'gm' | 'co-gm' | 'player' | 'spectator';

export interface Konto {
  admin?: boolean;
  /** Rolle je Kampagne, wie `campaign_member`. */
  roles?: Record<string, Tischrolle>;
  /** Figuren, die das Konto führt (`app_user_actor`). */
  actorIds?: string[];
}

type Methode = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface Tisch {
  repo: InMemoryRepository;
  app: ReturnType<typeof buildApp>;
  /** Konto-Id je Name. */
  ids: Map<string, string>;
  /** Eine Anfrage als dieses Konto; ohne Namen ohne Sitzung. */
  als(
    name: string | null,
    method: Methode,
    url: string,
    opts?: { payload?: unknown; viewAs?: string },
  ): ReturnType<ReturnType<typeof buildApp>['inject']>;
  /** Wie `als`, gibt den Körper zurück und wirft bei einem Fehlercode. */
  json<T = unknown>(name: string | null, method: Methode, url: string, payload?: unknown): Promise<T>;
}

export async function tisch(opts: {
  artikel?: Entity[];
  /** Die laufende Kampagne (Einstellung `campaign`). */
  kampagne?: string;
  konten?: Record<string, Konto>;
  registry?: Registry;
  app?: Omit<AppOptions, 'repo'>;
}): Promise<Tisch> {
  const basis = opts.registry ?? seedRegistry;
  const registry = opts.kampagne
    ? { ...basis, settings: { ...(basis.settings ?? {}), campaign: opts.kampagne } }
    : basis;
  const repo = new InMemoryRepository(registry, opts.artikel ?? []);
  const app = buildApp({ ...opts.app, repo });
  const ids = new Map<string, string>();
  const kekse = new Map<string, string>();

  for (const [name, k] of Object.entries(opts.konten ?? {})) {
    const id = `u_${name.toLowerCase()}_${randomUUID().slice(0, 4)}`;
    ids.set(name, id);
    await repo.putUser({
      id,
      name,
      passwordHash: '-',
      isAdmin: k.admin ?? false,
      actorIds: k.actorIds ?? [],
      roles: k.roles ?? {},
    });
    const token = newSessionToken();
    await repo.createSession({ tokenHash: hashToken(token), userId: id, expiresAt: sessionExpiry().toISOString(), agent: 'test' });
    kekse.set(name, `nw_session=${token}`);
  }

  const als: Tisch['als'] = (name, method, url, o = {}) => {
    const keks = name ? kekse.get(name) : undefined;
    if (name && !keks) throw new Error(`Kein Konto „${name}" am Tisch.`);
    return app.inject({
      method,
      url,
      headers: {
        ...(keks ? { cookie: keks } : {}),
        ...(o.viewAs ? { 'x-view-as': ids.get(o.viewAs) ?? o.viewAs } : {}),
      },
      ...(o.payload !== undefined ? { payload: o.payload as object } : {}),
    });
  };

  return {
    repo,
    app,
    ids,
    als,
    async json<T>(name: string | null, method: Methode, url: string, payload?: unknown): Promise<T> {
      const res = await als(name, method, url, payload !== undefined ? { payload } : {});
      if (res.statusCode >= 400) throw new Error(`${method} ${url} als ${name ?? 'niemand'}: ${res.statusCode} ${res.body}`);
      return res.json() as T;
    },
  };
}
