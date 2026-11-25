import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { typeChain } from '@nw/model';
import type { Entity } from '@nw/model';
import { Api, ApiError, type Wissensreiter } from '../kern/api';
import { Bestand } from '../kern/bestand';
import { KurzLink } from '../kern/kurzansicht';

/** Eine Gruppe der Feldwahl: ein Bestandteil des Artikels und seine Felder. */
interface Feldgruppe {
  comp: string;
  label: string;
  felder: { ref: string; label: string }[];
}

/** Was die Maske gerade bearbeitet: eine neue Information oder eine bestehende. */
interface Entwurf {
  id: string | null;
  name: string;
  fields: string[];
  bundles: string[];
  newBundle: string;
}

/**
 * **Der Kasten Knowledge am Artikel** (T-286, REQ-352): welche
 * Informationen es zu diesem Artikel gibt — angehängte, für genau ihn
 * geltende und Regeln für eine Gruppe (T-285) —, je mit Feldern und den
 * Bündeln (`Knowledge`), in denen sie stehen, und wem diese zugeteilt
 * sind. Neu anlegen: Name, Felder nach Bestandteil gewählt (wie in den
 * Ansichten), Bündel ankreuzen oder ein neues nennen.
 *
 * Nur die Leitung bekommt ihn (der Server sagt 403 sonst, und dann steht
 * hier nichts). Geschrieben wird am Server (`/api/knowledge/…`); die neue
 * Information ändert den Artikel nicht, sie gilt für ihn.
 */
