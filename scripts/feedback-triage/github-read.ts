// Spec 022: reads the cursor and the topics from GitHub.
//
//   GH_TOKEN=… pnpm exec tsx scripts/feedback-triage/github-read.ts
//
// Writes triage-out/cursor.txt (empty without cursor) and
// triage-out/themen.json ({ offen: [...], geschlossen: [...] }).
// Prints numbers only.

import { mkdir, writeFile } from "node:fs/promises";
import { readCursor } from "../../src/lib/feedback-triage/cursor";
import { readTopicMarker } from "../../src/lib/feedback-triage/topics";
import { OUT_DIR, fail, ghJson } from "./gh";

type IssueJson = { number: number; title: string; body?: string; labels?: { name: string }[] };

async function main() {
  if (!process.env.GH_TOKEN) fail("GH_TOKEN fehlt.");

  const [latest] = await ghJson<IssueJson[]>([
    "issue", "list", "--label", "feedback-triage", "--state", "all", "--limit", "1", "--json", "number,title,body",
  ]);
  const cursor = readCursor(latest?.body);

  const open = await ghJson<IssueJson[]>([
    "issue", "list", "--label", "feedback-thema", "--state", "open", "--limit", "500",
    "--json", "number,title,labels,body",
  ]);
  const closed = await ghJson<IssueJson[]>([
    "issue", "list", "--label", "feedback-thema", "--state", "closed", "--limit", "20", "--json", "number,title",
  ]);

  // `body` is kept for publish.ts (extendTopicBody); it holds only our own, already sanitized text.
  const topics = {
    offen: open.map((issue) => ({
      number: issue.number,
      title: issue.title,
      labels: (issue.labels ?? []).map((label) => label.name),
      ids: readTopicMarker(issue.body),
      body: issue.body ?? "",
    })),
    geschlossen: closed.map((issue) => ({ number: issue.number, title: issue.title })),
  };

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(`${OUT_DIR}/cursor.txt`, cursor ? cursor.toISOString() : "");
  await writeFile(`${OUT_DIR}/themen.json`, JSON.stringify(topics, null, 2) + "\n");

  console.log(
    `Cursor: ${cursor ? "ja" : "nein"}, ${topics.offen.length} offene Themen, ${topics.geschlossen.length} geschlossene (letzte 20)`
  );
}

main().catch((error: unknown) => fail(error instanceof Error && error.name === "GhError" ? error.message : "Unerwarteter Fehler."));
