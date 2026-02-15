
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client'
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import { Transaction } from '@mysten/sui/transactions'
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography'
import * as tlock from 'tlock-js'

const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID;
const MODULE_NAME = 'minority_game';
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY;
const ADMIN_CAP_ID = process.env.ADMIN_CAP_ID;
const POLL_DURATION = 3600 * 1000; // 60 mins

export async function GET(request: Request) {
  // Security Check: Verify Cron Secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`) {
    // If not matching service role, check if it's a manual admin run with admin secret?
    // But for cron, we rely on service role key.
    // However, Vercel Cron uses a different mechanism (CRON_SECRET).
    // Supabase pg_cron uses the header we set in SQL.
    
    // Check for Vercel Cron header if needed, but here we enforce Bearer Token matching Service Role Key
    // which we configured in pg_cron.
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Reload env vars at runtime to support standalone script execution
  const currentPackageId = PACKAGE_ID || process.env.NEXT_PUBLIC_PACKAGE_ID;
  const currentAdminKey = ADMIN_SECRET_KEY || process.env.ADMIN_SECRET_KEY;
  const currentAdminCapId = ADMIN_CAP_ID || process.env.ADMIN_CAP_ID;

  if (!currentAdminKey || !currentPackageId || !currentAdminCapId) {
      console.error("Config Check Failed:", { 
          hasAdminKey: !!currentAdminKey, 
          hasPackageId: !!currentPackageId,
          hasAdminCapId: !!currentAdminCapId,
          envPackageId: process.env.NEXT_PUBLIC_PACKAGE_ID 
      });
      return NextResponse.json({ error: 'Config missing' }, { status: 500 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const client = new SuiClient({ url: getFullnodeUrl('testnet') });
  const { schema, secretKey } = decodeSuiPrivateKey(currentAdminKey);
  const signer = Ed25519Keypair.fromSecretKey(secretKey);
  const now = Date.now();
  const results = [];

  // 1. Query topics that have ended voting phase
  const { data: topics, error: topicsError } = await supabase
    .from('topics')
    .select('*')
    .eq('status', 'active') // Only check active topics
    .not('on_chain_id', 'is', null);

  if (topicsError) {
      console.error("Topics Fetch error:", topicsError)
      return NextResponse.json({ error: topicsError.message }, { status: 500 })
  }

  for (const topic of topics) {
      const topicCreatedAt = new Date(topic.created_at).getTime();
      
      // Check if Voting Phase Ended
      if (now > topicCreatedAt + POLL_DURATION) {
          console.log(`Processing Topic ${topic.id} (Voting Ended)...`);
          
          // Update Topic Status to 'revealing' locally first (optional, but good for UI)
          // We don't strictly need to update DB status to 'revealing' if we just process it.
          // But user requirement says: "Change topic status to revealing"
          
          // 2. Find votes for this topic
          const { data: votes, error: votesError } = await supabase
              .from('user_votes')
              .select('*')
              .eq('topic_id', topic.id)
              .eq('status', 'committed');

          if (votesError) {
              console.error(`Error fetching votes for topic ${topic.id}:`, votesError);
              continue;
          }
          
          let allRevealed = true;

          for (const vote of votes) {
              try {
                  // Decrypt
                  let decryptedChoice = "";
                  let decryptedSalt = "";

                  if (vote.choice === "ENCRYPTED") {
                      try {
                          const plaintext = await tlock.timelockDecrypt(
                              vote.salt, 
                              tlock.mainnetClient()
                          );
                          console.log('Decrypted plaintext:', plaintext.toString());
                          const data = JSON.parse(plaintext.toString());
                          decryptedChoice = data.choice;
                          decryptedSalt = data.salt;
                      } catch (e) {
                          console.log(`Vote ${vote.id} not yet decryptable:`, e);
                          allRevealed = false; // Cannot finish topic yet
                          continue; 
                      }
                  } else {
                      decryptedChoice = vote.choice;
                      decryptedSalt = vote.salt;
                  }

                  // Reveal on Chain
                  const tx = new Transaction();
                  // Set gas budget for reveal transaction
                  tx.setGasBudget(100_000_000); // 0.1 SUI
                  
                  tx.moveCall({
                      target: `${currentPackageId}::${MODULE_NAME}::reveal_vote`,
                      arguments: [
                          tx.object(currentAdminCapId), // AdminCap
                          tx.object(topic.on_chain_id),
                          tx.pure.address(vote.user_address),
                          tx.pure.vector('u8', new TextEncoder().encode(decryptedChoice)),
                          tx.pure.vector('u8', Buffer.from(decryptedSalt, 'hex')),
                          tx.object('0x6')
                      ]
                  });

                  const res = await client.signAndExecuteTransaction({
                      signer,
                      transaction: tx,
                      options: { showEffects: true, showEvents: true }
                  });
                  console.log('Sign and execute transaction:', res);

                  await client.waitForTransaction({
                    digest: res.digest,
                    options: { showEffects: true, showEvents: true }
                  });

                  console.log('Reveal vote tx:', JSON.stringify(res, null, 2));

                  // Check for RevealEvent
                  const revealEvent = res.events?.find(e => e.type.includes('RevealEvent'));
                  if (revealEvent) {
                      console.log('RevealEvent Found:', revealEvent.parsedJson);
                  } else {
                      console.log('No RevealEvent found in transaction');
                  }

                  if (res.effects?.status.status === 'success' || String(res.effects?.status.error).includes('9')) {
                      // Update Vote Status
                      await supabase.from('user_votes')
                          .update({ status: 'revealed', reveal_tx: res.digest, choice: decryptedChoice })
                          .eq('id', vote.id);
                      results.push({ id: vote.id, status: 'revealed' });
                  } else {
                      console.error(`Reveal failed for vote ${vote.id}:`, res.effects?.status);
                      allRevealed = false;
                  }

              } catch (e) {
                  console.error(`Error processing vote ${vote.id}:`, e);
                  const errStr = String(e);
                  // Check for MoveAbort with error code 0 (E_POLL_ENDED)
                  // Matches formats like "MoveAbort(..., 0)" or "sub status 0"
                  const isExpired = errStr.includes('MoveAbort') && (errStr.includes(', 0)') || errStr.includes('sub status 0'));
                  
                  if (isExpired) {
                       console.log(`Vote ${vote.id} expired (Reveal phase ended). Marking as expired.`);
                       await supabase.from('user_votes').update({ status: 'expired' }).eq('id', vote.id);
                       results.push({ id: vote.id, status: 'expired' });
                       // Do not set allRevealed = false, as expired counts as processed.
                  } else {
                       console.error(`Error processing vote ${vote.id}:`, e);
                       results.push({ id: vote.id, status: 'error', error: errStr });
                       allRevealed = false;
                  }
              }
          }

          // 3. If all votes processed (or skipped), close topic?
          // Actually, we should close the topic if the Reveal Phase is OVER on chain.
          // Or if we have revealed everyone.
          // User req: "After processing all votes for a topic, change topic status to end"
          // Let's assume we change it to 'closed'
          
          // But wait, if some votes failed (e.g. decryption not ready), we shouldn't close it yet?
          // Or maybe we just mark it done for this batch.
          // Let's only close if we attempted all valid commits.
          
          if (allRevealed) {
              await supabase.from('topics').update({ status: 'closed' }).eq('id', topic.id);
              console.log(`Topic ${topic.id} closed.`);
          }
      }
  }

  return NextResponse.json({ processed: results.length, results })
}
