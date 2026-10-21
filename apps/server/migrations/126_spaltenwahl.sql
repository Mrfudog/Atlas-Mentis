-- Die Spalten einer Übersicht als Vorgabe der Kampagne (T-343): je
-- Kampagne und Tabelle (`world`, `compendium|Spell`) die gewählten
-- Spalten — `Typ.feld`, `out.kante`, `in.kante`, `@angabe`.
--
-- Wie die Filtergruppen (066) neben der Kampagne und nicht in ihr: wie die
-- Leitung ihre Tabellen schneidet, ist keine Regel und kein Inhalt. Die
-- Wahl eines Kontos steht in `app_user_pref` (`listColumns.<seite>…`).
-- Kein Fremdschlüssel auf die Kampagne — sie ist ein Artikel.
create table if not exists list_columns (
  campaign_id text not null,
  key         text not null,
  columns     jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (campaign_id, key)
);
