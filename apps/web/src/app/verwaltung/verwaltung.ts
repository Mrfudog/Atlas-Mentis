import { Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Api,
  ApiError,
  TABLE_ROLES,
  type Einladung,
  type Kampagnen,
  type Konto,
  type Mitglied,
  type Mitglieder,
  type TableRole,
} from '../kern/api';
import { Session } from '../kern/session';

/** Was jede Rolle heisst — dieselben Sätze wie auf der Tafel (`Members.dc.html`). */
const ROLLEN: { role: TableRole; text: string }[] = [
  { role: 'gm', text: 'leads; sees everything; manages members' },
  { role: 'co-gm', text: 'sees what the GM sees; members read only' },
  { role: 'player', text: 'sees public, campaign and players, plus what is revealed' },
  { role: 'spectator', text: 'sees public and campaign' },
];

/**
 * Die Verwaltung einer Kampagne (W3), nach `Members.dc.html`: links wer am
 * Tisch sitzt, rechts Einladen und die Rollen; darunter die offenen
 * Einladungen und — nur für die Verwaltung — die Konten der Installation.
 *
 * **Was jemand ändern darf, sagt der Server** (`may`): `manage` für die
 * Verwaltung und die Leitung, `see` für die Mitleitung. Die Seite rechnet
 * das nicht nach; sie zeigt Auswahl und × nur, wo der Server sie annimmt.
 *
 * Gibt es noch keine Kampagne, steht hier, wie eine entsteht — für die
 * Verwaltung mit einem Feld dafür. Ohne Kampagne gibt es nichts, wohin
 * jemand eingeladen werden könnte.
 */
