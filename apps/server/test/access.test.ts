/**
 * Zugang (REQ-031, 032).
 *
 * Was hier geprüft wird, ist nicht „kann man sich anmelden" — das merkt man
 * sofort. Geprüft wird, was man nicht merkt: dass ein frischer Server nicht
 * schreibt, dass die Antwort nicht verrät, welche Namen es gibt, dass ein
 * gesperrtes Konto wirklich draussen ist, und dass ein Spieler genau seine
 * Figur schreiben kann und nichts daneben.
 */

import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword, hashToken, passwordProblem } from '../src/auth.js';
import { runUserCommand } from '../src/user.js';

const PASSWORT = 'nebel-wacht-am-tor';

const rook: Entity = {
  id: 'pc_rook',
  interfaces: ['PlayerCharacter'],
  name: 'Rook',
  tags: [],
  components: {
    Base: { text: 'Rook', key: 'pc/rook', aliases: [], value: 'used' },
    PlayerCharacter: { level: 5 },
  },
  blocks: [],
  relations: [{ id: 'r1', type: 'carries', to: 'inv_rook', props: {} }],
};
const inv: Entity = {
  id: 'inv_rook',
  interfaces: ['Inventory'],
  name: 'Rooks Sachen',
  tags: [],
  components: {
    Base: { text: 'Rooks Sachen', key: 'inv/rook', aliases: [], value: 'used' },
  },
  blocks: [],
  relations: [],
};
const fremd: Entity = {
  id: 'n_volo',
  interfaces: ['NPC'],
  name: 'Volo',
  tags: [],
  components: {
    Base: { text: 'Volo', key: 'npc/volo', aliases: [], value: 'used' },
  },
  blocks: [],
  relations: [],
};

function makeApp() {
  const repo = new InMemoryRepository(seedRegistry, [rook, inv, fremd]);
  return { app: buildApp({ repo }), repo };
}

async function addUser(
  repo: InMemoryRepository,
  name: string,
  opts: { gm?: boolean; actorId?: string; actorIds?: string[] } = {},
) {
  await repo.putUser({
    id: randomUUID(),
    name,
    passwordHash: await hashPassword(PASSWORT),
    isGm: opts.gm ?? false,
    actorIds: opts.actorIds ?? (opts.actorId ? [opts.actorId] : []),
  });
}

async function login(app: ReturnType<typeof buildApp>, name: string, password = PASSWORT) {
  return app.inject({ method: 'POST', url: '/api/login', payload: { name, password } });
}
function cookieOf(res: { cookies: { name: string; value: string }[] }): string {
  const c = res.cookies.find((x) => x.name === 'nw_session');
  return c ? `nw_session=${c.value}` : '';
}

describe('a fresh server', () => {
  let app: ReturnType<typeof buildApp>;
  let repo: InMemoryRepository;
  beforeEach(() => {
    ({ app, repo } = makeApp());
  });

  /* Der wichtigste Fall: kein Konto heisst kein Standardpasswort. Wer je
     eines vergessen hat zu ändern, weiss warum das hier steht. */
  it('says how to make the first account instead of having a default one', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me' });
    expect(res.statusCode).toBe(200);
    expect(res.json().user).toBeNull();
    expect(res.json().setup).toMatch(/user add/);
  });

  it('reads without an account, and writes nothing at all', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/entities' })).statusCode).toBe(200);
    const schreiben = await app.inject({
      method: 'PUT',
      url: '/api/entities/n_volo',
      payload: fremd,
    });
    expect(schreiben.statusCode).toBe(401);
    expect(await repo.countUsers()).toBe(0);
  });
});

