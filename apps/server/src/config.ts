import { join } from 'node:path';

export interface Config {
  port: number;
  host: string;
  databaseUrl: string;
  /** Wem `X-Forwarded-*` geglaubt wird. Ungesetzt: niemandem. */
  trustProxy: boolean | string;
  /** Welche Umgebung das ist (`ATLAS_ENV`); ungesetzt: keine Angabe. */
  env: AtlasEnv | null;
  /** Wo die Bilder liegen (`ASSET_DIR`, T-114, E-032 a). */
  assetDir: string;
  /** Wie gross ein Bild sein darf, in Bytes (`ASSET_MAX_MB`, Vorgabe 40). */
  assetMaxBytes: number;
}

export type AtlasEnv = 'dev' | 'prod';

/* Die Leitung soll auf einen Blick sehen, ob die Daten hier sicher sind
   (T-070): auf dev ersetzen Ausrollen und Einlesen den Bestand, auf prod
   nicht. Nur die zwei Wörter zählen — ein Tippfehler heisst „keine
   Angabe" und nicht still „prod". */
function atlasEnv(raw: string | undefined): AtlasEnv | null {
  const v = raw?.trim().toLowerCase();
  return v === 'dev' || v === 'prod' ? v : null;
}

/* Hinter Caddy kommt jede Anfrage als http vom Proxy. Ohne Vertrauen
   bekäme das Sitzungs-Cookie nie `secure`, und die Anmeldebremse zählte
   alle Fehlversuche einer einzigen Adresse zu — der des Proxys. Vertraut
   wird nur, wer genannt ist: eine Liste wie `loopback,uniquelocal` oder
   `true` für jeden. */
function trustProxy(raw: string | undefined): boolean | string {
  const v = raw?.trim();
  if (!v || v === 'false') return false;
  if (v === 'true') return true;
  return v;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env['PORT'] ?? 8080),
    // Bind to loopback by default: the reverse proxy is what faces the network.
    host: env['HOST'] ?? '127.0.0.1',
    databaseUrl:
      env['DATABASE_URL'] ?? 'postgres://nebelwacht:nebelwacht@localhost:5432/nebelwacht',
    trustProxy: trustProxy(env['TRUST_PROXY']),
    env: atlasEnv(env['ATLAS_ENV']),
    /* Im Container ein Volume (`/data/assets`, compose); lokal neben dem
       Arbeitsverzeichnis, damit `pnpm dev:server` ohne Einstellung läuft. */
    assetDir: env['ASSET_DIR']?.trim() || join(process.cwd(), 'daten', 'bilder'),
    /* Eine Karte ist 5–30 MB (E-032); darüber ist es meist ein Versehen. */
    assetMaxBytes: Math.max(1, Number(env['ASSET_MAX_MB']) || 40) * 1024 * 1024,
  };
}