@Component({
  selector: 'nw-wissenskasten',
  imports: [RouterLink, KurzLink],
  template: `
    @if (stand(); as s) {
      <section class="kasten wissen" aria-label="Knowledge">
        <h2>Knowledge</h2>
        @for (i of s.infos; track i.id) {
          <article class="info">
            <header>
              <a [routerLink]="['/artikel', i.id]" [nwQuick]="i.id"><b>{{ i.name }}</b></a>
              <small>{{ geltung(i) }}</small>
            </header>
            <p class="felder">{{ feldText(i.fields) }}</p>
            <p class="buendel">
              @for (b of i.bundles; track b.id) {
                <a [routerLink]="['/artikel', b.id]" [nwQuick]="b.id">{{ b.name }}</a>{{ $last ? '' : ', ' }}
              } @empty {
                <span class="dim">In no knowledge yet.</span>
              }
              @if (bekannt(i); as k) {
                <small> — known by {{ k }}</small>
              }
            </p>
            @if (i.canEdit && i.scope !== 'group' && entwurf()?.id !== i.id) {
              <div class="knoepfe">
                <button type="button" class="klein" (click)="bearbeiten(i)">Edit</button>
                <button type="button" class="klein" (click)="entfernen(i.id)" [disabled]="laeuft()">Remove</button>
              </div>
            }
          </article>
        } @empty {
          <p class="dim">No information about this article yet — everything on it is open to whoever sees it.</p>
        }

        @if (entwurf(); as d) {
          <form class="maske" (submit)="$event.preventDefault(); speichern()">
            <h3>{{ d.id ? 'Edit information' : 'New information' }}</h3>
            <label>Name <input type="text" [value]="d.name" (input)="setze({ name: $any($event.target).value })" placeholder="e.g. How it is made" /></label>
            <fieldset>
              <legend>Fields it covers</legend>
              @for (g of gruppen(); track g.comp) {
                <div class="gruppe">
                  <label class="ganz">
                    <input type="checkbox" [checked]="d.fields.includes(g.comp)" (change)="feld(g.comp, $any($event.target).checked)" />
                    <b>{{ g.label }}</b>
                    @if (g.felder.length) {
                      <small>&nbsp;all fields</small>
                    }
                  </label>
                  @if (!d.fields.includes(g.comp)) {
                    @for (f of g.felder; track f.ref) {
                      <label class="einzeln">
                        <input type="checkbox" [checked]="d.fields.includes(f.ref)" (change)="feld(f.ref, $any($event.target).checked)" />
                        {{ f.label }}
                      </label>
                    }
                  }
                </div>
              }
            </fieldset>
            <fieldset>
              <legend>In knowledge</legend>
              @for (b of s.bundles; track b.id) {
                <label [class.aus]="!b.canEdit" [title]="b.canEdit ? '' : 'You cannot change this knowledge.'">
                  <input type="checkbox" [checked]="d.bundles.includes(b.id)" [disabled]="!b.canEdit" (change)="buendel(b.id, $any($event.target).checked)" />
                  {{ b.name }}
                  @if (b.knownBy.length) {
                    <small>— {{ namen(b.knownBy) }}</small>
                  }
                </label>
              }
              <label>New knowledge <input type="text" [value]="d.newBundle" (input)="setze({ newBundle: $any($event.target).value })" placeholder="e.g. Orc lore" /></label>
            </fieldset>
            @if (fehler(); as f) {
              <p class="fehler" role="alert">{{ f }}</p>
            }
            <div class="knoepfe">
              <button type="button" (click)="entwurf.set(null)">Cancel</button>
              <button type="submit" class="pri" [disabled]="laeuft() || !d.fields.length">Save</button>
            </div>
            <p class="hinweis">Who knows it is set on the knowledge (“known by”): characters, a party, a faction — or an ancestry, background, class or feat.</p>
          </form>
        } @else {
          <button type="button" (click)="neu()">+ Information</button>
        }
      </section>
    }
  `,
  styles: `
    /* Wie die übrigen Kästen im Kapitel „Admin" (T-277). */
    .kasten { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 1rem; display: flex; flex-direction: column; gap: 0.4rem; }
    .kasten h2 { margin: 0; font-family: var(--caps); font-size: 1rem; color: var(--accent); }
    .info { border-top: 1px dotted var(--line); padding-top: 0.4rem; }
    .info header { display: flex; flex-wrap: wrap; gap: 0.3rem 0.6rem; align-items: baseline; }
    .felder, .buendel { margin: 0.15rem 0; overflow-wrap: anywhere; }
    .felder { font-size: 0.85rem; }
    small, .dim, .hinweis { color: var(--dim); }
    .knoepfe { display: flex; gap: 0.4rem; flex-wrap: wrap; }
    .maske { display: flex; flex-direction: column; gap: 0.5rem; border-top: 1px solid var(--line); padding-top: 0.6rem; }
    .maske h3 { margin: 0; font-size: 1rem; }
    fieldset { border: 1px solid var(--line); border-radius: 6px; padding: 0.3rem 0.6rem 0.5rem; display: flex; flex-direction: column; gap: 0.15rem; }
    .gruppe { display: flex; flex-direction: column; }
    .einzeln { padding-left: 1.4rem; }
    label.aus { opacity: 0.6; }
    input[type='text'] { width: 100%; }
    .fehler { color: var(--warn); }
  `,
})
export class Wissenskasten {
  readonly artikel = input.required<Entity>();

  private readonly api = inject(Api);
  private readonly bestand = inject(Bestand);

  protected readonly stand = signal<Wissensreiter | null>(null);
  protected readonly entwurf = signal<Entwurf | null>(null);
  protected readonly laeuft = signal(false);
  protected readonly fehler = signal('');

  constructor() {
    effect(() => {
      const id = this.artikel().id;
      untracked(() => void this.laden(id));
    });
  }

  private async laden(id: string): Promise<void> {
    try {
      this.stand.set(await this.api.knowledgeOf(id));
    } catch (e) {
      /* Nicht die Leitung (403) oder nicht da: kein Kasten. */
      if (!(e instanceof ApiError)) this.fehler.set(String((e as Error).message ?? e));
      this.stand.set(null);
    }
  }

