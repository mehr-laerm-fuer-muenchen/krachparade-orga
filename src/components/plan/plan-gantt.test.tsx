import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { GanttWindowElement } from "../../lib/gantt-layout";
import { PlanGantt, type PlanGanttProps } from "./plan-gantt";

// Renders the Gantt to HTML on the server side (as on the first render) and
// checks what it draws. Interaction is covered by the click test in e2e/.

const D_DAY = "2027-05-08";
const NBSP = " ";

const OPEN = { placement: "alap", fixedDay: null, fixedOffsetDays: null, freeStartDay: null } as const;

const ELEMENTS: GanttWindowElement[] = [
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
    ...OPEN,
    placement: "fixed",
    fixedDay: -150,
    earliestStart: -150,
    latestStart: -150,
    slack: 0,
    critical: true,
    tight: false,
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
    ...OPEN,
    earliestStart: -140,
    latestStart: -130,
    slack: 10,
    critical: false,
    tight: false,
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
    ...OPEN,
    earliestStart: -180,
    latestStart: -180,
    slack: 0,
    critical: false,
    tight: false,
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
      criticalIds={["talk", "check"]}
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
  it("draws lanes, elements, today and the Krachparade line", () => {
    const html = render();
    expect(html).toContain('aria-label="Gantt-Plan"');
    expect(html).toContain("AK Demo &amp; Route");
    expect(html).toContain("AK Finanzen");
    expect(count(html, 'data-testid="gantt-element"')).toBe(3);
    expect(count(html, 'data-testid="gantt-lane-bar"')).toBe(2);
    expect(html).toContain(">Heute<");
    expect(html).toContain(">Krachparade<");
    expect(html).not.toContain("D-Day");
    expect(html).not.toMatch(/D[-−+]\d/);
    expect(html).toContain("fill-gantt-late");
    // Spec 026: no buffer line and no buffer in the label any more.
    expect(html).not.toContain("stroke-gantt-buffer");
    expect(html).not.toContain("−2 T");
    expect(html).toContain(">Fix<");
  });

  it("draws a window band only for open elements that are not fixed (spec 026)", () => {
    const html = render();
    // Only "Finaler Crosscheck": the fixed date and the reached element have none.
    expect(count(html, 'data-testid="gantt-window"')).toBe(1);
    expect(html).toContain("fill-window stroke-window-edge");
    expect(count(render({ windows: false }), 'data-testid="gantt-window"')).toBe(0);
    // No window left: no band either.
    const noWindow = ELEMENTS.map((element) =>
      element.id === "check" ? { ...element, earliestStart: -120, latestStart: -130, slack: -10 } : element
    );
    expect(count(render({ elements: noWindow }), 'data-testid="gantt-window"')).toBe(0);
  });

  it("pins fixed dates and frames critical and tight elements with a word for them", () => {
    const html = render();
    expect(count(html, 'data-testid="gantt-pin"')).toBe(1);
    expect(html).toContain("<title>Kooperationsgespräch · fest · kritisch</title>");
    expect(html).toContain('data-frame="critical"');
    const tight = ELEMENTS.map((element) => (element.id === "check" ? { ...element, slack: 5, tight: true } : element));
    const tightHtml = render({ elements: tight });
    expect(tightHtml).toContain('data-frame="tight"');
    expect(tightHtml).toContain("<title>Finaler Crosscheck · knapp</title>");
    expect(tightHtml).toContain("[stroke-dasharray:3_2]");
    // A fixed date that is not critical: the pin, no dark outline.
    const calm = ELEMENTS.map((element) =>
      element.id === "talk" ? { ...element, status: "ok" as const, buffer: 0, critical: false } : element
    );
    const calmHtml = render({ elements: calm });
    expect(count(calmHtml, 'data-testid="gantt-pin"')).toBe(1);
    expect(calmHtml).not.toContain("stroke-text");
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

  it("leaves out calendar week labels under the Heute and Krachparade labels", () => {
    // Zoom Woche: KW 42 (Mo 12.10.2026) sits under "Heute" (Do 15.10.),
    // KW 19 (Mo 10.05.2027) under "Krachparade" (Sa 08.05.2027).
    const html = render({ zoom: "week" });
    expect(html).not.toContain(">KW 42<");
    expect(html).not.toContain(">KW 19<");
    expect(html).toContain(">KW 43<");
    expect(html).toContain(">KW 18<");
  });

  it("labels with the slack, „keine Luft“, „fest“ and „erreicht“ (spec 026)", () => {
    const onTime: GanttWindowElement = {
      id: "brief",
      name: "Briefing",
      kind: "milestone",
      workingGroupId: "demo",
      start: -100,
      end: -100,
      latestEnd: -100,
      buffer: 0,
      status: "ok",
      done: false,
      fixed: false,
      ...OPEN,
      earliestStart: -100,
      latestStart: -100,
      slack: 0,
      critical: true,
      tight: false,
    };
    const html = render({ elements: [...ELEMENTS, onTime] });
    expect(html).toContain(">28.01. · keine Luft</text>");
    expect(html).toContain(`· Luft 10${NBSP}T</text>`);
    expect(html).toContain(" · fest</text>");
    expect(html).toContain(" · erreicht</text>");
    expect(html).not.toContain("0 T");
  });

  it("shows the to-do progress: bar under tasks, number after dates and slack", () => {
    expect(render()).not.toContain("gantt-progress");
    const html = render({
      progress: new Map([
        ["check", { done: 1, total: 4, complete: false }],
        ["talk", { done: 2, total: 2, complete: true }],
      ]),
    });
    // Only the task has a bar; its fill is a quarter of the track.
    expect(count(html, 'data-testid="gantt-progress"')).toBe(1);
    expect(count(html, "fill-progress-fill")).toBe(2);
    expect(html).toMatch(new RegExp(`Luft 10${NBSP}T · <tspan[^>]*>1/4</tspan>`));
    expect(html).toMatch(/fill-progress-fill font-semibold[^>]*>2\/2 ✓</);
  });
});
