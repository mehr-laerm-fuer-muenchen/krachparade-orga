import { describe, expect, it } from "vitest";
import { validateResult, type Assessment, type TriageResult } from "./result";
import type { TopicsFile } from "./topics";

const INPUT = {
  fresh: [{ shortId: "aaaaaaaa" }, { shortId: "bbbbbbbb" }],
  stale: [{ shortId: "cccccccc" }],
};
const TOPICS: TopicsFile = {
  offen: [{ number: 12, title: "Thema: Abhaken", labels: ["feedback-thema", "p2"], ids: [] }],
  geschlossen: [{ number: 7, title: "Thema: Alt" }],
};

function assessment(shortId: string, extra: Partial<Assessment> = {}): Assessment {
  return {
    shortId,
    kategorie: "fehler",
    prioritaet: "p2",
    aufwand: "klein",
    deutung: "Die Liste springt nach dem Abhaken.",
    befund: "src/components/…",
    vorschlag: "entwurf",
    statusvorschlag: "in_progress",
    antworttext: "Danke, schauen wir uns an.",
    antwortJetzt: false,
    thema: { issue: 12 },
    ...extra,
  };
}

function result(extra: Partial<TriageResult> = {}): TriageResult {
  return {
    meldungen: [assessment("aaaaaaaa"), assessment("bbbbbbbb", { thema: { neu: "export-wunsch" } })],
    neueThemen: [{ schluessel: "export-wunsch", titel: "Export als PDF", zusammenfassung: "Wunsch nach Export." }],
    liegengeblieben: [{ shortId: "cccccccc", vorschlag: "Nachfragen." }],
    fragenAnFranz: [],
    entwuerfe: [{ kurzname: "abhaken-springt", datei: "entwuerfe/abhaken-springt.md", thema: { issue: 12 }, shortIds: ["aaaaaaaa"] }],
    skizzen: [{ thema: { neu: "export-wunsch" }, datei: "skizzen/export-wunsch.md", shortIds: ["bbbbbbbb"] }],
    ...extra,
  };
}

