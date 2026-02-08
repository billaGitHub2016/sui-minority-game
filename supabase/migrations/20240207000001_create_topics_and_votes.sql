
-- Create topics table
CREATE TABLE IF NOT EXISTS topics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  on_chain_id TEXT, -- The Object ID of the Poll on Sui
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'closed'))
);

-- Enable RLS for topics
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read active topics
CREATE POLICY "Public topics are viewable by everyone" 
ON topics FOR SELECT 
USING (true);

-- Create user_votes table for history
CREATE TABLE IF NOT EXISTS user_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  topic_id UUID REFERENCES topics(id) NOT NULL,
  choice TEXT NOT NULL,
  tx_digest TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for user_votes
ALTER TABLE user_votes ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own votes
CREATE POLICY "Users can view their own votes" 
ON user_votes FOR SELECT 
USING (auth.uid() = user_id);

-- Allow users to insert their own votes
CREATE POLICY "Users can insert their own votes" 
ON user_votes FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Grant permissions
GRANT SELECT ON topics TO anon, authenticated;
GRANT SELECT, INSERT ON user_votes TO authenticated;
