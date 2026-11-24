# nadfink.com page counter

A tiny Cloudflare Worker + D1 database replaces the old WordPress
**Page Views Count** plugin. It keeps the recovered WordPress totals, counts
one view per page load, and also maintains a site-wide total.

No ads, no third-party analytics script, and no API key exposed in the browser.

## What is here

- `worker.js` — the Worker. `GET /hit?key=<id>` increments and returns a count;
  `GET /get?key=<id>` reads without incrementing. Bots and prefetch requests are
  treated as read-only.
- `schema.sql` / `seed.sql` — one-table D1 schema and the recovered WordPress
  totals. `seed.sql` uses `INSERT OR IGNORE`, so re-running it will not reset
  counts that have already been collected.
- `counts.py` — the same totals as a Python dict, used by
  `tools/install_counter.py` to write no-JS fallback numbers into the HTML and
  by `prepare_site.py` on every rebuild.
- `wrangler.toml` — Worker config. You must fill in the D1 `database_id`.

## One-time deploy

Requires Node.js **22.12.0 or newer** and a Cloudflare account (the free tier
is plenty). On this machine Node 22 is installed through nvm and symlinked into
`~/.local/bin`, so `node`, `npm` and `npx` already resolve to it.

```bash
cd counter
npx wrangler login
npx wrangler d1 create nadfink-counter
```

Wrangler prints a `database_id`. Paste it into `wrangler.toml`, then create and
seed the table:

```bash
npx wrangler d1 execute nadfink-counter --remote --file=schema.sql
npx wrangler d1 execute nadfink-counter --remote --file=seed.sql
npx wrangler deploy
```

For this site the Worker is named `nadfink-page-counter` and the account's
`workers.dev` subdomain is `nadfink-page-counter`, so the deployed URL is:

```text
https://nadfink-page-counter.nadfink-page-counter.workers.dev
```

That URL is already configured in `../assets/counter-config.js`. If you deploy
to a different account or name, put the URL Wrangler prints there instead:

```js
window.NADFINK_COUNTER = {
  endpoint: "https://nadfink-counter.example.workers.dev",
  siteSeed: 1335,
};
```

Then commit and push. GitHub Pages publishes `assets/counter.js`,
`assets/counter.css` and `assets/counter-config.js` automatically because
`tools/prepare_site.py` copies them into the built site and rewires all 22
counter widgets.

## Optional: custom domain

If you would rather use `counter.nadfink.com` than the `workers.dev` URL, add a
CNAME record pointing to your Worker's `workers.dev` hostname in Cloudflare,
then add a custom domain to the Worker (or a zone route). Set `endpoint` to
`https://counter.nadfink.com` in `assets/counter-config.js`.

## Verify

```bash
curl "https://YOUR-WORKER/get?key=1014"   # homepage, should report 735 initially
curl "https://YOUR-WORKER/hit?key=1014"   # increments to 736 and returns total
curl "https://YOUR-WORKER/health"         # {"ok":true}
```

Then load <https://nadfink.com/> and check that the bar-chart counter shows a
number instead of the old loading spinner, and that "Site views" appears in the
footer.

## Behaviour notes

- Each browser tab counts a given page once per visit (`sessionStorage`), so a
  refresh in the same tab does not inflate the number.
- Search-engine bots, link-preview fetchers and `Purpose: prefetch` requests
  are read-only.
- If the Worker is unreachable, each widget keeps its last known / seeded
  number rather than showing an error.
- Keys are the original WordPress post IDs (for example `1014` is the
  homepage). They are already present in the HTML as `data-element-id` and
  `data-counter-key`, so the seed data maps directly onto the old counts.

written by Big Pickle
