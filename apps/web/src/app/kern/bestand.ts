/**
 * Was gerade geladen ist — das Register und die Artikel, die jemand
 * geöffnet hat, samt den Namen, die sie brauchen.
 *
 * **Keine Liste aller Artikel mehr** (W7). Bis zum 13.10. hielt der Browser
 * die Kurzfassung des ganzen Bestands (7,7 MB bei den 24 157 Artikeln aus
 * 5e.tools) und rechnete daraus Liste, Filter, Verweise und Auswahlen — und
 * weil Register und Kurzfassung in einem Zug kamen, wartete selbst die
 * Artikelseite auf die ganze Liste. Jetzt:
 * - das **Register** kommt allein und sofort (`load`);
 * - ein **Artikel** kommt beim Öffnen, mit den Namen seiner Kantenziele
 *   und den Treffern seiner `[[Verweise]]` (`refs`, vom Server gerechnet);
 * - **Listen und Auswahlen** fragen die Liste am Server (`Api.list`).
 *
 * Was einmal da ist, bleibt da: `namen` und `verweise` sammeln, was die
 * geöffneten Artikel mitbrachten. Kein Zwischenspeicher mit Verfallsdatum:
 * wer neu laden will, lädt neu — das ist ehrlicher als eine Heuristik, die
 * manchmal Altes zeigt.
 */

import { Injectable, computed, inject, signal } from '@angular/core';
import { entityName } from '@nw/model';
import type { Entity, Registry } from '@nw/model';
import { Live, type ArtikelEreignis } from './live';
import { BildStand } from '../artikel/bild';
import { Api, ApiError, type Begegnungsbezug, type Bezuege, type Fertigungswerte, type Ladenwaren, type LeseZiel, type ListenFrage, type Liste, type ListenZeile, type RegisterTeil, type Rueckbezug } from './api';

@Injectable({ providedIn: 'root' })
export class Bestand {
  private readonly api = inject(Api);
  private readonly bildStand = inject(BildStand);

  /* **Was offen ist, bleibt aktuell** (T-116): ändert sich ein geöffneter
     Artikel am Server, wird er neu geholt — gesiebt wie beim Öffnen. Eine
     Maske, die gerade bearbeitet, hält ihre Ausgangslage selbst (REQ-192)
     und merkt beim Speichern, dass jemand anders schneller war. */
  constructor() {
    const live = inject(Live);
    live.onArtikel((e) => this.lebt(e));
    live.onNeu((was) => (was === 'registry' ? void this.load(true) : this.allesNeu()));
  }

