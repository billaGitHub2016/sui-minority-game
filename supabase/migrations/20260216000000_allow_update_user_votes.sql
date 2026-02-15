-- Enable UPDATE for user_votes to allow users to claim rewards
-- Note: In a production app, this should be handled by a backend service or Edge Function
-- to verify the transaction on-chain before updating the database.
-- For this template/demo, we allow client-side updates.

DROP POLICY IF EXISTS "Enable update for all users" ON "public"."user_votes";

CREATE POLICY "Enable update for all users" ON "public"."user_votes"
FOR UPDATE 
USING (true) 
WITH CHECK (true);
