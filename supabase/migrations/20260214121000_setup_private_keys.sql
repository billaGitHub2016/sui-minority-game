-- 1. Create a private schema to store secrets
CREATE SCHEMA IF NOT EXISTS private;

-- 2. Create configuration table
CREATE TABLE IF NOT EXISTS private.keys (
    key text PRIMARY KEY,
    value text NOT NULL
);

-- 3. Insert service_role_key
-- Note: In a real production environment, you might want to avoid committing this file if it contains real secrets.
-- However, since this is a dev/test setup and the key is already exposed in client generation, we include it here for automation.
INSERT INTO private.keys (key, value)
VALUES ('service_role_key', 'your_service_role_key')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 4. Revoke access from public
REVOKE ALL ON SCHEMA private FROM anon, authenticated, public;