  private readonly _registry = signal<Registry | null>(null);
  private readonly _fehler = signal<string | null>(null);
  private readonly _geladen = signal(false);
  private readonly _voll = signal<ReadonlyMap<string, Entity>>(new Map());
  private readonly _rueck = signal<ReadonlyMap<string, Rueckbezug[]>>(new Map());
  private readonly _fehlt = signal<ReadonlySet<string>>(new Set());
  private readonly _namen = signal<ReadonlyMap<string, string>>(new Map());
  private readonly _verweise = signal<ReadonlyMap<string, Bezuege['links'][string]>>(new Map());
  private readonly _anpassbar = signal<ReadonlySet<string>>(new Set());
  /** In welche Ebenen eine Fassung ginge, je Artikel (`refs.adaptTo`, T-098). */
  private readonly _anpassZiele = signal<ReadonlyMap<string, { id: string; name: string }[]>>(new Map());
  /** Wohin ein Artikel geholt werden kann, je Artikel (`refs.takeInto`, E-026). */
  private readonly _uebernahmeZiele = signal<ReadonlyMap<string, { id: string; name: string; type: string }[]>>(new Map());
  private readonly _fertig = signal<ReadonlyMap<string, string>>(new Map());
  private readonly _lesen = signal<ReadonlyMap<string, LeseZiel>>(new Map());
  /** Womit an einem Rezept gefertigt wird (`refs.craft`, T-122). */
  private readonly _fertigung = signal<ReadonlyMap<string, Fertigungswerte>>(new Map());
  readonly fertigung = this._fertigung.asReadonly();
  /** Was ein Laden führt, und zu welchem Preis (`refs.shop`, T-129). */
  private readonly _laden = signal<ReadonlyMap<string, Ladenwaren>>(new Map());
  readonly laden = this._laden.asReadonly();
  /** Was eine Begegnung über ihre Beteiligten weiss (`refs.encounter`, T-215). */
  private readonly _begegnung = signal<ReadonlyMap<string, Begegnungsbezug>>(new Map());
  readonly begegnung = this._begegnung.asReadonly();
  /** Die geltende Sichtbarkeitsstufe je geöffnetem Artikel (`refs.audience`, T-277). */
  private readonly _stufe = signal<ReadonlyMap<string, NonNullable<Bezuege['audience']>>>(new Map());
  readonly stufe = this._stufe.asReadonly();
  /** Woher Form und Stapel je geöffnetem Gegenstand kommen (`refs.shape`, T-394). */
  private readonly _form = signal<ReadonlyMap<string, NonNullable<Bezuege['shape']>>>(new Map());
  readonly form = this._form.asReadonly();
  /** Das Bild je geöffnetem Artikel, wie der Server es rechnet (`refs.image`, T-211) — auch das geerbte des Statblocks. */
  private readonly _bild = signal<ReadonlyMap<string, NonNullable<Bezuege['image']>>>(new Map());
  readonly bild = this._bild.asReadonly();
  /** Das Token je geöffnetem Artikel (`refs.token`, T-297). */
  private readonly _token = signal<ReadonlyMap<string, NonNullable<Bezuege['token']>>>(new Map());
  readonly token = this._token.asReadonly();
  /** Artikel aus einer Vergleichsebene (T-092): nicht im Spiel, auf Wunsch sichtbar. */
  private readonly _vergleich = signal<ReadonlySet<string>>(new Set());
  readonly vergleich = this._vergleich.asReadonly();
  /** Einzeln freigeben oder zurücknehmen (`refs.enable`/`enabled`, T-187) — nur für die Leitung gefüllt. */
  private readonly _freigabe = signal<ReadonlyMap<string, { campaign: string; enabled: boolean }>>(new Map());
  readonly freigabe = this._freigabe.asReadonly();

  readonly registry = this._registry.asReadonly();
  readonly fehler = this._fehler.asReadonly();
  /** Das Register ist da (oder kam nicht) — mehr wartet niemand ab. */
  readonly geladen = this._geladen.asReadonly();
  /** Die geöffneten Artikel, ganz. */
  readonly voll = this._voll.asReadonly();
  readonly rueckbezuege = this._rueck.asReadonly();
  /** Was beim Öffnen nicht kam — es gibt ihn nicht, oder nicht für diesen Betrachter. */
  readonly fehlt = this._fehlt.asReadonly();
  /**
   * Id → Name für alles, was geöffnete Artikel nannten (Kantenziele,
   * Rückbezüge, Ebenen). Fehlt eine Id, darf der Betrachter das Ziel nicht
   * sehen — oder es gibt es nicht; beides heisst „nicht hier".
   */
  readonly namen = this._namen.asReadonly();
  /** `[[ziel]]` → die Artikel, die es treffen könnten (M11). */
  readonly verweise = this._verweise.asReadonly();
  /** Geöffnete Artikel, die sich für die laufende Kampagne anpassen lassen (E-018, T-082). */
  readonly anpassbar = this._anpassbar.asReadonly();
  readonly anpassZiele = this._anpassZiele.asReadonly();
  readonly uebernahmeZiele = this._uebernahmeZiele.asReadonly();
  /**
   * Id → Datum des fertigen Stands, der für alle anderen noch gilt
   * (REQ-237, E-012). Kommt nur an, wenn der Betrachter den Arbeitsstand
   * sieht; die Artikelseite zeigt dann das Band.
   */
  readonly fertig = this._fertig.asReadonly();
  /** Wohin „im Buch lesen" von einem geöffneten Artikel führt (`refs.reading`, T-091). */
  readonly lesen = this._lesen.asReadonly();

  private readonly _kurz = signal<ReadonlyMap<string, Entity>>(new Map());
  /**
   * Was Listen schon brachten, als schmaler Artikel: Id, Art, Name, Marken
   * und die Kanten, nach denen gefragt wurde (`rel=`). Genug für eine Seite,
   * die Namen, Arten oder `partOf` braucht, ohne jeden Artikel ganz zu
   * holen — Boards und Klassen lesen daraus mit denselben Hilfen wie aus
   * einem ganzen Artikel.
   */
  readonly kurz = this._kurz.asReadonly();

