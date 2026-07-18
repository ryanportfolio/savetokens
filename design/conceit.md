# Conceit: Datasheet

## The winning conceit

The whole site is an engineering component datasheet, the document a chip or part ships with. Each token-saving technique is a characterized component with its own part number, and the site is that part's datasheet.

The document runs in datasheet order: a Features summary, an Absolute Maximum Ratings box, an Electrical Characteristics table of measured parameters with stated test conditions, a Typical Performance Characteristics section of curves, an Application Information section written as readable how-to prose, an Ordering Information section, and a Revision History strip at the foot.

The form itself is the credential. A real datasheet cannot be produced casually, because it presupposes that someone actually characterized the part, stated the conditions of every measurement, and separated what was tested from what is only nominal. Publishing one about your own tooling is proof of rigor by mere existence, since the reader trusts the genre before they trust the author.

The measured versus estimated split is a hard convention the genre already carries. Measured values appear as guaranteed parameters with Min, Typ, and Max plus a Test Conditions cell, footnoted "production tested." Values with no counterfactual appear as a Typ figure only, footnoted "guaranteed by design, not tested." That convention is borrowed from real engineering practice, not invented for the site.

## The truth it derives from

The author characterizes tooling the way a semiconductor vendor characterizes a part: with logged, per-command before-and-after token deltas and stated conditions. A datasheet is the artifact form whose entire authority rests on separating production-tested figures from design nominals, which is exactly the measured versus estimated distinction the site must carry. It is an engineering document rather than a finance one, so it signals craft to the target audience by genre alone.

Two load-bearing facts anchor the design. Tokens are a metered, billed commodity, and the owner holds real measured data (RTK before-and-after deltas plus Claude Code and Codex session logs) that a later phase pipes in live. Savings come in two kinds that must stay visually distinct everywhere: MEASURED (real counterfactual deltas) and ESTIMATED (no clean counterfactual). The datasheet's production-tested versus guaranteed-by-design convention encodes that split as table structure rather than as a badge bolted on.

## The design questions it answers

### Typeface direction

A neutral technical grotesque for body and section headings, the plain sans lineage of real component datasheets, paired with a monospace carrying tabular lining figures for every numeric cell, part number, and test condition. Tabular figures are mandatory so columns of saved-percent and token counts align digit for digit. Condensed weight sets the section header bars, and no display or expressive faces appear anywhere, because a datasheet earns trust by looking uniform and unmarketed.

### What color means

The base is a single ink on paper stock, near monochrome, because a datasheet is printed economically and metered ink rhymes with metered tokens. Exactly one spot color is reserved, and it means one thing only: this number is production tested and has a real counterfactual behind it. Measured rows and the traceable data points on characteristic curves carry the spot color, while estimated Typ-only figures never receive it and stay in plain ink and gray outline. Color is therefore a semantic flag for measured, never decoration.

### How measured versus estimated figures display

Measured figures render as guaranteed parameters in the Electrical Characteristics table with a value plus a mandatory Test Conditions cell stating the counterfactual (for example: rtk read, raw versus filtered, n=571, global scope, 2026-07-18) and a superscript resolving to the footnote "production tested." Estimated figures render in the same table as a Typ-only value with the Min and Max cells empty, with the spot color withheld and the footnote "guaranteed by design, characterization only, not production tested." The 75-percent terse-prompting claim appears as a Typ figure flagged by design, never dressed as a tested number. The distinction is native to the table structure, not a badge added afterward.

### Layout and grid logic

A rigid multi-column datasheet grid runs numbered sections in datasheet order: 1 Features, 2 Absolute Maximum Ratings, 3 Electrical Characteristics, 4 Typical Performance Characteristics, 5 Application Information (the actual how-to tips as readable prose blocks, one to four sentences), 6 Ordering Information, and a Revision History strip at the foot. Tables are boxed with ruled columns, and footnotes are superscripted and resolve at the section foot. Margins are tight and functional, and nothing is centered for effect: every element sits where a datasheet section would place it.

