import "dotenv/config";
import { flushMail } from "../src/lib/owners/mail";
import { pool } from "../src/lib/db";
try {
  console.log(await flushMail());
} finally {
  await pool.end();
}
