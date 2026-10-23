import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { entityName, headingLevel, isBookPart, primaryInterface } from '@nw/model';
import type { Entity, VarScopes } from '@nw/model';
import { Api, type Teile } from '../kern/api';
import { Bestand } from '../kern/bestand';
import { bloeckeVon, type Block } from '../kern/buchtext';
import { KurzLink } from '../kern/kurzansicht';
import { illustration } from './bild';
import { Text } from './text';

interface Zeile {
  id: string;
  /** Wohin „open" führt: die Fassung, die gilt. */
  artikel: string;
  art: 'ueberschrift' | 'text' | 'verweis' | 'szene' | 'bild';
  name: string;
  stufe: number;
  bloecke: Block[];
  ziel?: { id: string; name: string; art: string };
  /** Am Bild-Teil (T-210): Adresse, wenn hochgeladen, und Unterschrift. */
  bild?: { adresse?: string; text: string; alt: string };
}

/**
 * **Die Teile eines Kapitels, wie im Buch** (T-108, Element `parts`): was
 * mit Rang an einem Kapitel, einer Szene oder einem Arc hängt —
 * Überschriften, Absätze, Vorlesetexte, Verweise auf Artikel, die für sich
 * stehen, und Szenen, die selbst wieder Teile haben (als Kopf mit
 * Verweis, damit eine Kapitelseite nicht das halbe Abenteuer lädt). Jeder
 * Teil ist ein Artikel; „open" führt hin, dort lässt er sich holen.
 *
 * Geholt beim Öffnen (`GET /api/entities/:id/parts`); gesiebt hat der
 * Server. Wo nichts hängt, zeichnet das Element nichts.
 */
@Component({
  selector: 'nw-fluss',
  imports: [RouterLink, Text, KurzLink],
  template: `
    @if (zeilen().length) {
      <section class="fluss" aria-label="Parts">
        @for (z of zeilen(); track z.id) {
          <div class="fteil" [class]="'fteil ' + z.art">
            @switch (z.art) {
              @case ('ueberschrift') {
                <div class="fkopf" role="heading" [attr.aria-level]="z.stufe">{{ z.name }}</div>
              }
              @case ('szene') {
                <div class="fkopf szene" role="heading" [attr.aria-level]="2">
                  <a [routerLink]="['/artikel', z.artikel]" [nwQuick]="z.artikel">{{ z.name }}</a>
                </div>
              }
              @case ('bild') {
                @if (z.bild; as bi) {
                  <figure class="abbildung" [class.ohne]="!bi.adresse">
                    @if (bi.adresse) {
                      <img [src]="bi.adresse" [alt]="bi.alt" loading="lazy" />
                    } @else {
                      <div class="platzhalter" role="img" [attr.aria-label]="bi.alt || 'Illustration'">Illustration</div>
                    }
                    @if (bi.text) {
                      <figcaption>{{ bi.text }}</figcaption>
                    }
                  </figure>
                }
              }
              @case ('verweis') {
                @if (z.ziel; as v) {
                  <div class="verweis">
                    <span class="leg">{{ v.art }}</span>
                    <a [routerLink]="['/artikel', v.id]" [nwQuick]="v.id">{{ v.name }}</a>
                  </div>
                }
              }
            }
            @for (bl of z.bloecke; track bl.key) {
              <div [class]="'block ' + bl.art">
                @if (bl.art !== 'text') {
                  <span class="leg">{{ bl.label }}</span>
                }
                <nw-text [text]="bl.text" [scopes]="scopes" />
              </div>
            }
            @if (z.art !== 'szene') {
              <a class="foeffnen" [routerLink]="['/artikel', z.artikel]" [attr.aria-label]="'Open ' + z.name">open</a>
            }
          </div>
        }
      </section>
    }
    <!-- Was ohne Rang daran hängt (T-422, REQ-427): die Szenen eines Arcs, die Begegnungen einer Szene oder Session. -->
    @if (enthaelt().length) {
      <section class="enthaelt" aria-label="Contains">
        <h3>Contains <span class="dim">({{ enthaelt().length }})</span></h3>
        <ul>
          @for (c of enthaelt(); track c.id) {
            <li>
              <span class="leg">{{ c.art }}</span>
              <a [routerLink]="['/artikel', c.id]" [nwQuick]="c.id">{{ c.name }}</a>
              @if (c.zusatz) {
                <span class="dim">{{ c.zusatz }}</span>
              }
            </li>
          }
        </ul>
      </section>
    }
    @if (fehler(); as f) {
      <p class="fehler" role="alert">{{ f }}</p>
    }
  `,
  styleUrl: './fluss.scss',
})
export class Fluss {
  readonly besitzer = input.required<Entity>();

  private readonly api = inject(Api);
  private readonly bestand = inject(Bestand);
  protected readonly teile = signal<Teile | null>(null);
  protected readonly fehler = signal<string | null>(null);
  protected readonly scopes: VarScopes = {};

  constructor() {
    effect(() => {
      const id = this.besitzer().id;
      untracked(() => void this.laden(id));
    });
  }

  private async laden(id: string): Promise<void> {
    this.fehler.set(null);
    try {
      const t = await this.api.parts(id);
      if (id !== this.besitzer().id) return;
      this.bestand.bezuegeAufnehmen(t.refs);
      this.teile.set(t);
    } catch (x) {
      this.teile.set(null);
      this.fehler.set(x instanceof Error ? x.message : String(x));
    }
  }

  /** Die Liste „Contains" (T-422): Art, Name, und was die Zeile kurz sagt — Begegnungsart, Stand. */
  protected readonly enthaelt = computed(() => {
    const t = this.teile();
    const r = this.bestand.registry();
    if (!t?.contains?.length || !r) return [];
    return t.contains.map((c) => {
      const e = c.entity;
      const typ = primaryInterface(e);
      const arten = (e.components?.['Encounter'] as { kind?: unknown } | undefined)?.kind;
      const stand = (e.components?.['Status'] as { status?: unknown } | undefined)?.status;
      const zusatz = [Array.isArray(arten) ? arten.join(', ') : '', typeof stand === 'string' && stand !== 'ready' ? stand : '']
        .filter(Boolean)
        .join(' · ');
      return { id: c.id, name: entityName(e), art: r.interfaces[typ]?.label ?? typ, zusatz };
    });
  });

  protected readonly zeilen = computed<Zeile[]>(() => {
    const t = this.teile();
    const r = this.bestand.registry();
    if (!t || !r) return [];
    return t.parts.map((p) => {
      const e = p.entity;
      const typ = primaryInterface(e);
      const stufe = headingLevel(e);
      const bild = typ === 'Illustration';
      const szene = !isBookPart(e) && stufe === undefined;
      return {
        id: p.id,
        artikel: e.id,
        art: stufe !== undefined ? 'ueberschrift' : typ === 'Embed' ? 'verweis' : bild ? 'bild' : szene ? 'szene' : 'text',
        ...(bild ? { bild: illustration(e) } : {}),
        name: entityName(e),
        stufe: (stufe ?? 2) + 1,
        /* Eine Szene zeigt hier nur ihren Kopf; ihren Text liest man auf ihrer Seite. */
        bloecke: szene || bild || stufe !== undefined || typ === 'Embed' ? [] : bloeckeVon(r, e),
        ...(p.target
          ? { ziel: { id: p.target.id, name: entityName(p.target), art: r.interfaces[primaryInterface(p.target)]?.label ?? primaryInterface(p.target) } }
          : {}),
      };
    });
  });
}
