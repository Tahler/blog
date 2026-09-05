import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { relative, resolve } from "node:path";

import { getTableColumns } from "drizzle-orm";

import { BLOG_POST_TAGS, isBlogPostTag } from "../src/lib/blog-post-tags";
import { subscribers } from "./schema";

interface MigrationJournal {
  entries: Array<{ tag: string }>;
}

interface SchemaSnapshot {
  tables?: Record<string, { columns?: Record<string, unknown> }>;
}

const TAG_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const root = process.cwd();
const journalPath = resolve(root, "db/meta/_journal.json");
const metaDirectory = resolve(root, "db/meta");
const drizzleKitPath = resolve(root, "node_modules/drizzle-kit/bin.cjs");

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

function main() {
  const [sourceTag, targetTag, ...extraArguments] = process.argv.slice(2);
  if (!sourceTag || !targetTag || extraArguments.length > 0) {
    throw new Error("Usage: npm run db:split-tag -- <source-tag> <target-tag>");
  }
  if (!TAG_PATTERN.test(sourceTag) || !TAG_PATTERN.test(targetTag)) {
    throw new Error("Tags must be lowercase kebab-case names.");
  }
  if (sourceTag === targetTag) {
    throw new Error("Source and target tags must be different.");
  }
  if (!isBlogPostTag(sourceTag) || !isBlogPostTag(targetTag)) {
    throw new Error(
      `Both tags must first be added to BLOG_POST_TAGS (${BLOG_POST_TAGS.join(", ")}).`,
    );
  }

  const sourceColumn = preferenceColumn(sourceTag);
  const targetColumn = preferenceColumn(targetTag);
  const schemaColumns = new Set(
    Object.values(getTableColumns(subscribers)).map((column) => column.name),
  );
  if (!schemaColumns.has(sourceColumn) || !schemaColumns.has(targetColumn)) {
    throw new Error(
      `Both ${sourceColumn} and ${targetColumn} must first be added to db/schema.ts.`,
    );
  }

  const journal = JSON.parse(
    readFileSync(journalPath, "utf8"),
  ) as MigrationJournal;
  assertSnapshotCanBeSplit(journal, sourceColumn, targetColumn);

  const migrationName = `split_${tagForFileName(sourceTag)}_to_${tagForFileName(targetTag)}`;
  const temporaryDirectory = mkdtempSync(resolve(tmpdir(), "blog-tag-split-"));
  try {
    cpSync(metaDirectory, resolve(temporaryDirectory, "meta"), {
      recursive: true,
    });
    generateMigration(temporaryDirectory, migrationName);

    const journalAfter = JSON.parse(
      readFileSync(resolve(temporaryDirectory, "meta/_journal.json"), "utf8"),
    ) as MigrationJournal;
    const newEntries = journalAfter.entries.slice(journal.entries.length);
    if (newEntries.length !== 1) {
      throw new Error("Drizzle did not generate exactly one migration.");
    }

    const entry = newEntries[0]!;
    const generatedMigrationPath = resolve(
      temporaryDirectory,
      `${entry.tag}.sql`,
    );
    const generatedSql = readFileSync(generatedMigrationPath, "utf8");
    const expectedSql = `ALTER TABLE "subscribers" ADD COLUMN "${targetColumn}" boolean DEFAULT true NOT NULL;`;
    if (normalizeSql(generatedSql) !== normalizeSql(expectedSql)) {
      throw new Error(
        "Only the target preference column may be pending when generating a tag split.",
      );
    }

    persistMigration(
      temporaryDirectory,
      journalAfter,
      entry.tag,
      buildSplitMigration(sourceColumn, targetColumn),
    );
    console.log(`Generated db/${entry.tag}.sql`);
    console.log("Review it, then apply it with: npm run db:migrate");
  } finally {
    rmSync(temporaryDirectory, { force: true, recursive: true });
  }
}

