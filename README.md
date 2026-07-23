# Third Umpire — Phase 1 + Phase 2 + Phase 3

A free, single-competition build of the product design: pick a ruleset, ask a
question or describe a scenario, get an answer scoped and cited to that
ruleset, keep getting answers with no network connection, and stay current
through a Change Alerts digest.

- **Phase 1**: Match Mode + cited Q&A for one anchor competition.
- **Phase 2**: Scenario Simulator (curated library, not open-ended
  generation), offline support via a Service Worker, and export-to-report on
  every ruling.
- **Phase 3** (this update): Change Alerts digest, and a lightweight way for
  new content to get published into the app and immediately show up there.

The original product design paired Change Alerts with a full Association
Portal (seats, billing, per-association members) — but this build stayed
free, and a real multi-tenant accounts system was never built (see "What's
deliberately not here yet"). So Phase 3 here is scoped to what's genuinely
buildable without inventing that: a single shared content library anyone can
publish to via `/admin.html`, not per-association member management.

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

## What's new in Phase 3

- **Change Alerts** — a filterable digest (`GET /api/alerts`) covering Law
  reminders, playing-condition updates, and newly-published content, plus a
  **personal insight** ("your most-queried topic so far") computed entirely
  client-side from a query history kept in `localStorage` — no server-side
  accounts needed for that part. Read/unread state is tracked the same way.
  Works offline too, through the same Service Worker fallback pattern as
  Q&A and Scenario Simulator.
- **Content publishing** (`public/admin.html`, `POST /api/content`) — fill in
  a title, summary, explanation, citation, and keywords for a ruleset, and it
  is immediately searchable in Match Mode and appears as an "association"
  category alert in the digest. No restart needed: the running server keeps
  an in-memory copy that's mutated and persisted to disk on every publish
  (`server/lib/contentStore.js`), so a single process stays consistent
  between what's searchable and what's on disk.
- This endpoint is **deliberately unauthenticated** — anyone with the URL can
  publish to the one shared library. That's an accepted limitation of a
  no-accounts Phase 3, not an oversight; don't point it at anything but a
  demo.

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
`server/test/contentStore.test.js` and `server/test/api-http.test.js` cover
Phase 3's write path — including a test that specifically asserts the real
committed data files in `server/data/` are never touched by running the
suite (writes go through `THIRD_UMPIRE_DATA_DIR` pointed at a temp
directory). **If you manually test `POST /api/content` outside the test
suite** (e.g. running the server yourself and using `/admin.html`), set
`THIRD_UMPIRE_DATA_DIR` to a temp copy first, or it will genuinely write
into the committed JSON files — this happened once during Phase 3
development and had to be cleaned up.

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
- No accounts, no billing (this build is free), no multi-tenant Association
  Portal (seats, per-association members) — `/admin.html` is a single shared
  content library, not a stand-in for that.
- Only two rulesets, eight Laws, four curated scenarios, and two seed
  alerts — enough to prove the mechanics, not to cover a real competition.
- The offline cache is single-version and whole-bundle (no incremental
  sync) — fine at this content size, won't stay fine indefinitely.
- The static GitHub Pages build in `web/` (see below) mirrors Phase 1 + 2
  (Match Mode and Scenario Simulator) but not yet Phase 3 — Change Alerts
  could reasonably be added there (it needs no backend, same as the rest of
  that build), but content *publishing* inherently can't work on a static
  site with no server to persist to.