### How live data slots in later

The Electrical Characteristics table and the Typical Performance Characteristics curves are the designated live-data regions. Today they show the dated snapshot from rtk gain (2026-07-18, global scope) under a header note reading "Characterization data: snapshot 2026-07-18, values subject to revision." Later the same cells pipe from live rtk gain output and the Claude Code and Codex session logs, and the Revision History strip bumps its revision letter and date. No layout changes when real numbers arrive, because the table was built to hold characterization data from the start.

### How the conceit handles the no-fabrication rule

Empty cells are legal and expected in a datasheet, so a parameter with no measured Min or Max simply leaves those cells blank rather than filling them with a guess. Any figure without a logged counterfactual can only appear as a Typ nominal under the by-design footnote, which structurally forbids dressing an estimate as a measurement. Blank is an honest datasheet state, so the form removes the temptation to invent numbers.

## Grafted element: significant figures as confidence, plus the n=1 caution

One element is grafted from the Calibration certificate runner-up, and both judges who picked the Datasheet recommended it. Measured values print to the precision RTK actually reports (83.5 percent, 24.9 percent, 8.9M), while estimates print deliberately coarse with a leading tilde (~75 percent), so typographic precision becomes a second honesty signal on top of the production-tested versus guaranteed-by-design footnote.

Every measured parameter also carries an n flag in its Test Conditions cell. Single-observation rows (rtk git log --all -p: 2.0M saved, 100.0 percent, n=1; rtk git diff: 5.6M saved, 99.2 percent, n=3) get a footnote reading "single observation, not a distribution." This deepens the honesty axis rather than decorating it, because the datasheet's native Min, Typ, and Max convention does not by itself force caution on a flattering single-sample measurement. The graft makes the site openly wary of its own best numbers exactly where an expert would probe, and it needs no new visual furniture since sample count already belongs in the Test Conditions cell.

## Wit examples

- An Absolute Maximum Ratings box for the context window, with the footnote: "Stresses beyond these limits cause context to be dropped, not summarized. Sustained operation near maximum reduces answer quality."
- An Ordering Information section giving each technique a part number with a decoder key (for example RTK-READ-01) and a Package column stating where it applies: Claude Code, Codex, or both.
- A "Not recommended for new designs" stamp on any technique a newer approach supersedes, the exact notice vendors print on parts nearing end of life.
- A functional block diagram of one RTK-proxied command showing raw input entering and filtered output leaving, with the delta labeled as the characterized parameter.
- A handling caution set in the ESD-warning style: "Handle estimates with care. Values marked Typ are design targets, not measured, and are not guaranteed across sessions."
- A Revision History strip at the foot tying real revision letters to snapshot dates, so the document visibly versions itself as new characterization data lands.

## Sample data snapshot

All figures below are a dated sample snapshot from rtk gain, global scope, 2026-07-18. They are the only real numbers used, and no others are invented.

- Totals: 92,695 commands proxied, 22.0M input tokens, 3.6M output tokens, 18.4M tokens saved (83.5 percent).
- rtk read: n=571, 8.9M saved, 24.9 percent.
- rtk git diff (one large diff): n=3, 5.6M saved, 99.2 percent.
- rtk git log --all -p: n=1, 2.0M saved, 100.0 percent.
- rtk grep: n=1199, 448.6K saved, 23.0 percent.
- rtk vitest run: n=38, 208.4K saved, 92.5 percent.
- rtk git pull: n=73, 38.9K saved, 92.3 percent.
- Example estimated claim, no counterfactual: terse prompting style cuts prose tokens by roughly 75 percent (~75 percent, Typ only, guaranteed by design).

## The candidates it beat

