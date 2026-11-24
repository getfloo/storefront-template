import { readFileSync } from "node:fs";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { describe, expect, it } from "vitest";

describe("committed migrations", () => {
  const migrations = readMigrationFiles({ migrationsFolder: "./drizzle" });
  const sql = migrations.flatMap((migration) => migration.sql).join("\n");
  const tables = new Map(Array.from(
    sql.matchAll(/CREATE TABLE "(\w+)"\s*\(([\s\S]*?)\n\);/g),
    ([, name, columns]) => [name, columns],
  ));

  it("keeps product prices positive and stock at zero or more", () => {
    expect(tables.get("products")).toContain('CHECK ("products"."price_cents" > 0)');
    expect(tables.get("products")).toContain('CHECK ("products"."stock" >= 0)');
    expect(sql).toContain('CREATE UNIQUE INDEX "products_slug_idx"');
  });

  it("records each Checkout Session as one order, in a known status", () => {
    expect(sql).toContain('CREATE UNIQUE INDEX "orders_checkout_session_id_idx" ON "orders" USING btree ("checkout_session_id")');
    expect(tables.get("orders")).toContain(`CHECK ("orders"."status" in ('pending', 'paid', 'fulfilled', 'expired'))`);
  });

  it("drops the starter's tables", () => {
    expect(sql).toContain('DROP TABLE "notes" CASCADE');
    expect(sql).toContain('DROP TABLE "users" CASCADE');
  });

  it("keeps SQL portable across managed tenant schemas", () => {
    expect(sql).not.toMatch(/"public"\.|CREATE SCHEMA|SET search_path/i);
    const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));
    expect(journal.entries).toHaveLength(migrations.length);
  });
});
