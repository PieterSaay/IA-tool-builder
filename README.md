# Third Umpire — Phase 1 + Phase 2

A free, single-competition build of the product design: pick a ruleset, ask a
question or describe a scenario, get an answer scoped and cited to that
ruleset — and keep getting answers even with no network connection.

- **Phase 1**: Match Mode + cited Q&A for one anchor competition.
- **Phase 2** (this update): Scenario Simulator (curated library, not
  open-ended generation), offline support via a Service Worker, and
  export-to-report on every ruling.

Change Alerts and the Association Portal are later phases and are not built
here.

## What's new in Phase 2

- **Scenario Simulator** — describe a passage of play (or tap a preset chip)
  and get a verdict (OUT / NOT OUT / a neutral ruling like a runs count) with
  a numbered reasoning chain, each step citing its Law. `POST /api/scenario`,
  matched against a hand-curated library in `server/data/scenarios.json` —
  deliberately not open-ended generation yet, per the Phase 2 scope.
- **Offline support** — `public/sw.js` precaches the app shell and the full
  content bundle (`GET /api/content-bundle`) at install time. When a query or
  scenario request can't reach the network, the Service Worker computes the
  same answer locally from the cached bundle and marks the response
  `offline: true`, using the *exact same* resolution code the server uses
  (see "One source of truth" below) — not a separate, potentially-drifting
  copy of the logic.
- **Report export** — every ruling (Q&A or scenario) has an "Export ruling"
  button that downloads a plain-text summary with the citation, reasoning
  steps, and a timestamp.

## Running it

```
npm install
npm start
```

Then open `http://localhost:3000`.

## Running the tests

```
npm test
```

The tests in `server/test/search.test.js` verify the one thing this product
actually depends on: that the *same question* returns a *different, correctly
sourced* answer depending on which ruleset is active, and that a playing
condition never leaks into a ruleset it isn't scoped to.

## Content policy — read before adding data

Everything in `server/data/laws.json` and `server/data/playingConditions.json`
is **original paraphrase**, not verbatim official text, written specifically
to avoid reproducing MCC's or any board's copyrighted wording. Each entry
cites the Law or clause number as a pointer to the official source — it does
not quote that source at length.

Keep it that way when adding content:
- Write the `summary` and `explanation` fields in your own words.
- Put the Law/clause number and document name in `citation`, not the official
  sentence itself.
- If you ever want to display verbatim official text (MCC Laws, ICC or board
  playing conditions), that requires an actual license from the rights
  holder first — see the licensing discussion from the product design phase.
  Nothing here should be taken as legal clearance; get real IP counsel before
  relying on this distinction for anything beyond a hobby build.

## How the scoping works

`shared/resolvers.js` filters candidate entries to Law entries (always
included) plus playing-condition entries whose `rulesetIds` include the
active ruleset, scores them by keyword overlap with the query, and boosts
playing-condition matches slightly so a specific override outranks the
general Law when both are relevant. See `server/test/search.test.js` for the
exact behavior this guarantees, and `server/test/scenario.test.js` for the
equivalent on Scenario Simulator matching.

## One source of truth: `shared/`

`shared/matching.js` and `shared/resolvers.js` are plain, dependency-free
JS written UMD-style so the exact same code runs three ways with no build
step: `require()`d by the Express server, `importScripts()`d by
`public/sw.js` inside the Service Worker, and (in principle) loadable via a
plain `<script>` tag. This is why an offline answer and an online answer for
the same question are identical — they're produced by the same function,
not two versions that can drift apart. `server/lib/search.js` and
`server/lib/scenarioSearch.js` are now thin re-exports of `shared/resolvers.js`,
kept only so existing `require('../lib/search')` paths and tests didn't need
to change.

## Verifying the offline behavior

Browser-level network simulation (`context.setOffline`, `context.route(...).abort()`)
did not reliably reach requests the Service Worker issues from its own fetch
handler in manual testing with Playwright — the "network" calls kept
succeeding regardless. Rather than rely on that, `server/test/sw-offline.test.js`
loads the real `public/sw.js` source into a sandboxed Node VM with a
genuinely-failing `fetch`, and drives its actual `fetch` event listener
directly. That's the real offline code path under test, not a rewritten
stand-in for it.

## Adding a new ruleset

1. Add an entry to `server/data/rulesets.json`.
2. Add playing-condition entries to `server/data/playingConditions.json` with
   `rulesetIds` including the new ruleset's id.
3. Add a test asserting the new ruleset returns the right answer for at least
   one question, and that it doesn't inherit another ruleset's conditions.
4. Bump `CACHE_NAME` in `public/sw.js` (e.g. `third-umpire-v2`) so returning
   users get the updated content bundle instead of a stale cached one.

## Adding a new scenario

1. Add an entry to `server/data/scenarios.json` with a `verdictType`
   (`out` / `notout` / `neutral`), a `summary`, `keywords` for matching, and a
   `steps` array — each step a `{ text, cite }` pair.
2. Add a test in `server/test/scenario.test.js` asserting a realistic
   free-text description resolves to it, and that it doesn't get matched by
   an unrelated description.

## What's deliberately not here yet

- No LLM — retrieval is keyword/metadata matching over a hand-curated
  dataset, for both Q&A and Scenario Simulator. Inspectable, testable, and
  avoids an API dependency before the content foundation is proven out.
- No accounts, no billing (this build is free), no Change Alerts, no
  Association Portal — later phases.
- Only two rulesets, eight Laws, and four curated scenarios — enough to
  prove the mechanics, not to cover a real competition.
- The offline cache is single-version and whole-bundle (no incremental
  sync) — fine at this content size, won't stay fine indefinitely.
