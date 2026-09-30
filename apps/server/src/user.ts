/**
 * Konten anlegen und ändern — von der Kommandozeile, nicht über das Netz.
 *
 * Der erste Zugang muss irgendwo herkommen, und jeder Weg dafür über HTTP
 * ist eine Tür, die danach offen bleibt. Eine Tür, die nur auf der Maschine
 * selbst benutzbar ist, ist hier die richtige: wer auf dem Server eine
 * Shell hat, kommt ohnehin an die Datenbank.
 *
 *   pnpm --filter @nw/server user add basil --admin
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
import { foldName, hashPassword, hashToken, newInviteCode, passwordProblem } from './auth.js';
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

  /* Einladungen. Sie brauchen keinen Namen, also stehen sie vor der
     Namensprüfung — und der Code wird **einmal** ausgegeben: gespeichert
     ist nur sein Hash. */
  if (cmd === 'invite') {
    const sub = name ?? 'list';
    if (sub === 'list') {
      const list = await repo.listInvites();
      if (!list.length) return 'Keine Einladung offen.';
      return list
        .map(
          (i) =>
            `${i.label ?? '(ohne Kennung)'}` +
            `${i.isAdmin ? '  (Verwaltung)' : ''}` +
            `${i.actorId ? `  für ${i.actorId}` : ''}` +
            `${i.usesLeft == null ? '  unbegrenzt' : `  noch ${i.usesLeft}×`}` +
            `${i.expiresAt ? `  bis ${i.expiresAt.slice(0, 10)}` : ''}` +
            `\n  ${i.codeHash}`,
        )
        .join('\n');
    }
    if (sub === 'drop') {
      const handle = rest[0];
      if (!handle) throw new Error('Welche? Die Kennung steht bei `invite list`.');
      return (await repo.dropInvite(handle)) ? 'Zurückgenommen.' : 'Nicht gefunden.';
    }
    if (sub === 'new') {
      const usesAt = rest.indexOf('--uses');
      const daysAt = rest.indexOf('--days');
      const labelAt = rest.indexOf('--label');
      const code = newInviteCode();
      await repo.putInvite({
        codeHash: hashToken(code),
        label: labelAt >= 0 ? rest[labelAt + 1] : undefined,
        isAdmin: flags.has('--admin'),
        actorId: actorId,
        usesLeft: usesAt >= 0 ? Math.max(1, Number(rest[usesAt + 1]) || 1) : undefined,
        expiresAt:
          daysAt >= 0
            ? new Date(Date.now() + Math.max(1, Number(rest[daysAt + 1]) || 1) * 86400000).toISOString()
            : undefined,
      });
      /* Einmal und nie wieder — danach steht nur noch der Hash da. */
      return `Einladung: ${code}\n(Sie steht nur hier. Gespeichert ist nur ihr Hash.)`;
    }
    throw new Error('invite new | invite list | invite drop <kennung>');
  }

  if (cmd === 'list') {
    const users = await repo.listUsers();
    if (!users.length) return 'Kein Konto angelegt.';
    return users
      .map(
        (u) =>
          `${u.name}${u.isAdmin ? '  (Verwaltung)' : ''}` +
          `${u.actorIds.length ? `  spielt ${u.actorIds.join(', ')}` : ''}` +
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
        isAdmin: flags.has('--admin'),
        actorIds: actorId ? [actorId] : [],
      });
      return `${name} angelegt${flags.has('--admin') ? ' (Verwaltung)' : ''}.`;
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
    /* **Figuren dazu und weg**, nicht ersetzen. Ein Konto führt mehrere,
       und ein `actor`, das die Liste jedes Mal überschreibt, nimmt beim
       Hinzufügen der zweiten die erste weg — und niemand merkt es, bis
       jemand sein halbes Blatt vermisst. */
    case 'actor': {
      if (!existing) throw new Error(`„${name}" gibt es nicht.`);
      const wie = rest[0] === 'remove' || flags.has('--remove') ? 'remove' : 'add';
      if (!actorId) {
        return existing.actorIds.length
          ? `${name} spielt ${existing.actorIds.join(', ')}.`
          : `${name} spielt niemanden.`;
      }
      const ids = new Set(existing.actorIds);
      if (wie === 'remove') ids.delete(actorId);
      else ids.add(actorId);
      await repo.putUser({ ...existing, actorIds: [...ids] });
      return wie === 'remove'
        ? `${name} spielt ${actorId} nicht mehr.`
        : `${name} spielt jetzt auch ${actorId}.`;
    }
    default:
      throw new Error('add | password | disable | enable | actor | invite | list');
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
