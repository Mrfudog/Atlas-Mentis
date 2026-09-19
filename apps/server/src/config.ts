export interface Config {
  port: number;
  host: string;
  databaseUrl: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env['PORT'] ?? 8080),
    // Bind to loopback by default: the reverse proxy is what faces the network.
    host: env['HOST'] ?? '127.0.0.1',
    databaseUrl:
      env['DATABASE_URL'] ?? 'postgres://nebelwacht:nebelwacht@localhost:5432/nebelwacht',
  };
}
