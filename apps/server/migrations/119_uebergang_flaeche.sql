-- Übergänge als Fläche, Regeln für Übergänge (T-326).
--
-- An der Kante `marker`: `area` und `toArea` (Vielecke in Anteilen der
-- Karte; ohne sie ist ein Ende das Feld um seinen Punkt, wie bisher) und
-- `rules` (was ein Übergang anders regelt als die Kampagne).
-- `Campaign.passageTrigger`, `passageWhen`, `passageMove`, `passageAction`,
-- `passageConfirm`: die Vorgabe der Kampagne. Ohne Angabe gilt, was vor
-- T-326 galt — beide lösen aus, jederzeit, kostenlos, bestätigt wie ein Zug.
--
-- Der Seed schreibt nur in eine leere Datenbank, also kommt es hier nach.
-- Nur, wo die Felder noch fehlen; nichts wird entfernt, kein Artikel geändert.
-- Die Nummer wird beim Hereinmergen nachgesehen.

update interface_def
   set schema = jsonb_set(
         schema::jsonb,
         '{properties}',
         (schema::jsonb -> 'properties')
           || jsonb_build_object(
                'passageTrigger', '{"type":"string","title":"Passages: who sends tokens through","description":"Who moves tokens through stairs, ladders and portals: only the GM, players with their own token in the passage, or both.","enum":["gm","players","both"],"default":"both"}'::jsonb,
                'passageWhen', '{"type":"string","title":"Passages: when in an encounter","description":"During an encounter, when a player may take a passage: any time, only on their own turn, or only in the last turn of the round.","enum":["any","turn","roundEnd"],"default":"any"}'::jsonb,
                'passageMove', '{"type":"string","title":"Passages: movement it costs","description":"How much movement going through costs during an encounter: nothing, one square, half the speed, or all of it.","enum":["none","square","half","all"],"default":"none"}'::jsonb,
                'passageAction', '{"type":"string","title":"Passages: action it costs","description":"Whether going through costs an action or a bonus action during an encounter.","enum":["none","action","bonus"],"default":"none"}'::jsonb,
                'passageConfirm', '{"type":"string","title":"Passages: GM confirms","description":"Whether the GM confirms a player going through: like any move (Player moves), always, or never.","enum":["moves","always","never"],"default":"moves"}'::jsonb
              )
       )::json
 where name = 'Campaign'
   and jsonb_typeof(schema::jsonb -> 'properties') = 'object'
   and not ((schema::jsonb -> 'properties') ? 'passageTrigger');

update relation_def
   set props = jsonb_set(
         props,
         '{properties}',
         (props -> 'properties')
           || jsonb_build_object(
                'area', '{"type":"array","title":"Passage area","items":{"type":"array"}}'::jsonb,
                'toArea', '{"type":"array","title":"Target area","items":{"type":"array"}}'::jsonb,
                'rules', '{"type":"object","title":"Passage rules"}'::jsonb
              )
       )
 where type = 'marker'
   and jsonb_typeof(props -> 'properties') = 'object'
   and not ((props -> 'properties') ? 'area');
