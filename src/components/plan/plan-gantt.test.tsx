import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { GanttElement } from "../../lib/gantt-layout";
import { PlanGantt, type PlanGanttProps } from "./plan-gantt";

// Renders the Gantt to HTML on the server side (as on the first render) and
// checks what it draws. Interaction is covered by the click test in e2e/.

const D_DAY = "2027-05-08";

const ELEMENTS: GanttElement[] = [
  {
    id: "talk",
    name: "Kooperationsgespräch",
    kind: "milestone",
    workingGroupId: "demo",
    start: -150,
    end: -150,
    latestEnd: -152,
    buffer: -2,
    status: "late",
    done: false,
    fixed: true,
  },
  {
    id: "check",
    name: "Finaler Crosscheck",
    kind: "task",
    workingGroupId: "demo",
    start: -135,
    end: -100,
    latestEnd: -95,
    buffer: 5,
    status: "ok",
    done: false,
    fixed: false,
  },
  {
    id: "budget",
    name: "Budget beschlossen",
    kind: "milestone",
    workingGroupId: "money",
    start: -180,
    end: -180,
    latestEnd: -180,
    buffer: 0,
    status: "done",
    done: true,
    fixed: false,
  },
];

function render(overrides: Partial<PlanGanttProps> = {}): string {
  return renderToStaticMarkup(
    <PlanGantt
      elements={ELEMENTS}
      groups={[
        { id: "demo", name: "Demo & Route", sortOrder: 1 },
        { id: "money", name: "Finanzen", sortOrder: 2 },
      ]}
      links={[
        { fromId: "talk", toId: "check", lagDays: 15 },
        { fromId: "check", toId: null, lagDays: 10 },
      ]}
      criticalPath={["talk", "check"]}
      today={-205}
      dDay={D_DAY}
      zoom="month"
      collapsed={new Set()}
      criticalOnly={false}
      openOnly={false}
      selectedId={null}
      onSelect={() => {}}
      onToggleLane={() => {}}
      {...overrides}
    />
  );
}

const count = (html: string, text: string) => html.split(text).length - 1;

describe("PlanGantt", () => {
  it("draws lanes, elements, today and D-Day", () => {
    const html = render();
    expect(html).toContain('aria-label="Gantt-Plan"');
    expect(html).toContain("AK Demo &amp; Route");
    expect(html).toContain("AK Finanzen");
    expect(count(html, 'data-testid="gantt-element"')).toBe(3);
    expect(count(html, 'data-testid="gantt-lane-bar"')).toBe(2);
    expect(html).toContain(">Heute<");
    expect(html).toContain(">D-Day<");
    expect(html).toContain("fill-gantt-late");
    expect(html).toContain("stroke-gantt-buffer");
    expect(html).toContain(">Fix<");
    expect(html).toContain("−2 T");
    expect(html).toContain("2/2");
  });

  it("shows arrows only for a selected element", () => {
    expect(render()).not.toContain("gantt-arrows");
    const html = render({ selectedId: "check" });
    expect(html).toContain('data-testid="gantt-arrows"');
    // From the predecessor and to the D-Day.
    expect(count(html, 'marker-end="url(#gantt-arrow)"')).toBe(2);
    expect(html).toContain('aria-pressed="true"');
  });

  it("hides the elements of a collapsed lane", () => {
    const html = render({ collapsed: new Set(["demo"]) });
    expect(html).not.toContain("Kooperationsgespräch");
    expect(count(html, 'data-testid="gantt-lane-bar"')).toBe(2);
    expect(html).toContain('aria-expanded="false"');
  });

  it("applies the filters", () => {
    expect(render({ criticalOnly: true })).not.toContain("Budget beschlossen");
    expect(render({ openOnly: true })).not.toContain("Budget beschlossen");
  });

  it("labels every calendar week only at zoom Woche", () => {
    const week = count(render({ zoom: "week" }), ">KW ");
    const month = count(render(), ">KW ");
    expect(week).toBeGreaterThan(month);
    expect(month).toBeGreaterThan(0);
  });

  it("leaves out calendar week labels under the Heute and D-Day labels", () => {
    // Zoom Woche: KW 42 (Mo 12.10.2026) sits under "Heute" (Do 15.10.),
    // KW 19 (Mo 10.05.2027) under "D-Day" (Sa 08.05.2027).
    const html = render({ zoom: "week" });
    expect(html).not.toContain(">KW 42<");
    expect(html).not.toContain(">KW 19<");
    expect(html).toContain(">KW 43<");
    expect(html).toContain(">KW 18<");
  });
});
