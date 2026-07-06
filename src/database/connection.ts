/**
 * Database connection layer.
 *
 * TODO: Wire this to a real database provider (Supabase, PostgreSQL, Firebase, ...).
 * The rest of the app must only import from `@/database/*` — never touch the driver
 * directly, so we can swap providers without rewriting features.
 */

export interface DatabaseClient {
  isConnected: boolean;
  provider: "mock" | "supabase" | "postgres" | "firebase";
}

let client: DatabaseClient | null = null;

export async function connectDatabase(): Promise<DatabaseClient> {
  if (client) return client;
  // TODO: Replace with real connection logic.
  client = { isConnected: true, provider: "mock" };
  return client;
}

export function getClient(): DatabaseClient {
  if (!client) {
    // Auto-connect for now so mock reads work without explicit init.
    client = { isConnected: true, provider: "mock" };
  }
  return client;
}