  /** Die Bestandteile des Artikels mit ihren Feldern — die Gruppen der Ansichten. */
  protected readonly gruppen = computed<Feldgruppe[]>(() => {
    const e = this.artikel();
    const r = this.bestand.registry();
    if (!r) return [];
    const kette = typeChain(r, e.interfaces?.[0] ?? '');
    const raus: Feldgruppe[] = [];
    for (const comp of kette) {
      const props = r.interfaces[comp]?.schema?.properties ?? {};
      const felder = Object.entries(props)
        .filter(([, p]) => !p.derived)
        .map(([k, p]) => ({ ref: `${comp}.${k}`, label: p.title ?? k }));
      if (!felder.length || comp === 'Identity' || comp === 'Visibility' || comp === 'Status') continue;
      raus.push({ comp, label: r.interfaces[comp]?.label ?? comp, felder });
    }
    /* Der Name gehört Identity, und ihn zu verbergen zeigt den Decknamen (REQ-178). */
    raus.unshift({ comp: 'Identity.name', label: 'Name', felder: [] });
    return raus;
  });

  protected geltung(i: Wissensreiter['infos'][number]): string {
    if (i.scope === 'attached') return 'on this article';
    if (i.scope === 'article') return 'for this article';
    return `for ${i.applies ?? 'a group'}`;
  }

  /** Die Felder mit ihren Namen: „Recipe: DC, Time"; ein ganzer Bestandteil heisst „all of Recipe". */
  protected feldText(f: readonly string[]): string {
    const gruppen = this.gruppen();
    const text = (ref: string) => {
      const g = gruppen.find((x) => x.comp === ref);
      if (g) return g.felder.length ? `all of ${g.label}` : g.label;
      for (const x of gruppen) {
        const t = x.felder.find((y) => y.ref === ref.split('#')[0]);
        if (t) return `${x.label}: ${t.label}`;
      }
      return ref;
    };
    return f.map(text).join(', ') || '—';
  }

  protected namen(l: readonly { name: string }[]): string {
    return l.map((x) => x.name).join(', ');
  }

  protected bekannt(i: Wissensreiter['infos'][number]): string {
    const s = this.stand();
    const wer = new Set<string>(i.knownBy.map((k) => k.name));
    for (const b of i.bundles) for (const k of s?.bundles.find((x) => x.id === b.id)?.knownBy ?? []) wer.add(k.name);
    return [...wer].join(', ');
  }

  protected neu(): void {
    this.fehler.set('');
    this.entwurf.set({ id: null, name: '', fields: [], bundles: [], newBundle: '' });
  }

  protected bearbeiten(i: Wissensreiter['infos'][number]): void {
    this.fehler.set('');
    this.entwurf.set({ id: i.id, name: i.name, fields: [...i.fields], bundles: i.bundles.map((b) => b.id), newBundle: '' });
  }

  protected setze(teil: Partial<Entwurf>): void {
    const d = this.entwurf();
    if (d) this.entwurf.set({ ...d, ...teil });
  }

  protected feld(ref: string, an: boolean): void {
    const d = this.entwurf();
    if (!d) return;
    let f = d.fields.filter((x) => x !== ref);
    /* Ein ganzer Bestandteil nimmt seine Einzelfelder mit. */
    if (an) f = [...f.filter((x) => !x.startsWith(`${ref}.`)), ref];
    this.entwurf.set({ ...d, fields: f });
  }

  protected buendel(id: string, an: boolean): void {
    const d = this.entwurf();
    if (!d) return;
    this.entwurf.set({ ...d, bundles: an ? [...new Set([...d.bundles, id])] : d.bundles.filter((x) => x !== id) });
  }

  protected async speichern(): Promise<void> {
    const d = this.entwurf();
    if (!d || !d.fields.length) return;
    this.laeuft.set(true);
    this.fehler.set('');
    try {
      const body = { ...(d.name.trim() ? { name: d.name.trim() } : {}), fields: d.fields, bundles: d.bundles, ...(d.newBundle.trim() ? { newBundle: d.newBundle.trim() } : {}) };
      const s = d.id
        ? await this.api.updateInformation(d.id, { ...body, article: this.artikel().id })
        : await this.api.addInformation(this.artikel().id, body);
      this.stand.set(s);
      this.entwurf.set(null);
    } catch (e) {
      this.fehler.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.laeuft.set(false);
    }
  }

  protected async entfernen(id: string): Promise<void> {
    this.laeuft.set(true);
    try {
      await this.api.deleteInformation(id);
      await this.laden(this.artikel().id);
    } catch (e) {
      this.fehler.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.laeuft.set(false);
    }
  }
}
