-- Das Konto-Merkmal hiess `is_gm` und heisst jetzt `is_admin`.
--
-- Es gilt für die **ganze Installation** und schaltet drei Dinge: alles
-- schreiben, das Register ändern, Einladungen anlegen — und unbeschnitten
-- lesen. Das ist eine Verwaltungsrolle und keine Rolle am Tisch. „GM" las
-- sich aber wie eine: als stünde dort, wer in dieser Kampagne leitet.
--
-- Der Unterschied ist keiner auf dem Papier. Wer in einer Runde leitet, kann
-- in einer anderen mitspielen; ein Merkmal am Konto kann das nicht sagen.
-- Die Rolle je Tisch steht in der `Access`-Karte an der Figur
-- (`Access.role`) und ist eine eigene Sache — sie kommt nicht hierher
-- zurück, egal wie das Feld heisst.
--
-- Umbenannt und nicht neu angelegt: ein neues Feld daneben hiesse, dass
-- zwei Stellen sagen, wer darf, und dass die Sperre an der einen nichts
-- nützt, solange die andere offen steht.

alter table app_user rename column is_gm to is_admin;
alter table app_invite rename column is_gm to is_admin;
