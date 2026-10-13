import { Component, input, output } from '@angular/core';
import type { ClassTableRow } from '@nw/model';

/** Eine Zeile, wie die Klassenansicht sie rechnet: die Tabelle der Klasse, dazu die gewählten Unterklassen. */
export interface KlassenZeile extends ClassTableRow {
  unter: { id: string; name: string; nr: number; optional: boolean }[];
  gruppen: string[];
}
export interface KlassenTabelle {
  spalten: string[];
  gruppen: { name: string; nr: number; spalten: string[] }[];
  zeilen: KlassenZeile[];
}

/**
 * Die Stufentabelle einer Klasse wie im Buch (W6): Stufe, Übungsbonus,
 * Merkmale — verlinkt auf ihren Abschnitt weiter unten — und die Spalten
 * aus `classTableGroups`. Die Spalten einer gewählten Unterklasse
 * (`subclassTableGroups`) stehen dahinter, mit ihrem Namen darüber; ihre
 * Merkmale stehen in der Farbe, die sie auch über ihrer Vergleichsspalte
 * trägt. Optionale Merkmale stehen kursiv mit Stern.
 */
@Component({
  selector: 'nw-klassentabelle',
  template: `
    <div class="tabelle">
      <table>
        <thead>
          @if (tabelle().gruppen.length) {
            <tr class="gruppen">
              <th colspan="3"></th>
              @if (tabelle().spalten.length) {
                <th [attr.colspan]="tabelle().spalten.length"></th>
              }
              @for (g of tabelle().gruppen; track g.name) {
                <th [attr.colspan]="g.spalten.length" class="gruppe" [class]="'u' + (g.nr % 6)">
                  {{ g.name }}<span class="nr" aria-hidden="true">{{ g.nr + 1 }}</span>
                </th>
              }
            </tr>
          }
          <tr>
            <th class="stufe" scope="col">Level</th>
            <th class="zahl" scope="col" title="Proficiency bonus">PB</th>
            <th scope="col">Features</th>
            @for (s of tabelle().spalten; track $index) {
              <th class="zahl" scope="col">{{ s }}</th>
            }
            @for (g of tabelle().gruppen; track g.name) {
              @for (s of g.spalten; track $index) {
                <th class="zahl" scope="col">{{ s }}</th>
              }
            }
          </tr>
        </thead>
        <tbody>
          @for (z of tabelle().zeilen; track z.level) {
            <tr>
              <th class="stufe" scope="row">{{ z.level }}</th>
              <td class="zahl">+{{ z.proficiencyBonus }}</td>
              <td class="merkmale">
                @for (f of z.features; track f.id; let letzte = $last) {
                  <a
                    [attr.href]="'#' + anker(z.level, f.id)"
                    (click)="klick($event, anker(z.level, f.id))"
                    [class.optional]="f.optional"
                    >{{ f.name }}</a
                  >
                  @if (!letzte || z.unter.length) {
                    <span>, </span>
                  }
                }
                @for (f of z.unter; track f.id + f.nr; let letzte = $last) {
                  <a
                    [attr.href]="'#' + anker(z.level, f.id)"
                    (click)="klick($event, anker(z.level, f.id))"
                    class="unterm"
                    [class]="'u' + (f.nr % 6)"
                    [class.optional]="f.optional"
                    >{{ f.name }}<span class="nr" aria-hidden="true">{{ f.nr + 1 }}</span></a
                  >
                  @if (!letzte) {
                    <span>, </span>
                  }
                }
                @if (!z.features.length && !z.unter.length) {
                  <span class="dim">—</span>
                }
              </td>
              @for (c of z.extra; track $index) {
                <td class="zahl">{{ c }}</td>
              }
              @for (c of z.gruppen; track $index) {
                <td class="zahl">{{ c }}</td>
              }
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styleUrl: './klassentabelle.scss',
})
export class Klassentabelle {
  readonly tabelle = input.required<KlassenTabelle>();
  /** Der Anker des Merkmals, zu dem gesprungen werden soll. */
  readonly springe = output<string>();

  protected anker(level: number, id: string): string {
    return `l${level}-${id}`;
  }
  protected klick(event: Event, anker: string): void {
    event.preventDefault();
    this.springe.emit(anker);
  }
}
