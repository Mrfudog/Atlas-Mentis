---
Gegenstandstyp: material
Rarität: gewöhnlich
tags:
  - gegenstand
  - material
Formfaktor:
  - X
Stapelgrösse: "64"
aliases:
  - common Essence
Kupferpreis:
Kaufrarität:
Materialtyp:
Berufe:
Beispiel:
---

# Inventar
```dataviewjs
const lines = dv.current().formfaktor ?? [];
const rows = lines.map(line => [...line]);

dv.el("div", "", { cls: "formfaktor-table" });
dv.table(['**Stapelgrösse:** ' + dv.current().stapelgrösse], rows);

```