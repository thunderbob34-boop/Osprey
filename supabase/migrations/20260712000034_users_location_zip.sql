-- 034_users_location_zip.sql
-- Feeds the tune-up race search deep link (see
-- docs/superpowers/specs/2026-07-12-tuneup-races-design.md). A US zip code,
-- not free-text city/state — RunSignup's search radius filter
-- (zipcodeRadius query param, verified live during planning) needs a zip
-- specifically. No table-level grant needed: users already has UPDATE for
-- authenticated (confirmed via role_table_grants during planning), and a
-- new column is automatically covered by the existing table-level grant.
ALTER TABLE users ADD COLUMN location_zip text;
