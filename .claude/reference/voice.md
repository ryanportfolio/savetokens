# Voice — savetokens guide prose

> How the owner writes/edits guide copy (`design/specimen/guide.html`, `index.html`, `llms.txt`).
> Derived 2026-07-19 from 39 before/after edits the owner made across one session. Match this when drafting or trimming site prose.

## Core

Ruthless compressor. Field notes, not essays. Lead with the claim or the bare command; delete everything that explains *why* it works. When something is added, it adds concreteness (a named tool, a first-person anecdote, a blunt "But" payoff), never a qualifier.

## The moves (highest-signal first)

1. **Lead with the point, cut the runway.** Delete opening context/billing/framing. First words = the concrete point or the operative command. "Tokens are metered and billed, and every word…" → "Every word…"
2. **Kill the why, keep the what.** Strip mechanism, economics, spec citations, methodology, provenance — even whole sentences ("The model has no memory between turns." → gone). "Push close to the limit and older context gets dropped…" → "/compact to summarize the session."
3. **Label-colon openers.** Framing clause → one-word topic label + colon, then terse directives: `Tools:` `Skills:` `Efficiency:` `Skill descriptions:` `Remember:`
4. **Typographic shorthand.** `&` for "and"; slash-fuse paired/near-synonym terms (`tools/MCP`, `connected tools/MCP`); occasionally `X = Y` for cause→effect ("cutting irrelevant = fewer tokens & better output"); digits not words, incl. ordinals ("3rd", "5 minute" not "five-minute").
5. **Fragments + bare imperatives.** One idea per short declarative; rarely a second elaborating sentence.
6. **No flourish, no soft concessive.** Delete metaphors (rent, tax, cleanest cut, "while a session is hot"). Replace hedged "What you buy is…" with a blunt "But …" payoff.
7. **Swap generic advice for a named tool the owner endorses** (sometimes changing the recommendation): handoff-audit, AI-Firmware, `/workflows`, caveman, recall. "Start fresh instead." → "Use the handoff-audit skill…"
8. **Second person + first-person ownership.** "you" is the subject of directives; claim artifacts in first person ("my project template"); may add a concrete anecdote where an abstract claim sat.

## Always preserved verbatim

Command names, product nouns, settings (`xhigh`, `/context`, `/compact`, Codex, MCP). Measured stats kept exact **with snapshot date** ("81.8% … 93,690 commands (snapshot 2026-07-19)"), stripping only the framing around them. Soft targets use clean approximate figures (`~50%`).

## Non-absolute caveat

Not every hedge dies. Some survive ("caching can cut the price **but** the tokens still dilute attention"); once a claim was *softened* in ("do not apply" → "**may** not apply"). Rule is "flatten hedges toward flat directives," not "delete every qualifier."

## Banned (owner reliably deletes)

Setup clauses before the point; mechanism justification; preview/promise tails ("starting with the two-second ones", "They differ in how much they drop"); balanced antithesis ("A fat file taxes every session; a thin one…"); presentation legends/caveats; spelled-out numbers; promo selling points (open source, MIT, free) as flourish. Em dashes are banned project-wide (see [[pitfalls]]; `verify.mjs` gates it).
