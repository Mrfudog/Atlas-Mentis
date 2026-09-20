---
Gegenstandstyp: waffe
Rarität: "-"
tags:
  - waffe
  - gegenstand
Formfaktor:
  - 0X0
  - XXX
  - 0X0
  - 0X0
  - 0X0
Stapelgrösse: "1"
aliases:
  - longsword
Kupferpreis:
Kaufrarität: Ungewöhnlich
Schaden: 1d8 / 1d10
Schadenstyp: Stichschaden
Reichweite: Nahkampf
Eigenschaften:
  - "[[Versatil]]"
---
Das Bastardschwert (oft auch Anderthalbhänder) ist unglaublich vielseitig in seiner Nutzung. Seine Länge, lässt die einhändige wie auch zweihändige Nutzung zu.

#### Eigenschaften

Ein Bastardschwert besitzt die folgenden Eigenschaften:
- ![[Versatil#Versatil]]

_(1d10)_

# Inventar

```dataviewjs
const lines = dv.current().formfaktor ?? [];
const rows = lines.map(line => [...line]);

dv.el("div", "", { cls: "formfaktor-table" });
dv.table(['**Stapelgrösse:** ' + dv.current().stapelgrösse], rows);

```