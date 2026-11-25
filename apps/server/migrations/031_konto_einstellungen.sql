-- Einstellungen je Konto (T-092, E-021 d).
--
-- Ob an den Feldern die Fassungen anderer Ebenen stehen und welche Ebenen
-- verglichen werden, merkt sich das Konto — nicht der Browser: wer am
-- Laptop vorbereitet und am Tablet leitet, will denselben Stand. Und nicht
-- der Artikel oder die Kampagne: es ist eine Frage, wie jemand liest, nicht
-- was gilt.
--
-- Ein Schlüssel je Einstellung, der Wert als JSON — die nächste Einstellung
-- braucht dann keine Spalte. Neben dem Konto wie `app_user_actor`: ein
-- Konto wandert nicht mit der Ausfuhr (REQ-199), seine Einstellungen auch
-- nicht.
create table if not exists app_user_pref (
  user_id    text not null references app_user(id) on delete cascade,
  key        text not null,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
