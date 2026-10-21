-- Das Kampagnenboard als Startpunkt für Spielende (T-342).
--
-- Die Kampagne bekommt `playerStart` (`board` oder `compendium`, Vorgabe
-- `board`): wo Spielende nach der Anmeldung landen. Der Seed schreibt nur in
-- eine leere Datenbank, also kommt das Feld hier nach — nur, wo es fehlt.
--
-- Das Board selbst legt diese Migration **nicht** an: es entsteht beim
-- Anlegen der Kampagne und für bestehende beim ersten Öffnen
-- (`sorgeKampagnenboard`), aus derselben Vorlage im Modell
-- (`newCampaignBoard`) — sie hier in SQL noch einmal hinzuschreiben wäre
-- die zweite Stelle, die beim nächsten Umbau der Vorlage veraltet.
--
-- Kein Artikel wird geändert, entfernt wird nichts.
-- Nummer beim Hereinmergen nachsehen.

update interface_def
   set schema = jsonb_set(
         schema::jsonb,
         '{properties,playerStart}',
         '{"type":"string","title":"Players start on","description":"Where players of this campaign land after signing in: the campaign board or the compendium.","enum":["board","compendium"],"default":"board"}'::jsonb
       )::json
 where name = 'Campaign'
   and jsonb_typeof(schema::jsonb -> 'properties') = 'object'
   and not ((schema::jsonb -> 'properties') ? 'playerStart');
