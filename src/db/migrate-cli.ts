/** Apply pending migrations and exit. The compose file runs it before web and worker start. */
import { connect, migrate } from "./client.ts";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const sql = connect(url);
const applied = await migrate(sql);
console.log(applied.length > 0 ? `migrated: ${applied.join(", ")}` : "migrations: nothing to apply");
await sql.end();