@Component({
  selector: 'nw-verwaltung',
  imports: [FormsModule, NgTemplateOutlet],
  template: `
    <div class="kopf">
      @if (mitglieder()) {
        <span class="pfad">
          Campaign ›
          @if (mehrere()) {
            <select aria-label="Campaign" [ngModel]="gewaehlt()" (ngModelChange)="waehlen($event)">
              @for (k of kampagnen()?.campaigns ?? []; track k.id) {
                <option [value]="k.id">{{ k.name }}</option>
              }
            </select>
          } @else {
            <b>{{ mitglieder()?.campaign?.name ?? '…' }}</b>
          }
          › Members
        </span>
      }
      <span class="stand">{{ standText() }}</span>
    </div>

    @if (fehler()) {
      <p class="fehler" role="alert">{{ fehler() }}</p>
    }

    @if (kampagnen(); as k) {
      @if (!k.campaigns.length) {
        <section class="kasten leer">
          @if (k.canCreate) {
            <h2>No campaign yet</h2>
            <p>
              Members and invitations belong to a campaign — an article of the type
              <b>Campaign</b>. There is none yet; create the first one here.
            </p>
            <ng-container *ngTemplateOutlet="anlegen" />
          } @else {
            <h2>Nothing to manage</h2>
            <p>
              Members and invitations are kept by the GM of a campaign and by the admin of this
              installation. You lead no campaign here.
            </p>
          }
        </section>
      }
    }

    @if (mitglieder(); as m) {
      <div class="flaeche">
        <section class="kasten tisch" aria-label="Members">
          <h2>At the table</h2>
          @if (!m.campaign.exists) {
            <p class="dim">
              There is no article for this campaign (<code>{{ m.campaign.id }}</code
              >) — the roles stand anyway.
            </p>
          }
          <div class="tabelle" role="table">
            <div class="zeile kopfzeile" role="row">
              <span role="columnheader">Account</span>
              <span role="columnheader">Role</span>
              <span role="columnheader">Plays</span>
              <span role="columnheader"><span class="sr">Remove</span></span>
            </div>
            @for (p of m.members; track p.id) {
              <div class="zeile" role="row">
                <span role="cell" class="wer">
                  {{ p.name }}
                  @if (p.self) {
                    <span class="dim">(you)</span>
                  }
                  @if (p.isAdmin) {
                    <span class="marke">admin</span>
                  }
                  @if (p.disabled) {
                    <span class="marke aus">disabled</span>
                  }
                </span>
                <span role="cell">
                  @if (aenderbar(p)) {
                    <select
                      aria-label="Role of {{ p.name }}"
                      [ngModel]="p.role"
                      (ngModelChange)="rolleSetzen(p, $event)"
                    >
                      @for (r of rollen; track r) {
                        <option [value]="r">{{ r }}</option>
                      }
                    </select>
                  } @else {
                    <span class="rolle" [class.gm]="p.role === 'gm'">{{ p.role }}</span>
                  }
                </span>
                <span role="cell" class="figuren">
                  @for (f of p.actors; track f.id) {
                    <span class="figur">
                      {{ f.name ?? f.id + ' (gone)' }}
                      @if (aenderbar(p)) {
                        <button
                          type="button"
                          class="klein"
                          [attr.aria-label]="'Take ' + (f.name ?? f.id) + ' from ' + p.name"
                          (click)="figurWeg(p, f.id)"
                        >
                          ×
                        </button>
                      }
                    </span>
                  } @empty {
                    <span class="dim">—</span>
                  }
                  @if (aenderbar(p) && freieFiguren(p).length) {
                    <select
                      class="dazu"
                      [attr.aria-label]="'Give ' + p.name + ' a character'"
                      [ngModel]="''"
                      (ngModelChange)="figurDazu(p, $event)"
                    >
                      <option value="">+ character</option>
                      @for (c of freieFiguren(p); track c.id) {
                        <option [value]="c.id">{{ c.name }}</option>
                      }
                    </select>
                  }
                </span>
                <span role="cell">
                  @if (aenderbar(p)) {
                    <button
                      type="button"
                      class="weg"
                      [attr.aria-label]="'Remove ' + p.name + ' from the campaign'"
                      (click)="entfernen(p)"
                    >
                      ×
                    </button>
                  }
                </span>
              </div>
            } @empty {
              <p class="dim">Nobody yet. Invite someone, or add an account by name.</p>
            }
          </div>

          @if (m.may === 'manage') {
            <form class="dazunehmen" (ngSubmit)="kontoDazu()">
              <label>
                <span>Add an existing account</span>
                <input name="konto" placeholder="Account name" [(ngModel)]="kontoName" />
              </label>
              <label>
                <span>Role</span>
                <select name="kontoRolle" [(ngModel)]="kontoRolle">
                  @for (r of rollen; track r) {
                    <option [value]="r">{{ r }}</option>
                  }
                </select>
              </label>
              <button type="submit" [disabled]="!kontoName.trim()">Add</button>
            </form>
          }
          <p class="fuss">
            The role lives on the account, per campaign — never in an article, so it does not travel
            with an export. A co-GM sees this list and cannot change it.
          </p>
        </section>

        <section class="seitlich" aria-label="Invite and roles">
          @if (m.may === 'manage') {
            <form class="einladen" (ngSubmit)="einladen()">
              <h2>Invite</h2>
              <label>
                Role
                <select name="rolle" [(ngModel)]="neu.role">
                  @for (r of rollen; track r) {
                    <option [value]="r">{{ r }}</option>
                  }
                </select>
              </label>
              <label>
                Character (optional)
                <select name="figur" [(ngModel)]="neu.actorId">
                  <option value="">— none —</option>
                  @for (c of m.characters; track c.id) {
                    <option [value]="c.id">{{ c.name }}</option>
                  }
                </select>
              </label>
              <div class="zwei">
                <label>
                  Uses
                  <select name="uses" [(ngModel)]="neu.uses">
                    <option [ngValue]="1">once</option>
                    <option [ngValue]="5">5 times</option>
                    <option [ngValue]="0">unlimited</option>
                  </select>
                </label>
                <label>
                  Valid for
                  <select name="days" [(ngModel)]="neu.days">
                    <option [ngValue]="1">1 day</option>
                    <option [ngValue]="7">7 days</option>
                    <option [ngValue]="30">30 days</option>
                    <option [ngValue]="0">no end</option>
                  </select>
                </label>
              </div>
              <label>
                Note (optional)
                <input name="label" placeholder="e.g. for Sela" [(ngModel)]="neu.label" />
              </label>
              <button type="submit" class="pri" [disabled]="laeuft()">Create invite link</button>
              <span class="fuss">{{ einladungsText() }}</span>
              @if (link(); as l) {
                <div class="link" role="status">
                  <input
                    readonly
                    aria-label="Invite link"
                    [value]="l"
                    (focus)="$any($event.target).select()"
                  />
                  <button type="button" (click)="kopieren(l)">
                    {{ kopiert() ? 'Copied' : 'Copy link' }}
                  </button>
                  <span class="fuss">
                    Shown only now — the server keeps nothing but a hash of it. Lost it? Revoke and
                    make a new one.
                  </span>
                </div>
              }
            </form>
          }
          <div class="kasten legende">
            @for (r of rollenText; track r.role) {
              <strong>{{ r.role }}</strong
              ><span>{{ r.text }}</span>
            }
            <span class="fuss breit"
              >Admin of the installation is something else: it sees all campaigns.</span
            >
          </div>
        </section>
      </div>

      <section class="kasten" aria-label="Open invitations">
        <h2>Open invitations</h2>
        @if (einladungenHier().length) {
          <ul class="einladungen">
            @for (i of einladungenHier(); track i.handle) {
              <li>
                <span class="was">
                  <span class="rolle">{{ i.role ?? (i.isAdmin ? 'admin' : 'account') }}</span>
                  {{ i.label ?? 'invitation' }}
                  @if (i.actorName ?? i.actorId; as f) {
                    <span class="dim">· plays {{ f }}</span>
                  }
                </span>
                <span class="dim">{{ nutzungen(i) }} · {{ ablauf(i) }}</span>
                @if (i.may === 'manage') {
                  <button type="button" (click)="widerrufen(i)">Revoke</button>
                }
              </li>
            }
          </ul>
        } @else {
          <p class="dim">None open.</p>
        }
      </section>
    }

    @if (kampagnen()?.isAdmin) {
      <section class="kasten" aria-label="Accounts">
        <h2>Accounts of this installation</h2>
        <p class="fuss">
          Only the admin sees this list. Accounts are made by invitation or on the machine.
        </p>
        <ul class="konten">
          @for (k of konten(); track k.id) {
            <li>
              <span class="wer">
                {{ k.name }}
                @if (k.self) {
                  <span class="dim">(you)</span>
                }
                @if (k.isAdmin) {
                  <span class="marke">admin</span>
                }
                @if (k.disabled) {
                  <span class="marke aus">disabled</span>
                }
              </span>
              <span class="dim">
                @for (r of k.roles; track r.campaign; let last = $last) {
                  {{ r.role }} in {{ r.name }}{{ last ? '' : ', ' }}
                } @empty {
                  no campaign
                }
                @if (k.actors.length) {
                  · plays {{ figurenText(k) }}
                }
              </span>
              @if (gewaehlt() && !istMitglied(k)) {
                <button type="button" (click)="kontoAufnehmen(k)">Add to this campaign</button>
              }
            </li>
          }
        </ul>
      </section>
      @if (kampagnen()?.campaigns?.length) {
        <section class="kasten" aria-label="New campaign">
          <h2>New campaign</h2>
          <ng-container *ngTemplateOutlet="anlegen" />
        </section>
      }
    }

    <ng-template #anlegen>
      <form class="dazunehmen" (ngSubmit)="kampagneAnlegen()">
        <label>
          <span>Name</span>
          <input name="kname" placeholder="e.g. Aus Nebel wacht" [(ngModel)]="kampagneName" />
        </label>
        <label class="haken">
          <input type="checkbox" name="leiten" [(ngModel)]="selbstLeiten" />
          <span>I lead it (gm)</span>
        </label>
        <button type="submit" class="pri" [disabled]="!kampagneName.trim() || laeuft()">
          Create campaign
        </button>
      </form>
    </ng-template>
  `,
  styleUrl: './verwaltung.scss',
})
export class Verwaltung {
  private readonly api = inject(Api);
  private readonly session = inject(Session);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly rollen = TABLE_ROLES;
  protected readonly rollenText = ROLLEN;