describe('logging in', () => {
  let app: ReturnType<typeof buildApp>;
  let repo: InMemoryRepository;
  beforeEach(async () => {
    ({ app, repo } = makeApp());
    await addUser(repo, 'Basil', { gm: true });
  });

  it('takes the right password and hands out a session', async () => {
    const res = await login(app, 'Basil');
    expect(res.statusCode).toBe(200);
    expect(res.json().user.isGm).toBe(true);
    expect(res.json().user.passwordHash).toBeUndefined();
    expect(cookieOf(res)).toMatch(/^nw_session=/);
  });

  /* Gross- und Kleinschreibung: „Basil" und „basil" sind dieselbe Person.
     Zwei Konten, die sich nur darin unterscheiden, wären eine Falle. */
  it('does not care how the name is capitalised', async () => {
    expect((await login(app, 'basil')).statusCode).toBe(200);
    expect((await login(app, '  BASIL ')).statusCode).toBe(200);
  });

  /* Dieselbe Auskunft für beide Fälle: welcher Name existiert, geht
     niemanden etwas an, der ihn nicht schon kennt. */
  it('answers the same whether the name exists or the password is wrong', async () => {
    const falschesPasswort = await login(app, 'Basil', 'daneben-daneben');
    const kennt = await login(app, 'gibtsnicht', 'daneben-daneben');
    expect(falschesPasswort.statusCode).toBe(401);
    expect(kennt.statusCode).toBe(401);
    expect(kennt.json().error).toBe(falschesPasswort.json().error);
  });

  it('shuts the door after too many tries, and opens it again on success', async () => {
    for (let i = 0; i < 8; i += 1) await login(app, 'Basil', 'daneben-daneben');
    const gesperrt = await login(app, 'Basil', PASSWORT);
    expect(gesperrt.statusCode).toBe(429);
  });

  it('forgets the failures once someone gets in', async () => {
    for (let i = 0; i < 3; i += 1) await login(app, 'Basil', 'daneben-daneben');
    expect((await login(app, 'Basil')).statusCode).toBe(200);
    for (let i = 0; i < 7; i += 1) await login(app, 'Basil', 'daneben-daneben');
    expect((await login(app, 'Basil')).statusCode).toBe(200);
  });

  it('lets a session go, on this device and on all of them', async () => {
    const angemeldet = await login(app, 'Basil');
    const keks = cookieOf(angemeldet);
    const me = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: keks } });
    expect(me.json().user.name).toBe('Basil');

    await app.inject({ method: 'POST', url: '/api/logout', headers: { cookie: keks } });
    const danach = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: keks } });
    expect(danach.json().user).toBeNull();
  });

  it('turns a disabled account away, session or not', async () => {
    const keks = cookieOf(await login(app, 'Basil'));
    const user = await repo.findUserByName('basil');
    await repo.putUser({ ...user!, disabledAt: new Date().toISOString() });
    const me = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: keks } });
    expect(me.json().user).toBeNull();
    expect((await login(app, 'Basil')).statusCode).toBe(401);
  });
});

