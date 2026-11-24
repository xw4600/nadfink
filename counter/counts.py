"""Legacy Page Views Count totals recovered from the WordPress VPS.

Keys are the original WordPress post IDs, which the static pages still carry in
their `data-element-id` attributes. These values are used both to seed the
Cloudflare D1 database and as no-JS fallbacks in the HTML.
"""

COUNTS = {
    "3": 39,       # privacy-policy
    "12": 13,      # its-dark-out / author / category archives
    "969": 15,     # 999-2
    "1011": 16,    # start
    "1014": 735,   # homepage
    "1027": 17,    # 404 / 404-2
    "1058": 41,    # bicycle
    "1063": 34,    # sitemap
    "1071": 46,    # resources
    "1099": 68,    # playa-ghostride
    "1113": 32,    # cutouts
    "1175": 33,    # raccoon
    "1183": 29,    # linux
    "1185": 46,    # volvo
    "1188": 37,    # underground
    "1221": 32,    # itsdarkout
    "1243": 13,    # antisocial-media
    "1245": 44,    # lubrican
    "1328": 17,    # 3d
    "1390": 28,    # news (kept in the site total; page excluded from export)
}

SITE_KEY = "__site__"
SITE_TOTAL = sum(COUNTS.values())

# coded by Big Pickle
