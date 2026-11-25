import { Component, computed, inject, input, signal } from '@angular/core';
import { contrastRatio, MIN_CONTRAST, usedTokens } from '@nw/model';
import type { TokenDef, TokenRole } from '@nw/model';
import { Bestand } from '../kern/bestand';
import { RegisterArbeit } from './arbeit';
import { techName } from './regeln';

/**
 * **Registry › Tokens** (T-425, REQ-437, E-170 a): die Farben, die ein
 * Element im Designer nennt. Je Token Name, Rolle, Wert hell und dunkel und
 * die Fläche, auf der es steht; daneben der Kontrast in beiden Modi und wie
 * viele Ansichten es nutzen. Gelöscht wird nur, was keine Ansicht nennt —
 * sonst zeichnete die Stelle plötzlich nichts mehr.
 */
@Component({
  selector: 'nw-reg-tokens',
  template: `
    <section class="tokens" aria-label="Design tokens">
      <h2>Design tokens</h2>
      <p class="hint">
        Colours an element in the view designer can use for its head, surface, frame and text — each with a light and a dark value.
        Text needs {{ MIN.text }}:1 on its surface, an accent {{ MIN.accent }}:1; the workbench lists what falls short.
      </p>
      <table>
        <thead>
          <tr><th scope="col">Token</th><th scope="col">Role</th><th scope="col">Light</th><th scope="col">Dark</th><th scope="col">On</th><th scope="col">Contrast</th><th scope="col">Used</th><th scope="col"></th></tr>
        </thead>
        <tbody>
          @for (z of zeilen(); track z.name) {
            <tr [attr.aria-label]="z.def.label">
              <td>
                <input type="text" [value]="z.def.label" [disabled]="!darf()" (change)="setze(z.name, { label: wert($event) || z.def.label })" [attr.aria-label]="'Name of ' + z.name" />
                <code class="sub">{{ z.name }}</code>
              </td>
              <td>
                <select [disabled]="!darf()" (change)="setze(z.name, { role: $any(wert($event)) })" [attr.aria-label]="'Role of ' + z.def.label">
                  @for (r of ROLLEN; track r) {
                    <option [value]="r" [selected]="z.def.role === r">{{ r }}</option>
                  }
                </select>
              </td>
              @for (m of MODI; track m) {
                <td>
                  <span class="muster" [style.background]="z.def[m]"></span>
                  @if (hex(z.def[m])) {
                    <input type="color" [value]="z.def[m]" [disabled]="!darf()" (change)="setzeModus(z.name, m, wert($event))" [attr.aria-label]="(m === 'light' ? 'Light' : 'Dark') + ' value of ' + z.def.label" />
                  }
                  <input type="text" class="wert" [value]="z.def[m]" [disabled]="!darf()" (change)="setzeModus(z.name, m, wert($event))" [attr.aria-label]="(m === 'light' ? 'Light' : 'Dark') + ' colour of ' + z.def.label" />
                </td>
              }
              <td>
                @if (z.def.role === 'text' || z.def.role === 'accent') {
                  <select [disabled]="!darf()" (change)="setze(z.name, { on: wert($event) || undefined })" [attr.aria-label]="'Surface of ' + z.def.label">
                    @for (f of flaechen(); track f.name) {
                      <option [value]="f.name" [selected]="(z.def.on ?? 'paper') === f.name">{{ f.label }}</option>
                    }
                  </select>
                }
              </td>
              <td>
                @for (k of z.kontrast; track k.mode) {
                  <span class="kontrast" [class.schwach]="k.schwach" [title]="k.mode">{{ k.mode === 'light' ? '☀' : '☾' }} {{ k.ratio }}</span>
                }
              </td>
              <td>{{ z.genutzt || '—' }}</td>
              <td>
                @if (darf()) {
                  <button type="button" class="klein" [disabled]="z.genutzt > 0" [title]="z.genutzt ? 'Used by ' + z.genutzt + ' view(s) — take it out there first' : 'Delete'" (click)="loeschen(z.name)" [attr.aria-label]="'Delete ' + z.def.label">×</button>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
      @if (darf()) {
        <form class="neu" (submit)="$event.preventDefault(); neu()">
          <input type="text" [value]="neuName()" (input)="neuName.set(wert($event))" placeholder="New token, e.g. Danger" aria-label="Name of the new token" />
          <button type="submit" class="pri" [disabled]="!neuName().trim()">Add token</button>
        </form>
      }
    </section>
  `,
  styles: `
    table { border-collapse: collapse; width: 100%; }
    th, td { text-align: left; padding: 0.3rem 0.4rem; border-bottom: 1px solid var(--line2); vertical-align: middle; }
    .muster { display: inline-block; width: 1.2rem; height: 1.2rem; border: 1px solid var(--line); border-radius: 4px; vertical-align: middle; }
    input.wert { width: 8.5rem; }
    input[type='color'] { width: 2.2rem; min-height: 2rem; padding: 0; border: 0; background: none; }
    .kontrast { margin-right: 0.4rem; white-space: nowrap; }
    .kontrast.schwach { color: var(--warn); font-weight: 700; }
    .neu { display: flex; gap: 0.4rem; margin-top: 0.8rem; }
    @media (max-width: 700px) {
      table, tbody, tr, td { display: block; }
      thead { display: none; }
      tr { border: 1px solid var(--line); border-radius: 8px; margin-bottom: 0.6rem; padding: 0.4rem; }
      td { border: 0; }
    }
  `,
})
export class RegTokens {
  readonly darf = input(true);
  private readonly bestand = inject(Bestand);
  private readonly arbeit = inject(RegisterArbeit);
  protected readonly ROLLEN: readonly TokenRole[] = ['surface', 'text', 'accent', 'line'];
  protected readonly MODI = ['light', 'dark'] as const;
  protected readonly MIN = MIN_CONTRAST;
  protected readonly neuName = signal('');