describe('who may write what', () => {
  let app: ReturnType<typeof buildApp>;
  let repo: InMemoryRepository;
  beforeEach(async () => {
    ({ app, repo } = makeApp());
    await addUser(repo, 'Basil', { gm: true });
    await addUser(repo, 'Sela', { actorId: 'pc_rook' });
  });

  it('lets the GM write anything', async () => {
    const keks = cookieOf(await login(app, 'Basil'));
    const res = await app.inject({
      method: 'PUT',
      url: '/api/entities/n_volo',
      headers: { cookie: keks },
      payload: fremd,
    });
    expect(res.statusCode).toBe(200);
  });

  it('lets a player write their own character', async () => {
    const keks = cookieOf(await login(app, 'Sela'));
    const res = await app.inject({
      method: 'PUT',
      url: '/api/entities/pc_rook',
      headers: { cookie: keks },
      payload: rook,
    });
    expect(res.statusCode).toBe(200);
  });

  /* Und was über eine Kante an der Figur hängt. Die Kante steht in den
     Daten, also wird sie dort nachgesehen und nicht hier behauptet. */
  it('lets a player write what hangs off their character', async () => {
    const keks = cookieOf(await login(app, 'Sela'));
    const res = await app.inject({
      method: 'PUT',
      url: '/api/entities/inv_rook',
      headers: { cookie: keks },
      payload: inv,
    });
    expect(res.statusCode).toBe(200);
  });

  it('keeps a player out of everything else', async () => {
    const keks = cookieOf(await login(app, 'Sela'));
    const fremdes = await app.inject({
      method: 'PUT',
      url: '/api/entities/n_volo',
      headers: { cookie: keks },
      payload: fremd,
    });
    expect(fremdes.statusCode).toBe(403);
    const loeschen = await app.inject({
      method: 'DELETE',
      url: '/api/entities/n_volo',
      headers: { cookie: keks },
    });
    expect(loeschen.statusCode).toBe(403);
  });

  /* Eine Registerzeile zu ändern heisst, die Regeln zu ändern. Das ist
     Sache der Spielleitung, und die Antwort sagt auch warum. */
  it('keeps the registry with the GM', async () => {
    const keks = cookieOf(await login(app, 'Sela'));
    const res = await app.inject({
      method: 'PUT',
      url: '/api/registry/views',
      headers: { cookie: keks },
      payload: seedRegistry.views,
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toMatch(/Spielleitung/);
  });

  /**
   * Der Server sagt der Oberfläche, was jemand schreiben darf — sie rechnet
   * es nicht zum zweiten Mal aus. Eine zweite Rechnung wäre die zweite
   * Stelle, an der jemand eine Kante vergisst, und dann zeigt die Maske
   * einen Knopf, den der Server danach abweist.
   */
  it('tells the client what this viewer may write', async () => {
    const keks = cookieOf(await login(app, 'Sela'));
    const me = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: keks } });
    const writable: string[] = me.json().writable;
    expect(writable).toContain('pc_rook'); // die eigene Figur
    expect(writable).toContain('inv_rook'); // und was über `carries` daran hängt
    expect(writable).not.toContain('n_volo');
  });

  /* „Alles" ist `null` und keine Liste: der Spielleitung den ganzen Bestand
     aufzuzählen wäre eine Liste, die mit jeder Sitzung länger wird. */
  it('says “everything” as null for the GM, not as a list', async () => {
    const keks = cookieOf(await login(app, 'Basil'));
    const me = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: keks } });
    expect(me.json().writable).toBeNull();
  });

  it('still lets a player read', async () => {
    const keks = cookieOf(await login(app, 'Sela'));
    const res = await app.inject({
      method: 'GET',
      url: '/api/entities',
      headers: { cookie: keks },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe('the password itself', () => {
  it('asks for length and nothing else', () => {
    expect(passwordProblem('kurz')).toMatch(/12/);
    expect(passwordProblem('            ')).toMatch(/Leerzeichen/);
    // Keine Zeichenklassen: die erzeugen `Passwort1!` und verbieten die
    // Passphrase, die tatsächlich hilft.
    expect(passwordProblem('nebel wacht am tor')).toBeNull();
  });

  it('is stored as argon2id and never as itself', async () => {
    const hash = await hashPassword(PASSWORT);
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain(PASSWORT);
  });
});

describe('the user command', () => {
  let repo: InMemoryRepository;
  beforeEach(() => {
    repo = new InMemoryRepository(seedRegistry, []);
    process.env['NW_PASSWORD'] = PASSWORT;
  });

  it('adds, lists, disables and re-opens an account', async () => {
    expect(await runUserCommand(repo, ['list'])).toMatch(/Kein Konto/);
    await runUserCommand(repo, ['add', 'Basil', '--gm']);
    expect(await runUserCommand(repo, ['list'])).toMatch(/Basil {2}\(Spielleitung\)/);
    await runUserCommand(repo, ['add', 'Sela', '--actor', 'pc_rook']);
    expect(await runUserCommand(repo, ['list'])).toMatch(/spielt pc_rook/);
    await runUserCommand(repo, ['disable', 'Sela']);
    expect(await runUserCommand(repo, ['list'])).toMatch(/\[gesperrt\]/);
    await runUserCommand(repo, ['enable', 'Sela']);
    expect(await runUserCommand(repo, ['list'])).not.toMatch(/\[gesperrt\]/);
  });

  it('refuses a second account with the same name in another case', async () => {
    await runUserCommand(repo, ['add', 'Basil']);
    await expect(runUserCommand(repo, ['add', 'basil'])).rejects.toThrow(/gibt es schon/);
  });

  it('refuses a password that is too short', async () => {
    process.env['NW_PASSWORD'] = 'kurz';
    await expect(runUserCommand(repo, ['add', 'Basil'])).rejects.toThrow(/12/);
  });

  /* Ein neues Passwort beendet die alten Sitzungen. Sonst bliebe das Gerät,
     dessentwegen man es geändert hat, angemeldet. */
  it('ends the old sessions when the password changes', async () => {
    await runUserCommand(repo, ['add', 'Basil']);
    const app = buildApp({ repo });
    const keks = cookieOf(await login(app, 'Basil'));
    expect((await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: keks } })).json().user)
      .not.toBeNull();
    process.env['NW_PASSWORD'] = 'ein-ganz-anderes-wort';
    const text = await runUserCommand(repo, ['password', 'Basil']);
    expect(text).toMatch(/Sitzung/);
    expect((await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: keks } })).json().user)
      .toBeNull();
  });
});