  /**
   * Eine Liste fragen (`/api/list`) und ihre Zeilen in `kurz` und `namen`
   * aufnehmen. Für Seiten, die eine Handvoll Artikel einer Art brauchen
   * (die Boards, die Klassen, die Geschichte); das Kompendium fragt selbst.
   */
  async liste(frage: ListenFrage): Promise<Liste> {
    const r = await this.api.list(frage);
    const kurz = new Map(this._kurz());
    const namen = new Map(this._namen());
    for (const z of r.rows) {
      kurz.set(z.id, schmal(z));
      namen.set(z.id, z.name);
    }
    this._kurz.set(kurz);
    this._namen.set(namen);
    return r;
  }

  /** Der Name zu einer Id, sofern ein geöffneter Artikel ihn mitbrachte. */
  readonly name = computed(() => {
    const m = this._namen();
    return (id: string): string | undefined => m.get(id);
  });

  private laeuft: Promise<void> | null = null;
  private readonly oeffnet = new Map<string, Promise<void>>();
  /** Das jüngste Laden je Artikel (T-371): nur sein Ergebnis zählt. */
  private readonly juengstes = new Map<string, { nr: number; lauf: Promise<void> }>();
  private zaehler = 0;

  /** Das Register — klein (≈10 KB gepackt) und allein, damit nichts darauf wartet. */
  async load(neu = false): Promise<void> {
    if (this._geladen() && !neu) return;
    this.laeuft ??= this.api
      .registry()
      .then((registry) => {
        this._registry.set(registry);
        this._fehler.set(null);
      })
      .catch((error: Error) => {
        /* Was nicht geladen hat, wird nicht durch etwas Altes ersetzt: die
           Seite sagt, dass sie nichts hat, statt Halbes zu zeigen. */
        this._fehler.set(error.message);
      })
      .finally(() => {
        this._geladen.set(true);
        this.laeuft = null;
      });
    return this.laeuft;
  }

  /**
   * Den ganzen Artikel holen, samt dem, was auf ihn zeigt. Einmal je
   * Artikel; `neu` holt ihn wieder, etwa nach dem Speichern — was der Server
   * ausliefert, ist gesiebt und aufgelöst, und das ist nicht unbedingt das,
   * was geschickt wurde.
   *
   * `rueck: false` holt den Artikel ohne das, was auf ihn zeigt — eine
   * Kachel auf dem Board zeigt keine Rückbezüge, und eine Anfrage weniger
   * ist eine weniger. Wer ihn danach als Seite öffnet, bekommt sie
   * nachgeholt.
   *
   * **`neu` fragt immer neu** (T-371): ein noch laufendes Laden begann
   * vielleicht vor dem Speichern, das jetzt nachfragt — der erste Schaden
   * nach dem Öffnen des Bogens blieb so in der Anzeige auf dem alten Stand.
   * Kommt ein älteres Laden nach einem jüngeren an, zählt es nicht.
   */
  async oeffnen(id: string, neu = false, rueck = true): Promise<void> {
    const da = this._voll().has(id) && (!rueck || this._rueck().has(id));
    if (!neu && (da || this._fehlt().has(id))) return;
    const schluessel = rueck ? `${id} +rueck` : id;
    const schon = this.oeffnet.get(schluessel) ?? this.oeffnet.get(`${id} +rueck`);
    if (schon && !neu) return schon;
    /* Holt ihn gerade ein Sammelabruf (T-398) — die Kachel auf dem Board
       wartet auf ihn, statt ihn ein zweites Mal einzeln zu fragen. */
    const viele = this.holtViele.get(id);
    if (viele && !neu && (viele.rueck || !rueck)) {
      await viele.lauf;
      if (this._fehlt().has(id) || (this._voll().has(id) && (!rueck || this._rueck().has(id)))) return;
    }
    const nr = ++this.zaehler;
    const ueberholt = () => this.juengstes.get(id)?.nr !== nr;
    const lauf: Promise<void> = Promise.all([
      this.api.entity(id),
      rueck ? this.api.backlinks(id) : Promise.resolve(null),
    ])
      .then(([mitBezug, zeigt]) => {
        if (ueberholt()) return;
        this.uebernimm(id, mitBezug, zeigt);
      })
      .catch((error: unknown) => {
        if (ueberholt()) return;
        if (error instanceof ApiError && error.status === 404) {
          this._fehlt.update((s) => new Set(s).add(id));
          this._voll.update((m) => {
            const n = new Map(m);
            n.delete(id);
            return n;
          });
        } else {
          this._fehler.set(error instanceof Error ? error.message : String(error));
        }
      })
      .finally(() => {
        if (this.oeffnet.get(schluessel) === lauf) this.oeffnet.delete(schluessel);
      })
      /* Wer auf ein überholtes Laden wartet, wartet auf das jüngere mit. */
      .then(() => (ueberholt() ? this.juengstes.get(id)?.lauf : undefined))
      .finally(() => {
        if (!ueberholt()) this.juengstes.delete(id);
      });
    this.juengstes.set(id, { nr, lauf });
    this.oeffnet.set(schluessel, lauf);
    return lauf;
  }

