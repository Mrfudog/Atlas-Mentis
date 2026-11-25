-- Sichtbarkeit je Gruppe (T-252, E-098): die Ebene gibt vor, die Kampagne
-- überschreibt je Gruppe, das Feld am Artikel gewinnt.
--
--  1. Aufzählungszeile `Audience` (public, campaign, players, gm): drei
--     Felder brauchen sie jetzt; `Visibility.audience` nennt sie, wo das
--     Feld noch wie im Seed steht.
--  2. `Layer.defaultAudience`: die Vorgabe der Ebene für ihre Artikel.
--  3. Typ `VisibilityRules` mit `visibilityRules` (je Gruppe eine Regel,
--     die `id` ist der Schlüssel der Gruppe) — `Campaign` nimmt ihn dazu.
--
-- Wie 095 nur, wo schon ein Register steht. Ergänzt wird nur, was fehlt;
-- kein Artikel wird geändert, nichts entfernt — die Werte von `audience`
-- bleiben dieselben vier Wörter.

insert into enum_def (name, config)
select 'Audience', '{"name":"Audience","label":"Audience","values":["public","campaign","players","gm"]}'::jsonb
 where exists (select 1 from enum_def)
on conflict (name) do nothing;

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,audience}', '{"type":"string","title":"Audience","enumRef":"Audience","default":"public","description":"Who may see this at all: everyone, the campaign, its players or the GM."}'::jsonb)::json
 where name = 'Visibility'
   and (schema::jsonb #> '{properties,audience}') = '{"type":"string","title":"Audience","enum":["public","campaign","players","gm"],"default":"public","description":"Who may see this at all: everyone, the campaign, its players or the GM."}'::jsonb;

update interface_def
   set schema = jsonb_set(schema::jsonb, '{properties,defaultAudience}', '{"type":"string","title":"Articles visible to","enumRef":"Audience","description":"Who sees the articles of this layer, unless the campaign or the article says otherwise. Empty: everyone.","facet":false}'::jsonb)::json
 where name = 'Layer'
   and (schema::jsonb #> '{properties,defaultAudience}') is null;

insert into interface_def (name, label, abstract, extends, schema)
select 'VisibilityRules', 'Visibility by group', true, array[]::text[],
       '{"type":"object","properties":{"visibilityRules":{"type":"array","many":true,"editOnly":true,"title":"Visibility by group","description":"Who sees each group of articles in this campaign — set on the campaign page under Visibility. An article’s own setting wins.","items":{"type":"object"},"facet":false,"entry":{"type":"object","required":["id"],"properties":{"id":{"type":"string","title":"Group"},"audience":{"type":"string","title":"Audience","enumRef":"Audience"},"show":{"type":"array","format":"link","title":"Show to","items":{"type":"string"},"target":{"interfaces":["Creature","Party","Faction"]}},"hide":{"type":"array","format":"link","title":"Hide from","items":{"type":"string"},"target":{"interfaces":["Creature","Party","Faction"]}}}}}}}'::json
 where exists (select 1 from interface_def)
on conflict (name) do nothing;

update interface_def
   set extends = extends || array['VisibilityRules']
 where name = 'Campaign' and not ('VisibilityRules' = any(extends))
   and exists (select 1 from interface_def where name = 'VisibilityRules');
