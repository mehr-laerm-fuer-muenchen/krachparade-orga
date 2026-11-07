import { describe, expect, it } from "vitest";
import {
  indentFollowLines,
  toMarkdown,
  toTelegramText,
  type ExportItem,
  type ExportMeeting,
} from "./protocol-export";

const names = new Map([
  ["kim", "Kim Brenner"],
  ["alex", "Alex Rauch"],
  ["sascha", "Sascha Möller"],
]);

const meeting: ExportMeeting = {
  title: "Orga-Treffen",
  date: "2026-10-14",
  place: "Werkstatt",
  moderatorId: "kim",
  minuteTakerId: "alex",
  attendeeIds: ["kim", "alex"],
  guests: "Gast Beispiel",
};

function item(overrides: Partial<ExportItem>): ExportItem {
  return {
    topic: "Route",
    kind: "info",
    text: "Text",
    ownerId: null,
    ownerName: null,
    dueDate: null,
    done: false,
    ...overrides,
  };
}

const items: ExportItem[] = [
  item({ topic: "Route", kind: "info", text: "Route steht grob" }),
  item({ topic: "Route", kind: "entscheidung", text: "Start am Odeonsplatz" }),
  item({ topic: "Finanzen", kind: "todo", text: "Angebot einholen", ownerId: "alex", dueDate: "2026-10-21" }),
  item({ topic: "Finanzen", kind: "diskussion", text: "Spenden oder Soli-Party?" }),
  item({ topic: "Finanzen", kind: "todo", text: "Konto klären", ownerName: "Gast Beispiel", done: true }),
  item({ topic: "Presse", kind: "todo", text: "Pressemappe", dueDate: "2026-11-02" }),
];

describe("toTelegramText", () => {
  it("has title, attendees, decisions, to-dos and then the TOPs in this order", () => {
    expect(toTelegramText(meeting, items, names)).toBe(
      [
        "Orga-Treffen – 14.10.2026",
        "Anwesend: Alex Rauch, Kim Brenner, Gast Beispiel",
        "",
        "Beschlüsse:",
        "– Start am Odeonsplatz",
        "",
        "To-dos:",
        "– Angebot einholen (Alex Rauch, bis 21.10.)",
        "– ✓ Konto klären (Gast Beispiel)",
        "– Pressemappe (bis 02.11.)",
        "",
        "Route:",
        "– Route steht grob",
        "",
        "Finanzen:",
        "– Spenden oder Soli-Party?",
      ].join("\n")
    );
  });

  it("leaves out empty sections", () => {
    const text = toTelegramText(
      { ...meeting, attendeeIds: [], guests: "  " },
      [item({ kind: "todo", text: "Nur ein To-do" })],
      names
    );
    expect(text).toBe(["Orga-Treffen – 14.10.2026", "", "To-dos:", "– Nur ein To-do"].join("\n"));
    expect(text).not.toContain("Anwesend");
    expect(text).not.toContain("Beschlüsse");
    expect(text).not.toContain("Route:");
  });

  it("shows only the title for an empty meeting", () => {
    expect(toTelegramText({ ...meeting, attendeeIds: [], guests: "" }, [], names)).toBe(
      "Orga-Treffen – 14.10.2026"
    );
  });

  it("never contains e-mail addresses", () => {
    expect(toTelegramText(meeting, items, names)).not.toMatch(/@/);
  });

  it("puts the summary as its own paragraph after the attendees, without a heading", () => {
    const text = toTelegramText(
      { ...meeting, summary: "  Route steht.\nGeld fehlt noch.  " },
      [item({ kind: "entscheidung", text: "Start am Odeonsplatz" })],
      names
    );
    expect(text).toBe(
      [
        "Orga-Treffen – 14.10.2026",
        "Anwesend: Alex Rauch, Kim Brenner, Gast Beispiel",
        "",
        "Route steht.",
        "Geld fehlt noch.",
        "",
        "Beschlüsse:",
        "– Start am Odeonsplatz",
      ].join("\n")
    );
  });

  it("stays unchanged with an empty summary", () => {
    expect(toTelegramText({ ...meeting, summary: null }, items, names)).toBe(toTelegramText(meeting, items, names));
    expect(toTelegramText({ ...meeting, summary: "   " }, items, names)).toBe(toTelegramText(meeting, items, names));
  });
});

