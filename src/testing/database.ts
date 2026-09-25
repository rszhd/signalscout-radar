import { randomBytes } from "node:crypto";
import { connect, migrate, type Sql } from "../db/client.ts";

/**
 * A database of its own for one test file, on Radar's local Postgres
 * (`docker compose up -d`, port 5439), made and dropped by the test.
 */
const adminUrl = process.env.TEST_DATABASE_URL ?? "postgres://radar:radar@127.0.0.1:5439/radar";

export async function createTestDatabase(): Promise<{ sql: Sql; drop: () => Promise<void> }> {
  const name = `radar_test_${randomBytes(4).toString("hex")}`;
  const admin = connect(adminUrl);
  await admin.unsafe(`create database ${name}`);
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  const sql = connect(url.toString());
  await migrate(sql);

  return {
    sql,
    async drop() {
      await sql.end();
      await admin.unsafe(`drop database ${name}`);
      await admin.end();
    },
  };
}
