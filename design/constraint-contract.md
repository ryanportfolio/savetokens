# savetokens.tips constraint contract

Binding rules for the whole site. A violation is a bug, not a preference. The site is one engineering datasheet for token-saving techniques. Every rule below exists to protect one promise: an expert reader can tell, at a glance and without trusting the author, which numbers are measured and which are estimated.

This document governs both the production site and any design specimen or mockup. If a build decision is not covered here, it must not contradict here.

## 1. Scope and precedence

1.1 These rules bind all pages, components, print stylesheets, and generated specimens.

1.2 When a rule here conflicts with a visual preference, the rule wins. When two rules here conflict, the one earlier in this document wins.

1.3 The direction document (`design/direction.md`) implements these rules. It may add detail. It may not relax a rule stated here.

## 2. Element semantics

Nothing on the page is decorative. Every line, rule, box, mark, and label carries one fixed meaning. If an element cannot be assigned a meaning from this list, it does not ship.

2.1 Section rule (heavy horizontal, full content width). Marks the start of a numbered datasheet section. Carries the section number and title. One per section, never used mid-section.

2.2 Table frame (boxed border around a parameter table). Marks a set of characterized parameters. A frame implies the rows inside share a Test Conditions convention.

2.3 Column rule (thin vertical). Separates parameter columns (Symbol, Min, Typ, Max, Unit, Test Conditions). Never used for visual rhythm outside a table.

2.4 Row rule (thin horizontal, inside a table). Separates one parameter from the next. Zebra fill may substitute but never both at once.

