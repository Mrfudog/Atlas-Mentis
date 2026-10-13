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
import {
  BulkRequestSchema,
  EntitySchema,
  RegistrySchema,
  conditionProblem,
  planBulk,
  runChecks,
  selectEntities,
  storedKey,
  articleVisible,
  backlinks,
  classParts,
  currentCampaign,
  inPlay,
  detachInstance,
  registryUsage,
  entityName,
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
} from '@nw/model';
import type { BulkChange, Entity, Registry } from '@nw/model';
import type { Repository } from './repo.js';
import { registerVerwaltung } from './verwaltung.js';
import {
  ATTEMPT_WINDOW_MINUTES,
  MAX_ATTEMPTS,
  SESSION_DAYS,
  TOKEN_SCOPES,
  checkPassword,
  foldName,
  isLeitung,
  newApiToken,
  newInviteCode,
  tokenExpiry,
  hashPassword,
  hashToken,
  mayWrite,
  newSessionToken,
  passwordProblem,
  sessionExpiry,
  type ApiToken,
  type TokenScope,
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

  /**
   * Wer fragt: über den Sitzungskeks — oder über `Authorization: Bearer`
   * mit einem API-Token (W9). Ein Token wirkt wie die Sitzung seines
   * Kontos, beschränkt auf seine Rechte; es sieht und darf nie mehr als das
   * Konto, weil alles danach mit diesem `User` rechnet. Steht ein Token da
   * und gilt nicht, ist niemand angemeldet — auch mit einem Keks daneben:
   * ein Werkzeug, das still als jemand anderes weiterläuft, sucht man
   * lange.
   *
   * Einmal je Anfrage gefragt (Wache, Sieb und Route fragen alle), sonst
   * schöbe jede Frage die Sitzung nach.
   */
  interface Wer {
    user: User;
    token?: ApiToken | undefined;
  }
  const gefragt = new WeakMap<FastifyRequest, Promise<Wer | null>>();
  function werIst(request: FastifyRequest): Promise<Wer | null> {
    let p = gefragt.get(request);
    if (!p) {
      p = ermittle(request);
      gefragt.set(request, p);
    }
    return p;
  }
  async function ermittle(request: FastifyRequest): Promise<Wer | null> {
    const kopf = String(request.headers.authorization ?? '');
    if (/^bearer\s/i.test(kopf)) {
      const roh = kopf.slice(7).trim();
      if (!roh) return null;
      const treffer = await repo.useToken(hashToken(roh));
      if (!treffer || treffer.user.disabledAt) return null;
      const { passwordHash: _hash, ...user } = treffer.user;
      return { user, token: treffer.token };
    }
    const token = request.cookies?.[COOKIE];
    if (!token) return null;
    const user = await repo.touchSession(hashToken(token), sessionExpiry().toISOString());
    if (!user || user.disabledAt) return null;
    const { passwordHash: _hash, ...rest } = user;
    return { user: rest };
  }
  async function viewerOf(request: FastifyRequest): Promise<User | null> {
    return (await werIst(request))?.user ?? null;
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

  /**
   * **Wer das Register ändert:** die Verwaltung der Installation und die
   * Leitung (`gm`) der laufenden Kampagne. Das Register gilt für den ganzen
   * Tisch — eine Zeile zu ändern heisst, die Regeln zu ändern. Ein
   * Mitleiter sieht es und ändert es nicht; dieselbe Trennung wie bei den
   * Mitgliedern (CLAUDE.md, Rolle am Konto).
   *
   * Gefragt wird die **laufende** Kampagne (`currentCampaign`), weil das
   * Register keiner Ebene gehört: wer in einer anderen Runde leitet und
   * in dieser mitspielt, schreibt hier die Regeln nicht.
   */
  async function mayEditRegistry(user: User): Promise<boolean> {
    if (user.isAdmin) return true;
    const rollen = user.roles ?? {};
    if (!Object.values(rollen).includes('gm')) return false;
    const alle = new Map((await repo.listEntities()).map((e) => [e.id, e]));
    const kampagne = currentCampaign(alle, (await repo.getRegistry()).settings ?? null);
    return !!kampagne && rollen[kampagne.id] === 'gm';
  }

  app.get('/api/me', async (request) => {
    const wer = await werIst(request);
    const user = wer?.user ?? null;
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
      if (e) actors.push({ id, name: entityName(e) });
    }
    return {
      user,
      actors,
      writable,
      /* Ob dieser Betrachter das Register ändern darf — gesagt vom Server,
         der es beim Schreiben ohnehin prüft (`mayEditRegistry`). */
      registry: user ? await mayEditRegistry(user) : false,
      /* Ein frischer Server sagt es geradeheraus. Das ist keine Auskunft,
         die jemandem nützt, den es nichts angeht: wer den Port erreicht,
         sieht ohnehin, dass nichts eingerichtet ist. */
      setup: count === 0 ? 'Kein Konto angelegt. `pnpm --filter @nw/server user add <name> --admin`' : null,
      /* Ob sich hier überhaupt jemand anmelden kann, ohne dass die
         Spielleitung etwas tut. Die Maske zeigt den Registrieren-Knopf nur
         dann — einer, der bei jedem Versuch „Einladung fehlt" sagt, ist
         kein Knopf, sondern eine Enttäuschung. */
      invites: count === 0 ? false : (await repo.listInvites()).length > 0,
      /* Über welches Token gefragt wird — ein Werkzeug soll sehen, was es
         darf, ohne es auszuprobieren. */
      token: wer?.token
        ? { name: wer.token.name, scope: wer.token.scope, expiresAt: wer.token.expiresAt }
        : null,
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
        /* Eine Einladung führt in eine Kampagne, mit der Rolle darin (W3).
           Danach steht die Rolle am Konto und nicht mehr an der Einladung —
           die ist mit dem letzten Gebrauch weg. */
        roles: invite.campaignId && invite.role ? { [invite.campaignId]: invite.role } : {},
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

  /* Einladungen, Kampagnen, Mitglieder und Konten: `verwaltung.ts` (W3). */
  registerVerwaltung(app, { repo, viewerOf });

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

    const wer = await werIst(request);
    const user = wer?.user ?? null;
    (request as FastifyRequest & { viewer?: User | null }).viewer = user;
    /* Zwei POST schreiben nichts: prüfen (`/api/validate`) und die
       Vorschau einer Massenänderung (`dryRun`). Ein Token mit `read` darf
       sie, sonst könnte ein Werkzeug nicht fragen, was geschähe. */
    const liestNur =
      url === '/api/validate' ||
      (url === '/api/bulk' && (request.body as { dryRun?: unknown } | null)?.dryRun === true);
    const schreibt = request.method !== 'GET' && request.method !== 'HEAD' && !liestNur;

    if (!user) {
      const frisch = (await repo.countUsers()) === 0 && (await repo.countEntities()) === 0;
      if (frisch && !schreibt) return; // frischer Server: lesen ja, schreiben nie
      return reply.code(401).send({ error: 'Nicht angemeldet.' });
    }
    /* Vor jeder anderen Regel: ein Lesetoken schreibt nirgends — auch
       nicht dort, wo das Konto es dürfte (Register, Verwaltung). */
    if (schreibt && wer?.token && wer.token.scope !== 'write') {
      return reply.code(403).send({ error: 'Dieses Token darf nur lesen.' });
    }
    /* Das Register gehört der Spielleitung: eine Registerzeile zu ändern
       heisst, die Regeln zu ändern. Auch die Zählung des Bestands gehört
       ihr — sie zählt über alles, auch über Verborgenes. */
    if (url.startsWith('/api/registry') && (schreibt || url.startsWith('/api/registry/usage'))) {
      if (await mayEditRegistry(user)) return;
      return reply.code(403).send({ error: 'Das Register ändert die Spielleitung.' });
    }
    if (!schreibt) return;
    if (user.isAdmin) return;
    /* Die eigenen Tokens verwaltet jedes Konto; die Massenänderung prüft
       je Artikel selbst, ob geschrieben werden darf (`mayWrite`). */
    if (url === '/api/tokens' || url.startsWith('/api/tokens/')) return;
    if ((url === '/api/bulk' || url.startsWith('/api/bulk/')) && isLeitung(user)) return;
    /* Verwaltung und Einladungen prüfen selbst: das Recht hängt an der
       Kampagne im Pfad (gm ändert, co-gm sieht), nicht am Konto allein. */
    if (url.startsWith('/api/campaigns') || url.startsWith('/api/invites')) return;

    /* Ein Spieler schreibt seine Figur und was an ihr hängt — und sonst
       nichts. */
    const id = url.startsWith('/api/entities/') ? decodeURIComponent(url.slice(14)) : '';
    if (!id || !mayWrite(user, await ownedBy(user), id)) {
      return reply.code(403).send({ error: 'Das gehört dir nicht.' });
    }
  });

  // ---------------------------------------------------------------- registry

  app.get('/api/registry', async () => repo.getRegistry());

  /**
   * **Was der Bestand an jeder Zeile trägt** — je Art, Karte, Feld,
   * Listenwert und Kantenart (`registryUsage`). Das Register fragt es,
   * bevor es ein Feld löscht, einen Typ herausnimmt oder einen Wert
   * streicht: was dabei verloren ginge oder beim nächsten Speichern
   * abgewiesen würde, wird vorher gezählt und gesagt. Ungesiebt, darum nur
   * für die, die das Register ändern (Wache oben).
   */
  app.get('/api/registry/usage', async () =>
    registryUsage(await repo.getRegistry(), await repo.listEntities()),
  );

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
  async function sieve(request: FastifyRequest, entities: Entity[], bestand?: Entity[]): Promise<Entity[]> {
    const user = await viewerOf(request);
    /* **Eine Instanz geht aufgelöst hinaus**, mit ihrer Vorlage darin und
       der Angabe, welche Felder von dort kommen. Gespeichert ist an ihr nur,
       was abweicht; ohne Auflösung hätte Wache 1 keine Trefferpunkte. */
    const roh = new Map((bestand ?? (await repo.listEntities())).map((e) => [e.id, e]));
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
      .map((e) => redactEntity(registry, alle, e, augen, gmFields));
  }

  app.get<{ Querystring: { as?: string } }>('/api/entities', async (request) => {
    /* Die Liste ist zugleich der Zusammenhang, gegen den gesiebt wird —
       einmal holen, nicht zweimal. */
    const alle = await repo.listEntities();
    const gesiebt = await sieve(request, alle, alle);
    /* `?as=summary`: die Kurzfassung für Liste, Verweise und Auswahlen.
       Gekürzt wird nach dem Sieb, damit ein Deckname der Deckname bleibt.
       Ohne die Angabe bleibt es der ganze Bestand — Ausfuhr und Prüfungen
       lesen ihn so. */
    if (request.query.as !== 'summary') return gesiebt;
    const felder = summaryFields(await repo.getRegistry());
    return gesiebt.map((e) => summaryOf(e, felder));
  });

  /**
   * Wer auf diesen Artikel zeigt. Die Gegenrichtung ist eine Abfrage (K1);
   * gestellt wurde sie bisher in der Oberfläche, über den ganzen Bestand —
   * den hat sie jetzt nicht mehr. Gefragt wird nur unter dem, was der
   * Betrachter sehen darf: eine Kante von einem verborgenen Artikel verriete
   * ihn.
   */
  app.get<{ Params: { id: string } }>('/api/entities/:id/backlinks', async (request, reply) => {
    const alle = await repo.listEntities();
    const gesiebt = await sieve(request, alle, alle);
    if (!gesiebt.some((e) => e.id === request.params.id)) {
      return reply.code(404).send({ error: 'Nicht gefunden' });
    }
    const registry = await repo.getRegistry();
    const felder = summaryFields(registry);
    return backlinks(registry, gesiebt, request.params.id).map((b) => ({
      from: summaryOf(b.from, felder),
      relation: b.relation,
    }));
  });

  /**
   * **Eine Klasse samt allem, was ihre Ansicht braucht** (W6): die Klasse,
   * ihre Unterklassen, die Stufentabellen und jedes Merkmal, das eine davon
   * gewährt oder einbettet (`classParts`). Eine Antwort statt einer Anfrage
   * je Merkmal — und nicht die 7 000 Merkmale des ganzen Bestands, von
   * denen die Kurzfassung ohnehin keinen Text trägt.
   *
   * Gesiebt wird wie überall (`sieve`). Danach wird **auf dem Gesiebten**
   * noch einmal gesammelt: ein Merkmal, das nur eine verborgene Unterklasse
   * gewährt, verriete sonst, dass es sie gibt.
   */
  app.get<{ Params: { id: string } }>('/api/classes/:id', async (request, reply) => {
    const alle = await repo.listEntities();
    const roh = classParts(alle, request.params.id);
    if (!roh) return reply.code(404).send({ error: 'Nicht gefunden' });
    const byId = new Map(alle.map((e) => [e.id, e]));
    const ids = [roh.klass, ...roh.subclasses, ...roh.tables, ...roh.features];
    const gesiebt = await sieve(
      request,
      ids.map((i) => byId.get(i)).filter((e): e is Entity => !!e),
      alle,
    );
    const teile = classParts(gesiebt, request.params.id);
    if (!teile) return reply.code(404).send({ error: 'Nicht gefunden' });
    const nach = new Map(gesiebt.map((e) => [e.id, e]));
    const nimm = (l: string[]) => l.map((i) => nach.get(i)).filter((e): e is Entity => !!e);
    return {
      class: nach.get(teile.klass),
      subclasses: nimm(teile.subclasses),
      tables: nimm(teile.tables),
      features: nimm(teile.features),
    };
  });

  app.get<{ Params: { id: string } }>('/api/entities/:id', async (request, reply) => {
    const entity = await repo.getEntity(request.params.id);
    if (!entity) return reply.code(404).send({ error: 'Nicht gefunden' });
    const [einer] = await sieve(request, [entity]);
    /* Fällt er durchs Sieb, gibt es ihn für diesen Betrachter nicht.
       „Verboten" wäre die genauere Auskunft und die falsche: sie sagt, dass
       da etwas ist. Vorher stand hier `einer ?? entity` — der Rückfall
       schickte genau den Artikel, den das Sieb gerade zurückgehalten
       hatte. */
    if (!einer) return reply.code(404).send({ error: 'Nicht gefunden' });
    return einer;
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

  // ---------------------------------------------------------- API-Tokens
  /*
   * Eigene Tokens anlegen, ansehen, widerrufen (W9). Nur aus einer
   * angemeldeten Sitzung, nie mit einem Token: ein Token, das Tokens
   * anlegt, machte aus `read` ein `write`, und aus einem verlorenen eines
   * zehn.
   */
  async function nurSitzung(request: FastifyRequest): Promise<User | string> {
    const wer = await werIst(request);
    if (!wer) return 'Nicht angemeldet.';
    if (wer.token) return 'Tokens werden in einer angemeldeten Sitzung verwaltet, nicht mit einem Token.';
    return wer.user;
  }
  const tokenAus = (t: ApiToken) => ({
    id: t.id,
    name: t.name,
    scope: t.scope,
    expiresAt: t.expiresAt,
    createdAt: t.createdAt ?? null,
    lastUsedAt: t.lastUsedAt ?? null,
  });

  app.get('/api/tokens', async (request, reply) => {
    const user = await nurSitzung(request);
    if (typeof user === 'string') return reply.code(403).send({ error: user });
    return (await repo.listTokens(user.id)).map(tokenAus);
  });

  app.post<{ Body: { name?: string; scope?: string; days?: number } }>('/api/tokens', async (request, reply) => {
    const user = await nurSitzung(request);
    if (typeof user === 'string') return reply.code(403).send({ error: user });
    const name = String(request.body?.name ?? '').trim();
    if (!name) return reply.code(400).send({ error: 'Ein Token braucht einen Namen — woran erkennst du es sonst?' });
    const scope = (request.body?.scope ?? 'read') as TokenScope;
    if (!TOKEN_SCOPES.includes(scope)) return reply.code(400).send({ error: 'Rechte: read oder write.' });
    const klartext = newApiToken();
    const token: ApiToken = {
      id: `tok_${newInviteCode().slice(0, 12)}`,
      userId: user.id,
      name: name.slice(0, 80),
      tokenHash: hashToken(klartext),
      scope,
      expiresAt: tokenExpiry(request.body?.days).toISOString(),
    };
    await repo.createToken(token);
    await repo.appendEvent('token.created', user.id, { id: token.id, name: token.name, scope, expiresAt: token.expiresAt });
    /* Einmal und nie wieder — gespeichert ist nur der Hash. */
    return reply.code(201).send({ ...tokenAus(token), token: klartext });
  });

  app.delete<{ Params: { id: string } }>('/api/tokens/:id', async (request, reply) => {
    const user = await nurSitzung(request);
    if (typeof user === 'string') return reply.code(403).send({ error: user });
    if (!(await repo.dropToken(user.id, request.params.id))) return reply.code(404).send({ error: 'Nicht gefunden' });
    await repo.appendEvent('token.revoked', user.id, { id: request.params.id });
    return { ok: true };
  });

  // ------------------------------------------------------------ Werkbank
  /*
   * Prüfungen und Massenänderungen (W9) — für Leitung und Verwaltung.
   * Gerechnet wird über den Bestand, **wie ihn der Fragende sieht** (das
   * Sieb), geschrieben nur, was `mayWrite` ihm erlaubt, und jeder Artikel
   * geht durch `validateEntity`.
   */
  async function werkbankFuer(request: FastifyRequest): Promise<Wer | string> {
    const wer = await werIst(request);
    if (!wer) return 'Nicht angemeldet.';
    if (!isLeitung(wer.user)) return 'Die Werkbank ist für Leitung und Verwaltung.';
    return wer;
  }

  app.get<{ Querystring: { check?: string; limit?: string } }>('/api/checks', async (request, reply) => {
    const wer = await werkbankFuer(request);
    if (typeof wer === 'string') return reply.code(403).send({ error: wer });
    const t0 = Date.now();
    const alle = await repo.listEntities();
    const gesiebt = await sieve(request, alle, alle);
    const registry = await repo.getRegistry();
    const exists = new Map(alle.map((e) => [e.id, e.interfaces?.[0] ?? ''] as const));
    const roh = String(request.query.limit ?? '50');
    const limit = roh === 'all' ? Number.MAX_SAFE_INTEGER : Math.max(0, Math.floor(Number(roh)) || 0);
    const only = request.query.check ? request.query.check.split(',').map((x) => x.trim()).filter(Boolean) : undefined;
    const checks = runChecks({ registry, entities: gesiebt, exists }, { limit, ...(only ? { only } : {}) });
    return { total: gesiebt.length, ms: Date.now() - t0, checks };
  });

  /** Ein Artikel in einer Antwort der Werkbank: wer, was, was sich ändert. */
  const zeile = (c: BulkChange) => {
    const e = c.after ?? c.before!;
    return {
      id: c.id,
      name: String(e.components?.['Identity']?.['name'] ?? e.name ?? c.id),
      type: e.interfaces?.[0] ?? '',
      change: c.after === null ? 'delete' : c.before === null ? 'create' : 'update',
      summary: c.summary,
    };
  };

  /**
   * Prüft die Nachher-Fassungen eines Laufs, als stünden sie schon da:
   * Instanzen aufgelöst geprüft und ausgedünnt gespeichert (wie `PUT`),
   * Rechte je Artikel. Gibt die Änderungen zurück, wie sie geschrieben
   * würden, und die Abgelehnten.
   */
  async function pruefeLauf(user: User, registry: Registry, roh: Map<string, Entity>, changes: BulkChange[]) {
    const danach = new Map(roh);
    for (const c of changes) {
      if (c.after) danach.set(c.id, c.after);
      else danach.delete(c.id);
    }
    const known = new Map([...danach.values()].map((e) => [e.id, e.interfaces?.[0] ?? ''] as const));
    /* Einmal, nicht je Artikel (siehe `invalid` in checks.ts). */
    const ids = new Set(known.keys());
    const stufen = stageBases(danach.values());
    const eigen = user.isAdmin ? null : await ownedBy(user);
    const abgelehnt: { id: string; name: string; type: string; issues: string[] }[] = [];
    const geprueft: BulkChange[] = [];
    for (const c of changes) {
      const e = c.after ?? c.before!;
      const name = String(e.components?.['Identity']?.['name'] ?? e.name ?? c.id);
      if (eigen && !mayWrite(user, eigen, c.id)) {
        abgelehnt.push({ id: c.id, name, type: e.interfaces?.[0] ?? '', issues: ['Das gehört dir nicht.'] });
        continue;
      }
      if (!c.after) {
        geprueft.push(c);
        continue;
      }
      const pruefling = isInstance(c.after) ? resolveInstance(danach, c.after) : c.after;
      const issues = validateEntity(registry, pruefling, { knownTypes: known, knownIds: ids, stageOf: stufen });
      if (issues.length) {
        abgelehnt.push({ id: c.id, name, type: e.interfaces?.[0] ?? '', issues: issues.map((i) => i.message) });
        continue;
      }
      const after = isInstance(c.after) ? thinInstance(danach, c.after) : c.after;
      if (c.before && storedKey(after) === storedKey(c.before)) continue;
      geprueft.push({ ...c, after });
    }
    return { geprueft, abgelehnt };
  }

  /**
   * Eine Massenänderung. `dryRun: true` sagt, was geschähe — Zahl,
   * Beispiele, Ablehnungen —, und schreibt nichts. Ohne `dryRun` geht jeder
   * Artikel durch `validateEntity`; besteht einer nicht, wird **nichts**
   * geschrieben (ausser `skipRejected`, und nie beim Löschen). Vor dem
   * ersten Schreiben steht das Ereignis im Protokoll, mit jeder alten
   * Fassung: bricht der Lauf mittendrin ab, ist er trotzdem rückgängig zu
   * machen.
   */
  app.post<{ Body: unknown }>('/api/bulk', async (request, reply) => {
    const wer = await werkbankFuer(request);
    if (typeof wer === 'string') return reply.code(403).send({ error: wer });
    const parsed = BulkRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Massenänderung ungültig', issues: parsed.error.issues });
    const auftrag = parsed.data;
    const falsch = (auftrag.select.where ?? []).map(conditionProblem).filter((x): x is string => !!x);
    if (falsch.length) return reply.code(400).send({ error: falsch.join('; ') });
    const merge = auftrag.ops.find((o) => o.op === 'merge');
    if (merge && auftrag.ops.length > 1) {
      return reply.code(400).send({ error: 'Zusammenführen steht allein — nicht mit anderen Operationen in einem Lauf.' });
    }
    if (!auftrag.select.ids?.length && !auftrag.select.types?.length && !auftrag.select.layer && !auftrag.select.tag && !auftrag.select.where?.length) {
      return reply.code(400).send({ error: 'Eine Auswahl ohne Bedingung träfe den ganzen Bestand — sag, welche Artikel.' });
    }

    const t0 = Date.now();
    const alle = await repo.listEntities();
    const roh = new Map(alle.map((e) => [e.id, e]));
    const registry = await repo.getRegistry();
    const gesiebt = await sieve(request, alle, alle);
    const auswahl = selectEntities(registry, gesiebt, auftrag.select);
    const plan = planBulk(registry, roh, auswahl.map((e) => e.id), auftrag.ops);
    const { geprueft, abgelehnt } = await pruefeLauf(wer.user, registry, roh, plan.changes);
    const loescht = geprueft.filter((c) => !c.after).length;
    const limit = auftrag.limit ?? 50;
    const antwort = {
      dryRun: auftrag.dryRun === true,
      selected: plan.selected,
      changed: geprueft.length - loescht,
      deleted: loescht,
      examples: geprueft.slice(0, limit).map(zeile),
      rejected: abgelehnt.slice(0, limit),
      rejectedCount: abgelehnt.length,
      skipped: plan.skipped.slice(0, limit),
      skippedCount: plan.skipped.length,
      ms: 0,
    };
    if (auftrag.dryRun) return { ...antwort, ms: Date.now() - t0 };

    if (loescht > 1 && auftrag.confirmDelete !== loescht) {
      return reply.code(409).send({
        ...antwort,
        error: `Dieser Lauf löscht ${loescht} Artikel. Bestätige mit "confirmDelete": ${loescht}.`,
      });
    }
    if (abgelehnt.length && (!auftrag.skipRejected || loescht > 0)) {
      return reply.code(422).send({
        ...antwort,
        error: `${abgelehnt.length} Artikel bestehen die Prüfung nicht — nichts geschrieben.`,
      });
    }
    if (!geprueft.length) return { ...antwort, id: null, ms: Date.now() - t0 };

    const { dryRun: _d, ...was } = auftrag;
    const id = await repo.appendEvent('bulk', undefined, {
      by: { id: wer.user.id, name: wer.user.name },
      token: wer.token?.name ?? null,
      request: was,
      selected: plan.selected,
      changed: antwort.changed,
      deleted: loescht,
      summary: geprueft.slice(0, 5).map((c) => `${zeile(c).name}: ${c.summary.join(', ')}`),
      changes: geprueft.map((c) => ({ id: c.id, before: c.before, after: c.after })),
    });
    let geschrieben = 0;
    try {
      /* Zuerst die gehenden: ein bleibender Artikel nimmt ihre Kanten mit,
         und eine Kanten-Id ist Schlüssel der ganzen Tabelle. */
      for (const c of geprueft) if (!c.after) {
        await repo.deleteEntity(c.id);
        geschrieben += 1;
      }
      for (const c of geprueft) if (c.after) {
        await repo.putEntity(c.after);
        geschrieben += 1;
      }
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        error: `Abgebrochen nach ${geschrieben} von ${geprueft.length} Artikeln. Rückgängig: POST /api/bulk/${id}/undo`,
        id,
      });
    }
    return { ...antwort, id, ms: Date.now() - t0 };
  });

  /** Die letzten Massenänderungen, ohne ihre alten Fassungen. */
  app.get<{ Querystring: { limit?: string } }>('/api/bulk', async (request, reply) => {
    const wer = await werkbankFuer(request);
    if (typeof wer === 'string') return reply.code(403).send({ error: wer });
    const limit = Math.min(200, Math.max(1, Number(request.query.limit) || 20));
    const laeufe = await repo.listEvents({ name: 'bulk', limit, light: true });
    const zurueck = new Set((await repo.listEvents({ name: 'bulk.undone', limit: 1000, light: true })).map((e) => e.subject));
    return laeufe.map((e) => ({ id: e.id, at: e.at, undone: zurueck.has(e.id), ...(e.payload as object) }));
  });

  /**
   * Eine Massenänderung zurücknehmen: jede alte Fassung wieder hin, jeder
   * gelöschte Artikel wieder da. Hat jemand einen Artikel seither anders
   * geändert, steht er als Konflikt da, und es geschieht nichts — ausser
   * mit `force`, dann gewinnt die alte Fassung. Auch das geht durch
   * `validateEntity`, und auch das steht im Protokoll.
   */
  app.post<{ Params: { id: string }; Body: { force?: boolean; dryRun?: boolean } | null }>(
    '/api/bulk/:id/undo',
    async (request, reply) => {
      const wer = await werkbankFuer(request);
      if (typeof wer === 'string') return reply.code(403).send({ error: wer });
      const ereignis = await repo.getEvent(request.params.id);
      if (!ereignis || ereignis.name !== 'bulk') return reply.code(404).send({ error: 'Nicht gefunden' });
      if ((await repo.listEvents({ name: 'bulk.undone', subject: ereignis.id, limit: 1, light: true })).length) {
        return reply.code(409).send({ error: 'Schon rückgängig gemacht.' });
      }
      const payload = ereignis.payload as { changes?: { id: string; before: Entity | null; after: Entity | null }[] };
      const alle = await repo.listEntities();
      const roh = new Map(alle.map((e) => [e.id, e]));
      const konflikte: { id: string; name: string; reason: string }[] = [];
      const zurueck: BulkChange[] = [];
      for (const c of [...(payload.changes ?? [])].reverse()) {
        const jetzt = roh.get(c.id) ?? null;
        const name = String((c.before ?? c.after)?.components?.['Identity']?.['name'] ?? c.id);
        if (storedKey(jetzt) === storedKey(c.before)) continue; // steht schon wie vorher
        if (storedKey(jetzt) !== storedKey(c.after)) {
          konflikte.push({
            id: c.id,
            name,
            reason: jetzt ? (c.after ? 'changed since' : 'exists again') : 'deleted since',
          });
          if (!request.body?.force) continue;
        }
        zurueck.push({ id: c.id, before: jetzt, after: c.before, summary: [] });
      }
      if (konflikte.length && !request.body?.force) {
        return reply.code(409).send({ error: `${konflikte.length} Artikel wurden seither geändert. Mit "force": true gewinnt die alte Fassung.`, conflicts: konflikte });
      }
      const registry = await repo.getRegistry();
      const { geprueft, abgelehnt } = await pruefeLauf(wer.user, registry, roh, zurueck);
      const antwort = { restored: geprueft.length, conflicts: konflikte, rejected: abgelehnt };
      if (request.body?.dryRun) return { dryRun: true, ...antwort };
      if (abgelehnt.length) return reply.code(422).send({ error: 'Die alten Fassungen bestehen die Prüfung nicht — nichts geschrieben.', ...antwort });
      await repo.appendEvent('bulk.undone', ereignis.id, {
        by: { id: wer.user.id, name: wer.user.name },
        token: wer.token?.name ?? null,
        changes: geprueft.map((c) => ({ id: c.id, before: c.before, after: c.after })),
      });
      for (const c of geprueft) if (!c.after) await repo.deleteEntity(c.id);
      for (const c of geprueft) if (c.after) await repo.putEntity(c.after);
      return antwort;
    },
  );


  return app;
}
