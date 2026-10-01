-- Die Rolle am Tisch steht am Konto, je Kampagne.
--
-- Sie stand als `Access`-Karte in den Artikeln: `role` und `userIds` an der
-- Figur, für einen Tag auch an der Kampagne. Der Server las die Karte nie —
-- welche Figur ein Konto führt, steht seit 003 in `app_user_actor` —, und
-- eine Kontoangabe in einem Artikel wandert beim Export mit. Zugänge wandern
-- nicht (REQ-199).
--
-- Eine Zeile je Konto und Kampagne. Wer in einer Runde leitet und in einer
-- anderen mitspielt, hat zwei Zeilen; das konnte eine Karte an einer Figur
-- nicht sagen, denn eine Figur sagt nicht, in welcher Runde ihr Konto was
-- ist.
--
-- `campaign_id` hat bewusst keinen Fremdschlüssel, aus demselben Grund wie
-- `app_user_actor.actor_id`: die Kampagne ist ein Artikel, sie kann gelöscht
-- und neu eingelesen werden, und eine Rolle, die daran zerbricht, sperrt
-- jemanden mitten in der Sitzung aus. Das Konto dagegen ist eine Zeile hier,
-- und mit ihm geht die Rolle.
create table if not exists campaign_member (
  campaign_id text not null,
  user_id     text not null references app_user(id) on delete cascade,
  role        text not null check (role in ('gm', 'co-gm', 'player', 'spectator')),
  added_at    timestamptz not null default now(),
  primary key (campaign_id, user_id)
);
create index if not exists campaign_member_user on campaign_member(user_id);