2.5 Measured-row marker (short accent rule at the row's leading edge, plus the accent-colored value). Means: this row is production tested and has a real counterfactual behind it. See Section 6.

2.6 Footnote superscript (small raised numeral after a value). Resolves to a statement at the foot of the same section; numbering is section-local. A numbered footnote must be anchored by at least one superscript in its section, and a superscript must resolve in its section. Blanket cautions that anchor to no cell are unnumbered lines led by "Note:" and never carry a number. Three resolutions are reserved and may not be reused for other purposes: "production tested", "guaranteed by design, characterization only, not production tested", and "vendor specification, not measured here, no counterfactual."

2.7 Provenance chip (compact inline label under or beside a number). States where the number came from, its date, its scope, and its sample count. Required on every number. See Section 8.

2.8 Not-characterized mark (a middot, "·"). Means: no value exists for this cell yet. It is the only legal filler for an empty numeric cell. It is never a zero, never a dash that could read as a minus, never "TBD" styled as a value. The middot is reserved for this meaning alone: provenance chips, test-condition cells, and any other field lists use commas as separators, never the middot.

2.9 Absolute Maximum box (boxed panel, heavier frame than a normal table). Reserved for the context-window limits section. Its heavier frame means "exceeding these values degrades behavior." Used exactly once per document.

2.10 Handling-caution panel (ESD-warning style: ruled box, caution glyph, short imperative text). Reserved for the estimate-handling notice. Used at most once per document.

2.11 End-of-life stamp ("Not recommended for new designs"). A rotated or ruled stamp applied only to a technique a newer approach supersedes. It is a status, not a decoration, and appears only on a superseded technique.

2.12 Revision strip (ruled rows at the document foot). Ties a revision letter to a snapshot date and is the authoritative version record. The masthead may carry a current-revision field that mirrors the strip's latest row; no other element states a version.

2.13 Any gradient, blur, glow, shadow-for-depth, floating shape, or symmetric ornament is prohibited. These carry no datasheet meaning and are anti-slop tells.

## 3. Color

The site is one ink on paper plus exactly one accent. The accent has one meaning and a hard usage budget.

3.1 Named palette (light).
- Paper (page background): `#F6F4EE`, a warm off-white printing stock.
- Ink (primary text, heavy rules, table frames): `#16171A`.
- Graphite (secondary text, provenance chips, footnotes): `#55585E`.
- Rule (thin column and row rules, hairlines): `#C9C7BE`.
- Faint (zebra fill, panel fill): `#E9E6DD`.
- Measured (the one accent): `#147A5C`.

3.2 Named palette (dark). Same roles, inverted stock.
- Paper: `#141519`.
- Ink: `#ECEAE2`.
- Graphite: `#A2A5AC`.
- Rule: `#3A3C41`.
- Faint: `#1E2025`.
- Measured: `#3FB489` (lightened so its contrast against dark paper matches the light-mode ratio).

3.3 The accent Measured means one thing only: this number is production tested and has a real counterfactual behind it. It appears on measured numeric values, on measured data points and traces in performance curves, and on the measured-row leading marker. Nowhere else. The bracket kind tag itself ([M], [E], [S]) prints in Ink or Graphite, never in the accent; the tag is the grayscale channel and the accent belongs to the value.

3.4 Accent usage budget. The accent covers no more than five percent of inked area on any screen. It is never used for links, buttons, headings, section rules, backgrounds, icons, hover states, focus rings, or any decorative purpose. Focus rings and interactive affordances use Ink or Graphite, never the accent.

3.5 Estimated figures never receive the accent. They stay in Ink or Graphite. An estimated value shown in the accent color is a bug.

3.6 Color is a redundant reinforcement of the measured signal, never its sole carrier. The site must remain fully readable and fully distinguishable in grayscale (Section 6.5).

## 4. Type system

One family group, three roles, one numeric rule. Concrete choices below self-host as static font files with system fallbacks.

4.1 Families.
- Sans (body prose, section titles, table header labels): IBM Plex Sans. Fallback stack: `IBM Plex Sans, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`.
- Sans Condensed (section header bars, table column labels): IBM Plex Sans Condensed. Fallback: `IBM Plex Sans Condensed, IBM Plex Sans, Arial Narrow, sans-serif`.
- Mono (all numeric cells, part numbers, provenance chips, test conditions, footnotes): IBM Plex Mono. Fallback: `IBM Plex Mono, ui-monospace, SFMono-Regular, Consolas, Liberation Mono, monospace`.

4.2 No display face, no expressive or branded face, appears anywhere. A datasheet earns trust by looking uniform and unmarketed.

4.3 Tabular figures are mandatory for every number that sits in a column. Mono is fixed width by nature; where Sans shows figures in a column, apply `font-variant-numeric: tabular-nums lining-nums`. Percent columns and token-count columns must align digit for digit.

4.4 Type scale (concrete, rem at a 16px root). The direction document may add intermediate steps but not change these anchors.
- Masthead part number: Mono, 1.75rem, weight 600.
- Section title: Sans, 1.125rem, weight 600.
- Section header bar label: Sans Condensed, 0.8125rem, weight 600, uppercase, letter-spacing 0.08em.
- Body prose: Sans, 0.9375rem, weight 400, line-height 1.5.
- Table column label: Sans Condensed, 0.6875rem, weight 600, uppercase.
- Numeric cell value: Mono, 0.875rem, weight 500 for measured, weight 400 for estimated.
- Provenance chip and footnote: Mono, 0.6875rem, weight 400, Graphite.

4.5 Headings never end with a period (also a copy rule, Section 7).

## 5. Wit budget

Wit is rationed and homed. It reinforces the genre; it never floats free.

5.1 At most one wit detail per numbered section. At most six across the whole document.

5.2 Wit may live only in these homes: the Absolute Maximum Ratings footnotes, the handling-caution panel, an end-of-life stamp, the Ordering Information part-number decoder, a functional block diagram caption, and the Revision History strip.

5.3 A wit detail must be true and must carry datasheet meaning. A joke that states something false about the tooling, or that exists only to amuse, does not ship.

5.4 Functional furniture is not wit. An element that carries required information (the part-number decoder, a block-diagram caption, a provenance chip) does not spend a wit slot even when it lives in an allowed wit home. Only a detail whose reward is the close read itself counts against the budget.

## 6. Measured versus estimated: the hard rule

This is the reason the site exists. A measured figure and an estimated figure must be impossible to confuse, distinguishable at a glance, and distinguishable without color. The distinction is carried on six channels at once. All six are required on every figure; none alone is sufficient.

6.1 Kind tag (primary, colorblind-safe channel). Every figure carries a leading bracket tag: `[M]` for measured, `[E]` for estimated, `[S]` for a vendor specification (a limit stated by a supplier, not measured here and holding no counterfactual). This tag is text, reads in grayscale, and reads to a screen reader. It is the load-bearing signal. One tag never covers two meanings: an estimate the author derived is `[E]`, a number a vendor states is `[S]`, and neither may borrow the other's footnote.

6.2 Table structure. A measured figure fills Typ, and fills Min and Max when a distribution exists, and always fills a Test Conditions cell. An estimated figure fills Typ only. Its Min and Max cells show the not-characterized mark (Section 2.8); its Test Conditions cell carries the figure's required provenance statement (no counterfactual, design target only), since provenance (2.7) outranks the empty-cell convention. An estimated figure with a populated Min or Max cell is a bug.

6.3 Precision as a signal. A measured value prints to the precision RTK actually reports (for example 83.5 percent, 24.9 percent, 8.9M). An estimated or vendor-spec value prints deliberately coarse and always carries a leading tilde (for example ~75 percent, ~200,000 tokens). The tilde is mandatory on every [E] and [S] figure and forbidden on every measured figure.

6.4 Footnote. A measured value's superscript resolves to "production tested." An estimated value's superscript resolves to "guaranteed by design, characterization only, not production tested." A vendor-spec value's superscript resolves to "vendor specification, not measured here, no counterfactual." These three resolutions are reserved (Section 2.6).

6.5 Color reinforcement. A measured value prints in the accent (Measured). An estimated value prints in Ink or Graphite. Removing all color must not remove the distinction: tags, table structure, tilde, and footnotes still separate the two. Verify in grayscale as a release gate.

6.6 Single-observation caution. Any measured parameter with a small sample count states n in its Test Conditions cell. Rows with n=1 or n=3 carry an added footnote reading "single observation, not a distribution." A flattering single-sample number without this caution is a bug. This applies today to rtk git log --all -p (2.0M saved, 100.0 percent, n=1) and rtk git diff (5.6M saved, 99.2 percent, n=3).

6.7 The estimate example that must stay honest. The terse-prompting claim renders as `[E] ~75 percent`, Typ only, no counterfactual, footnoted "guaranteed by design." It may never be dressed as a tested number.

## 7. Copy rules (binding clauses)

These govern every user-visible string, including this document and any specimen.

7.1 No em dashes anywhere. Use commas, periods, colons, and parentheses.

7.2 Plain, specific language. No invented coinages, no insider jargon, no aphorism flourishes. Name a thing by what it does.

7.3 Headings never end with a period.

7.4 Paragraphs run one to four sentences.

7.5 No death metaphors. Do not write "killed" or "dies" for a saved or dropped token. State the specific verb (dropped, filtered, removed, truncated).

7.6 Every sample number is visibly labeled as sample data. A dated snapshot label satisfies this. The current label is "Characterization data: snapshot 2026-07-18, global scope, values subject to revision."

7.7 No placeholder-flavored microcopy. No "lorem", no "your text here", no "coming soon" styled as content.

## 8. Provenance and the no-fabrication rule

Every number states where it came from. No number is invented.

8.1 Provenance chip contents. A measured figure shows source, date, scope, and sample count, for example: `M, rtk gain, 2026-07-18, global, n=571`. An estimated figure shows: `E, by design, no counterfactual`. A vendor-spec figure shows: `S, vendor spec, no counterfactual`. Chip fields separate with commas; the middot is reserved for the not-characterized mark (Section 2.8).

8.2 The only real numbers permitted today are the 2026-07-18 rtk gain global snapshot listed in the project brief. No additional measured numbers may be invented, rounded into new figures, or interpolated. When a figure is not in that snapshot, its slot renders in the no-data state (Section 9), never a guess.

8.3 Empty is an honest state. A parameter with no measured Min or Max leaves those cells at the not-characterized mark. Blank is legal and expected in a datasheet.

## 9. Live-data reservation: three-state number slots

The Electrical Characteristics table and the Typical Performance Characteristics curves are live-data regions. A later phase pipes rtk gain output and Claude Code and Codex session logs into the same cells. The layout does not change when live data arrives, because every number slot is built to render three states from day one.

9.1 Every number slot renders exactly one of three states, chosen by the data it receives.
- Live: the slot shows a value from the feed plus a freshness timestamp. Its provenance chip date is the feed time.
- Snapshot: the slot shows a value from a dated capture plus the snapshot label (Section 7.6). This is today's default for all measured figures.
- No data yet: the slot shows the not-characterized mark in Typ, leaves Min and Max blank, and its Test Conditions cell reads "not yet characterized." It shows no number.

9.2 A number slot must never fabricate a filler. Zero, a random value, a rounded guess, a "TBD" styled as a value, or lorem text in a no-data slot is a bug.

9.3 State is a property of the data, not the styling. The same slot component accepts all three states and picks its rendering. No separate "placeholder component" that could be mistaken for real data may exist.

9.4 When live data replaces the snapshot, only the values, the provenance dates, and the Revision History strip change. The grid, the columns, the tags, and the footnotes stay put.

## 10. Release gates

Before any deploy, these checks pass or the deploy stops.

10.1 Grayscale check: render the page with color removed. Measured and estimated figures remain distinguishable by tag, structure, tilde, and footnote.

10.2 Accent budget check: the accent appears only on measured values, measured curve points, and measured-row markers, and covers no more than five percent of inked area.

10.3 Number audit: every visible number is either in the 2026-07-18 snapshot with a full provenance chip, or in a no-data slot. No number lacks provenance. No number outside the snapshot appears as a measured value.

10.4 Copy audit: no em dashes, no headings ending in a period, no death metaphors, no placeholder microcopy, every sample number carries its snapshot label.

10.5 Wit audit: at most one wit detail per section, at most six per document, each in an allowed home and each true.