describe("toMarkdown", () => {
  it("has a head and a heading per TOP with kind prefixes", () => {
    expect(toMarkdown(meeting, items, names)).toBe(
      [
        "# Orga-Treffen",
        "",
        "- **Datum:** 14.10.2026",
        "- **Ort:** Werkstatt",
        "- **Moderation:** Kim Brenner",
        "- **Protokoll:** Alex Rauch",
        "- **Anwesend:** Alex Rauch, Kim Brenner",
        "- **Gäste:** Gast Beispiel",
        "",
        "## Route",
        "",
        "- **Info:** Route steht grob",
        "- **Beschluss:** Start am Odeonsplatz",
        "",
        "## Finanzen",
        "",
        "- **To-do:** Angebot einholen (Alex Rauch, bis 21.10.2026)",
        "- **Diskussion:** Spenden oder Soli-Party?",
        "- **To-do:** Konto klären (Gast Beispiel) ✓",
        "",
        "## Presse",
        "",
        "- **To-do:** Pressemappe (bis 02.11.2026)",
      ].join("\n")
    );
  });

  it("leaves out empty head fields", () => {
    const text = toMarkdown(
      { ...meeting, place: "", moderatorId: null, minuteTakerId: null, attendeeIds: [], guests: "" },
      [],
      names
    );
    expect(text).toBe(["# Orga-Treffen", "", "- **Datum:** 14.10.2026"].join("\n"));
  });

  it("puts the summary under its own label after the head", () => {
    const text = toMarkdown(
      { ...meeting, place: "", moderatorId: null, minuteTakerId: null, guests: "", summary: "Route steht.\nGeld fehlt." },
      [item({ kind: "info", text: "Route steht grob" })],
      names
    );
    expect(text).toBe(
      [
        "# Orga-Treffen",
        "",
        "- **Datum:** 14.10.2026",
        "- **Anwesend:** Alex Rauch, Kim Brenner",
        "",
        "**Kurzfassung**",
        "",
        "Route steht.",
        "Geld fehlt.",
        "",
        "## Route",
        "",
        "- **Info:** Route steht grob",
      ].join("\n")
    );
  });

  it("stays unchanged with an empty summary", () => {
    expect(toMarkdown({ ...meeting, summary: " " }, items, names)).toBe(toMarkdown(meeting, items, names));
  });
});

describe("multi-line items (spec 028)", () => {
  const empty = { ...meeting, attendeeIds: [], guests: "" };

  it("indents the following lines in the Telegram text", () => {
    const text = toTelegramText(
      empty,
      [
        item({ kind: "entscheidung", text: "Start am Odeonsplatz\nEnde am Königsplatz" }),
        item({ kind: "todo", text: "Angebot einholen\nbei zwei Firmen", ownerId: "alex" }),
        item({ topic: "Route", kind: "info", text: "Route steht\nnoch ohne Umweg" }),
      ],
      names
    );
    expect(text).toBe(
      [
        "Orga-Treffen – 14.10.2026",
        "",
        "Beschlüsse:",
        "– Start am Odeonsplatz",
        "  Ende am Königsplatz",
        "",
        "To-dos:",
        "– Angebot einholen",
        "  bei zwei Firmen (Alex Rauch)",
        "",
        "Route:",
        "– Route steht",
        "  noch ohne Umweg",
      ].join("\n")
    );
  });

  it("indents the following lines in Markdown", () => {
    const text = toMarkdown(empty, [item({ kind: "entscheidung", text: "Start am Odeonsplatz\nEnde am Königsplatz" })], names);
    expect(text.split("\n").slice(-2)).toEqual(["- **Beschluss:** Start am Odeonsplatz", "  Ende am Königsplatz"]);
  });

  it("leaves single-line items unchanged", () => {
    expect(indentFollowLines("Start am Odeonsplatz")).toBe("Start am Odeonsplatz");
    expect(toTelegramText(meeting, items, names)).not.toContain("\n  ");
    expect(toMarkdown(meeting, items, names)).not.toContain("\n  ");
  });

  it("collapses several blank lines into one", () => {
    expect(indentFollowLines("Eins\n\n\n  \nZwei\r\nDrei")).toBe("Eins\n\n  Zwei\n  Drei");
  });
});