/**
 * Was ein Spieler zu sehen bekommt (REQ-035, 036).
 *
 * Der Fall, der einen Server still unsicher macht: die Oberfläche hält
 * zurück, der Server schickt alles, und niemand merkt es, bis jemand die
 * Schnittstelle direkt aufruft. Deshalb wird hier nicht die Anzeige geprüft,
 * sondern das, was über die Leitung geht.
 */
describe('what a player gets to read', () => {
  const geheimnis: Entity = {
    id: 'n_wachsmann',
    interfaces: ['NPC'],
    name: 'Der Wachsmann',
    tags: [],
    components: {
      Base: { text: 'Der Wachsmann', key: 'npc/wachsmann', aliases: [], cover: 'die Gestalt im Mantel', value: 'used', raw: 'Er heisst Aurinax und war einmal Goldschmied.' },
    },
    blocks: [
      { id: 'b1', anchor: 'paragraph-offen', blockType: 'paragraph', body: 'Gross, still, wächsern.', order: 0 },
      { id: 'b2', anchor: 'secret-geheim', blockType: 'secret', body: 'Er sucht seinen Bruder.', order: 1 },
    ],
    relations: [{ id: 'rk', type: 'knowledge', to: 'i_name', props: {} }],
  };
  const info: Entity = {
    id: 'i_name',
    interfaces: ['Information'],
    name: 'Sein richtiger Name',
    tags: [],
    components: {
      Base: { text: 'Sein richtiger Name', key: 'info/wachsmann-name', aliases: [], value: 'used' },
      Information: { tier: 'secret', fields: ['Base.text', 'Base.raw'], blocks: [] },
    },
    blocks: [],
    relations: [],
  };

  async function setup(known: boolean) {
    const mitWissen: Entity = known
      ? { ...info, relations: [{ id: 'rb', type: 'knownBy', to: 'pc_rook', props: {} }] }
      : info;
    const repo = new InMemoryRepository(seedRegistry, [rook, inv, geheimnis, mitWissen]);
    const app = buildApp({ repo });
    await addUser(repo, 'Basil', { gm: true });
    await addUser(repo, 'Sela', { actorId: 'pc_rook' });
    return { app, repo };
  }

  it('gives the GM the whole article', async () => {
    const { app } = await setup(false);
    const keks = cookieOf(await login(app, 'Basil'));
    const res = await app.inject({
      method: 'GET',
      url: '/api/entities/n_wachsmann',
      headers: { cookie: keks },
    });
    expect(res.json().components.Base.raw).toMatch(/Aurinax/);
    expect(res.json().blocks).toHaveLength(2);
  });

  /* Der eigentliche Prüfstein: der Name steht nicht in der Antwort. Nicht
     „wird nicht angezeigt" — steht nicht drin. */
  it('does not send a player what they have not been told', async () => {
    const { app } = await setup(false);
    const keks = cookieOf(await login(app, 'Sela'));
    const res = await app.inject({
      method: 'GET',
      url: '/api/entities/n_wachsmann',
      headers: { cookie: keks },
    });
    const body = res.json();
    expect(JSON.stringify(body)).not.toMatch(/Aurinax/);
    /* Die Karte bleibt, weil `Base` auch Offenes trägt — was weg ist, ist
       das Feld. Vorher war die ganze Karte weg, und das sah nach einer
       stärkeren Zusicherung aus, als es war. */
    expect(body.components.Base.raw).toBeUndefined();
    expect(body.components.Base.text).toBe('die Gestalt im Mantel');
    // Ein GM-Block geht gar nicht erst mit.
    expect(body.blocks.map((b: { anchor: string }) => b.anchor)).toEqual(['paragraph-offen']);
  });

  it('sends it once the information is theirs', async () => {
    const { app } = await setup(true);
    const keks = cookieOf(await login(app, 'Sela'));
    const res = await app.inject({
      method: 'GET',
      url: '/api/entities/n_wachsmann',
      headers: { cookie: keks },
    });
    const body = res.json();
    expect(body.components.Base.raw).toMatch(/Aurinax/);
    expect(body.components.Base.text).toBe('Der Wachsmann');
  });

  /* Und die Liste ebenso — sie ist der bequemere Weg an dieselben Daten,
     und genau deshalb der, den man vergisst. */
  it('filters the list the same way as the single read', async () => {
    const { app } = await setup(false);
    const keks = cookieOf(await login(app, 'Sela'));
    const res = await app.inject({
      method: 'GET',
      url: '/api/entities',
      headers: { cookie: keks },
    });
    expect(JSON.stringify(res.json())).not.toMatch(/Aurinax/);
  });
});

