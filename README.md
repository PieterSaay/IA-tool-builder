# Third Umpire — Phase 1

A free, single-competition MVP of the Match Mode mechanic: pick a ruleset, ask a
question, get an answer scoped and cited to that ruleset specifically.

This is Phase 1 of the phased build discussed in product design: Match Mode +
cited Q&A for one anchor competition, no offline cache, content maintained by
hand. Scenario Simulator, Change Alerts, and the Association Portal are later
phases and are not built here.

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

`server/lib/search.js` filters candidate entries to Law entries (always
included) plus playing-condition entries whose `rulesetIds` include the
active ruleset, scores them by keyword overlap with the query, and boosts
playing-condition matches slightly so a specific override outranks the
general Law when both are relevant. See `server/test/search.test.js` for the
exact behavior this guarantees.

## Adding a new ruleset

1. Add an entry to `server/data/rulesets.json`.
2. Add playing-condition entries to `server/data/playingConditions.json` with
   `rulesetIds` including the new ruleset's id.
3. Add a test asserting the new ruleset returns the right answer for at least
   one question, and that it doesn't inherit another ruleset's conditions.

## What's deliberately not here yet

- No LLM — retrieval is keyword/metadata matching over a hand-curated
  dataset. That's a reasonable Phase 1 choice: it's inspectable, testable,
  and avoids an API dependency before the content foundation is proven out.
- No offline cache, no accounts, no billing (this phase is free).
- Only two rulesets and eight Laws — enough to prove the mechanic, not to
  cover a real competition.
