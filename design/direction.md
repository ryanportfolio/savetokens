# savetokens.tips design direction

This document implements the constraint contract (`design/constraint-contract.md`). It is concrete enough that a build phase can start without reopening decisions. Where it adds detail, that detail serves the contract. Where the contract states a rule, this document does not relax it.

The site is one engineering datasheet for token-saving techniques, read top to bottom in datasheet order. It is a single long page with numbered sections, not a multi-page blog.

## 1. Document structure

The page runs in fixed datasheet order. Section numbers are part of the design.

- Masthead: part identity block for the whole document (part number, title, revision letter, snapshot date, characterization-data note).
- Section 1 Features: a short bullet summary of what the site characterizes.
- Section 2 Absolute Maximum Ratings: the context-window limits box.
- Section 3 Electrical Characteristics: the measured-parameter table (the core live-data region).
- Section 4 Typical Performance Characteristics: the curves (the second live-data region).
- Section 5 Application Information: the actual how-to tips as readable prose, one to four sentences each.
- Section 6 Ordering Information: each technique gets a part number, a status, and a decoder key. Platform applicability (Claude Code, Codex) states itself in the decoder note when constant across parts, and returns as a column only when parts genuinely differ.
- Revision History strip: at the foot, tying revision letters to snapshot dates.

## 2. Type

Families and roles are fixed by the contract (Section 4). Restated in build terms.

2.1 Ship IBM Plex Sans, IBM Plex Sans Condensed, and IBM Plex Mono as self-hosted static WOFF2 files, weights 400, 500, and 600 only. Subset to Latin. Preload the Mono 500 and Sans 400 files, since they paint first.

2.2 Fallback stacks are declared in the contract (4.1) and must be set so a font-load failure still yields a tabular, monospaced numeric column.

2.3 Apply `font-variant-numeric: tabular-nums lining-nums` to every element that holds a number in a column. This is not optional styling; misaligned digits are a bug.

2.4 Type scale anchors are fixed in the contract (4.4). Line lengths for body prose in Section 5 cap at roughly 72 characters so the how-to reads as prose, not as a caption.

## 3. Color

3.1 The named palette, light and dark, is fixed in the contract (Section 3). Implement it as CSS custom properties on `:root` and a `prefers-color-scheme: dark` block, plus a manual `[data-theme]` override that wins in both directions.

3.2 The accent variable is named `--measured`. It is referenced only by the measured value class, the measured curve mark, and the measured-row marker. A lint rule or a grep gate should confirm `--measured` appears in no other selector.

3.3 Focus rings, hover states, and buttons use `--ink` or `--graphite`. The accent is never an interaction color.

## 4. Grid and spacing

4.1 Spacing base unit is 4px. All vertical and horizontal spacing is a multiple of it. Named steps: 4, 8, 12, 16, 24, 32, 48, 64.

4.2 Content column caps at 1100px, centered in the viewport with functional side margins (24px on tablet, 16px on mobile). The page body never scrolls horizontally. Wide tables and curves scroll inside their own container.

4.3 Vertical rhythm: 48px between numbered sections, 16px within a section, 8px between a value and its provenance chip.

4.4 Section header bar: a full-width heavy rule (`--ink`, 2px) with the Condensed uppercase label sitting on it, section number left, title following. This is the only heavy horizontal rule inside a section.

4.5 The Electrical Characteristics table uses a rigid column grid: Part number, Symbol or Parameter, Min, Typ, Max, Unit, Test Conditions. Numeric columns are right-aligned so digits stack. Text columns are left-aligned. Column rules are `--rule` hairlines. Row separation is a single channel: either row rules or zebra `--faint`, never both.

4.6 Nothing is centered for effect. Every element sits where a datasheet section would place it.

## 5. Component: number slot

The number slot is the single most important component. It renders one figure in one of three data states and one of two kinds. It is used in the table, inline in prose, and as a curve label.

5.1 Data shape the slot expects.

