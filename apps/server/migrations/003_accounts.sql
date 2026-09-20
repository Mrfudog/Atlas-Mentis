-- Konten, die sich jemand selbst anlegt — und mehr als eine Figur daran.
--
-- Bis hierher legte die Kommandozeile jedes Konto an, und ein Konto führte
-- genau eine Figur (`app_user.actor_id`). Beides war zu eng:
--
-- **Eine Figur je Konto** stimmt am Tisch nicht. Wer zwei Figuren spielt,
-- brauchte zwei Konten — und dann sind es zwei Personen, die sich nicht
-- kennen: was die eine erfahren hat, weiss die andere nicht, und die
-- Freigabeliste zeigt zwei Absender für einen Menschen.
--
-- **Jedes Konto von Hand** hiess, dass die Spielleitung für jeden Spieler
-- ein Passwort ausdenkt und weitergibt — über einen Kanal, der keiner ist.
-- Besser legt sich jeder selbst eines an. Ein offener Registrierungsendpunkt
-- wäre allerdings ein Loch, also braucht es eine Einladung.

-- ------------------------------------------------------------ Figuren
--
-- Eine eigene Tabelle und kein Feld am Artikel. Wer diese Figur spielt,
-- gehört der Instanz und nicht der Kampagne: beim Spiegeln von prod nach
-- preprod darf es ausdrücklich nicht mitwandern (REQ-199), und ein Feld am
-- Artikel wanderte mit.
--
-- Ohne Fremdschlüssel auf die Figur, aus demselben Grund wie bei
-- `actor_id`: die Figur kann gelöscht und neu eingelesen werden, und ein
-- Zugang, der daran zerbricht, sperrt jemanden mitten in der Sitzung aus.
create table if not exists app_user_actor (
  user_id  text not null references app_user(id) on delete cascade,
  actor_id text not null,
  added_at timestamptz not null default now(),
  primary key (user_id, actor_id)
);
create index if not exists app_user_actor_actor on app_user_actor(actor_id);

-- Was schon gebunden war, wandert mit. Erst danach fällt die Spalte — eine
-- Migration, die zuerst löscht und dann umzieht, zieht nichts um.
insert into app_user_actor(user_id, actor_id)
  select id, actor_id from app_user where actor_id is not null
  on conflict do nothing;

alter table app_user drop column if exists actor_id;

-- ---------------------------------------------------------- Einladungen
--
-- Eine Einladung ist ein Code, der eine Registrierung erlaubt — und sonst
-- nichts. Gespeichert wird sein **Hash**, wie beim Sitzungstoken: wer die
-- Datenbank liest, soll sich damit nicht einladen können.
--
-- `uses_left` null heisst unbegrenzt. Das ist der Link, den die Spielleitung
-- einmal in die Gruppe stellt; eine Einladung je Person wäre genauer und
-- würde bei fünf Leuten viermal vergessen.
--
-- `actor_id` bindet die neue Person gleich an eine Figur. Damit ist der
-- „spezifische Link" genau das: ein Link, der weiss, wer kommt.
create table if not exists app_invite (
  code_hash  text primary key,
  label      text,
  is_gm      boolean not null default false,
  actor_id   text,
  uses_left  integer,
  expires_at timestamptz,
  created_by text references app_user(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists app_invite_expiry on app_invite(expires_at);