  /** Ein Ereignis aus dem Live-Kanal: geöffnete Artikel neu holen oder
   *  als fehlend vermerken. Was niemand geöffnet hat, wird nicht geholt. */
  private lebt(e: ArtikelEreignis): void {
    const voll = this._voll();
    /* Auch unter der Id des Originals, wenn eine Fassung kam (E-018). */
    const schluessel = [...voll].filter(([k, x]) => k === e.id || x.id === e.id).map(([k]) => k);
    if (e.kind === 'gone') {
      if (!schluessel.length) return;
      this._voll.update((m) => {
        const n = new Map(m);
        for (const k of schluessel) n.delete(k);
        return n;
      });
      this._fehlt.update((f) => new Set([...f, ...schluessel]));
      return;
    }
    if (this._fehlt().has(e.id) && !schluessel.includes(e.id)) schluessel.push(e.id);
    for (const k of schluessel) {
      /* Den eigenen gerade gespeicherten Stand nicht zweimal holen. */
      if (e.revision != null && voll.get(k)?.revision === e.revision) continue;
      void this.oeffnen(k, true, this._rueck().has(k));
    }
  }

  /**
   * **Eine andere Sicht** (T-269, REQ-241): nach „View as" oder zurück
   * sieht der Betrachter anderes. Namen und Verweise der alten Sicht
   * vergessen und alles Geöffnete neu holen — was die neue Sicht nicht
   * sieht, fällt dabei als fehlend heraus.
   */
  sichtGewechselt(): void {
    this._namen.set(new Map());
    this._verweise.set(new Map());
    this.allesNeu();
  }

  /** Alles Geöffnete neu holen — nach `reset` (zu viel auf einmal, oder
   *  die Verbindung war zu lange weg). */
  private allesNeu(): void {
    const offen = new Set([...this._voll().keys(), ...this._fehlt()]);
    for (const k of offen) void this.oeffnen(k, true, this._rueck().has(k));
  }

  /**
   * Die Namen und Verweisziele eines Stücks der Leseansicht aufnehmen
   * (T-091): der Server rechnet sie für das ganze Kapitel auf einmal, und
   * `nw-text` liest sie hier wie die eines geöffneten Artikels.
   */
  bezuegeAufnehmen(refs: Bezuege): void {
    if (Object.keys(refs.names).length) {
      const namen = new Map(this._namen());
      for (const [id, name] of Object.entries(refs.names)) namen.set(id, name);
      this._namen.set(namen);
    }
    if (Object.keys(refs.links).length) {
      const v = new Map(this._verweise());
      for (const [ziel, treffer] of Object.entries(refs.links)) v.set(ziel, treffer);
      this._verweise.set(v);
    }
  }

  /** Namen und Verweise aufnehmen — auch die eines Rückbezugs und des Artikels selbst. */
  private merke(refs: Bezuege | undefined, rueck: Rueckbezug[], e: Entity): void {
    const namen = new Map(this._namen());
    for (const [id, name] of Object.entries(refs?.names ?? {})) namen.set(id, name);
    for (const b of rueck) namen.set(b.from.id, entityName(b.from));
    namen.set(e.id, entityName(e));
    this._namen.set(namen);
    if (refs && Object.keys(refs.links).length) {
      const v = new Map(this._verweise());
      for (const [ziel, treffer] of Object.entries(refs.links)) v.set(ziel, treffer);
      this._verweise.set(v);
    }
  }

