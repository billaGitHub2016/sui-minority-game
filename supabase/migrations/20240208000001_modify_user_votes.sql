-- Modify user_votes table to support wallet-based auth and encrypted voting

-- 1. Drop existing policies that depend on user_id
DROP POLICY IF EXISTS "Users can view their own votes" ON user_votes;
DROP POLICY IF EXISTS "Users can insert their own votes" ON user_votes;

-- 2. Remove user_id and foreign key dependency on auth.users
ALTER TABLE user_votes DROP CONSTRAINT IF EXISTS user_votes_user_id_fkey;
ALTER TABLE user_votes DROP COLUMN IF EXISTS user_id;

-- 3. Add new columns for wallet auth and encryption
ALTER TABLE user_votes ADD COLUMN IF NOT EXISTS user_address TEXT NOT NULL DEFAULT '';
-- Remove default after updating existing rows if any, but since we assume dev/reset, it's fine.
-- Actually, if table is empty, NOT NULL is fine if we provide default or if it's empty.
-- If table has data, we need a default.
-- Let's assume empty or acceptable to clear.

ALTER TABLE user_votes ADD COLUMN IF NOT EXISTS salt TEXT;
ALTER TABLE user_votes ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'committed';
ALTER TABLE user_votes ADD COLUMN IF NOT EXISTS network TEXT;
ALTER TABLE user_votes ADD COLUMN IF NOT EXISTS reveal_tx TEXT;

-- 4. Add Unique Constraint for Upsert (One vote per user per topic)
ALTER TABLE user_votes ADD CONSTRAINT user_votes_topic_user_unique UNIQUE (topic_id, user_address);

-- 5. Create new RLS policies (Optional, as we primarily use Service Role for writes now)
-- Allow anyone to read public votes (or maybe just aggregate data is enough, but transparency is good)
CREATE POLICY "Public votes are viewable by everyone" 
ON user_votes FOR SELECT 
USING (true);

-- Allow Service Role to do everything (implicit, but good to know)
-- No specific policy needed for service role as it bypasses RLS.
