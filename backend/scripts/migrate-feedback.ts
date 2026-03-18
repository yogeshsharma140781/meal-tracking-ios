/**
 * Run this to add the feedback table: npx ts-node scripts/migrate-feedback.ts
 * Requires DATABASE_URL in backend/.env
 */
import dotenv from "dotenv";
import { Pool } from "pg";
import path from "path";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const sql = `
create table if not exists feedback (
  id uuid primary key,
  rating smallint not null check (rating >= 1 and rating <= 5),
  text text,
  created_at timestamptz not null default now()
);
`;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL not set. Create backend/.env from backend/env.example");
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url });
  try {
    await pool.query(sql);
    console.log("feedback table created (or already exists)");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
