# nadfink.com — static site

Static export of the WordPress site at <https://nadfink.com>, generated with
Simply Static 3.8.25 and prepared for GitHub Pages.

- **Staging URL:** <https://xw4600.github.io/nadfink/>
- **Production URL (after DNS cutover):** <https://nadfink.com/>

## What is in this repository

The repository root is the published site. It contains the unmodified output
of Simply Static apart from a small, repeatable post-processing step:

- root-relative URLs from the export are prefixed with `/nadfink` so the site
  works at the staging project path;
- `.nojekyll` disables Jekyll processing;
- `404.html` is copied from the exported `404-2/index.html`;
- a stub at `nadfink.com/linux/` preserves the live site's 301 to `/linux/`.

`/news/` was deliberately excluded from the export. The old page depended on
server-side RSS fetching and cannot work on GitHub Pages.

Dynamic widgets — page-view counters, comments, the search box, the contact
form, `/feed/`, `/comments/feed/`, `wp-json/`, `xmlrpc.php`, and
`admin-ajax.php` — are **intentionally left broken** in this export. They will
be reworked separately.

The raw Simply Static export ZIP is kept on the `export-archive` branch so the
site can be regenerated without another WordPress export.

## Rebuilding

From a checkout of this repository, fetch the raw export and run:

```bash
git fetch origin export-archive
git checkout origin/export-archive -- nadfink-export.zip
unzip -q -o nadfink-export.zip -d /tmp/nadfink-export
python3 tools/prepare_site.py --source /tmp/nadfink-export \
  --output /tmp/nadfink-site --base /nadfink
```

Copy the contents of `/tmp/nadfink-site` into this repository root when
publishing a staging update. **Do not commit `CNAME` while staging at the
`github.io` project path.**

## Cutover to nadfink.com

1. Re-run the preparation with no base path and a CNAME:

   ```bash
   python3 tools/prepare_site.py --source /tmp/nadfink-export \
     --output /tmp/nadfink-site --base "" --cname nadfink.com
   ```

   Publish those files, replacing the staged `/nadfink`-prefixed output.

2. In GitHub → Settings → Pages, set the custom domain to `nadfink.com`.
3. Update DNS:

   - apex `nadfink.com` A records → `185.199.108.153`, `185.199.109.153`,
     `185.199.110.153`, `185.199.111.153`
   - **remove** the apex AAAA record (GitHub Pages custom domains are IPv4-only)
   - `www.nadfink.com` CNAME → `xw4600.github.io`

4. Leave `mail.nadfink.com` A/AAAA and the `MX 10 mail.nadfink.com` record
   untouched. Mail remains on the Linode server.

DNS is intentionally not changed until the staged site has been reviewed.

written by Big Pickle
