
-- Migration to add claimed_amount and claimed_digest to user_votes table

ALTER TABLE public.user_votes
ADD COLUMN IF NOT EXISTS claimed_amount numeric,
ADD COLUMN IF NOT EXISTS claimed_digest text;