  protected readonly kampagnen = signal<Kampagnen | null>(null);
  protected readonly gewaehlt = signal<string | null>(null);
  protected readonly mitglieder = signal<Mitglieder | null>(null);
  protected readonly einladungen = signal<Einladung[]>([]);
  protected readonly konten = signal<Konto[]>([]);
  protected readonly fehler = signal<string | null>(null);
  protected readonly laeuft = signal(false);
  protected readonly link = signal<string | null>(null);
  protected readonly kopiert = signal(false);

  protected kontoName = '';
  protected kontoRolle: TableRole = 'player';
  protected kampagneName = '';
  protected selbstLeiten = true;
  protected neu: { role: TableRole; actorId: string; uses: number; days: number; label: string } = {
    role: 'player',
    actorId: '',
    uses: 1,
    days: 7,
    label: '',
  };

  protected readonly einladungenHier = computed(() => {
    const c = this.gewaehlt();
    return this.einladungen().filter((i) => i.campaignId === c);
  });

  protected readonly standText = computed(() => {
    const m = this.mitglieder();
    if (this.kampagnen()?.isAdmin) return 'You are the admin of this installation';
    if (m?.may === 'manage') return 'You lead this campaign';
    if (m?.may === 'see') return 'You co-lead this campaign — read only';
    return '';
  });

