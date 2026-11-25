-- Die Kante `zone` wird gelesen (T-349): der Zugplan zählt schwieriges
-- Gelände aus den Zonen der Karte (`ZoneKind.moveCost`). Damit verliert sie
-- `intended`, wie `equips` in 130.
--
-- Nur, wo noch steht, was das Register gebracht hat; was jemand im Register
-- geändert hat, bleibt. Kein Artikel wird geändert.
-- Die Nummer ist beim Hereinmergen nachgesehen (160).

update relation_def
   set intended = null
 where type = 'zone'
   and intended = 'Draw on the map screen and count it: a zone should change movement and sight where it lies.';