/* ---------------------------------------------------------------------
   Konten, die sich jemand selbst anlegt — gegen eine Einladung.

   Zwei Dinge gehen hier still schief. Ein offener Registrierungsendpunkt
   fällt niemandem auf, weil sich nichts ändert ausser dass ein Konto mehr
   da ist. Und eine Einladung, deren Gebrauch erst nach der Prüfung
   abgezogen wird, lässt zwei Leute durch, die gleichzeitig klicken.
   --------------------------------------------------------------------- */
describe('signing yourself up', () => {
  async function mitEinladung(
    repo: InMemoryRepository,
    opts: { uses?: number; actorId?: string; gm?: boolean; expired?: boolean } = {},
  ) {
    const code = 'einladung-zum-pruefen';
    await repo.putInvite({
      codeHash: hashToken(code),
      label: 'Prüfung',
      isGm: opts.gm ?? false,
      actorId: opts.actorId,
      usesLeft: opts.uses,
      expiresAt: opts.expired ? new Date(Date.now() - 1000).toISOString() : undefined,
    });
    return code;
  }
  const anmelden = (
    app: ReturnType<typeof buildApp>,
    payload: Record<string, unknown>,
  ) => app.inject({ method: 'POST', url: '/api/register', payload });

  it('refuses to make an account without an invitation', async () => {
    const { app } = makeApp();
    const res = await anmelden(app, { name: 'Neu', password: PASSWORT });
    expect(res.statusCode).toBe(400);
    const ohne = await anmelden(app, { name: 'Neu', password: PASSWORT, invite: 'erfunden' });
    expect(ohne.statusCode).toBe(403);
  });

  it('makes the account and logs it straight in', async () => {
    const { app, repo } = makeApp();
    const code = await mitEinladung(repo);
    const res = await anmelden(app, { name: 'Neu', password: PASSWORT, invite: code });
    expect(res.statusCode).toBe(201);
    /* Wer sich eben ein Passwort ausgedacht hat, soll es nicht sofort
       wieder eintippen müssen. */
    expect(cookieOf(res)).toMatch(/^nw_session=/);
    const me = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: cookieOf(res) } });
    expect(me.json().user.name).toBe('Neu');
    expect(me.json().user.isGm).toBe(false);
  });

  /* Der spezifische Link: einer, der weiss, wer kommt. */
  it('binds the character the invitation names', async () => {
    const { app, repo } = makeApp();
    const code = await mitEinladung(repo, { actorId: 'pc_rook' });
    const res = await anmelden(app, { name: 'Neu', password: PASSWORT, invite: code });
    const me = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: cookieOf(res) } });
    expect(me.json().user.actorIds).toEqual(['pc_rook']);
    expect(me.json().actors).toEqual([{ id: 'pc_rook', name: 'Rook' }]);
  });

  it('spends a single-use invitation exactly once', async () => {
    const { app, repo } = makeApp();
    const code = await mitEinladung(repo, { uses: 1 });
    expect((await anmelden(app, { name: 'Erste', password: PASSWORT, invite: code })).statusCode)
      .toBe(201);
    expect((await anmelden(app, { name: 'Zweite', password: PASSWORT, invite: code })).statusCode)
      .toBe(403);
  });

  it('will not spend an expired one at all', async () => {
    const { app, repo } = makeApp();
    const code = await mitEinladung(repo, { expired: true });
    expect((await anmelden(app, { name: 'Neu', password: PASSWORT, invite: code })).statusCode)
      .toBe(403);
  });

  /* Ein Name, den es schon gibt, darf keinen Gebrauch kosten — sonst
     verliert jemand seine Einladung an einen Tippfehler. */
  it('does not spend the invitation on a name that is taken', async () => {
    const { app, repo } = makeApp();
    await addUser(repo, 'Basil', { gm: true });
    const code = await mitEinladung(repo, { uses: 1 });
    expect((await anmelden(app, { name: 'basil', password: PASSWORT, invite: code })).statusCode)
      .toBe(409);
    expect((await anmelden(app, { name: 'Neu', password: PASSWORT, invite: code })).statusCode)
      .toBe(201);
  });

  it('holds the password to the same rule as the command line', async () => {
    const { app, repo } = makeApp();
    const code = await mitEinladung(repo);
    const res = await anmelden(app, { name: 'Neu', password: 'kurz', invite: code });
    expect(res.statusCode).toBe(400);
    /* Und der Gebrauch ist noch da: geprüft wird vor dem Abziehen. */
    expect((await anmelden(app, { name: 'Neu', password: PASSWORT, invite: code })).statusCode)
      .toBe(201);
  });

  it('keeps invitations out of reach of everyone but the GM', async () => {
    const { app, repo } = makeApp();
    await addUser(repo, 'Sela', { actorId: 'pc_rook' });
    const keks = cookieOf(await login(app, 'Sela'));
    const res = await app.inject({ method: 'GET', url: '/api/invites', headers: { cookie: keks } });
    expect(res.statusCode).toBe(403);
  });

  /* Der Code steht **einmal** in der Antwort und danach nie wieder —
     gespeichert ist nur sein Hash. */
  it('shows a new invitation code once and never again', async () => {
    const { app, repo } = makeApp();
    await addUser(repo, 'Basil', { gm: true });
    const keks = cookieOf(await login(app, 'Basil'));
    const neu = await app.inject({
      method: 'POST',
      url: '/api/invites',
      headers: { cookie: keks },
      payload: { label: 'Für die Gruppe', uses: 3 },
    });
    expect(neu.statusCode).toBe(201);
    const code = neu.json().code as string;
    expect(code).toBeTruthy();
    const liste = await app.inject({ method: 'GET', url: '/api/invites', headers: { cookie: keks } });
    expect(JSON.stringify(liste.json())).not.toContain(code);
    expect(liste.json()[0].usesLeft).toBe(3);
  });
});