  protected readonly flaechen = computed(() =>
    Object.entries(this.bestand.registry()?.tokens ?? {})
      .filter(([, d]) => d.role === 'surface')
      .map(([name, d]) => ({ name, label: d.label })),
  );

  /** Wie viele Ansichten ein Token nennen — am Element oder als Vorgabe je Elementart. */
  private readonly nutzung = computed(() => {
    const r = this.bestand.registry();
    const n = new Map<string, number>();
    if (!r) return n;
    const zaehle = (namen: string[]) => new Set(namen).forEach((x) => n.set(x, (n.get(x) ?? 0) + 1));
    for (const v of Object.values(r.views)) zaehle(usedTokens(v.layout ?? [...(v.adjust?.extra ?? [])], v));
    for (const t of Object.values(r.interfaces)) {
      for (const l of Object.values(t.views ?? {})) zaehle(usedTokens(Array.isArray(l) ? l : (l.adjust.extra ?? [])));
    }
    return n;
  });

  protected readonly zeilen = computed(() => {
    const t = this.bestand.registry()?.tokens ?? {};
    return Object.entries(t)
      .map(([name, def]) => {
        const on = t[def.on ?? 'paper'];
        const kontrast =
          (def.role === 'text' || def.role === 'accent') && on
            ? this.MODI.map((mode) => {
                const ratio = contrastRatio(def[mode], on[mode]);
                return ratio === null ? null : { mode, ratio: Math.round(ratio * 10) / 10, schwach: ratio < MIN_CONTRAST[def.role as 'text' | 'accent'] };
              }).filter((x): x is { mode: 'light' | 'dark'; ratio: number; schwach: boolean } => !!x)
            : [];
        return { name, def, kontrast, genutzt: this.nutzung().get(name) ?? 0 };
      })
      .sort((a, b) => this.ROLLEN.indexOf(a.def.role) - this.ROLLEN.indexOf(b.def.role) || a.def.label.localeCompare(b.def.label));
  });

  protected hex(v: string): boolean {
    return /^#[0-9a-f]{6}$/i.test(v);
  }

  protected wert(ev: Event): string {
    return (ev.target as HTMLInputElement | HTMLSelectElement).value.trim();
  }

  protected setze(name: string, patch: Partial<TokenDef>): void {
    void this.arbeit.aendern('tokens', (tokens) => {
      const d = tokens[name];
      if (!d) return `There is no token ${name}.`;
      const neu = { ...d, ...patch };
      if (patch.on === undefined && 'on' in patch) delete neu.on;
      tokens[name] = neu;
      return undefined;
    });
  }

  /** Hell oder dunkel: ein leerer Wert lässt den bisherigen stehen. */
  protected setzeModus(name: string, modus: 'light' | 'dark', farbe: string): void {
    if (farbe) this.setze(name, modus === 'light' ? { light: farbe } : { dark: farbe });
  }

  protected neu(): void {
    const label = this.neuName().trim();
    if (!label) return;
    void this.arbeit
      .aendern('tokens', (tokens) => {
        const name = techName(label, tokens, true);
        tokens[name] = { label, role: 'accent', light: '#8c1c13', dark: '#d0675a' };
        return undefined;
      })
      .then((ok) => ok && this.neuName.set(''));
  }

  protected loeschen(name: string): void {
    if ((this.nutzung().get(name) ?? 0) > 0) return;
    void this.arbeit.aendern('tokens', (tokens) => {
      delete tokens[name];
      return undefined;
    });
  }
}
