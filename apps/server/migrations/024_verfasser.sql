-- Wer einen Artikel angelegt hat (REQ-237, E-011): Spielende legen
-- Artikel an, und was sie angelegt haben, dürfen sie schreiben und sehen
-- es in jedem Stand.
--
-- Es steht hier, neben dem Konto, und nicht im Artikel — aus demselben
-- Grund wie `app_user_actor` und `campaign_member`: eine Konto-Id in einem
-- Artikel wandert beim Export mit, und Zugänge wandern nicht (REQ-199).
--
-- `entity_id` ohne Fremdschlüssel wie `app_user_actor.actor_id`: ein
-- Artikel kann gelöscht und neu eingelesen werden, und eine Zeile, die
-- daran zerbricht, nimmt der Verfasserin ihr Recht. Eine Zeile, die auf
-- nichts mehr zeigt, tut niemandem etwas.
create table if not exists app_user_article (
  user_id   text not null references app_user(id) on delete cascade,
  entity_id text not null,
  added_at  timestamptz not null default now(),
  primary key (user_id, entity_id)
);
create index if not exists app_user_article_entity on app_user_article(entity_id);