function assertSnapshotCanBeSplit(
  journal: MigrationJournal,
  sourceColumn: string,
  targetColumn: string,
) {
  const latestEntry = journal.entries.at(-1);
  if (!latestEntry) {
    throw new Error("No Drizzle migration exists. Create a baseline first.");
  }

  const snapshotPath = resolve(
    metaDirectory,
    `${migrationPrefix(latestEntry.tag)}_snapshot.json`,
  );
  if (!existsSync(snapshotPath)) {
    throw new Error(
      "No Drizzle schema snapshot exists. Create a baseline first.",
    );
  }

  const snapshot = JSON.parse(
    readFileSync(snapshotPath, "utf8"),
  ) as SchemaSnapshot;
  const columns = snapshot.tables?.["public.subscribers"]?.columns;
  if (!columns?.[sourceColumn]) {
    throw new Error(`${sourceColumn} does not exist in the latest migration.`);
  }
  if (columns[targetColumn]) {
    throw new Error(`${targetColumn} already exists in the latest migration.`);
  }
}

function generateMigration(outputDirectory: string, migrationName: string) {
  if (!existsSync(drizzleKitPath)) {
    throw new Error("Run npm install before generating a tag split.");
  }

  const result = spawnSync(
    process.execPath,
    [
      drizzleKitPath,
      "generate",
      "--dialect=postgresql",
      "--schema=./db/schema.ts",
      `--out=${relative(root, outputDirectory)}`,
      `--name=${migrationName}`,
    ],
    { cwd: root, stdio: "inherit" },
  );
  if (result.error || result.status !== 0) {
    throw (
      result.error ?? new Error("Drizzle failed to generate the migration.")
    );
  }
}

function persistMigration(
  temporaryDirectory: string,
  journal: MigrationJournal,
  migrationTag: string,
  migrationSql: string,
) {
  const prefix = migrationPrefix(migrationTag);
  const migrationPath = resolve(root, "db", `${migrationTag}.sql`);
  const snapshotPath = resolve(metaDirectory, `${prefix}_snapshot.json`);
  if (existsSync(migrationPath) || existsSync(snapshotPath)) {
    throw new Error(`Migration ${migrationTag} already exists.`);
  }

  const suffix = `.split-tag-${process.pid}.tmp`;
  const stagedMigrationPath = `${migrationPath}${suffix}`;
  const stagedSnapshotPath = `${snapshotPath}${suffix}`;
  const stagedJournalPath = `${journalPath}${suffix}`;
  try {
    writeFileSync(stagedMigrationPath, migrationSql);
    const snapshot = JSON.parse(
      readFileSync(
        resolve(temporaryDirectory, `meta/${prefix}_snapshot.json`),
        "utf8",
      ),
    );
    writeFileSync(stagedSnapshotPath, formatJson(snapshot));
    writeFileSync(stagedJournalPath, formatJson(journal));

    renameSync(stagedMigrationPath, migrationPath);
    renameSync(stagedSnapshotPath, snapshotPath);
    renameSync(stagedJournalPath, journalPath);
  } catch (error) {
    rmSync(stagedMigrationPath, { force: true });
    rmSync(stagedSnapshotPath, { force: true });
    rmSync(stagedJournalPath, { force: true });
    rmSync(migrationPath, { force: true });
    rmSync(snapshotPath, { force: true });
    throw error;
  }
}

function preferenceColumn(tag: string) {
  return `wants_${tag.replaceAll("-", "_")}`;
}

function tagForFileName(tag: string) {
  return tag.replaceAll("-", "_");
}

function migrationPrefix(migrationTag: string) {
  return migrationTag.split("_", 1)[0]!;
}

function formatJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function normalizeSql(sql: string) {
  return sql.replace(/\s+/g, " ").trim();
}

function buildSplitMigration(sourceColumn: string, targetColumn: string) {
  return `DO $$
BEGIN
\t-- Existing rows start null so retries never overwrite a later preference change.
\tALTER TABLE "subscribers"
\t\tADD COLUMN IF NOT EXISTS "${targetColumn}" boolean;

\tUPDATE "subscribers"
\tSET "${targetColumn}" = "${sourceColumn}"
\tWHERE "${targetColumn}" IS NULL;

\tALTER TABLE "subscribers"
\t\tALTER COLUMN "${targetColumn}" SET DEFAULT true,
\t\tALTER COLUMN "${targetColumn}" SET NOT NULL;
END
$$;
`;
}
