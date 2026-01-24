import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();

export const hasDatabase = Boolean(process.env.DATABASE_URL);

export const pool = hasDatabase
  ? new Pool({
      connectionString: process.env.DATABASE_URL
    })
  : null;
