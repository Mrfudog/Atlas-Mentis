-- Zugang (REQ-031, 032): ein Passwort je Nutzer.
--
-- Die Anwendung bindet auf 127.0.0.1 und der Reverse Proxy zeigt nach
-- aussen — aber „nur das Heimnetz" ist keine Zugangskontrolle, sondern eine
-- Annahme über das Heimnetz. Hier steht die Kontrolle selbst.
--
-- Nutzer sind KEINE Artikel. Ein Artikel gehört der Kampagne und wandert mit
-- ihr; ein Zugang gehört der Instanz und darf beim Spiegeln von prod nach
-- preprod ausdrücklich NICHT mitwandern (REQ-199). Deshalb eine eigene
-- Tabelle, und deshalb steht in der Artikeltabelle nur die Id der Figur, die
-- jemand spielt.

create table if not exists app_user (
  id            text primary key,
  -- Kleingeschrieben eindeutig: „Basil" und „basil" sind dieselbe Person,
  -- und zwei Konten, die sich nur in der Schreibweise unterscheiden, sind
  -- eine Falle und kein Merkmal.
  name          text not null,
  name_fold     text not null unique,
  -- Argon2id. Der ganze Parameterblock steht im Hash selbst, also lässt sich
  -- die Härte später erhöhen, ohne dass alte Passwörter unlesbar werden.
  password_hash text not null,
  is_gm         boolean not null default false,
  -- Wen diese Person spielt. Bewusst ohne Fremdschlüssel: die Figur kann
  -- gelöscht und neu eingelesen werden, und ein Zugang, der daran zerbricht,
  -- sperrt jemanden mitten in der Sitzung aus.
  actor_id      text,
  disabled_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Sitzungen liegen beim Server, nicht im Keks. Ein signierter Keks mit den
-- Rechten darin liesse sich nicht widerrufen; eine Zeile hier schon — und
-- „alle Geräte abmelden" ist dann ein DELETE und keine Schlüsselrotation.
create table if not exists app_session (
  -- Gespeichert wird der Hash des Sitzungstokens, nicht das Token. Wer die
  -- Datenbank liest, kann sich damit trotzdem nicht anmelden.
  token_hash text primary key,
  user_id    text not null references app_user(id) on delete cascade,
  created_at timestamptz not null default now(),
  seen_at    timestamptz not null default now(),
  expires_at timestamptz not null,
  agent      text
);
create index if not exists app_session_user on app_session(user_id);
create index if not exists app_session_expiry on app_session(expires_at);

-- Fehlversuche, damit Raten teuer wird. Gezählt wird je Konto und je
-- Herkunft: nur je Konto liesse sich ein Konto von aussen sperren, nur je
-- Herkunft hülfe gegen ein Botnetz nichts.
create table if not exists login_attempt (
  id         bigserial primary key,
  name_fold  text not null,
  origin     text not null,
  at         timestamptz not null default now()
);
create index if not exists login_attempt_window on login_attempt(at);
create index if not exists login_attempt_who on login_attempt(name_fold, origin);
