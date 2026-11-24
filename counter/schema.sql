-- Counter storage for nadfink.com (Cloudflare D1).
CREATE TABLE IF NOT EXISTS page_views (
    key   TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0
);

-- coded by Big Pickle
