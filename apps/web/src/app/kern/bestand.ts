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
import { Api, ApiError, type Bezuege, type ListenFrage, type Liste, type ListenZeile, type RegisterTeil, type Rueckbezug } from './api';

@Injectable({ providedIn: 'root' })
export class Bestand {
  private readonly api = inject(Api);

  private readonly _registry = signal<Registry | null>(null);
  private readonly _fehler = signal<string | null>(null);
  private readonly _geladen = signal(false);
  private readonly _voll = signal<ReadonlyMap<string, Entity>>(new Map());
  private readonly _rueck = signal<ReadonlyMap<string, Rueckbezug[]>>(new Map());
  private readonly _fehlt = signal<ReadonlySet<string>>(new Set());
  private readonly _namen = signal<ReadonlyMap<string, string>>(new Map());
  private readonly _verweise = signal<ReadonlyMap<string, Bezuege['links'][string]>>(new Map());
  private readonly _fertig = signal<ReadonlyMap<string, string>>(new Map());

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
  /**
   * Id → Datum des fertigen Stands, der für alle anderen noch gilt
   * (REQ-237, E-012). Kommt nur an, wenn der Betrachter den Arbeitsstand
   * sieht; die Artikelseite zeigt dann das Band.
   */
  readonly fertig = this._fertig.asReadonly();

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
   */
  async oeffnen(id: string, neu = false, rueck = true): Promise<void> {
    const da = this._voll().has(id) && (!rueck || this._rueck().has(id));
    if (!neu && (da || this._fehlt().has(id))) return;
    const schluessel = rueck ? `${id} +rueck` : id;
    const schon = this.oeffnet.get(schluessel) ?? this.oeffnet.get(`${id} +rueck`);
    if (schon) return schon;
    const lauf = Promise.all([
      this.api.entity(id),
      rueck ? this.api.backlinks(id) : Promise.resolve(null),
    ])
      .then(([mitBezug, zeigt]) => {
        const { refs, ...e } = mitBezug;
        this.merke(refs, zeigt ?? [], e as Entity);
        this._fertig.update((m) => {
          const n = new Map(m);
          if (refs?.ready) n.set(id, refs.ready.at);
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
      })
      .catch((error: unknown) => {
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
      .finally(() => this.oeffnet.delete(schluessel));
    this.oeffnet.set(schluessel, lauf);
    return lauf;
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
