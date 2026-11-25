import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject } from '@angular/core';
import { tokenVars } from '@nw/model';
import type { Registry } from '@nw/model';
import { Bestand } from './bestand';

/**
 * **Die Farben der Design-Tokens** (T-425, REQ-437, E-170 a): je Token eine
 * CSS-Variable `--tok-<name>`, hell und dunkel, mit denselben Regeln wie
 * `styles.scss` (`prefers-color-scheme`, ausser `data-theme="light"`).
 * Geschrieben als ein `<style>` im Kopf der Seite, neu, sobald das
 * Register sich ändert — ein Element nennt das Token, nie die Farbe.
 */
@Injectable({ providedIn: 'root' })
export class TokenFarben {
  private readonly doc = inject(DOCUMENT);
  private readonly bestand = inject(Bestand);

  constructor() {
    effect(() => {
      const r = this.bestand.registry();
      if (r) this.schreibe(r);
    });
  }

  private schreibe(r: Registry): void {
    const id = 'nw-tokens';
    let el = this.doc.getElementById(id) as HTMLStyleElement | null;
    if (!el) {
      el = this.doc.createElement('style');
      el.id = id;
      this.doc.head.appendChild(el);
    }
    el.textContent = tokenCss(r);
  }
}

/** Das Stylesheet der Tokens: hell an `:root`, dunkel wie in `styles.scss`. */
export function tokenCss(r: Pick<Registry, 'tokens'>): string {
  const block = (vars: Record<string, string>) =>
    Object.entries(vars)
      .filter(([, v]) => /^[#a-z0-9(),.%\s-]+$/i.test(v))
      .map(([k, v]) => `${k}: ${v};`)
      .join(' ');
  return `:root { ${block(tokenVars(r, 'light'))} }\n@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) { ${block(tokenVars(r, 'dark'))} } }`;
}
