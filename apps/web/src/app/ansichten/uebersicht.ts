import { appliesText, isAdjust, isContribution, isDesignedView, ownLayout, typeList, viewGroup, viewKeys } from '@nw/model';
import type { LayoutAdjust, Registry, TypeLayout } from '@nw/model';

/** Eine Anpassung, die nichts ändert (T-318): der Typ folgt der Ansicht — sie zählt nicht als Eigenes. */
export function anpassungLeer(a: LayoutAdjust): boolean {
  return Object.values(a).every((v) => v === undefined || v === null || (Array.isArray(v) ? !v.length : typeof v === 'object' && !Object.keys(v).length));
}

/** Sagt der Typ für die Ansicht wirklich etwas — nicht bloss eine leere Anpassung? */
export function sagtEigenes(x: TypeLayout | undefined | null): boolean {
  return ownLayout(x) && !(isAdjust(x) && anpassungLeer(x.adjust));
}

/** Eine Zeile der Übersicht einer Ansicht: die allgemeine, ein Typ mit Eigenem, eine gestaltete, ein Beitrag (T-425). */
export interface AnsichtsTeil {
  art: 'general' | 'type' | 'designed' | 'overlay';
  label: string;
  /** Was die Zeile ist: „own arrangement", „adjusted", die Geltung einer gestalteten. */
  wie: string;
  /** Wohin „Design" führt (`?tab=views&view=…&type=…`). */
  view: string;
  type: string | null;
}

/**
 * **Alles, was in einer Ansicht gilt** (T-318): zuerst die allgemeine
 * Anordnung, dann jeder Typ, der für sie Eigenes sagt (eine eigene Anordnung
 * oder eine Anpassung), dann die gestalteten Ansichten ihrer Gruppe. So
 * findet man wieder, was man für einen Typ gespeichert hat — vorher stand
 * eine Typanordnung nur auf der Seite ihres Typs.
 */
export function ansichtsTeile(r: Registry, key: string, name: (id: string) => string | undefined = () => undefined): AnsichtsTeil[] {
  const def = r.views[key];
  if (!def) return [];
  if (isDesignedView(def)) {
    return [{ art: 'designed', label: def.label ?? key, wie: appliesText(def.applies, name), view: key, type: null }];
  }
  if (isContribution(def)) {
    return [{ art: 'overlay', label: def.label ?? key, wie: appliesText(def.applies, name), view: key, type: null }];
  }
  const raus: AnsichtsTeil[] = [{ art: 'general', label: def.label ?? key, wie: 'every article, unless its type says otherwise', view: key, type: null }];
  for (const t of typeList(r)) {
    const eigen = r.interfaces[t]?.views?.[key];
    if (!sagtEigenes(eigen)) continue;
    raus.push({ art: 'type', label: r.interfaces[t]?.label ?? t, wie: isAdjust(eigen) ? 'adjusted' : 'own arrangement', view: key, type: t });
  }
  for (const v of viewKeys(r)) {
    const d = r.views[v];
    if (v === key || !d || viewGroup(v, d) !== key) continue;
    /* Beiträge (T-425, E-168) stehen wie gestaltete unter ihrer Gruppe. */
    if (isDesignedView(d)) raus.push({ art: 'designed', label: d.label ?? v, wie: appliesText(d.applies, name), view: v, type: null });
    else if (isContribution(d)) raus.push({ art: 'overlay', label: d.label ?? v, wie: appliesText(d.applies, name), view: v, type: null });
  }
  return raus;
}

/** Die Ansichten, die oben zur Wahl stehen: jede, die keine gestaltete einer anderen Gruppe ist. */
export function wahlAnsichten(r: Registry): { key: string; label: string }[] {
  return viewKeys(r)
    .filter((k) => {
      const d = r.views[k];
      if (isContribution(d) && r.views[viewGroup(k, d)] && viewGroup(k, d) !== k) return false;
      return !isDesignedView(d) || !r.views[viewGroup(k, d)] || viewGroup(k, d) === k;
    })
    .map((k) => ({ key: k, label: r.views[k]?.label ?? k }));
}
