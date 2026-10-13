/**
 * The HTTP surface.
 *
 * Every write goes through Validation before it reaches storage, so a
 * malformed entity is refused at the door rather than becoming a document
 * nobody can render. Reads return the registry and entities as the model
 * package defines them — front and back share one definition.
 */

import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCookie from '@fastify/cookie';
import {
  EntitySchema,
  RegistrySchema,
  articleVisible,
  backlinks,
  currentCampaign,
  inPlay,
  detachInstance,
  instancesOf,
  isInstance,
  readInstance,
  redactEntity,
  resolveInstance,
  thinInstance,
  stageBases,
  summaryFields,
  summaryOf,
  validateEntity,
  articleId,
  entityName,
  idLinks,
  linkCandidates,
  nextId,
  typeChain,
} from '@nw/model';
import type { Entity, Registry } from '@nw/model';
import type { Repository } from './repo.js';
import { buildListIndex, listProjection, parseListQuery, queryList, type ListIndex } from './liste.js';
import {
  ATTEMPT_WINDOW_MINUTES,
  MAX_ATTEMPTS,
  SESSION_DAYS,
  checkPassword,
  foldName,
  hashPassword,
  hashToken,
  mayWrite,
  newInviteCode,
  newSessionToken,
  passwordProblem,
  sessionExpiry,
  type Invite,
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
  /** Siehe `Config.trustProxy`; in Tests ungesetzt. */
  trustProxy?: boolean | string;
}

const REGISTRY_PARTS = ['interfaces', 'relations', 'views', 'vars', 'enums', 'settings'] as const;
type RegistryPart = (typeof REGISTRY_PARTS)[number];

function isRegistryPart(value: string): value is RegistryPart {
  return (REGISTRY_PARTS as readonly string[]).includes(value);
}