- **Calibration certificate**: The most literally true framing, since RTK is an actual measuring instrument and an estimate structurally cannot carry a sample count, but it risks reading cold like a tax form and is thinner as a working how-to reference. It supplies the winning graft rather than winning outright.
- **Fuel economy log**: The most human and emotionally legible entry, with brim-to-brim versus indicated economy and a natively live odometer, but it sits one analogical step from the literal billing fact and carries real automotive kitsch risk.
- **Cable office**: The most distinctive historical rhyme (per-word wire pricing re-engineering language, collated versus penciled counts), but it sits a historical layer removed from the subject, leans on obscure vocabulary the copy rules push offstage, and carries the highest kitsch risk.
- **Signal codec**: Compression is literally what token-saving is, but "lossless" implies bit-for-bit meaning preservation that RTK does not deliver, courting an overclaim this audience would catch, and its dithered estimated figures fight the legibility of the number a reader came for.
- **Utility statement**: The truest in the plainest sense, since tokens are metered and billed, but it headlines spend rather than savings, its estimated-read analogy is loose, and invoice and rate-table aesthetics sit closest to a generic template.
- **Audited ledger**: A sound derivation (every saving is a claim against a counterfactual, and accounting separates audited from estimated figures), but double-entry is a forced fit, the auditor tick reads as a bolt-on badge, and it overlaps heavily with the utility statement.

## Judging rationale

Three judges scored the field on truth, decision power, and distance from template, each through a distinct lens: a Tufte-school information-design director, an expert-credibility reviewer, and a distinctiveness reviewer. Two of the three named the Datasheet their top pick, and the third placed it second by two points.

The score pattern is tight at the top. The Datasheet totaled 26, 27, and 26 across the three judges. The Calibration certificate totaled 28, 26, and 25. The Fuel economy log and Cable office each reached 25 on at least one card, but neither took a top pick.

The one real disagreement is between the Tufte judge and the other two. The Tufte judge ranked the Calibration certificate first, on the ground that its mapping is not analogical but literal: RTK is the measuring instrument, so a measured figure genuinely is a calibrated reading and an estimate structurally cannot carry a sample count, forcing the honesty into a visible empty cell in the same column. That judge rated it the single most honest measured-versus-estimated encoding in the field and proposed a fuel-odometer graft to give its static live surface a pulse.

The credibility judge and the distinctiveness judge both landed on the Datasheet, and their reasons converge. The Datasheet's split rides a real, hard, widely recognized engineering convention (production tested versus guaranteed by design) that a reader does not have to learn, and blank cells are a routine, expected state so the form itself forbids fabricating numbers. It signals craft to the exact target audience by genre authority, since developers and recruiters trust a datasheet before they trust the author. It is also the most usable reference of the set, because Section 5 Application Information reserves genuine readable how-to prose rather than another table, and it is the most architecturally complete, with seven purposeful sections that resist decaying into a themed skin over a generic blog.

The resolution honors both sides. The Datasheet wins on combined evidence (two firsts and a close second), and the graft imports the Calibration certificate's single strongest move, significant-figures-as-confidence plus the n=1 caution, which both Datasheet-picking judges independently recommended. That graft closes the one gap the datasheet convention leaves open, since Min, Typ, and Max do not by themselves force caution on a flattering single-observation measurement. The result keeps the datasheet's genre authority and usability while adding the self-skepticism about its own best numbers that converts a skeptical expert reader.

The lower-ranked candidates fell for consistent reasons across judges. The Utility statement and Audited ledger are honest at the root but nearest to template and thin on supplied design answers. The Signal codec pays a foundational truth cost, since a compression ratio is measurable regardless of lossy or lossless status and the "lossless" label courts a meaning-preservation overclaim. The Cable office is the most charming and distinctive but sits a historical layer removed, hides its best vocabulary offstage, and carries the highest kitsch risk. The Fuel economy log scores well on distinctiveness and owns the best live-data instrument, which is why one judge proposed its odometer as a graft, but it trades away literal truth and invites automotive kitsch.