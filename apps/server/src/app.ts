/**
 * The HTTP surface.
 *
 * Every write goes through Validation before it reaches storage, so a
 * malformed entity is refused at the door rather than becoming a document
 * nobody can render. Reads return the registry and entities as the model
 * package defines them — front and back share one definition.
 */

import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCookie from '@fastify/cookie';
import { EntitySchema, RegistrySchema, redactEntity, validateEntity } from '@nw/model';
import type { Entity, Registry } from '@nw/model';
import type { Repository } from './repo.js';
import {
  ATTEMPT_WINDOW_MINUTES,
  MAX_ATTEMPTS,
  SESSION_DAYS,
  checkPassword,
  foldName,
  hashToken,
  mayWrite,
  newSessionToken,
  sessionExpiry,
  type User,
} from './auth.js';

/* Kanten, über die eine Figur etwas „hat". Was daran hängt, darf ihr
   Spieler schreiben — das Inventar ist seines, der Ort, an dem es liegt,
   nicht. Eine Liste und keine Regel im Kopf: wer eine Kante dazunimmt,
   nimmt sie hier dazu und sieht dabei, was er tut. */
const OWNING_RELATIONS = new Set(['carries', 'holds', 'crafting']);

/* Ein Hash, gegen den auch dann geprüft wird, wenn es den Namen nicht gibt:
   sonst verrät die Antwortzeit, welche Konten existieren. Das Passwort dazu
   kennt niemand — es wird nie gesetzt, nur dagegen gerechnet. */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$' +
  'PH0Zz8rUqZ9y1c0jzJtQ0dLxYQhL0ZBoVQ1sT0nQ0kM';

export interface AppOptions {
  repo: Repository;
  logger?: boolean;
  /** Directory of the built Angular app. Omitted in tests — the API stands alone. */
  staticRoot?: string;
}

const REGISTRY_PARTS = ['components', 'interfaces', 'relations', 'views', 'vars'] as const;
type RegistryPart = (typeof REGISTRY_PARTS)[number];

function isRegistryPart(value: string): value is RegistryPart {
  return (REGISTRY_PARTS as readonly string[]).includes(value);
}

