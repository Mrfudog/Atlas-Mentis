-- Eine Einladung führt in eine Kampagne, mit einer Rolle darin (W3).
--
-- Bis hierher band sie nur an eine Figur, und die Rolle setzte danach die
-- Leitung. Das ging, solange die Leitung die Verwaltung war: sie sah die
-- Kontoliste und fand das neue Konto. Eine Leitung, die nicht Verwaltung
-- ist, sieht die Kontoliste nicht — sie lädt ein und fände den Gast danach
-- nirgends.
--
-- Die Rolle steht nach dem Einlösen am Konto (`campaign_member`), nicht
-- hier: eine Einladung ist mit ihrem letzten Gebrauch weg, und eine Rolle,
-- die an ihr hinge, ginge mit.
--
-- `campaign_id` ohne Fremdschlüssel, aus demselben Grund wie in
-- `campaign_member`: die Kampagne ist ein Artikel und kann neu eingelesen
-- werden.
alter table app_invite add column if not exists campaign_id text;
alter table app_invite add column if not exists role text
  check (role is null or role in ('gm', 'co-gm', 'player', 'spectator'));
create index if not exists app_invite_campaign on app_invite(campaign_id);
