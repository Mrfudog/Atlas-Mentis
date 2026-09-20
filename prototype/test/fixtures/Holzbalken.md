---
Gegenstandstyp: material
Rarität: "-"
tags:
  - gegenstand
  - material
Formfaktor:
  - XXXXXXXXXXXXXXXX
  - XXXXXXXXXXXXXXXX
  - XXXXXXXXXXXXXXXX
  - XXXXXXXXXXXXXXXX
Stapelgrösse: "1"
aliases:
  - unit of lumber
Kupferpreis: 1000
Kaufrarität: Trivial
Materialtyp: Baumaterial
Berufe:
  - Ingenieur
---

# Inventar
```dataviewjs
const lines = dv.current().formfaktor ?? [];
const rows = lines.map(line => [...line]);

dv.el("div", "", { cls: "formfaktor-table" });
dv.table(['**Stapelgrösse:** ' + dv.current().stapelgrösse], rows);

```