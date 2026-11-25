-- Das Register auf bestehenden Datenbanken an die Startzeilen nachziehen,
-- wo eine frühere Migration nur die Werte umgeschrieben hat (T-090).
--
-- Der Seed schreibt Arten nur in eine leere Datenbank. 025 (E-020) und 048
-- (T-099) haben Wörter zu Artikel-Ids gemacht, die Zeilen aber nicht
-- angefasst: auf dev standen `Statblock.conditionImmunities` (5 399 Werte),
-- `Weapon.ammoType` (27) und `Deity.domains` weiter als Wortlisten da, und
-- Artikelseite, Kurzansicht und Druck zeigten die Ids roh — „Condition
-- immunities: e5_1ceeff2ed43f, …" am Lich, „Ammunition: e5_d26088f61fc8"
-- am Blasrohr (gefunden in der Sichtprüfung T-090,
-- docs/Nachtarbeit/sichtpruefung-2026-10-14.md).
--
-- Gesetzt wird, was die Startzeile sagt (`format: link` mit Zieltyp), und
-- nur, wo das Feld noch kein Format hat — wer es am Server schon anders
-- eingestellt hat, behält das. Die Aufzählung an `conditionImmunities`
-- (`enumRef: Condition`) fällt weg: ein Verweisfeld nennt sein Ziel mit
-- `target`, und eine Liste von Namen passt nicht mehr zu Ids.
--
-- Dazu `Campaign`: auf dev stand die Art ohne Schema, darum griffen 036
-- (Sprachen) und 042 (Talente) dort nicht, und `compareFor` (T-092) fehlte
-- ebenso. Die drei Felder kommen wie in der Startzeile dazu; was dasteht,
-- bleibt. Entfernt wird nichts, kein Artikel wird geändert.

update interface_def
   set schema = jsonb_set(
     schema::jsonb,
     '{properties,domains}',
     (schema::jsonb #> '{properties,domains}')
       || '{"format":"link","target":{"interfaces":["Subclass"]}}'::jsonb
   )::json
 where name = 'Deity'
   and jsonb_typeof(schema::jsonb #> '{properties,domains}') = 'object'
   and not (schema::jsonb #> '{properties,domains}') ? 'format';

update interface_def
   set schema = jsonb_set(
     schema::jsonb,
     '{properties,conditionImmunities}',
     ((schema::jsonb #> '{properties,conditionImmunities}') - 'enumRef')
       || '{"format":"link","target":{"interfaces":["Condition"]}}'::jsonb
   )::json
 where name = 'Statblock'
   and jsonb_typeof(schema::jsonb #> '{properties,conditionImmunities}') = 'object'
   and not (schema::jsonb #> '{properties,conditionImmunities}') ? 'format';

update interface_def
   set schema = jsonb_set(
     schema::jsonb,
     '{properties,ammoType}',
     (schema::jsonb #> '{properties,ammoType}')
       || '{"format":"link","target":{"interfaces":["Item"]}}'::jsonb
   )::json
 where name = 'Weapon'
   and jsonb_typeof(schema::jsonb #> '{properties,ammoType}') = 'object'
   and not (schema::jsonb #> '{properties,ammoType}') ? 'format';

-- Campaign: erst ein Schema, wo keines steht, dann die fehlenden Felder.
update interface_def
   set schema = '{"type":"object","properties":{}}'::json
 where name = 'Campaign'
   and (schema is null or jsonb_typeof(schema::jsonb -> 'properties') is distinct from 'object');

update interface_def
   set schema = jsonb_set(
     schema::jsonb,
     '{properties}',
     '{"compareFor":{"type":"string","title":"Compare layers visible to","enum":["gm","players"],"default":"gm"},
       "languages":{"type":"array","items":{"type":"string"},"enumRef":["Language"],"title":"Languages in play"},
       "feats":{"type":"boolean","title":"Feats allowed","default":true}}'::jsonb
       || (schema::jsonb -> 'properties')
   )::json
 where name = 'Campaign'
   and not (schema::jsonb -> 'properties' ?& array['compareFor', 'languages', 'feats']);
