-- Create a view for the leaderboard to aggregate claimed rewards
CREATE OR REPLACE VIEW "public"."leaderboard" AS
SELECT
    user_address,
    SUM(COALESCE(claimed_amount, 0)) as total_rewards
FROM
    "public"."user_votes"
WHERE
    status = 'claimed'
GROUP BY
    user_address
ORDER BY
    total_rewards DESC
LIMIT 30;

-- Grant permissions to access the view
GRANT SELECT ON "public"."leaderboard" TO "anon";
GRANT SELECT ON "public"."leaderboard" TO "authenticated";
GRANT SELECT ON "public"."leaderboard" TO "service_role";
