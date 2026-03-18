import "dotenv/config";
import { Pool } from "pg";

export const hasDatabase = Boolean(process.env.DATABASE_URL);

export const pool = hasDatabase
  ? new Pool({
      connectionString: process.env.DATABASE_URL
    })
  : null;