```
type FigureState = "live" | "snapshot" | "none";
type FigureKind = "measured" | "estimated" | "spec";

interface Figure {
  id: string;              // e.g. "RTK-READ-01"
  parameter: string;       // "Tokens saved, rtk read"
  kind: FigureKind;
  unit: "tokens" | "percent" | "count";
  // values are null when not characterized
  min: number | null;
  typ: number | null;
  max: number | null;
  // precision the source reported, used verbatim for display
  display: {               // pre-formatted strings, source precision preserved
    min: string | null;    // measured: "24.9 percent"; estimated: null
    typ: string;           // measured: "83.5 percent"; estimated: "~75 percent"
    max: string | null;
  } | null;                // null in the no-data state
  testConditions: {
    counterfactual: string; // "raw vs filtered"
    n: number;
    scope: string;          // "global"
    singleObservation: boolean; // true when n <= 3
  } | null;                 // null for estimated and for no-data
  provenance: {
    source: string;         // "rtk gain" | "session log" | "by design"
    date: string | null;    // ISO date of the snapshot or feed time
    state: FigureState;
    freshness?: string;     // ISO timestamp, only in live state
  };
}
```

5.2 Rendering rules by kind and state.
- Measured and snapshot: leading `[M]` tag, value in `--measured` at source precision, no tilde, Min and Max filled when present else the not-characterized mark, Test Conditions cell filled with counterfactual and n and scope, footnote superscript resolving to "production tested". If `singleObservation` is true, add the "single observation, not a distribution" footnote.
- Measured and live: same as snapshot, plus the provenance chip date is the feed freshness time.
- Estimated (always snapshot or by-design, never live): leading `[E]` tag, value in `--graphite` printed coarse with a mandatory leading tilde, Min and Max and Test Conditions cells show the not-characterized mark, footnote resolving to "guaranteed by design, characterization only, not production tested".
- Spec (vendor-stated, never live): leading [S] tag, value in --graphite printed coarse with a mandatory leading tilde, provenance chip S, vendor spec, no counterfactual, footnote resolving to "vendor specification, not measured here, no counterfactual". Used only for supplier-stated limits such as the context window.
- No data (state "none"): leading kind tag still shown, Typ shows the not-characterized mark, Min and Max blank, Test Conditions reads "not yet characterized", no number, no color. Never a fabricated filler.

5.3 The slot never invents a value. If `display` is null it renders the no-data state. There is no separate placeholder component that could be mistaken for real data.

5.4 Accessibility: the `[M]` and `[E]` tags are real text, not color and not an icon font, so a screen reader announces kind. The provenance chip is associated with its value via `aria-describedby`.

## 6. Component: parameter table (Section 3)

6.1 The table is a set of number slots sharing one Test Conditions convention, wrapped in a boxed frame.

6.2 A measured row carries a short `--measured` marker rule at its leading edge (contract 2.5). An estimated row carries no marker. This gives a scannable left-edge rhythm of which rows are tested.

6.3 Today the table holds the 2026-07-18 snapshot only, under the header note "Characterization data: snapshot 2026-07-18, global scope, values subject to revision." The rows present today, each as a measured figure with full Test Conditions, are: rtk read (n=571, 8.9M saved, 24.9 percent), rtk git diff (n=3, 5.6M saved, 99.2 percent, single observation), rtk git log --all -p (n=1, 2.0M saved, 100.0 percent, single observation), rtk grep (n=1199, 448.6K saved, 23.0 percent), rtk vitest run (n=38, 208.4K saved, 92.5 percent), rtk git pull (n=73, 38.9K saved, 92.3 percent). A totals row shows 92,695 commands proxied, 18.4M saved, 83.5 percent. The terse-prompting estimate sits as one estimated row: ~75 percent, Typ only.

6.4 No number outside that snapshot appears in the table as a measured value. Additional technique rows that lack a logged counterfactual appear only as estimated rows or as no-data rows.

## 7. Component: performance curves (Section 4)

7.1 Curves plot characterized behavior, for example saved-percent against command frequency or against input size. Each series is a set of points, each flagged measured or estimated.

7.2 Data shape.

```
interface CurveSeries {
  id: string;
  xLabel: string;
  yLabel: string;
  state: FigureState;
  points: Array<{
    x: number;
    y: number;
    kind: FigureKind;     // measured points carry the accent, estimated do not
    label?: string;       // e.g. part number
  }>;
}
```

7.3 Measured points render in `--measured` with a solid mark. Estimated points or design-target regions render in `--graphite` with a hollow or dashed mark, never in the accent. A curve legend states which marks are measured.

7.4 Before data arrives, a curve renders its axes, labels, and a "not yet characterized" note in the plot area. It draws no line and no invented points.

7.5 Curves scroll horizontally inside their own container on narrow viewports rather than compressing until unreadable.

## 8. Responsive behavior

8.1 Breakpoints: desktop at 1024px and up, tablet 640 to 1023px, mobile below 640px.

