-- Wirkungen als Feld (T-085, REQ-238, REQ-063, E-025 a).
--
-- Was ein magischer Gegenstand an der Figur verändert (STR wird 19,
-- Resistenz gegen Feuer, +10 ft. Geschwindigkeit, +1 auf den Zauber-SG),
-- stand bisher nur im Text. Jetzt nimmt der Gegenstand den Obertyp
-- `Effects` mit dem Feld `effects`: je Eintrag
-- `{id, target, op, value, when, note}`. Gerechnet wird beim Lesen
-- (`effectsAt`, D8) aus dem, was die Figur trägt und eingestimmt hat.
--
-- Der Seed schreibt nur in eine leere Datenbank, also kommt das Register
-- hier nach: die Zeile `Effects` und `extends` am Gegenstand — **nur,
-- wo schon ein Register steht** (wie 028). Entfernt wird nichts; die alten
-- Zahlenfelder (`bonusAc` …) bleiben und zählen beim Lesen als Wirkung.

insert into interface_def (name, label, abstract, extends, schema)
select
  'Effects', 'Effects', true, '{}',
  '{"type":"object","properties":{"effects":{"type":"array","many":true,"title":"Effects","items":{"type":"object"},"entry":{"type":"object","required":["id","target","op"],"properties":{"id":{"type":"string","title":"Id"},"target":{"type":"string","title":"Target"},"op":{"type":"string","title":"Operation","enum":["add","set","grant"]},"value":{"type":"string","title":"Value"},"when":{"type":"string","title":"Applies when","enum":["worn","attuned","carried","self"]},"note":{"type":"string","title":"Note"}}}}}}'::json
where exists (select 1 from interface_def)
on conflict (name) do nothing;

update interface_def
   set extends = extends || array['Effects']
 where name = 'Item' and not ('Effects' = any(extends));