  /**
   * **Die Teile eines geöffneten Artikels, ganz und in einer Anfrage** —
   * die Merkmale und Aktionen eines Statblocks (W2). Eine Listenzeile trägt
   * ihren Namen, aber nicht ihren Text und nicht ihre Angriffswerte; ein
   * Drache hat dreizehn Teile, und dreizehn Anfragen wären dreizehnmal das
   * Sieb über den ganzen Bestand. Geholt wird nur, was noch nicht da ist;
   * was nicht kommt, fehlt für diesen Betrachter.
   */
  async holen(ids: readonly string[]): Promise<void> {
    const offen = [...new Set(ids)].filter(
      (id) => id && !this._voll().has(id) && !this._fehlt().has(id) && !this.holt.has(id),
    );
    if (!offen.length) return;
    offen.forEach((id) => this.holt.add(id));
    try {
      const da = await this.api.entitiesById(offen);
      const gekommen = new Set(da.map((e) => e.id));
      const namen = new Map(this._namen());
      for (const e of da) namen.set(e.id, entityName(e));
      this._namen.set(namen);
      this._voll.update((m) => {
        const n = new Map(m);
        for (const e of da) n.set(e.id, e);
        return n;
      });
      this._fehlt.update((s) => {
        const n = new Set(s);
        for (const id of offen) if (!gekommen.has(id)) n.add(id);
        return n;
      });
    } catch (error: unknown) {
      this._fehler.set(error instanceof Error ? error.message : String(error));
    } finally {
      offen.forEach((id) => this.holt.delete(id));
    }
  }
  private readonly holt = new Set<string>();