8.2 Desktop and tablet: the parameter table keeps its full column set. Tablet tightens the numeric column padding and may drop the Part-number column into the Parameter cell as a second line.

8.3 Mobile: the parameter table reflows into stacked parameter cards, one per figure. Each card must preserve, in order, the kind tag, the value at correct precision (with the tilde for estimates), the Min and Max or their not-characterized marks, the Test Conditions line, the provenance chip, and the footnote reference. Reflow may not drop the measured-versus-estimated signal on any channel.

8.4 The masthead stacks its identity fields on mobile but keeps the part number, revision, and snapshot date visible above the fold.

8.5 Theme follows `prefers-color-scheme` with a manual toggle that stamps `data-theme` on the root and wins in both directions.

## 9. How live data slots in later

9.1 Two regions are wired for live data: the Section 3 table and the Section 4 curves. Both consume the `Figure` and `CurveSeries` shapes above. Nothing else changes shape when live data arrives.

9.2 The RTK feed. rtk gain output maps one command to one measured Figure: raw-versus-filtered counts become saved tokens and saved percent, the command becomes the parameter and part number, the run count becomes n, scope and date become the provenance and Test Conditions. A build-time or request-time adapter transforms rtk gain JSON into `Figure[]`. Until that adapter runs live, the same shape is filled from the committed 2026-07-18 snapshot file and every provenance state reads "snapshot".

9.3 The session-log feed. Claude Code and Codex per-message token counts feed the curves and any per-session parameters. Each session log entry maps to curve points flagged measured. A message with no clean counterfactual maps to an estimated point, never a measured one.

9.4 Before data arrives, every consuming component renders its no-data state (Section 5.2, 7.4). The page is complete and honest with zero live numbers: it shows structure, the snapshot where it exists, and not-characterized marks everywhere else.

9.5 When live data replaces the snapshot, the adapter flips each Figure's `provenance.state` to "live" and sets `freshness`. The Revision History strip bumps its revision letter and date. The grid, columns, tags, footnotes, and accent budget do not move. This is the test that the design reserved space correctly: swapping snapshot for live changes values and dates only.

9.6 A single source-of-truth data module holds the current snapshot as typed `Figure[]` and `CurveSeries[]`. Components import from it. No component hard-codes a number in markup, so the live cutover touches one module, not the layout.

## 10. Build order suggestion

10.1 Build the number slot first, with all three states and both kinds, and its grayscale and screen-reader behavior. Everything else composes it.

10.2 Build the parameter table and totals row on the committed snapshot module next, verifying the accent budget and the left-edge measured markers.

10.3 Add Sections 1, 2, 5, and 6 as static prose and boxed panels, honoring the wit budget (at most one per section, six total, in allowed homes).

10.4 Add the curves against the same data module in their no-data state, then wire the snapshot points.

10.5 Wire the release gates from contract Section 10 into the deploy check: grayscale, accent budget, number audit, copy audit, wit audit.

## 11. Refinement backlog from the adversarial passes

Four review rounds ran against rendered screenshots. All contract violations found were fixed in the specimen or resolved in the contract; the items below survived round 4 as refinements, not blockers, and belong to the build phase.

11.1 Chart insight bands. The performance scatter is bimodal: structural commands (diff, log, pull, vitest) cluster near 90 to 100 percent, content commands (read, grep) sit near 23 to 25 percent. Label the two bands so the empty middle reads as the finding (savings depend on command kind), not as dead space.

11.2 Mobile parameter cards. Collapse always-empty Min and Max rows into one compact "Min/Max, no distribution" line per card, keeping the honest signal while cutting the longest scroll on the page.

11.3 Distribution provenance note. State once in Section 3 why high-n rows carry no Min/Max in this snapshot (per-command percentages are aggregated, not retained per run), so empty cells read as a data-capture fact.

11.4 Small typography polish. Add a small gap (about 0.2em) between a display-size percent glyph and its footnote superscripts; left-align the wrapped [S] chip in the mobile AbsMax card; open 2 to 3px between the [E] reference-line label and the dashed line; keep chart point labels clear of their markers at 390px.

11.5 Accent budget check on mobile 5.1. The two large measured figures dominate that viewport; run the contract 10.2 accent-area gate against the mobile Section 5 screen specifically when the build lands.

11.6 More application notes. The specimen carries one tip by scope. The build adds short notes for at least RTK-READ-01 and RTK-GREP-01 so Section 5 carries the weight the conceit won on.
