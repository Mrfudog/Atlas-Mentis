-- Vorgabespalten der Übersicht je Art (T-344, docs/vorschlaege/Ansichten-Bedarf.md).
--
-- Dieselben Zeilen wie `overview` in `packages/registry/src/ansichten.ts`
-- (ein Test prüft es, `ansichten.test.ts`). Ort, Fraktion, Auftrag, Szene,
-- Ereignis, Geschichte, Arc, Gruppe, Karte, Rezept und Fertigungsauftrag
-- sagten für `overview` nichts; in Kompendium und Bereichen standen darum
-- nur Name und Beschreibung. Jetzt nimmt das Feldelement `ov-f` die Werte
-- der Karte, soweit sie als Spalte taugen (Rohwerte, keine Masse, kein
-- langer Text). Das ist die Vorgabe, auf die „Reset to default“ der
-- Spaltenwahl (T-343) zurückgeht.
--
-- **Nur, wo die Art für `overview` noch nichts sagt** — was jemand im
-- Register oder im Designer eingestellt hat, bleibt (die bestehenden
-- Schlüssel stehen rechts und gewinnen). Entfernt wird nichts, kein Artikel
-- geändert, keine Spaltenwahl eines Kontos oder der Kampagne angefasst.

update interface_def i
   set views = z.neu || coalesce(i.views, '{}'::jsonb)
  from (
    select art, jsonb_object_agg(ansicht, wert) as neu
      from (values
        ('Place', 'overview', '{"adjust":{"add":{"ov-f":["Place.kind","Place.environment"]}}}'::jsonb),
        ('Faction', 'overview', '{"adjust":{"add":{"ov-f":["Faction.kind"]}}}'::jsonb),
        ('Map', 'overview', '{"adjust":{"add":{"ov-f":["Map.kind"]}}}'::jsonb),
        ('Recipe', 'overview', '{"adjust":{"add":{"ov-f":["Recipe.trade"]}}}'::jsonb),
        ('CraftingOrder', 'overview', '{"adjust":{"add":{"ov-f":["CraftingOrder.outcome"]}}}'::jsonb),
        ('Party', 'overview', '{"adjust":{"add":{"ov-f":["Party.level"]}}}'::jsonb),
        ('Event', 'overview', '{"adjust":{"add":{"ov-f":["Event.kind","Time.display"]}}}'::jsonb),
        ('Story', 'overview', '{"adjust":{"add":{"ov-f":["Story.kind","Story.played"]}}}'::jsonb),
        ('Arc', 'overview', '{"adjust":{"add":{"ov-f":["Arc.levelFrom","Arc.levelTo"]}}}'::jsonb),
        ('Scene', 'overview', '{"adjust":{"add":{"ov-f":["Scene.mode","Difficulty"]}}}'::jsonb),
        ('Quest', 'overview', '{"adjust":{"add":{"ov-f":["Quest.progress","Quest.reward"]}}}'::jsonb)
      ) as v(art, ansicht, wert)
     group by art
  ) z
 where i.name = z.art;
