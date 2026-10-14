-- Kulte und Segen wirken ihre Signaturzauber (T-084): `casts` nimmt
-- `Faction` und `Rule` als Wirkende, wie seit 049 das Talent. Der Importer
-- legt die Kanten an (Kult der Neun Höllen, Dämonensegen aus MTF); der Seed
-- schreibt nur in eine leere Datenbank, also kommen die Quellarten hier
-- nach — nur, wo `casts` steht und die Art noch fehlt. Entfernt wird nichts.

update relation_def
   set from_ifaces = from_ifaces || array['Faction']
 where type = 'casts' and not ('Faction' = any(from_ifaces));

update relation_def
   set from_ifaces = from_ifaces || array['Rule']
 where type = 'casts' and not ('Rule' = any(from_ifaces));

update relation_def
   set means = 'A statblock, character, item, subclass, ancestry, feat, cult or boon can cast a spell; the spell lists who casts it.'
 where type = 'casts'
   and means = 'A statblock, character, item, subclass, ancestry or feat can cast a spell; the spell lists who casts it.';