  protected readonly mehrere = computed(() => (this.kampagnen()?.campaigns.length ?? 0) > 1);

  /** Eine Methode und kein `computed`: `neu` ist ein gewöhnliches Objekt
   *  hinter `ngModel`, ein Signal sähe seine Änderungen nicht. */
  protected einladungsText(): string {
    const n = this.neu;
    const wie = n.uses === 0 ? 'any number of times' : n.uses === 1 ? 'once' : `${n.uses} times`;
    const bis =
      n.days === 0 ? 'with no end date' : `valid for ${n.days} day${n.days === 1 ? '' : 's'}`;
    return `The link creates an account with a password, ${bis}, used ${wie}.`;
  }

  constructor() {
    void this.laden(this.route.snapshot.queryParamMap.get('c'));
  }

  /** Wer sich selbst nicht ändert: eine Leitung, die sich zum Zuschauer
   *  macht, hat sich ausgesperrt — der Server weist es ohnehin ab. */
  protected aenderbar(p: Mitglied): boolean {
    return this.mitglieder()?.may === 'manage' && (!p.self || this.kampagnen()?.isAdmin === true);
  }

  protected freieFiguren(p: Mitglied): { id: string; name: string }[] {
    const hat = new Set(p.actors.map((a) => a.id));
    return (this.mitglieder()?.characters ?? []).filter((c) => !hat.has(c.id));
  }

  protected istMitglied(k: Konto): boolean {
    return (this.mitglieder()?.members ?? []).some((m) => m.id === k.id);
  }

  protected figurenText(k: Konto): string {
    return k.actors.map((a) => a.name ?? a.id).join(', ');
  }

  protected nutzungen(i: Einladung): string {
    if (i.usesLeft == null) return 'unlimited uses';
    return `${i.usesLeft} use${i.usesLeft === 1 ? '' : 's'} left`;
  }

  protected ablauf(i: Einladung): string {
    if (!i.expiresAt) return 'no end date';
    const d = new Date(i.expiresAt);
    return `${d.getTime() < Date.now() ? 'expired' : 'until'} ${d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })}`;
  }

  private async tun(was: () => Promise<unknown>): Promise<boolean> {
    this.fehler.set(null);
    this.laeuft.set(true);
    try {
      await was();
      return true;
    } catch (error) {
      this.fehler.set(error instanceof ApiError ? error.message : 'Could not reach the server.');
      return false;
    } finally {
      this.laeuft.set(false);
    }
  }

  private async laden(wunsch: string | null): Promise<void> {
    await this.tun(async () => {
      const k = await this.api.campaigns();
      this.kampagnen.set(k);
      const ids = k.campaigns.map((c) => c.id);
      const c = wunsch && ids.includes(wunsch) ? wunsch : (ids[0] ?? null);
      this.gewaehlt.set(c);
      await Promise.all([this.ladeKampagne(), k.isAdmin ? this.ladeKonten() : Promise.resolve()]);
    });
  }

  private async ladeKampagne(): Promise<void> {
    const c = this.gewaehlt();
    if (!c) {
      this.mitglieder.set(null);
      return;
    }
    const [m, e] = await Promise.all([this.api.members(c), this.api.invites()]);
    this.mitglieder.set(m);
    this.einladungen.set(e);
  }

