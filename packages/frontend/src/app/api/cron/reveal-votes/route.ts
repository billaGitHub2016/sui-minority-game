
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
const POLL_DURATION = 120 * 1000; // 2 mins

export async function GET() {
  if (!ADMIN_SECRET_KEY || !PACKAGE_ID) {
      return NextResponse.json({ error: 'Config missing' }, { status: 500 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: backups, error } = await supabase
    .from('vote_backups')
    .select(`
        *,
        topics!inner (
            created_at,
            on_chain_id
        )
    `)
    .eq('status', 'committed')
    .not('topics.on_chain_id', 'is', null)

  if (error) {
      console.error("Fetch error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const client = new SuiClient({ url: getFullnodeUrl('testnet') });
  const { schema, secretKey } = decodeSuiPrivateKey(ADMIN_SECRET_KEY);
  const signer = Ed25519Keypair.fromSecretKey(secretKey);
  const now = Date.now();
  const results = [];

  for (const backup of backups) {
      const topicCreatedAt = new Date(backup.topics.created_at).getTime();
      
      // Check if Voting Phase Ended (Reveal Phase Open)
      if (now > topicCreatedAt + POLL_DURATION) {
          try {
              console.log(`Processing backup ${backup.id}...`);
              
              // 1. Decrypt Time-Locked Data
              // `salt` field contains the Ciphertext (hacky but convenient)
              // `choice` is "ENCRYPTED"
              
              let decryptedChoice = "";
              let decryptedSalt = "";
              
              if (backup.choice === "ENCRYPTED") {
                  try {
                      // Attempt decrypt
                      const plaintext = await tlock.timelockDecrypt(
                          backup.salt, // ciphertext
                          tlock.mainnetClient()
                      );
                      const data = JSON.parse(plaintext.toString());
                      decryptedChoice = data.choice;
                      decryptedSalt = data.salt;
                      console.log(`Decrypted: ${decryptedChoice}`);
                  } catch (e) {
                      console.log("Not yet decryptable (time not reached):", e);
                      // Skip this backup if time not reached (Drand round not yet published)
                      continue;
                  }
              } else {
                  // Legacy plaintext fallback
                  decryptedChoice = backup.choice;
                  decryptedSalt = backup.salt;
              }

              // 2. Submit Reveal Transaction
              const tx = new Transaction();
              tx.moveCall({
                  target: `${PACKAGE_ID}::${MODULE_NAME}::reveal_vote`,
                  arguments: [
                      tx.object(backup.topics.on_chain_id),
                      tx.pure.vector('u8', Buffer.from(decryptedChoice, 'utf8')),
                      tx.pure.vector('u8', Buffer.from(decryptedSalt, 'hex')),
                      tx.object('0x6')
                  ]
              });

              const res = await client.signAndExecuteTransaction({
                  signer,
                  transaction: tx,
                  options: { showEffects: true }
              });

              if (res.effects?.status.status === 'success') {
                  // Update DB with Revealed Status
                  await supabase.from('vote_backups')
                      .update({ status: 'revealed', reveal_tx: res.digest, choice: decryptedChoice }) // Update choice to plaintext
                      .eq('id', backup.id);
                  results.push({ id: backup.id, status: 'success', digest: res.digest });
              } else {
                  console.error("Reveal failed on-chain:", res.effects?.status);
                  // If "Already Revealed" error (E_ALREADY_REVEALED = 9), mark as revealed
                  if (String(res.effects?.status.error).includes('9')) {
                       await supabase.from('vote_backups')
                          .update({ status: 'revealed', reveal_tx: res.digest })
                          .eq('id', backup.id);
                  }
                  results.push({ id: backup.id, status: 'failed', error: res.effects?.status.error });
              }
          } catch (e) {
              console.error("Exec failed:", e);
              results.push({ id: backup.id, status: 'error', msg: String(e) });
          }
      }
  }

  return NextResponse.json({ processed: results.length, results })
}
