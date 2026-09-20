---
Gegenstandstyp: ausrüstung
Rarität: "-"
tags:
  - gegenstand
Formfaktor:
  - XX
  - XX
  - XX
Stapelgrösse: "1"
aliases:
  - chain mail
Kupferpreis: 7500
Kaufrarität: Ungewöhnlich
rüstungsklasse: "16"
rüstungstyp: Schwere Rüstung
---
![[Kettenrüstung.png]]

# Inventar
```dataviewjs
const lines = dv.current().formfaktor ?? [];
const rows = lines.map(line => [...line]);

dv.el("div", "", { cls: "formfaktor-table" });
dv.table(['**Stapelgrösse:** ' + dv.current().stapelgrösse], rows);

```