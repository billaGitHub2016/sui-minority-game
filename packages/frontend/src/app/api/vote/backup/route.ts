
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client'

export async function POST(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
      const { topic_id, user_address, choice, salt, tx_digest, network } = await request.json()
      
      // Verify Transaction on Chain to prevent spoofing
      if (tx_digest && network) {
        try {
            // Map network name to fullnode URL (localnet, devnet, testnet, mainnet)
            const url = getFullnodeUrl(network as any); 
            const client = new SuiClient({ url });
            
            let tx;
            let retryCount = 0;
            const maxRetries = 5;
            
            while (retryCount < maxRetries) {
                try {
                    tx = await client.getTransactionBlock({
                        digest: tx_digest,
                        options: {
                            showInput: true,
                            showEffects: true
                        }
                    });
                    break; // Found it
                } catch (e: any) {
                    // Check if error is "not found" related if possible, but for now retry on any error
                    // or specifically looks for "Could not find the referenced transaction"
                    console.log(`Transaction ${tx_digest} not found yet, retrying... (${retryCount + 1}/${maxRetries})`);
                    retryCount++;
                    if (retryCount === maxRetries) throw e;
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            const sender = tx?.transaction?.data.sender;
            const status = tx?.effects?.status.status;

            if (sender !== user_address) {
                 console.error(`Verification failed: sender ${sender} !== ${user_address}`);
                 return NextResponse.json({ error: 'Transaction sender mismatch' }, { status: 403 })
            }
            if (status !== 'success') {
                 return NextResponse.json({ error: 'Transaction failed on chain' }, { status: 400 })
            }
            
            // Security check passed.

        } catch (verifyError) {
            console.error("Transaction verification failed:", verifyError);
            // If we are on localnet and running in a container, localhost might not be reachable.
            // But for safety, we should enforce it.
            return NextResponse.json({ error: 'Transaction verification failed' }, { status: 400 })
        }
    } else {
         return NextResponse.json({ error: 'Missing tx_digest or network for verification' }, { status: 400 })
    }

      // Store backup securely (using Service Role to bypass RLS if needed, though user should be able to write their own)
      // We upsert based on user + topic
      const { data, error } = await supabase.from('user_votes').upsert({
          topic_id,
          user_address,
          choice,
          salt,
          tx_digest,
          status: 'committed',
          network
      }, { onConflict: 'topic_id, user_address' }).select()

      if (error) throw error

      return NextResponse.json({ success: true, data })
  } catch (e) {
      console.error("Backup failed:", e)
      return NextResponse.json({ error: 'Backup failed' }, { status: 500 })
  }
}
