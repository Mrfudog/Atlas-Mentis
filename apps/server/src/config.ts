export interface Config {
  port: number;
  host: string;
  databaseUrl: string;
  /** Wem `X-Forwarded-*` geglaubt wird. Ungesetzt: niemandem. */
  trustProxy: boolean | string;
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
  };
}
