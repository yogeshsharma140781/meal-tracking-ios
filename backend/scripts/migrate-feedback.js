"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Run this to add the feedback table: npx ts-node scripts/migrate-feedback.ts
 * Requires DATABASE_URL in backend/.env
 */
const dotenv_1 = __importDefault(require("dotenv"));
const pg_1 = require("pg");
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, "..", ".env") });
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
    const pool = new pg_1.Pool({ connectionString: url });
    try {
        await pool.query(sql);
        console.log("feedback table created (or already exists)");
    }
    catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
    finally {
        await pool.end();
    }
}
main();
