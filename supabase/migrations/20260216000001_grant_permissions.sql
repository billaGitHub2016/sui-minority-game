-- Grant permissions for user_votes
GRANT SELECT, INSERT, UPDATE ON "public"."user_votes" TO "anon";
GRANT SELECT, INSERT, UPDATE ON "public"."user_votes" TO "authenticated";
GRANT SELECT, INSERT, UPDATE ON "public"."user_votes" TO "service_role";

-- Ensure RLS is enabled (redundant but safe)
ALTER TABLE "public"."user_votes" ENABLE ROW LEVEL SECURITY;
