-- API-Tokens je Konto (W9): für Werkzeuge, die keinen Keks halten — ein
-- Skript, eine Claude-Sitzung, die Kommandozeile.
--
-- Wie bei Sitzung und Einladung steht hier nur der **Hash**: wer die
-- Datenbank liest, kann sich damit nicht anmelden. Ein Token gehört einem
-- Konto und geht mit ihm (`on delete cascade`); es wirkt wie dessen
-- Sitzung, beschränkt auf `read` oder `write`, und **läuft immer ab** — ein
-- Token, das ewig gilt, vergisst man in irgendeiner Umgebung.
--
-- Zugänge sind keine Artikel: beim Spiegeln von prod nach dev wandert diese
-- Tabelle so wenig mit wie `app_session` (REQ-199).
--
-- 023 und nicht 022: zwei parallele Zweige legen 022 an, und die Kette
-- läuft nach Dateiname.
create table if not exists app_token (
  id           text primary key,
  user_id      text not null references app_user(id) on delete cascade,
  name         text not null,
  token_hash   text not null unique,
  scope        text not null check (scope in ('read', 'write')),
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists app_token_user on app_token(user_id);
