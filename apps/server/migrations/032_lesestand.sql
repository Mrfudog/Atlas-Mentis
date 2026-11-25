-- Der Lesestand je Konto und Buch (T-091, REQ-247).
--
-- Die Leseansicht zeigt eine Ebene als Buch; wer wiederkommt, soll dort
-- weiterlesen, wo er aufgehört hat — auf jedem Gerät, darum am Konto und
-- nicht im Browser. Gemerkt wird der Abschnitt (eine Artikel-Id), nicht
-- eine Bildschirmposition: die hängt an der Breite des Fensters.
--
-- Kein Fremdschlüssel auf den Artikel: geht ein Abschnitt, zeigt der
-- Lesestand ins Leere, und die Leseansicht fängt dann vorne an. Mit dem
-- Konto geht er mit (`on delete cascade`). Wie `app_session` wandert er
-- beim Spiegeln nicht mit — er ist kein Artikel.
create table if not exists reading_position (
  user_id    text not null references app_user(id) on delete cascade,
  layer_id   text not null,
  entity_id  text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, layer_id)
);