/* ---------------------------------------------------------------------
   Mehrere Figuren an einem Konto. Wer zwei spielt, ist trotzdem eine
   Person: was die eine erfahren hat, weiss er auch, wenn er auf die andere
   schaut. Eine Seite, die ihm das vorenthält, zwingt ihn zum Umschalten
   und sonst zu nichts.
   --------------------------------------------------------------------- */
describe('one account, several characters', () => {
  const sela: Entity = {
    id: 'pc_sela',
    interfaces: ['PlayerCharacter'],
    name: 'Sela',
    tags: [],
    components: {
      Base: { text: 'Sela', key: 'pc/sela', aliases: [], value: 'used' },
      /* `PlayerCharacter` verlangt sie — eine Figur ohne sie liesse sich
         lesen und nicht zurückschreiben, und die Prüfung fiele auf die
         Maske statt auf die Vorlage. */
      PlayerCharacter: { player: 'Prüfung' },
    },
    blocks: [],
    relations: [],
  };
  const geheim: Entity = {
    id: 'n_wachsmann',
    interfaces: ['NPC'],
    name: 'Der Wachsmann',
    tags: [],
    components: {
      Base: { text: 'Der Wachsmann', key: 'npc/wachsmann', aliases: [], value: 'used', raw: 'Er heisst Aurinax.' },
    },
    blocks: [],
    relations: [{ id: 'rk', type: 'knowledge', to: 'i_name', props: {} }],
  };
  /* Nur **Sela** weiss es — Rook nicht. */
  const info: Entity = {
    id: 'i_name',
    interfaces: ['Information'],
    name: 'Sein richtiger Name',
    tags: [],
    components: {
      Base: { text: 'Sein richtiger Name', key: 'info/name', aliases: [], value: 'used' },
      Information: { tier: 'secret', fields: ['Base.raw'], blocks: [] },
    },
    blocks: [],
    relations: [{ id: 'rb', type: 'knownBy', to: 'pc_sela', props: {} }],
  };

  async function setup(actorIds: string[]) {
    const repo = new InMemoryRepository(seedRegistry, [rook, sela, inv, geheim, info]);
    const app = buildApp({ repo });
    await addUser(repo, 'Spieler', { actorIds });
    return { app, repo };
  }

  it('reads with everything its characters know together', async () => {
    const { app } = await setup(['pc_rook', 'pc_sela']);
    const keks = cookieOf(await login(app, 'Spieler'));
    const res = await app.inject({
      method: 'GET',
      url: '/api/entities/n_wachsmann',
      headers: { cookie: keks },
    });
    expect(res.json().components.Base?.raw).toMatch(/Aurinax/);
  });

  it('and withholds it from an account that only plays the other one', async () => {
    const { app } = await setup(['pc_rook']);
    const keks = cookieOf(await login(app, 'Spieler'));
    const res = await app.inject({
      method: 'GET',
      url: '/api/entities/n_wachsmann',
      headers: { cookie: keks },
    });
    /* Nicht „wird nicht angezeigt" — steht nicht drin. */
    expect(JSON.stringify(res.json())).not.toContain('Aurinax');
  });

  it('may write every character it plays', async () => {
    const { app } = await setup(['pc_rook', 'pc_sela']);
    const keks = cookieOf(await login(app, 'Spieler'));
    const me = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: keks } });
    expect(me.json().writable).toEqual(expect.arrayContaining(['pc_rook', 'pc_sela']));
    for (const id of ['pc_rook', 'pc_sela']) {
      const art = (await app.inject({ method: 'GET', url: `/api/entities/${id}`, headers: { cookie: keks } })).json();
      const res = await app.inject({
        method: 'PUT',
        url: `/api/entities/${id}`,
        headers: { cookie: keks },
        payload: art,
      });
      expect(res.statusCode).toBe(200);
    }
  });

  /* Die Gegenrichtung: wer diese Figur spielt. Daran hängt das Freigeben —
     „wer hat das angelegt" ist die Frage, die eine Freigabeliste stellt. */
  it('can be asked the other way round: who plays this one', async () => {
    const { repo } = await setup(['pc_rook', 'pc_sela']);
    const wer = await repo.usersOfActor('pc_sela');
    expect(wer.map((u) => u.name)).toEqual(['Spieler']);
    expect(await repo.usersOfActor('n_wachsmann')).toEqual([]);
  });
});