export function buildApp({
  repo,
  logger = false,
  staticRoot,
  trustProxy = false,
}: AppOptions): FastifyInstance {
  const app = Fastify({ logger, trustProxy });

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
    const own = new Set<string>(user.actorIds ?? []);
    if (!own.size) return own;
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
    /* **Der Server sagt, was jemand schreiben darf** — die Oberfläche rechnet
       es nicht zum zweiten Mal aus. Eine zweite Rechnung wäre die zweite
       Stelle, an der jemand eine Kante vergisst, und dann zeigt die Maske
       einen Knopf, den der Server danach abweist.

       `null` heisst „alles" und nicht „nichts": die Spielleitung bekommt
       keine Liste über den ganzen Bestand geschickt. */
    const writable = user && !user.isAdmin ? [...(await ownedBy(user))] : null;
    /* Die Figuren mit Namen, nicht nur mit Id. Die Maske müsste sie sonst
       einzeln nachladen, bevor sie „meine Figuren" überhaupt beschriften
       kann — und täte es beim ersten Mal falsch. */
    const actors: { id: string; name: string }[] = [];
    for (const id of user?.actorIds ?? []) {
      const e = await repo.getEntity(id);
      if (e) actors.push({ id, name: String(e.name ?? id) });
    }
    return {
      user,
      actors,
      writable,
      /* Ein frischer Server sagt es geradeheraus. Das ist keine Auskunft,
         die jemandem nützt, den es nichts angeht: wer den Port erreicht,
         sieht ohnehin, dass nichts eingerichtet ist. */
      setup: count === 0 ? 'Kein Konto angelegt. `pnpm --filter @nw/server user add <name> --admin`' : null,
      /* Ob sich hier überhaupt jemand anmelden kann, ohne dass die
         Spielleitung etwas tut. Die Maske zeigt den Registrieren-Knopf nur
         dann — einer, der bei jedem Versuch „Einladung fehlt" sagt, ist
         kein Knopf, sondern eine Enttäuschung. */
      invites: count === 0 ? false : (await repo.listInvites()).length > 0,
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

  /**
   * Ein Konto anlegen — vom Spieler selbst, nicht von der Spielleitung.
   *
   * Die Spielleitung dachte sich sonst für jeden ein Passwort aus und gab
   * es weiter, über einen Kanal, der keiner ist. Wer sich selbst eines
   * setzt, hat eines, das nur er kennt.
   *
   * **Gegen eine Einladung**, und ohne sie gar nicht. Ein offener
   * Registrierungsendpunkt an einem Server, der im Netz steht, ist ein
   * Loch — und eines, das niemandem auffällt, weil sich ja nichts ändert,
   * ausser dass ein Konto mehr da ist.
   *
   * Der Code kommt aus der Einladung, die Rolle auch: ein Link kann eine
   * Figur mitbringen (dann ist es „der spezifische Link") oder die
   * Spielleitungsrolle (dann sollte ihn niemand weiterleiten).
   */
  app.post<{ Body: { name?: string; password?: string; invite?: string } }>(
    '/api/register',
    async (request, reply) => {
      const name = String(request.body?.name ?? '').trim();
      const password = String(request.body?.password ?? '');
      const code = String(request.body?.invite ?? '').trim();
      const fold = foldName(name);
      const origin = request.ip ?? 'unknown';
      const since = new Date(Date.now() - ATTEMPT_WINDOW_MINUTES * 60 * 1000).toISOString();

      if (!fold || !password || !code) {
        return reply.code(400).send({ error: 'Name, Passwort und Einladung gehören dazu.' });
      }
      /* Dieselbe Bremse wie beim Anmelden, mit demselben Zähler: sonst
         liesse sich über diesen Weg durchprobieren, welche Einladungen es
         gibt, während der Anmeldeweg zugehalten wird. */
      if ((await repo.countAttempts(fold, origin, since)) >= MAX_ATTEMPTS) {
        return reply.code(429).send({
          error: `Zu viele Versuche. In ${ATTEMPT_WINDOW_MINUTES} Minuten wieder.`,
        });
      }
      const schwach = passwordProblem(password);
      if (schwach) return reply.code(400).send({ error: schwach });

      /* Erst der Name, dann die Einladung: sonst wird ein Gebrauch
         verbraucht, weil jemand einen Namen gewählt hat, den es schon
         gibt. */
      if (await repo.findUserByName(fold)) {
        return reply.code(409).send({ error: 'Diesen Namen gibt es schon.' });
      }
      const invite = await repo.useInvite(hashToken(code), new Date().toISOString());
      if (!invite) {
        await repo.noteAttempt(fold, origin);
        await repo.appendEvent('register.refused', undefined, { name: fold });
        /* Eine Auskunft für alle Fälle — abgelaufen, aufgebraucht oder nie
           dagewesen geht niemanden an, der sie nicht hat. */
        return reply.code(403).send({ error: 'Diese Einladung gilt nicht (mehr).' });
      }

      const id = `u_${newSessionToken().slice(0, 16)}`;
      await repo.putUser({
        id,
        name,
        passwordHash: await hashPassword(password),
        isAdmin: invite.isAdmin,
        actorIds: invite.actorId ? [invite.actorId] : [],
        /* Eine Einladung bindet an eine Figur, nicht an eine Rolle: wer
           am Tisch was ist, setzt die Leitung danach. */
        roles: {},
      });
      await repo.clearAttempts(fold, origin);
      await repo.appendEvent('register.ok', id, { invite: invite.label ?? null });

      /* Gleich angemeldet. Wer sich eben ein Passwort ausgedacht hat, soll
         es nicht sofort wieder eintippen müssen — und der Weg dahin ist
         derselbe, den `/api/login` nimmt. */
      const token = newSessionToken();
      await repo.createSession({
        tokenHash: hashToken(token),
        userId: id,
        expiresAt: sessionExpiry().toISOString(),
        agent: String(request.headers['user-agent'] ?? '').slice(0, 200),
      });
      void reply.setCookie(COOKIE, token, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: request.protocol === 'https',
        maxAge: SESSION_DAYS * 24 * 60 * 60,
      });
      const angelegt = await repo.getUser(id);
      const rest = angelegt ? (({ passwordHash: _h, ...r }) => r)(angelegt) : null;
      return reply.code(201).send({ user: rest });
    },
  );

  /**
   * Einladungen anlegen und ansehen. Nur die Spielleitung, und der Code
   * steht **genau einmal** in der Antwort auf das Anlegen: gespeichert ist
   * nur sein Hash, und was hier nicht mitgeschrieben wird, ist weg.
   */
  app.get('/api/invites', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user?.isAdmin) return reply.code(403).send({ error: 'Nicht für dich.' });
    return (await repo.listInvites()).map((i) => ({
      label: i.label ?? null,
      isAdmin: i.isAdmin,
      actorId: i.actorId ?? null,
      usesLeft: i.usesLeft ?? null,
      expiresAt: i.expiresAt ?? null,
      /* Der Hash geht mit, damit sich eine Einladung zurücknehmen lässt.
         Aus ihm kommt man nicht auf den Code zurück. */
      handle: i.codeHash,
    }));
  });

  app.post<{ Body: { label?: string; admin?: boolean; actorId?: string; uses?: number; days?: number } }>(
    '/api/invites',
    async (request, reply) => {
      const user = await viewerOf(request);
      if (!user?.isAdmin) return reply.code(403).send({ error: 'Nicht für dich.' });
      const b = request.body ?? {};
      const code = newInviteCode();
      const uses = b.uses == null ? undefined : Math.max(1, Math.floor(Number(b.uses) || 1));
      const days = b.days == null ? undefined : Math.max(1, Math.floor(Number(b.days) || 1));
      const invite: Invite = {
        codeHash: hashToken(code),
        label: b.label?.trim() || undefined,
        isAdmin: b.admin === true,
        actorId: b.actorId?.trim() || undefined,
        usesLeft: uses,
        expiresAt: days ? new Date(Date.now() + days * 86400000).toISOString() : undefined,
        createdBy: user.id,
      };
      await repo.putInvite(invite);
      await repo.appendEvent('invite.created', user.id, { label: invite.label ?? null });
      /* Einmal und nie wieder. */
      return reply.code(201).send({ code, handle: invite.codeHash });
    },
  );

  app.delete<{ Params: { handle: string } }>('/api/invites/:handle', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user?.isAdmin) return reply.code(403).send({ error: 'Nicht für dich.' });
    const weg = await repo.dropInvite(request.params.handle);
    if (!weg) return reply.code(404).send({ error: 'Nicht gefunden' });
    return { ok: true };
  });

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
   * Solange kein Konto angelegt ist **und der Bestand leer ist**, ist der
   * Server offen zum Lesen und zu zum Schreiben: sonst käme man an einen
   * frisch aufgesetzten Server nicht heran, und ein offener Schreibweg wäre
   * das Schlimmste von beidem.
   *
   * Die Ausnahme hing bis P5 nur an den Konten. Mit leerem Bestand war das
   * harmlos; mit zehntausend geladenen Artikeln wäre es eine offene
   * Bibliothek, sobald jemand das letzte Konto löscht (Arbeitsplan §4). Der
   * Ladebefehl verweigert ohnehin ohne Verwaltungskonto (`import.ts`).
   */
  const OPEN = new Set(['/api/health', '/api/login', '/api/register', '/api/logout', '/api/me']);
  app.addHook('preHandler', async (request, reply) => {
    const url = request.url.split('?')[0] ?? '';
    if (!url.startsWith('/api/') || OPEN.has(url)) return;

    const user = await viewerOf(request);
    (request as FastifyRequest & { viewer?: User | null }).viewer = user;
    /* `POST /api/links` liest nur — die Texte sind zu lang für eine
       Adresse, darum kein GET. */
    const schreibt = request.method !== 'GET' && request.method !== 'HEAD' && url !== '/api/links';

    if (!user) {
      const frisch = (await repo.countUsers()) === 0 && (await repo.countEntities()) === 0;
      if (frisch && !schreibt) return; // frischer Server: lesen ja, schreiben nie
      return reply.code(401).send({ error: 'Nicht angemeldet.' });
    }
    if (!schreibt) return;
    if (user.isAdmin) return;

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
        case 'interfaces': await repo.putRegistryPart('interfaces', parsed.data.interfaces); break;
        case 'relations': await repo.putRegistryPart('relations', parsed.data.relations); break;
        case 'views': await repo.putRegistryPart('views', parsed.data.views); break;
        case 'vars': await repo.putRegistryPart('vars', parsed.data.vars); break;
        case 'enums': await repo.putRegistryPart('enums', parsed.data.enums ?? {}); break;
        case 'settings': await repo.putRegistryPart('settings', parsed.data.settings ?? {}); break;
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
  async function sieve(
    request: FastifyRequest,
    entities: Entity[],
    bestand?: Entity[] | Map<string, Entity>,
    /** Vor dem Wissen auf das Nötige kürzen — der Index der Liste braucht
     *  nur die Karten, die eine Zeile zeigt, und das Wissen gilt je Feld:
     *  was gekürzt wird, hätte keinen anderen Wert gesiebt. */
    schmal?: (e: Entity) => Entity,
  ): Promise<Entity[]> {
    const user = await viewerOf(request);
    /* **Eine Instanz geht aufgelöst hinaus**, mit ihrer Vorlage darin und
       der Angabe, welche Felder von dort kommen. Gespeichert ist an ihr nur,
       was abweicht; ohne Auflösung hätte Wache 1 keine Trefferpunkte. */
    const roh =
      bestand instanceof Map
        ? bestand
        : new Map((bestand ?? (await repo.listEntities())).map((e) => [e.id, e]));
    const registry = await repo.getRegistry();
    /* **Die nullte Frage: steht der Artikel im Stapel?** (E2, A2) Was eine
       aufgeschaltete Ebene herausnimmt oder eine spezifischere Fassung
       überschreibt, ist nicht da — für jeden, auch für die Verwaltung.
       Bis zum 7.10. rechnete das nur der Prototyp, und der Server schickte
       solche Artikel trotzdem hinaus. */
    const kampagne = currentCampaign(roh, registry.settings ?? null);
    entities = entities.filter((e) => inPlay(roh, e, kampagne)).map((e) => readInstance(roh, e));
    if (!user || user.isAdmin) return entities;
    /* Der Zusammenhang ist immer der ganze Bestand, auch wenn nur ein
       Artikel gesiebt wird: welche Information ein Feld beansprucht und
       wem sie gehört, steht an anderen Artikeln. Mit einer Karte aus nur
       diesem einen fände das Sieb keine einzige Information — und liesse
       alles durch, ohne dass irgendwo etwas schiefginge. */
    const alle = roh;
    const gmFields = String(registry.settings?.['gmFields'] ?? 'Secrets.secret,Tactics.tactics')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    /* **Alle Figuren dieses Kontos zusammen.** Wer Rook und Sela spielt,
       weiss am Tisch, was beide wissen — eine Seite, die ihm Selas Wissen
       vorenthält, während er Rook offen hat, zwingt ihn zum Umschalten und
       sonst zu nichts.

       Eine leere Liste ist nicht dasselbe wie keine: `undefined` heisst
       Spielleitung und sieht alles, `[]` heisst ein Konto ohne Figur und
       sieht genau das Offene. Das ist die richtige Vorgabe — ein Konto
       ohne Figur ist eines, dem noch nichts zugeteilt wurde. */
    /* **Zwei Fragen, und die grobe kommt zuerst.** Die Sichtbarkeit sagt,
       ob dieser Artikel überhaupt an ihn geht; das Wissen sagt, welche
       Felder darin. Sie zusammenzulegen hiesse, einen Artikel dadurch zu
       verbergen, dass man alle seine Felder wegnimmt — und er stünde
       trotzdem in der Liste, mit Namen und Bereich.

       Bis hierher war die grobe Frage nur eine Angabe in der Karte, die
       niemand auswertete: `audience: 'gm'` stand da, und der Server
       schickte den Artikel. */
    const augen = user.actorIds ?? [];
    /* **Die Rollen gehen mit, nicht nur die Figuren.** Wer eine Kampagne
       leitet, hat keine Figur — seine Rolle steht am Konto, je Kampagne
       (`campaign_member`). Das Wissen fragt weiter nur nach den Figuren:
       was jemand erfahren hat, hat eine Figur erfahren. */
    const auge = { actors: augen, roles: user.roles ?? {} };
    return entities
      .filter((e) => articleVisible(alle, e, auge))
      .map((e) => redactEntity(registry, alle, schmal ? schmal(e) : e, augen, gmFields));
  }

  app.get('/api/entities', async (request) => {
    /* Der ganze Bestand, gesiebt — für Ausfuhr und Prüfungen. Die
       Oberfläche fragt ihn nicht mehr: Listen kommen aus `/api/list`, ein
       Artikel aus `/api/entities/:id`. Die Kurzfassung `?as=summary` ist
       am 13.10. weggefallen (W7) — sie war genau der Weg, auf dem der
       Browser 7,7 MB lud, bevor er eine Zeile zeigte. */
    const alle = await repo.listEntities();
    return sieve(request, alle, alle);
  });

  // ------------------------------------------------------------ Liste (W7)

  /**
   * Der rohe Bestand je Stempel, mit den Nachschlagetafeln für Verweise:
   * Nummer und Peg-Id → Artikel, Name und Alias → Artikel. Ungesiebt — wer
   * daraus liest, siebt danach, was er gefunden hat.
   */
  let rohStand: {
    stempel: string;
    alle: Entity[];
    map: Map<string, Entity>;
    namen: Map<string, Entity[]>;
  } | null = null;
  async function roh(): Promise<NonNullable<typeof rohStand>> {
    const stempel = await repo.version();
    if (rohStand?.stempel === stempel) return rohStand;
    const alle = await repo.listEntities();
    const map = new Map(alle.map((e) => [e.id, e]));
    const namen = new Map<string, Entity[]>();
    const merke = (k: string, e: Entity): void => {
      const key = k.trim().toLowerCase();
      if (!key) return;
      const l = namen.get(key);
      if (!l) namen.set(key, [e]);
      else if (!l.includes(e)) l.push(e);
    };
    for (const e of alle) {
      merke(e.id, e);
      merke(articleId(e), e);
      merke(entityName(e), e);
      const aliases = e.components?.['Identity']?.['aliases'];
      if (Array.isArray(aliases)) for (const a of aliases) merke(String(a), e);
    }
    rohStand = { stempel, alle, map, namen };
    return rohStand;
  }

  /** Ein kleiner Hash des Registers: ändert es sich, gilt kein Index mehr. */
  function registerStempel(registry: Registry): string {
    const s = JSON.stringify(registry);
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return `${s.length}:${(h >>> 0).toString(36)}`;
  }

  /**
   * Der Index der Liste — je Bestand-Stempel, Register und Betrachter
   * einmal gerechnet (`liste.ts`). Die Verwaltung teilt sich einen; ein
   * Spieler hat seinen eigenen, weil das Sieb für ihn Wissen je Artikel
   * rechnet. Gehalten werden die letzten acht: eine Runde hat selten mehr
   * Leute gleichzeitig am Kompendium.
   */
  const indizes = new Map<string, Promise<ListIndex>>();
  async function indexFor(request: FastifyRequest): Promise<ListIndex> {
    const [stand, registry, user] = await Promise.all([roh(), repo.getRegistry(), viewerOf(request)]);
    const wer =
      !user || user.isAdmin
        ? '*'
        : `${user.id}|${(user.actorIds ?? []).join(',')}|${JSON.stringify(user.roles ?? {})}`;
    const key = `${stand.stempel}|${registerStempel(registry)}|${wer}`;
    let lauf = indizes.get(key);
    if (lauf) {
      indizes.delete(key);
      indizes.set(key, lauf); // zuletzt gebraucht steht hinten
      return lauf;
    }
    lauf = sieve(request, stand.alle, stand.map, listProjection(registry)).then((gesiebt) =>
      buildListIndex(registry, gesiebt),
    );
    indizes.set(key, lauf);
    lauf.catch(() => indizes.delete(key));
    /* Alte Stempel fallen sofort, sonst die ältesten über acht. */
    for (const k of indizes.keys()) {
      if (!k.startsWith(`${stand.stempel}|`)) indizes.delete(k);
    }
    while (indizes.size > 8) indizes.delete(indizes.keys().next().value as string);
    return lauf;
  }

  /**
   * Ein Blatt der Liste (W7): `GET /api/list?area=&type=&of=&q=&layer=&nolayer=&parts=&sort=&offset=&limit=&f=`.
   * Antwort `{ total, offset, limit, columns, rows, facets }`. Dieselbe
   * Route sucht für Auswahlen (Kantenziel, Verweis): `of=Art&q=…&limit=20`.
   */
  app.get('/api/list', async (request) => {
    const idx = await indexFor(request);
    return queryList(idx, parseListQuery(request.query as Record<string, unknown>));
  });

  /**
   * Die Kandidaten eines Verweises `[[ziel]]`, gesiebt: was dieser Betrachter
   * nicht sehen darf, ist kein Ziel — sonst verriete ein Verweis, dass es
   * den Artikel gibt. Dieselbe Regel wie `linkCandidates` (M11), nur über
   * die Nachschlagetafel statt über den ganzen Bestand.
   */
  async function kandidaten(request: FastifyRequest, ziele: Iterable<string>): Promise<Map<string, Entity[]>> {
    const stand = await roh();
    const ziel = [...new Set([...ziele].map((t) => t.trim()).filter(Boolean))];
    const sammel = new Map<string, Entity>();
    for (const t of ziel) for (const e of stand.namen.get(t.toLowerCase()) ?? []) sammel.set(e.id, e);
    const gesiebt = sammel.size ? await sieve(request, [...sammel.values()], stand.map) : [];
    const raus = new Map<string, Entity[]>();
    for (const t of ziel) raus.set(t, linkCandidates(gesiebt, t));
    return raus;
  }

  const VERWEIS = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  function verweiseIn(wert: unknown, raus: Set<string>): void {
    if (typeof wert === 'string') {
      if (!wert.includes('[[')) return;
      for (const m of wert.matchAll(VERWEIS)) raus.add((m[1] ?? '').trim());
    } else if (Array.isArray(wert)) {
      for (const w of wert) verweiseIn(w, raus);
    } else if (wert && typeof wert === 'object') {
      for (const w of Object.values(wert)) verweiseIn(w, raus);
    }
  }

  /**
   * Was ein geöffneter Artikel an Namen braucht, ohne dass der Browser den
   * Bestand hält (W7): die Ziele seiner Kanten, Verweisfelder und
   * Sichtbarkeitslisten (`names`) und die Treffer jedes `[[…]]` in seinen
   * Texten (`links`). Gerechnet beim Ausliefern, **nie gespeichert** — ein
   * Name von gestern wäre heute falsch.
   */
  async function bezuegeVon(
    request: FastifyRequest,
    e: Entity,
  ): Promise<{ names: Record<string, string>; links: Record<string, { id: string; name: string }[]> }> {
    const registry = await repo.getRegistry();
    const ids = new Set<string>();
    for (const r of e.relations ?? []) if (r.to) ids.add(r.to);
    for (const [typ, karte] of Object.entries(e.components ?? {})) {
      const props = registry.interfaces[typ]?.schema?.properties ?? {};
      for (const [k, v] of Object.entries(karte ?? {})) {
        const istVerweis = props[k]?.format === 'link' || (typ === 'Visibility' && k !== 'audience');
        if (!istVerweis) continue;
        for (const w of Array.isArray(v) ? v : [v]) if (typeof w === 'string' && w) ids.add(w);
      }
    }
    const stand = await roh();
    const ziele = [...ids].map((i) => stand.map.get(i)).filter((x): x is Entity => !!x);
    const names: Record<string, string> = {};
    for (const z of ziele.length ? await sieve(request, ziele, stand.map) : []) names[z.id] = entityName(z);
    const texte = new Set<string>();
    verweiseIn(e.components, texte);
    const links: Record<string, { id: string; name: string }[]> = {};
    for (const [t, treffer] of await kandidaten(request, texte)) {
      links[t] = treffer.map((x) => ({ id: x.id, name: entityName(x) }));
    }
    return { names, links };
  }

  /**
   * `[[Name]]` wird beim Speichern zur Nummer (M11) — über das, was der
   * Schreibende sehen darf. `{ texts }` → `{ texts, open }`: die Texte mit
   * Ids, und welche Verweise nichts oder mehreres trafen.
   */
  app.post<{ Body: { texts?: unknown } }>('/api/links', async (request, reply) => {
    const texts = request.body?.texts;
    if (!Array.isArray(texts) || texts.some((t) => typeof t !== 'string')) {
      return reply.code(400).send({ error: 'texts: eine Liste von Texten' });
    }
    const ziele = new Set<string>();
    for (const t of texts as string[]) verweiseIn(t, ziele);
    const treffer = await kandidaten(request, ziele);
    const pool = new Map<string, Entity>();
    for (const l of treffer.values()) for (const e of l) pool.set(e.id, e);
    const open = new Set<string>();
    const raus = (texts as string[]).map((t) => {
      const r = idLinks(t, pool.values());
      r.open.forEach((o) => open.add(o));
      return r.text;
    });
    return { texts: raus, open: [...open] };
  });

  /**
   * Wer auf diesen Artikel zeigt. Die Gegenrichtung ist eine Abfrage (K1);
   * gestellt wurde sie bisher in der Oberfläche, über den ganzen Bestand —
   * den hat sie jetzt nicht mehr. Gefragt wird nur unter dem, was der
   * Betrachter sehen darf: eine Kante von einem verborgenen Artikel verriete
   * ihn.
   */
  app.get<{ Params: { id: string } }>('/api/entities/:id/backlinks', async (request, reply) => {
    const stand = await roh();
    const ziel = stand.map.get(request.params.id);
    if (!ziel || !(await sieve(request, [ziel], stand.map)).length) {
      return reply.code(404).send({ error: 'Nicht gefunden' });
    }
    /* Gesiebt wird nur, wer überhaupt auf ihn zeigt — nicht der ganze
       Bestand (W7: für einen Spieler eine halbe Sekunde je Artikelseite).
       Das Sieb nimmt Kanten nur weg, nie dazu; die Antwort ist dieselbe. */
    const zeigen = stand.alle.filter((e) => (e.relations ?? []).some((r) => r.to === request.params.id));
    const gesiebt = zeigen.length ? await sieve(request, zeigen, stand.map) : [];
    const registry = await repo.getRegistry();
    const felder = summaryFields(registry);
    return backlinks(registry, gesiebt, request.params.id).map((b) => ({
      from: summaryOf(b.from, felder),
      relation: b.relation,
    }));
  });

  app.get<{ Params: { id: string } }>('/api/entities/:id', async (request, reply) => {
    const stand = await roh();
    const entity = stand.map.get(request.params.id) ?? (await repo.getEntity(request.params.id));
    if (!entity) return reply.code(404).send({ error: 'Nicht gefunden' });
    const [einer] = await sieve(request, [entity], stand.map);
    /* Fällt er durchs Sieb, gibt es ihn für diesen Betrachter nicht.
       „Verboten" wäre die genauere Auskunft und die falsche: sie sagt, dass
       da etwas ist. Vorher stand hier `einer ?? entity` — der Rückfall
       schickte genau den Artikel, den das Sieb gerade zurückgehalten
       hatte. */
    if (!einer) return reply.code(404).send({ error: 'Nicht gefunden' });
    /* Die Namen, die der Artikel braucht, kommen mit (W7) — der Browser
       hält keinen Bestand mehr, aus dem er sie nachschlagen könnte. */
    return { ...einer, refs: await bezuegeVon(request, einer) };
  });

  /**
   * **Einen Artikel anlegen** (W7). Die Oberfläche nennt Art und Name, der
   * Server vergibt den Rest: die Peg-Id (undurchsichtig, wie jede), die
   * Nummer (`nextId` über den ganzen Bestand — gezählt wird, was dasteht),
   * die Karten, die Pflicht sind oder Vorgaben tragen, mit den Vorgaben
   * (`default`) aus dem Register. Geprüft wird wie beim Schreiben
   * (`validateEntity`); was Pflicht ist und keine Vorgabe hat (die Art
   * einer Aktion), schickt die Maske in `fields` mit.
   *
   * Rechte wie beim Schreiben: die Wache lässt nur durch, wer schreiben
   * darf (`mayWrite`) — einen Artikel, den es noch nicht gibt, besitzt
   * kein Spieler, also legt die Verwaltung an.
   */
  app.post<{ Body: { type?: unknown; name?: unknown; fields?: unknown } }>(
    '/api/entities',
    async (request, reply) => {
      const type = String(request.body?.type ?? '');
      const name = String(request.body?.name ?? '').trim();
      const registry = await repo.getRegistry();
      const def = registry.interfaces[type];
      if (!def || def.abstract) {
        return reply.code(400).send({ error: `Diese Art lässt sich nicht anlegen: ${type || '—'}` });
      }
      if (!name) return reply.code(400).send({ error: 'Der Name fehlt.' });

      const stand = await roh();
      const kette = typeChain(registry, type);
      const components: Record<string, Record<string, unknown>> = {};
      for (const t of kette) {
        const schema = registry.interfaces[t]?.schema;
        if (!schema) continue;
        const karte: Record<string, unknown> = {};
        for (const [k, p] of Object.entries(schema.properties ?? {})) {
          if (!p.derived && p.default !== undefined) karte[k] = structuredClone(p.default);
        }
        if (Object.keys(karte).length || (schema.required ?? []).length) components[t] = karte;
      }
      const extra = request.body?.fields;
      if (extra && typeof extra === 'object') {
        for (const [ref, wert] of Object.entries(extra as Record<string, unknown>)) {
          const [t, k] = ref.split('.');
          if (!t || !k || !kette.includes(t)) continue;
          if (wert === undefined || wert === null || wert === '') continue;
          (components[t] ??= {})[k] = wert;
        }
      }
      components['Identity'] = {
        ...(components['Identity'] ?? {}),
        name,
        id: nextId(stand.alle, type),
      };
      const neueId = (): string => `e_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
      let id = neueId();
      while (stand.map.has(id)) id = neueId();
      const entity: Entity = { id, interfaces: [type], name, components, relations: [] };

      const known = new Map(stand.alle.map((e) => [e.id, e.interfaces?.[0] ?? ''] as const));
      known.set(id, type);
      const issues = validateEntity(registry, entity, { knownTypes: known, stageOf: stageBases([...stand.alle, entity]) });
      if (issues.length) {
        return reply.code(422).send({ error: 'Validierung fehlgeschlagen', issues });
      }
      const stored = await repo.putEntity(entity);
      await repo.appendEvent('entity.created', id, { interfaces: [type] });
      return reply.code(201).send(stored);
    },
  );

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
      /* Id **und Art**: daran prüft ein Verweisfeld seinen Zieltyp. Der
         Artikel selbst kommt dazu, weil er in diesem Augenblick noch nicht
         im Bestand steht und ein Verweis auf sich selbst kein Bruch ist. */
      const known = new Map(
        (await repo.listEntities()).map((e) => [e.id, e.interfaces?.[0] ?? ''] as const),
      );
      known.set(entity.id, entity.interfaces?.[0] ?? '');
      /* Welche Zustände Stufen eines Grundzustands sind (D48) — gerechnet
         aus den Kanten, nicht gespeichert. */
      const stufen = stageBases([...(await repo.listEntities()), entity]);

      /* **Eine Instanz wird aufgelöst geprüft und ausgedünnt gespeichert.**
         Ihre Pflichtfelder stehen an der Vorlage; gespeichert wird nur, was
         abweicht. Eine Maske, die den aufgelösten Artikel zurückschickt,
         schreibt so nicht still jeden Wert der Vorlage fest — und wer den
         Wert der Vorlage einträgt, folgt ihr wieder. */
      let zuSchreiben = entity;
      let zuPruefen = entity;
      if (isInstance(entity)) {
        const alle = new Map((await repo.listEntities()).map((e) => [e.id, e]));
        alle.set(entity.id, entity);
        zuPruefen = resolveInstance(alle, entity);
        zuSchreiben = thinInstance(alle, entity);
      }

      const issues = validateEntity(registry, zuPruefen, { knownTypes: known, stageOf: stufen });
      if (issues.length) {
        return reply.code(422).send({ error: 'Validierung fehlgeschlagen', issues });
      }

      const stored = await repo.putEntity(zuSchreiben);
      await repo.appendEvent('entity.written', entity.id, {
        interfaces: entity.interfaces,
        cards: Object.keys(entity.components ?? {}),
      });
      return stored;
    },
  );

  app.delete<{ Params: { id: string } }>('/api/entities/:id', async (request, reply) => {
    const alle = new Map((await repo.listEntities()).map((e) => [e.id, e]));
    const weg = alle.get(request.params.id);
    if (weg) {
      /* Eine Vorlage nimmt beim Gehen nichts mit: ihre Instanzen bekommen
         vorher, was sie von ihr lasen. */
      for (const instanz of instancesOf(alle, weg)) {
        await repo.putEntity(detachInstance(alle, instanz));
      }
      /* Eine Kreatur nimmt ihre Instanz mit — die steht in keiner Liste und
         gehört nur ihr. Ein eigener Statblock bleibt stehen. */
      const registry = await repo.getRegistry();
      const teilVon = new Set(
        Object.values(registry.relations).filter((r) => r.asField === 'to').map((r) => r.type),
      );
      for (const o of alle.values()) {
        if (o.id === weg.id || !isInstance(o)) continue;
        if ((o.relations ?? []).some((r) => teilVon.has(r.type) && r.to === weg.id)) {
          await repo.deleteEntity(o.id);
        }
      }
    }
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
    const known = new Map(
      (await repo.listEntities()).map((e) => [e.id, e.interfaces?.[0] ?? ''] as const),
    );
    /* Dieselbe Auflösung wie beim Schreiben: eine Instanz ohne eigene
       Trefferpunkte ist keine unvollständige. */
    let pruefling = parsed.data as Entity;
    if (isInstance(pruefling)) {
      const alle = new Map((await repo.listEntities()).map((e) => [e.id, e]));
      alle.set(pruefling.id, pruefling);
      pruefling = resolveInstance(alle, pruefling);
    }
    const stufen = stageBases([...(await repo.listEntities()), pruefling]);
    return { issues: validateEntity(registry, pruefling, { knownTypes: known, stageOf: stufen }) };
  });

  return app;
}
