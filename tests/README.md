# Tests

Two tests, at two different levels. Neither runs in CI yet.

## `.unit-dates.cjs` — the date maths and work order

Pure functions, no browser. It reads `app.js` and pulls the blocks it
needs out of it, so the test cannot silently drift from the code it
tests.

```
node .unit-dates.cjs
```

Covers the reversed date maths (start + finish -> working days,
weekends excluded), the days -> finish -> days round trip, and the
work-order ranking.

## `planning-autoplan.mjs` — the Auto-plan button

Drives the real UI in a headless browser: creates a project, adds tasks
in reverse order, clicks Auto-plan, and checks what the page shows.

```
node .serve.cjs &
node <browser-automation>/browser.mjs http://localhost:8123/ \
  --script tests/planning-autoplan.mjs
```

Covers sequencing, date chaining from the project start, idempotency (a
second click must not move anything) and a pinned start being honoured.

Its output is JSON with a boolean per assertion, so a `false` is a
failure. It needs the browser-automation skill's `browser.mjs`, which is
not vendored here - point the path at wherever it lives on your machine.
