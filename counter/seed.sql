-- Seed legacy WordPress page-view counts.
-- INSERT OR IGNORE keeps already-collected Cloudflare counts intact on re-run.
INSERT OR IGNORE INTO page_views (key, count) VALUES
('3', 39),
('12', 13),
('969', 15),
('1011', 16),
('1014', 735),
('1027', 17),
('1058', 41),
('1063', 34),
('1071', 46),
('1099', 68),
('1113', 32),
('1175', 33),
('1183', 29),
('1185', 46),
('1188', 37),
('1221', 32),
('1243', 13),
('1245', 44),
('1328', 17),
('1390', 28),
('__site__', 1335);

-- coded by Big Pickle