/* ---------------------------------------------------------------------
   Eine Gruppe von **Menschen**, nicht von Figuren.

   Wissen liess sich schon einer Party zuteilen, und jedes Mitglied bekam
   es über `memberOfParty`. Das deckt die Abenteuergruppe ab und sonst
   nichts: wer keine Figur hat, wer gerade eine neue baut, wer als Gast
   zusieht, steht in keiner Party — und soll dasselbe erfahren.

   Die Gruppe ist deshalb ein Halter wie jeder andere, und ein Konto zeigt
   auf sie wie auf eine Figur. Kein zweites Verfahren.
   --------------------------------------------------------------------- */
describe('knowledge shared with a whole group', () => {
  const gruppe: Entity = {
    id: 'grp_runde',
    interfaces: ['Group'],
    name: 'Die Donnerstagsrunde',
    tags: [],
    components: {
      Base: { text: 'Die Donnerstagsrunde', key: 'group/donnerstag', aliases: [], value: 'used' },
      Group: { kind: 'players', purpose: 'Wer an diesem Tisch sitzt' },
    },
    blocks: [],
    relations: [],
  };
  const ort: Entity = {
    id: 'o_keller',
    interfaces: ['Place'],
    name: 'Der Lampenkeller',
    tags: [],
    components: {
      Base: { text: 'Der Lampenkeller', key: 'place/keller', aliases: [], value: 'used', raw: 'Der Eingang liegt hinter dem Fass.' },
    },
    blocks: [],
    relations: [{ id: 'rk', type: 'knowledge', to: 'i_eingang', props: {} }],
  };
  /* Zugeteilt ist es der **Gruppe** — keiner einzelnen Figur. */
  const info: Entity = {
    id: 'i_eingang',
    interfaces: ['Information'],
    name: 'Wo der Eingang liegt',
    tags: [],
    components: {
      Base: { text: 'Wo der Eingang liegt', key: 'info/eingang', aliases: [], value: 'used' },
      Information: { tier: 'secret', fields: ['Base.raw'], blocks: [] },
    },
    blocks: [],
    relations: [{ id: 'rb', type: 'knownBy', to: 'grp_runde', props: {} }],
  };

  async function setup(actorIds: string[]) {
    const repo = new InMemoryRepository(seedRegistry, [rook, inv, gruppe, ort, info]);
    const app = buildApp({ repo });
    await addUser(repo, 'Spieler', { actorIds });
    return { app, repo };
  }
  const lesen = async (app: ReturnType<typeof buildApp>) => {
    const keks = cookieOf(await login(app, 'Spieler'));
    return app.inject({ method: 'GET', url: '/api/entities/o_keller', headers: { cookie: keks } });
  };

  it('reaches an account that belongs to the group', async () => {
    const { app } = await setup(['pc_rook', 'grp_runde']);
    expect((await lesen(app)).json().components.Base?.raw).toMatch(/hinter dem Fass/);
  });

  /* Und niemanden sonst — auch nicht jemanden mit einer Figur, die alles
     andere darf. Ohne diese Hälfte wäre die Gruppe nur Zierrat. */
  it('and nobody outside it, character or no character', async () => {
    const { app } = await setup(['pc_rook']);
    expect(JSON.stringify((await lesen(app)).json())).not.toContain('hinter dem Fass');
    const { app: leer } = await setup([]);
    expect(JSON.stringify((await lesen(leer)).json())).not.toContain('hinter dem Fass');
  });

  /* Eine Gruppe ohne Figuren ist der Punkt: „die Spieler dieser Kampagne"
     ist kein Figurengefüge, und wer noch keine Figur hat, soll trotzdem
     mitlesen. */
  it('works for an account that plays nobody at all', async () => {
    const { app } = await setup(['grp_runde']);
    expect((await lesen(app)).json().components.Base?.raw).toMatch(/hinter dem Fass/);
  });

  it('is a holder the registry allows, not one smuggled past it', () => {
    expect(seedRegistry.relations.knownBy.to).toContain('Group');
    expect(Object.keys(seedRegistry.interfaces.Group.schema?.properties ?? {})).toContain('purpose');
    /* Sie trägt kein Blatt und keine Ausrüstung — sie ist keine Party mit
       anderem Namen. */
    expect(seedRegistry.interfaces.Group.extends ?? []).not.toContain('Vitals');
    expect(seedRegistry.relations.carries.from).not.toContain('Group');
  });
});