  /** Was ein Abruf eines ganzen Artikels brachte, an seinen Platz — für `oeffnen` und `oeffnenViele`. */
  private uebernimm(id: string, mitBezug: Entity & { refs?: Bezuege }, zeigt: Rueckbezug[] | null): void {
    const { refs, ...e } = mitBezug;
    this.merke(refs, zeigt ?? [], e as Entity);
    this._anpassbar.update((m) => {
      const n = new Set(m);
      if (refs?.adaptable) n.add(id);
      else n.delete(id);
      return n;
    });
    this._anpassZiele.update((m) => {
      const n = new Map(m);
      if (refs?.adaptTo?.length) n.set(id, refs.adaptTo);
      else n.delete(id);
      return n;
    });
    this._uebernahmeZiele.update((m) => {
      const n = new Map(m);
      if (refs?.takeInto?.length) n.set(id, refs.takeInto);
      else n.delete(id);
      return n;
    });
    this._lesen.update((m) => {
      const n = new Map(m);
      if (refs?.reading) n.set(id, refs.reading);
      else n.delete(id);
      return n;
    });
    this._fertigung.update((m) => {
      const n = new Map(m);
      if (refs?.craft) n.set(id, refs.craft);
      else n.delete(id);
      return n;
    });
    this._laden.update((m) => {
      const n = new Map(m);
      if (refs?.shop) n.set(id, refs.shop);
      else n.delete(id);
      return n;
    });
    this._begegnung.update((m) => {
      if (!refs?.encounter && !m.has(id)) return m;
      const n = new Map(m);
      if (refs?.encounter) n.set(id, refs.encounter);
      else n.delete(id);
      return n;
    });
    this._form.update((m) => {
      if (!refs?.shape && !m.has(id)) return m;
      const n = new Map(m);
      if (refs?.shape) n.set(id, refs.shape);
      else n.delete(id);
      return n;
    });
    this._stufe.update((m) => {
      if (!refs?.audience && !m.has(id)) return m;
      const n = new Map(m);
      if (refs?.audience) n.set(id, refs.audience);
      else n.delete(id);
      return n;
    });
    this._token.update((m) => {
      if (!refs?.token && !m.has(id)) return m;
      const n = new Map(m);
      if (refs?.token) n.set(id, refs.token);
      else n.delete(id);
      return n;
    });
    this._bild.update((m) => {
      if (!refs?.image && !m.has(id)) return m;
      const n = new Map(m);
      if (refs?.image) n.set(id, refs.image);
      else n.delete(id);
      return n;
    });
    /* Die Versionen der Bilder, die er nennt (T-211): jedes `nw-bild`
       mit dieser Id fragt dann mit `?v=`, und der Browser behält es. */
    for (const [a, v] of Object.entries(refs?.assets ?? {})) if (this.bildStand.version()(a) !== v) this.bildStand.merke(a, v);
    this._fertig.update((m) => {
      const n = new Map(m);
      if (refs?.ready) n.set(id, refs.ready.at);
      else n.delete(id);
      return n;
    });
    this._freigabe.update((m) => {
      const f = refs?.enabled ? { campaign: refs.enabled.campaign, enabled: true } : refs?.enable ? { campaign: refs.enable.campaign, enabled: false } : null;
      if (!f && !m.has(id)) return m;
      const n = new Map(m);
      if (f) n.set(id, f);
      else n.delete(id);
      return n;
    });
    this._vergleich.update((v) => {
      if (!!refs?.compare === v.has(id)) return v;
      const n = new Set(v);
      if (refs?.compare) n.add(id);
      else n.delete(id);
      return n;
    });
    this._voll.update((m) => new Map(m).set(id, e as Entity));
    if (zeigt) this._rueck.update((m) => new Map(m).set(id, zeigt));
    this._fehlt.update((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
  }

  /**
   * **Viele Artikel auf einmal öffnen** (T-398): eine Anfrage
   * (`/api/entities/batch`) statt einer — oder mit Rückbezügen zweier — je
   * Artikel. Für das Board mit seinen Karten: zwanzig Karten waren vierzig
   * Anfragen, und jede las am Server den ganzen Bestand. Was schon da ist,
   * wird nicht noch einmal gefragt; ein Einzelabruf, der gerade läuft,
   * auch nicht.
   */
  async oeffnenViele(ids: readonly string[], rueck = true): Promise<void> {
    const offen = [...new Set(ids)].filter((id) => {
      if (!id || this._fehlt().has(id) || this.holtViele.has(id)) return false;
      if (this.oeffnet.has(`${id} +rueck`) || (!rueck && this.oeffnet.has(id))) return false;
      return !(this._voll().has(id) && (!rueck || this._rueck().has(id)));
    });
    if (!offen.length) return;
    /* Ein Einzelabruf, der danach beginnt (Live, Speichern), ist jünger und gewinnt. */
    const start = this.zaehler;
    let fertig!: () => void;
    const lauf = new Promise<void>((r) => (fertig = r));
    offen.forEach((id) => this.holtViele.set(id, { rueck, lauf }));
    try {
      for (let i = 0; i < offen.length; i += 200) {
        const teil = offen.slice(i, i + 200);
        const r = await this.api.entitiesBatch(teil, rueck);
        for (const id of teil) {
          const e = r.entities[id];
          if (e && (this.juengstes.get(id)?.nr ?? 0) <= start) this.uebernimm(id, e, rueck ? (r.backlinks?.[id] ?? []) : null);
        }
        if (r.missing.length) {
          this._fehlt.update((s) => {
            const n = new Set(s);
            for (const id of r.missing) n.add(id);
            return n;
          });
        }
      }
    } catch (error: unknown) {
      this._fehler.set(error instanceof Error ? error.message : String(error));
    } finally {
      offen.forEach((id) => this.holtViele.delete(id));
      fertig();
    }
  }
  private readonly holtViele = new Map<string, { rueck: boolean; lauf: Promise<void> }>();


  /**
   * **Einen Registerteil schreiben** und, wenn der Server ihn nimmt, hier
   * einsetzen. Erst nach seiner Antwort: eine Zeile, die er abweist, soll
   * auch hier nicht stehen — sonst zeigte die Seite ein Register, das es
   * nirgends gibt.
   */
  async registerSchreiben<T extends RegisterTeil>(part: T, value: Registry[T]): Promise<void> {
    await this.api.putRegistry(part, value);
    this._registry.update((r) => (r ? { ...r, [part]: value } : r));
  }
}

/** Eine Listenzeile als schmaler Artikel — mit den Kanten, die sie mitbrachte. */
export function schmal(z: ListenZeile): Entity {
  return {
    id: z.id,
    interfaces: [z.type],
    name: z.name,
    components: {
      Identity: { name: z.name },
      ...(z.tags?.length ? { Tags: { tags: z.tags } } : {}),
      ...(z.source ? { Source: { publication: z.source } } : {}),
    },
    relations: Object.entries(z.rels ?? {}).flatMap(([type, ziele]) =>
      ziele.map((to, i) => ({ id: `${z.id}~${type}-${i}`, type, to, props: {} })),
    ),
  };
}
