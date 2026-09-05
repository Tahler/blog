import { readFile } from "node:fs/promises";

import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

describe("tag split migration", () => {
  it("inherits the source once and defaults future subscribers to the target", async () => {
    const db = new PGlite();
    try {
      await db.exec(await readMigration("0000_subscribers.sql"));
      await db.exec(await readMigration("0001_wants_other.sql"));
      await db.exec(`
          INSERT INTO subscribers (email, wants_other)
          VALUES
            ('opted-in@example.com', true),
            ('opted-out@example.com', false)
        `);

      const splitMigration = await readMigration(
        "0002_split_other_to_travel.sql",
      );
      await db.exec(splitMigration);

      expect(await readPreferences(db)).toEqual([
        {
          email: "opted-in@example.com",
          wants_other: true,
          wants_travel: true,
        },
        {
          email: "opted-out@example.com",
          wants_other: false,
          wants_travel: false,
        },
      ]);

      await db.exec(`
          UPDATE subscribers
          SET wants_travel = false
          WHERE email = 'opted-in@example.com'
        `);
      await db.exec(splitMigration);

      expect(await readPreferences(db)).toEqual([
        {
          email: "opted-in@example.com",
          wants_other: true,
          wants_travel: false,
        },
        {
          email: "opted-out@example.com",
          wants_other: false,
          wants_travel: false,
        },
      ]);

      await db.exec(
        "INSERT INTO subscribers (email) VALUES ('new@example.com')",
      );
      const result = await db.query(`
          SELECT wants_other, wants_travel
          FROM subscribers
          WHERE email = 'new@example.com'
        `);
      expect(result.rows).toEqual([{ wants_other: true, wants_travel: true }]);
    } finally {
      await db.close();
    }
  }, 20_000);
});

async function readMigration(name: string) {
  return readFile(new URL(name, import.meta.url), "utf8");
}

async function readPreferences(db: PGlite) {
  const result = await db.query(`
    SELECT email, wants_other, wants_travel
    FROM subscribers
    ORDER BY email
  `);
  return result.rows;
}
