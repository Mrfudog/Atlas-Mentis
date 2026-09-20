---
Gegenstandstyp: material
Rarität: "-"
tags:
  - gegenstand
  - material
Formfaktor:
  - XXX
Stapelgrösse: "1"
aliases:
  - resistant leather
Kupferpreis: 60000
Kaufrarität: Ungewöhnlich
Materialtyp: Häute
Berufe:
---

# Inventar
```dataviewjs
const lines = dv.current().formfaktor ?? [];
const rows = lines.map(line => [...line]);

dv.el("div", "", { cls: "formfaktor-table" });
dv.table(['**Stapelgrösse:** ' + dv.current().stapelgrösse], rows);

```