  private async ladeKonten(): Promise<void> {
    this.konten.set(await this.api.users());
  }

  private async neuLaden(): Promise<void> {
    await this.ladeKampagne();
    if (this.kampagnen()?.isAdmin) await this.ladeKonten();
  }

  protected async waehlen(id: string): Promise<void> {
    this.gewaehlt.set(id);
    this.link.set(null);
    void this.router.navigate([], { queryParams: { c: id }, replaceUrl: true });
    await this.tun(() => this.ladeKampagne());
  }

  protected async rolleSetzen(p: Mitglied, role: TableRole): Promise<void> {
    const c = this.gewaehlt();
    if (!c) return;
    await this.tun(() => this.api.setRole(c, p.id, role));
    await this.tun(() => this.neuLaden());
    /* Die eigene Rolle (Verwaltung) ändert, was die Kopfleiste zeigt. */
    if (p.self) await this.session.load(true);
  }

  protected async entfernen(p: Mitglied): Promise<void> {
    const c = this.gewaehlt();
    if (!c) return;
    if (!confirm(`Remove ${p.name} from ${this.mitglieder()?.campaign.name}? The account stays.`))
      return;
    await this.tun(() => this.api.removeMember(c, p.id));
    await this.tun(() => this.neuLaden());
  }

  protected async figurDazu(p: Mitglied, id: string): Promise<void> {
    const c = this.gewaehlt();
    if (!c || !id) return;
    await this.tun(() => this.api.setActors(c, p.id, [...p.actors.map((a) => a.id), id]));
    await this.tun(() => this.neuLaden());
  }

  protected async figurWeg(p: Mitglied, id: string): Promise<void> {
    const c = this.gewaehlt();
    if (!c) return;
    await this.tun(() =>
      this.api.setActors(
        c,
        p.id,
        p.actors.map((a) => a.id).filter((x) => x !== id),
      ),
    );
    await this.tun(() => this.neuLaden());
  }

  protected async kontoDazu(): Promise<void> {
    const c = this.gewaehlt();
    if (!c || !this.kontoName.trim()) return;
    if (
      await this.tun(() => this.api.addMember(c, { name: this.kontoName.trim() }, this.kontoRolle))
    ) {
      this.kontoName = '';
    }
    await this.tun(() => this.neuLaden());
  }

  protected async kontoAufnehmen(k: Konto): Promise<void> {
    const c = this.gewaehlt();
    if (!c) return;
    await this.tun(() => this.api.addMember(c, { user: k.id }, 'player'));
    await this.tun(() => this.neuLaden());
  }

  protected async einladen(): Promise<void> {
    const c = this.gewaehlt();
    if (!c) return;
    this.kopiert.set(false);
    await this.tun(async () => {
      const { code } = await this.api.createInvite({
        campaignId: c,
        role: this.neu.role,
        actorId: this.neu.actorId || undefined,
        label: this.neu.label.trim() || undefined,
        uses: this.neu.uses || undefined,
        days: this.neu.days || undefined,
      });
      /* Der Link führt auf die Anmeldung, die mit dem Code die
         Registrierung zeigt. Er steht nur jetzt da. */
      this.link.set(`${location.origin}/login?invite=${encodeURIComponent(code)}`);
      this.neu.label = '';
      this.einladungen.set(await this.api.invites());
    });
  }

  protected async kopieren(l: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(l);
      this.kopiert.set(true);
    } catch {
      this.fehler.set('Copying is blocked here — select the link and copy it by hand.');
    }
  }

  protected async widerrufen(i: Einladung): Promise<void> {
    await this.tun(() => this.api.dropInvite(i.handle));
    await this.tun(async () => this.einladungen.set(await this.api.invites()));
  }

  protected async kampagneAnlegen(): Promise<void> {
    const name = this.kampagneName.trim();
    if (!name) return;
    let id: string | null = null;
    const ok = await this.tun(async () => {
      id = (await this.api.createCampaign(name, this.selbstLeiten)).id;
    });
    if (!ok) return;
    this.kampagneName = '';
    if (this.selbstLeiten) await this.session.load(true);
    if (id) void this.router.navigate([], { queryParams: { c: id }, replaceUrl: true });
    await this.laden(id);
  }
}