describe("validateResult", () => {
  it("accepts a valid result", () => {
    const { result: parsed, errors } = validateResult(result(), INPUT, TOPICS);
    expect(errors).toEqual([]);
    expect(parsed?.meldungen).toHaveLength(2);
  });

  it("finds a missing short id", () => {
    const { result: parsed, errors } = validateResult(result({ meldungen: [assessment("aaaaaaaa")] }), INPUT, TOPICS);
    expect(parsed).toBeNull();
    expect(errors).toContain("meldungen: Kurz-ID bbbbbbbb fehlt");
  });

  it("finds a duplicate and a foreign short id", () => {
    const { errors } = validateResult(
      result({
        meldungen: [
          assessment("aaaaaaaa"),
          assessment("aaaaaaaa"),
          assessment("bbbbbbbb", { thema: { neu: "export-wunsch" } }),
          assessment("eeeeeeee"),
        ],
      }),
      INPUT,
      TOPICS
    );
    expect(errors).toContain("meldungen: Kurz-ID aaaaaaaa kommt 2-mal vor");
    expect(errors).toContain("meldungen: fremde Kurz-ID eeeeeeee");
  });

  it("finds a wrong topic number and a missing new topic", () => {
    const { errors } = validateResult(
      result({
        meldungen: [assessment("aaaaaaaa", { thema: { issue: 99 } }), assessment("bbbbbbbb", { thema: { neu: "gibt-es-nicht" } })],
      }),
      INPUT,
      TOPICS
    );
    expect(errors).toContain("meldungen aaaaaaaa: Thema #99 ist kein offenes Thema");
    expect(errors).toContain("meldungen bbbbbbbb: neues Thema gibt-es-nicht fehlt in neueThemen");
    expect(errors).toContain("neueThemen export-wunsch: keine Meldung gehört zu diesem Thema");
  });

  it("closed topics are no target, only a reference", () => {
    const closed = validateResult(result({ meldungen: [assessment("aaaaaaaa", { thema: { issue: 7 } }), assessment("bbbbbbbb", { thema: { neu: "export-wunsch" } })] }), INPUT, TOPICS);
    expect(closed.errors).toContain("meldungen aaaaaaaa: Thema #7 ist kein offenes Thema");

    const reference = result();
    reference.neueThemen[0].verweisAuf = 7;
    expect(validateResult(reference, INPUT, TOPICS).errors).toEqual([]);
    reference.neueThemen[0].verweisAuf = 12;
    expect(validateResult(reference, INPUT, TOPICS).errors).toContain(
      "neueThemen export-wunsch: verweisAuf #12 ist kein geschlossenes Thema"
    );
  });

  it("finds a new topic key used twice", () => {
    const twice = result();
    twice.neueThemen.push({ ...twice.neueThemen[0] });
    expect(validateResult(twice, INPUT, TOPICS).errors).toContain("neueThemen: Schlüssel export-wunsch kommt 2-mal vor");
  });

  it("antwortJetzt only with done or rejected", () => {
    const { errors } = validateResult(
      result({
        meldungen: [
          assessment("aaaaaaaa", { antwortJetzt: true, statusvorschlag: "in_progress" }),
          assessment("bbbbbbbb", { thema: { neu: "export-wunsch" }, antwortJetzt: true, statusvorschlag: "done" }),
        ],
      }),
      INPUT,
      TOPICS
    );
    expect(errors).toEqual(["meldungen aaaaaaaa: antwortJetzt nur bei Statusvorschlag done oder rejected"]);
  });

  it("rejects D-Day and D-N in replies, case-insensitive", () => {
    for (const text of ["Bis zum D-Day!", "Ab d-30 geht’s los", "bis D-day"]) {
      const { errors } = validateResult(
        result({ meldungen: [assessment("aaaaaaaa", { antworttext: text }), assessment("bbbbbbbb", { thema: { neu: "export-wunsch" } })] }),
        INPUT,
        TOPICS
      );
      expect(errors).toContain("meldungen aaaaaaaa: Antworttext enthält „D-Day“/„D-N“");
    }
  });

  it("rejects schema errors: bad short id, file outside the folder, too long", () => {
    const bad = result();
    bad.entwuerfe[0].datei = "../AGENTS.md";
    bad.meldungen[0].antworttext = "x".repeat(401);
    const { result: parsed, errors } = validateResult(bad, INPUT, TOPICS);
    expect(parsed).toBeNull();
    expect(errors.some((e) => e.startsWith("entwuerfe.0.datei"))).toBe(true);
    expect(errors.some((e) => e.startsWith("meldungen.0.antworttext"))).toBe(true);
    expect(validateResult({ meldungen: "nein" }, INPUT, TOPICS).errors.length).toBeGreaterThan(0);
  });

  it("rejects unknown fields", () => {
    const extra = { ...result(), schreibeInDatenbank: true };
    expect(validateResult(extra, INPUT, TOPICS).errors.length).toBeGreaterThan(0);
  });

  it("stale suggestions only for stale entries", () => {
    const { errors } = validateResult(result({ liegengeblieben: [{ shortId: "aaaaaaaa", vorschlag: "x" }] }), INPUT, TOPICS);
    expect(errors).toContain("liegengeblieben: Kurz-ID aaaaaaaa ist nicht liegengeblieben");
  });

  describe("rejected entries get no topic", () => {
    const rejected = (extra: Partial<Assessment> = {}): Assessment => {
      const base = assessment("aaaaaaaa", {
        kategorie: "missverstaendnis",
        prioritaet: "keine",
        vorschlag: "verwerfen",
        statusvorschlag: "rejected",
        antwortJetzt: true,
        antworttext: "Danke, das schließen wir.",
        ...extra,
      });
      delete base.thema;
      return { ...base, ...("thema" in extra ? { thema: extra.thema } : {}) };
    };
    const withRejected = (entry: Assessment) =>
      result({ meldungen: [entry, assessment("bbbbbbbb", { thema: { neu: "export-wunsch" } })] });

    it("accepts verwerfen without topic", () => {
      expect(validateResult(withRejected(rejected()), INPUT, TOPICS).errors).toEqual([]);
    });

    it("rejects verwerfen with a topic", () => {
      expect(validateResult(withRejected(rejected({ thema: { issue: 12 } })), INPUT, TOPICS).errors).toEqual([
        "meldungen aaaaaaaa: bei Vorschlag verwerfen kein Thema",
      ]);
    });

    it("verwerfen needs status rejected, antwortJetzt and a reply", () => {
      const { errors } = validateResult(
        withRejected(rejected({ statusvorschlag: "new", antwortJetzt: false, antworttext: "" })),
        INPUT,
        TOPICS
      );
      expect(errors).toEqual([
        "meldungen aaaaaaaa: Vorschlag verwerfen braucht Statusvorschlag rejected",
        "meldungen aaaaaaaa: Vorschlag verwerfen braucht antwortJetzt und einen Antworttext",
      ]);
    });

    it("every other proposal needs a topic", () => {
      const noTopic = assessment("aaaaaaaa");
      delete noTopic.thema;
      expect(validateResult(withRejected(noTopic), INPUT, TOPICS).errors).toEqual(["meldungen aaaaaaaa: Thema fehlt"]);
    });
  });

  it("an empty run is valid", () => {
    const empty = { meldungen: [], neueThemen: [], liegengeblieben: [], fragenAnFranz: [], entwuerfe: [], skizzen: [] };
    expect(validateResult(empty, { fresh: [], stale: [] }, TOPICS).errors).toEqual([]);
  });
});
