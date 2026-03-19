-- ==========================================
-- BACKUP SUBSCRIPTION DATA BEFORE MIGRATION
-- ==========================================
-- This migration creates backup tables for both subscription systems
-- before we make any changes to ensure data safety during migration.

-- Backup current subscription data before changes
CREATE TABLE IF NOT EXISTS subscriptions_backup AS
SELECT * FROM subscriptions;

CREATE TABLE IF NOT EXISTS user_subscriptions_backup AS
SELECT * FROM user_subscriptions;

-- Analyze current data to understand migration needs
SELECT
  'subscriptions' as table_name,
  COUNT(*) as total_rows,
  COUNT(CASE WHEN tier = 'pro' THEN 1 END) as pro_users,
  COUNT(CASE WHEN tier = 'free' THEN 1 END) as free_users
FROM subscriptions
UNION ALL
SELECT
  'user_subscriptions' as table_name,
  COUNT(*) as total_rows,
  COUNT(CASE WHEN status = 'active' THEN 1 END) as active_subs,
  0 as free_users
FROM user_subscriptions;

-- Add comments to backup tables for clarity
COMMENT ON TABLE subscriptions_backup IS 'Backup of subscriptions table before migration on 2026-03-20';
COMMENT ON TABLE user_subscriptions_backup IS 'Backup of user_subscriptions table before migration on 2026-03-20';