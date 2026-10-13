import { Component, computed, effect, inject, input, linkedSignal, output, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { areaOf, enumOptions, fieldTitle, typeChain } from '@nw/model';
import type { PropertySchema } from '@nw/model';
import { Api, ApiError } from '../kern/api';
import { Bestand } from '../kern/bestand';
import { Session } from '../kern/session';
import { Wahl } from './wahl';

interface Pflicht {
  ref: string;
  label: string;
  prop: PropertySchema;
  werte: string[];
}

/**
 * „New article" (W7): Art wählen, Name, und was die Art verlangt und keine
 * Vorgabe hat (die Art einer Aktion). Den Rest setzt der Server — Peg-Id,
 * Nummer (`nextId`), Vorgaben aus dem Register — und prüft wie beim
 * Schreiben. Danach öffnet sich die Artikelseite gleich zum Bearbeiten.
 *
 * Angeboten werden die **anlegbaren** Arten (nicht `abstract`), in einem
 * Bereich nur seine (`area`, `areaOf`). Im Code steht keine Liste davon.
 */
@Component({
  selector: 'nw-anlegen',
  imports: [Wahl, RouterLink],
  template: `
    <div class="schleier" (click)="zu.emit()"></div>
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="anlegen-titel">
      <h2 id="anlegen-titel">New article</h2>
      <label>
        <span>Type</span>
        <select [value]="typ()" (change)="typ.set($any($event.target).value)">
          @for (t of arten(); track t.name) {
            <option [value]="t.name" [selected]="t.name === typ()">{{ t.label }}</option>
          }
        </select>
      </label>
      <label>
        <span>Name</span>
        <input
          #nameFeld
          type="text"
          [value]="name()"
          (input)="name.set($any($event.target).value)"
          (keydown.enter)="anlegen()"
          autofocus
        />
      </label>
      @for (p of pflicht(); track p.ref) {
        <label>
          <span>{{ p.label }} <i class="pflicht" title="required">*</i></span>
          @if (p.prop.format === 'link') {
            <nw-wahl
              [wert]="werte()[p.ref] ?? ''"
              (wertChange)="setze(p.ref, $event)"
              [arten]="p.prop.target?.interfaces ?? []"
              [label]="p.label"
            />
          } @else if (p.werte.length) {
            <select (change)="setze(p.ref, $any($event.target).value)">
              <option value=""></option>
              @for (w of p.werte; track w) {
                <option [value]="w">{{ w }}</option>
              }
            </select>
          } @else {
            <input type="text" (input)="setze(p.ref, $any($event.target).value)" />
          }
        </label>
      }
      @if (typ() === 'PlayerCharacter') {
        <!-- Klasse, Herkunft, Hintergrund und ihre Wahlen (T-080). -->
        <p class="hinweis">
          <a routerLink="/characters/new" (click)="zu.emit()">Use the character builder</a> — ancestry, background,
          class and their choices, step by step.
        </p>
      }
      @if (problem(); as f) {
        <p class="fehler" role="alert">{{ f }}</p>
      }
      <div class="knoepfe">
        <button type="button" (click)="zu.emit()">Cancel</button>
        <button type="button" class="pri" [disabled]="laeuft() || !name().trim() || !typ()" (click)="anlegen()">
          {{ laeuft() ? 'Creating…' : 'Create' }}
        </button>
      </div>
    </div>
  `,
  styles: `
    .schleier {
      position: fixed;
      inset: 0;
      background: rgb(0 0 0 / 0.35);
      z-index: 40;
    }
    .dialog {
      position: fixed;
      z-index: 41;
      top: 12vh;
      left: 50%;
      transform: translateX(-50%);
      width: min(440px, calc(100vw - 32px));
      max-height: 76vh;
      overflow-y: auto;
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 1.1rem 1.2rem;
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
      box-shadow: 0 12px 36px rgb(0 0 0 / 0.25);
    }
    h2 {
      margin: 0;
      font-family: var(--caps);
      color: var(--accent);
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
    }
    label > span {
      font-weight: 700;
      color: var(--heading);
    }
    input,
    select {
      min-height: 40px;
      padding: 0 0.5rem;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--surface);
    }
    .pflicht {
      color: var(--accent);
      font-style: normal;
    }
    .knoepfe {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }
    .fehler {
      margin: 0;
      color: var(--warn);
    }
    .hinweis {
      margin: 0;
      color: var(--dim);
    }
  `,
})
export class Anlegen {
  /** Im Bereich nur dessen Arten. */
  readonly bereich = input<string | undefined>(undefined);
  /** Die gerade gewählte Art, als Vorschlag. */
  readonly vorgabe = input<string | undefined>(undefined);
  readonly zu = output<void>();

  private readonly api = inject(Api);
  private readonly bestand = inject(Bestand);
  private readonly router = inject(Router);
  private readonly session = inject(Session);

  protected readonly name = signal('');
  protected readonly werte = signal<Partial<Record<string, string>>>({});
  protected readonly problem = signal<string | null>(null);
  protected readonly laeuft = signal(false);

  protected readonly arten = computed(() => {
    const r = this.bestand.registry();
    if (!r) return [];
    const b = this.bereich();
    /* Spielende legen nur Arten mit Stand an (REQ-237): ohne Status-Karte
       wäre ein Entwurf sofort für alle fertig. Der Server lehnt es ab. */
    const mitStand = !this.session.isAdmin();
    return Object.values(r.interfaces)
      .filter((d) => !d.abstract && (!b || areaOf(r, d.name) === b))
      .filter((d) => !mitStand || typeChain(r, d.name).includes('Status'))
      .map((d) => ({ name: d.name, label: d.label ?? d.name }))
      .sort((a, z) => a.label.localeCompare(z.label, 'en'));
  });

  /** Die gewählte Art; zuerst die vorgeschlagene, wenn sie hier anlegbar ist. */
  protected readonly typ = linkedSignal(() => {
    const arten = this.arten();
    const v = this.vorgabe();
    return v && arten.some((a) => a.name === v) ? v : (arten[0]?.name ?? '');
  });

  /** Was Pflicht ist und keine Vorgabe hat — ohne Name und Nummer (die setzt das hier). */
  protected readonly pflicht = computed<Pflicht[]>(() => {
    const r = this.bestand.registry();
    const typ = this.typ();
    if (!r || !typ) return [];
    const raus: Pflicht[] = [];
    for (const t of typeChain(r, typ)) {
      const schema = r.interfaces[t]?.schema;
      for (const k of schema?.required ?? []) {
        const prop = schema?.properties?.[k];
        if (!prop || prop.derived || prop.default !== undefined) continue;
        if (t === 'Identity' && (k === 'name' || k === 'id')) continue;
        raus.push({
          ref: `${t}.${k}`,
          label: fieldTitle(r, typ, { type: t, key: k, prop }),
          prop,
          werte: enumOptions(r, prop) ?? [],
        });
      }
    }
    return raus;
  });

  constructor() {
    /* Eine andere Art hat andere Pflichtfelder: was für die alte gewählt
       war, gilt nicht mehr. */
    effect(() => {
      this.typ();
      untracked(() => this.werte.set({}));
    });
  }

  protected setze(ref: string, wert: string): void {
    this.werte.update((w) => ({ ...w, [ref]: wert }));
  }

  protected async anlegen(): Promise<void> {
    const name = this.name().trim();
    const typ = this.typ();
    if (!name || !typ || this.laeuft()) return;
    this.laeuft.set(true);
    this.problem.set(null);
    try {
      const felder: Record<string, unknown> = {};
      for (const p of this.pflicht()) {
        const roh = this.werte()[p.ref];
        if (roh === undefined || roh === '') continue;
        felder[p.ref] = p.prop.type === 'number' || p.prop.type === 'integer' ? Number(roh) : roh;
      }
      const e = await this.api.createEntity(typ, name, felder);
      /* Was eine Spielerin anlegt, darf sie schreiben (REQ-237) — das weiss
         erst ein neues `/api/me`. Ohne es öffnete der Artikel schreibgeschützt. */
      if (!this.session.isAdmin()) await this.session.load(true);
      this.zu.emit();
      await this.router.navigate(['/artikel', e.id], { queryParams: { edit: 1 } });
    } catch (error) {
      if (error instanceof ApiError) {
        const issues = Array.isArray(error.issues)
          ? (error.issues as { message?: string }[]).map((i) => i.message).filter(Boolean)
          : [];
        this.problem.set([error.message, ...issues].join(' — '));
      } else {
        this.problem.set('Could not reach the server.');
      }
    } finally {
      this.laeuft.set(false);
    }
  }
}