export function buildApp({ repo, logger = false, staticRoot }: AppOptions): FastifyInstance {
  const app = Fastify({ logger });

  void app.register(fastifyCookie);

  app.get('/api/health', async () => ({ ok: true }));

  if (staticRoot) {
    // The Angular app, plus a catch-all so client-side routes survive a reload.
    void app.register(fastifyStatic, { root: staticRoot });
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/')) {
        return reply.code(404).send({ error: 'Nicht gefunden' });
      }
      return reply.sendFile('index.html');
    });
  }


  // ------------------------------------------------------------ Zugang
  /*
   * Ein Passwort je Nutzer (REQ-031, 032). Der Reverse Proxy ist das, was
   * nach aussen zeigt — aber „nur das Heimnetz" ist keine Zugangskontrolle,
   * sondern eine Annahme über das Heimnetz.
   *
   * **Ohne Konto schreibt niemand.** Ein frischer Server hat kein Konto und
   * also auch kein Standardpasswort, das jemand vergisst zu ändern. Er sagt,
   * wie man das erste anlegt, und weigert sich bis dahin.
   */
  const COOKIE = 'nw_session';

  async function viewerOf(request: FastifyRequest): Promise<User | null> {
    const token = request.cookies?.[COOKIE];
    if (!token) return null;
    const user = await repo.touchSession(hashToken(token), sessionExpiry().toISOString());
    if (!user || user.disabledAt) return null;
    const { passwordHash: _hash, ...rest } = user;
    return rest;
  }

  /** Was ein Spieler schreiben darf: seine Figur und was an ihr hängt. Die
   *  Kante steht in den Daten, also wird sie dort nachgesehen. */
  async function ownedBy(user: User): Promise<Set<string>> {
    const own = new Set<string>();
    if (!user.actorId) return own;
    own.add(user.actorId);
    for (const e of await repo.listEntities()) {
      for (const r of e.relations ?? []) {
        if (OWNING_RELATIONS.has(r.type) && r.to && own.has(e.id)) own.add(r.to);
      }
    }
    return own;
  }

  app.get('/api/me', async (request) => {
    const user = await viewerOf(request);
    const count = await repo.countUsers();
    return {
      user,
      /* Ein frischer Server sagt es geradeheraus. Das ist keine Auskunft,
         die jemandem nützt, den es nichts angeht: wer den Port erreicht,
         sieht ohnehin, dass nichts eingerichtet ist. */
      setup: count === 0 ? 'Kein Konto angelegt. `pnpm --filter @nw/server user add <name> --gm`' : null,
    };
  });

  app.post<{ Body: { name?: string; password?: string } }>(
    '/api/login',
    async (request, reply) => {
      const name = String(request.body?.name ?? '');
      const password = String(request.body?.password ?? '');
      const fold = foldName(name);
      const origin = request.ip ?? 'unknown';
      const since = new Date(Date.now() - ATTEMPT_WINDOW_MINUTES * 60 * 1000).toISOString();

      if (!fold || !password) {
        return reply.code(400).send({ error: 'Name und Passwort fehlen.' });
      }
      if ((await repo.countAttempts(fold, origin, since)) >= MAX_ATTEMPTS) {
        return reply.code(429).send({
          error: `Zu viele Fehlversuche. In ${ATTEMPT_WINDOW_MINUTES} Minuten wieder.`,
        });
      }

      const user = await repo.findUserByName(fold);
      /* Auch ohne Konto wird geprüft — sonst verrät die Antwortzeit, welche
         Namen es gibt. Das kostet eine Argon2-Runde und ist es wert. */
      const ok = user
        ? !user.disabledAt && (await checkPassword(user.passwordHash, password))
        : await checkPassword(DUMMY_HASH, password);

      if (!ok || !user) {
        await repo.noteAttempt(fold, origin);
        await repo.appendEvent('login.failed', undefined, { name: fold });
        // Eine Auskunft für beide Fälle: welcher Name existiert, geht niemanden an.
        return reply.code(401).send({ error: 'Name oder Passwort stimmt nicht.' });
      }

      const token = newSessionToken();
      await repo.createSession({
        tokenHash: hashToken(token),
        userId: user.id,
        expiresAt: sessionExpiry().toISOString(),
        agent: String(request.headers['user-agent'] ?? '').slice(0, 200),
      });
      await repo.clearAttempts(fold, origin);
      await repo.appendEvent('login.ok', user.id, {});

      void reply.setCookie(COOKIE, token, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        /* `secure` nur hinter TLS: auf einem nackten localhost würde der
           Keks sonst stillschweigend nie gesetzt, und niemand fände heraus,
           warum die Anmeldung „funktioniert" und doch nicht hält. */
        secure: request.protocol === 'https',
        maxAge: SESSION_DAYS * 24 * 60 * 60,
      });
      const { passwordHash: _hash, ...rest } = user;
      return { user: rest };
    },
  );

  app.post('/api/logout', async (request, reply) => {
    const token = request.cookies?.[COOKIE];
    if (token) await repo.dropSession(hashToken(token));
    void reply.clearCookie(COOKIE, { path: '/' });
    return { ok: true };
  });

  /** Alle Geräte. Genau dafür liegt die Sitzung beim Server. */
  app.post('/api/logout-everywhere', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return reply.code(401).send({ error: 'Nicht angemeldet.' });
    const n = await repo.dropSessionsOf(user.id);
    void reply.clearCookie(COOKIE, { path: '/' });
    return { ok: true, sessions: n };
  });

  /**
   * Die Wache. Sie steht vor allem unter `/api`, ausser vor dem, was man
   * braucht, um sich überhaupt anzumelden.
   *
   * Solange kein Konto angelegt ist, ist der Server **offen zum Lesen und
   * zu zu zum Schreiben**: sonst käme man an einen frisch aufgesetzten
   * Server nicht heran, und ein offener Schreibweg wäre das Schlimmste von
   * beidem.
   */
  const OPEN = new Set(['/api/health', '/api/login', '/api/logout', '/api/me']);
  app.addHook('preHandler', async (request, reply) => {
    const url = request.url.split('?')[0] ?? '';
    if (!url.startsWith('/api/') || OPEN.has(url)) return;

    const user = await viewerOf(request);
    (request as FastifyRequest & { viewer?: User | null }).viewer = user;
    const schreibt = request.method !== 'GET' && request.method !== 'HEAD';

    if (!user) {
      const leer = (await repo.countUsers()) === 0;
      if (leer && !schreibt) return; // frischer Server: lesen ja, schreiben nie
      return reply.code(401).send({ error: 'Nicht angemeldet.' });
    }
    if (!schreibt) return;
    if (user.isGm) return;

    /* Ein Spieler schreibt seine Figur und was an ihr hängt — und sonst
       nichts. Das Register gehört der Spielleitung: eine Registerzeile zu
       ändern heisst, die Regeln zu ändern. */
    if (url.startsWith('/api/registry')) {
      return reply.code(403).send({ error: 'Das Register ändert die Spielleitung.' });
    }
    const id = url.startsWith('/api/entities/') ? decodeURIComponent(url.slice(14)) : '';
    if (!id || !mayWrite(user, await ownedBy(user), id)) {
      return reply.code(403).send({ error: 'Das gehört dir nicht.' });
    }
  });

  // ---------------------------------------------------------------- registry

  app.get('/api/registry', async () => repo.getRegistry());

  app.put<{ Params: { part: string }; Body: unknown }>(
    '/api/registry/:part',
    async (request, reply) => {
      const { part } = request.params;
      if (!isRegistryPart(part)) {
        return reply.code(404).send({ error: `Unbekannter Registerteil: ${part}` });
      }

      // Validate the part in the context of the whole registry, so a broken
      // row cannot be written and then break every later read.
      const current = await repo.getRegistry();
      const candidate: Registry = { ...current, [part]: request.body } as Registry;
      const parsed = RegistrySchema.safeParse(candidate);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Register ungültig', issues: parsed.error.issues });
      }

      // Written out per part so each call is properly typed — a generic
      // indexed write across the union loses the correlation between the
      // key and the value's shape.
      switch (part) {
        case 'components': await repo.putRegistryPart('components', parsed.data.components); break;
        case 'interfaces': await repo.putRegistryPart('interfaces', parsed.data.interfaces); break;
        case 'relations': await repo.putRegistryPart('relations', parsed.data.relations); break;
        case 'views': await repo.putRegistryPart('views', parsed.data.views); break;
        case 'vars': await repo.putRegistryPart('vars', parsed.data.vars); break;
      }
      await repo.appendEvent('registry.written', undefined, { part });
      return { ok: true, part };
    },
  );

  // ---------------------------------------------------------------- entities

  /**
   * Gelesen wird gesiebt (REQ-035, 036).
   *
   * Bis hierher machte das Zurückhalten nur die Oberfläche. Das reicht
   * genau so lange, wie niemand die Schnittstelle direkt aufruft — und ein
   * Server, der einem Spieler die Geheimnisse schickt und darauf baut, dass
   * sein Browser sie nicht anzeigt, hält gar nichts zurück. Das Sieb selbst
   * steht im Modellpaket, weil es für Server und Oberfläche gleichermassen
   * gilt und es nur einmal geben darf.
   */
  async function sieve(request: FastifyRequest, entities: Entity[]): Promise<Entity[]> {
    const user = await viewerOf(request);
    if (!user || user.isGm) return entities;
    const registry = await repo.getRegistry();
    /* Der Zusammenhang ist immer der ganze Bestand, auch wenn nur ein
       Artikel gesiebt wird: welche Information einen Block beansprucht und
       wem sie gehört, steht an anderen Artikeln. Mit einer Karte aus nur
       diesem einen fände das Sieb keine einzige Information — und liesse
       alles durch, ohne dass irgendwo etwas schiefginge. */
    const alle = new Map((await repo.listEntities()).map((e) => [e.id, e]));
    const gmBlocks = String(registry.settings?.['gmBlockTypes'] ?? 'secret,tactics')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    /* Ohne Figur ist ein Spieler niemand, den irgendein Wissen kennt — dann
       bleibt genau das Offene. Das ist die richtige Vorgabe: ein Konto ohne
       Figur ist ein Konto, dem noch nichts zugeteilt wurde. */
    const viewerId = user.actorId ?? '';
    return entities.map((e) => redactEntity(registry, alle, e, viewerId || '\u0000', gmBlocks));
  }

  app.get('/api/entities', async (request) => sieve(request, await repo.listEntities()));

  app.get<{ Params: { id: string } }>('/api/entities/:id', async (request, reply) => {
    const entity = await repo.getEntity(request.params.id);
    if (!entity) return reply.code(404).send({ error: 'Nicht gefunden' });
    const [einer] = await sieve(request, [entity]);
    return einer ?? entity;
  });

  app.put<{ Params: { id: string }; Body: unknown }>(
    '/api/entities/:id',
    async (request, reply) => {
      const parsed = EntitySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Artikel ungültig', issues: parsed.error.issues });
      }
      const entity = parsed.data as Entity;
      if (entity.id !== request.params.id) {
        return reply.code(400).send({ error: 'id im Pfad und im Körper stimmen nicht überein' });
      }

      const registry = await repo.getRegistry();
      const known = new Set((await repo.listEntities()).map((e) => e.id));
      known.add(entity.id);

      const issues = validateEntity(registry, entity, { knownIds: known });
      if (issues.length) {
        return reply.code(422).send({ error: 'Validierung fehlgeschlagen', issues });
      }

      const stored = await repo.putEntity(entity);
      await repo.appendEvent('entity.written', entity.id, {
        interfaces: entity.interfaces,
        components: Object.keys(entity.components ?? {}),
      });
      return stored;
    },
  );

  app.delete<{ Params: { id: string } }>('/api/entities/:id', async (request, reply) => {
    const removed = await repo.deleteEntity(request.params.id);
    if (!removed) return reply.code(404).send({ error: 'Nicht gefunden' });
    await repo.appendEvent('entity.deleted', request.params.id, {});
    return { ok: true };
  });

  /**
   * Dry-run validation, so the editor can warn before anything is written.
   * Same code path as the write — there is deliberately no second implementation.
   */
  app.post<{ Body: unknown }>('/api/validate', async (request, reply) => {
    const parsed = EntitySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Artikel ungültig', issues: parsed.error.issues });
    }
    const registry = await repo.getRegistry();
    const known = new Set((await repo.listEntities()).map((e) => e.id));
    return { issues: validateEntity(registry, parsed.data as Entity, { knownIds: known }) };
  });

  return app;
}
