/**
 * Konten anlegen und ändern — von der Kommandozeile, nicht über das Netz.
 *
 * Der erste Zugang muss irgendwo herkommen, und jeder Weg dafür über HTTP
 * ist eine Tür, die danach offen bleibt. Eine Tür, die nur auf der Maschine
 * selbst benutzbar ist, ist hier die richtige: wer auf dem Server eine
 * Shell hat, kommt ohnehin an die Datenbank.
 *
 *   pnpm --filter @nw/server user add basil --gm
 *   pnpm --filter @nw/server user add sela --actor pc_sela
 *   pnpm --filter @nw/server user password basil
 *   pnpm --filter @nw/server user disable sela
 *   pnpm --filter @nw/server user list
 *
 * Das Passwort kommt aus der Umgebung (`NW_PASSWORD`) oder wird erfragt —
 * **nie aus der Kommandozeile**: Argumente stehen in der Prozessliste und
 * in der Shell-Historie, und ein Passwort, das dort steht, ist keines mehr.
 */

import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { closePool, getPool } from './db.js';
import { PgRepository } from './repo.pg.js';
import { foldName, hashPassword, passwordProblem } from './auth.js';
import type { Repository } from './repo.js';

async function askPassword(prompt: string): Promise<string> {
  const fromEnv = process.env['NW_PASSWORD'];
  if (fromEnv) return fromEnv;
  if (!process.stdin.isTTY) {
    throw new Error('Kein Terminal und kein NW_PASSWORD — abgebrochen.');
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const one = await rl.question(`${prompt}: `);
    const two = await rl.question('Noch einmal: ');
    if (one !== two) throw new Error('Die beiden stimmen nicht überein.');
    return one;
  } finally {
    rl.close();
  }
}

export async function runUserCommand(repo: Repository, argv: string[]): Promise<string> {
  const [cmd, name, ...rest] = argv;
  const flags = new Set(rest.filter((a) => a.startsWith('--')));
  const actorAt = rest.indexOf('--actor');
  const actorId = actorAt >= 0 ? rest[actorAt + 1] : undefined;

  if (cmd === 'list') {
    const users = await repo.listUsers();
    if (!users.length) return 'Kein Konto angelegt.';
    return users
      .map(
        (u) =>
          `${u.name}${u.isGm ? '  (Spielleitung)' : ''}` +
          `${u.actorId ? `  spielt ${u.actorId}` : ''}` +
          `${u.disabledAt ? '  [gesperrt]' : ''}`,
      )
      .join('\n');
  }

  if (!name) throw new Error('Kein Name angegeben.');
  const fold = foldName(name);
  const existing = await repo.findUserByName(fold);

  switch (cmd) {
    case 'add': {
      if (existing) throw new Error(`„${name}" gibt es schon.`);
      const password = await askPassword(`Passwort für ${name}`);
      const problem = passwordProblem(password);
      if (problem) throw new Error(problem);
      await repo.putUser({
        id: randomUUID(),
        name: name.trim(),
        passwordHash: await hashPassword(password),
        isGm: flags.has('--gm'),
        actorId: actorId,
      });
      return `${name} angelegt${flags.has('--gm') ? ' (Spielleitung)' : ''}.`;
    }
    case 'password': {
      if (!existing) throw new Error(`„${name}" gibt es nicht.`);
      const password = await askPassword(`Neues Passwort für ${name}`);
      const problem = passwordProblem(password);
      if (problem) throw new Error(problem);
      await repo.putUser({ ...existing, passwordHash: await hashPassword(password) });
      /* Ein neues Passwort beendet die alten Sitzungen. Sonst bliebe das
         Gerät, dessentwegen man es geändert hat, angemeldet. */
      const n = await repo.dropSessionsOf(existing.id);
      return `Passwort geändert${n ? `, ${n} Sitzung(en) beendet` : ''}.`;
    }
    case 'disable': {
      if (!existing) throw new Error(`„${name}" gibt es nicht.`);
      await repo.putUser({ ...existing, disabledAt: new Date().toISOString() });
      const n = await repo.dropSessionsOf(existing.id);
      return `${name} gesperrt${n ? `, ${n} Sitzung(en) beendet` : ''}.`;
    }
    case 'enable': {
      if (!existing) throw new Error(`„${name}" gibt es nicht.`);
      await repo.putUser({ ...existing, disabledAt: undefined });
      return `${name} wieder offen.`;
    }
    case 'actor': {
      if (!existing) throw new Error(`„${name}" gibt es nicht.`);
      await repo.putUser({ ...existing, actorId: actorId });
      return actorId ? `${name} spielt ${actorId}.` : `${name} spielt niemanden mehr.`;
    }
    default:
      throw new Error('add | password | disable | enable | actor | list');
  }
}

const direkt = process.argv[1]?.endsWith('user.ts') || process.argv[1]?.endsWith('user.js');
if (direkt) {
  const repo = new PgRepository(getPool());
  runUserCommand(repo, process.argv.slice(2))
    .then(async (text) => {
      console.log(text);
      await closePool();
    })
    .catch(async (error: Error) => {
      console.error(error.message);
      await closePool();
      process.exit(1);
    });
}
