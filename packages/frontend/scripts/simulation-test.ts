
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { createClient } from '@supabase/supabase-js';
import * as tlock from 'tlock-js';
import { blake2b } from 'blakejs';
import dotenv from 'dotenv';
import path from 'path';

// Load env from frontend package
dotenv.config({ path: path.join(__dirname, '../.env') });

const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID!;
const MODULE_NAME = 'minority_game';

// Drand Config
const DRAND_CHAIN_HASH = '8990e7a9aaed2ffed73dbd7092123d6f289930540d7651336225dc172e51b2ce';
const DRAND_GENESIS_TIME = 1595431050;
const DRAND_PERIOD = 30;
const POLL_DURATION = 120 * 1000; // 2 minutes

// Helpers
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function getWallets() {
    const keys = [
        process.env.TEST_WALLET_1_PRIVATE_KEY!,
        process.env.TEST_WALLET_2_PRIVATE_KEY!,
        process.env.TEST_WALLET_3_PRIVATE_KEY!,
        process.env.TEST_WALLET_4_PRIVATE_KEY!
    ];

    if (keys.some(k => !k)) throw new Error("Missing Test Wallet Keys in .env");

    return keys.map(k => {
        // Handle 'suiprivkey' prefix or raw hex/base64
        // The sdk `decodeSuiPrivateKey` handles 'suiprivkey' format
        const { decodeSuiPrivateKey } = require('@mysten/sui/cryptography');
        try {
            const { secretKey } = decodeSuiPrivateKey(k);
            return Ed25519Keypair.fromSecretKey(secretKey);
        } catch (e) {
            // fallback if raw hex/base64 (not expected based on previous steps)
            throw e;
        }
    });
}

// 1. Generate Topic via API (Simulate)
async function generateTopic(titleSuffix: string) {
    console.log(`[Generate] Requesting new topics...`);
    try {
        const res = await fetch('http://localhost:3000/api/cron/generate-topics');
        const data = await res.json();
        if (!data.success) throw new Error("API failed");
        
        // Find the latest one
        const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { data: topics } = await supabase.from('topics')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1);
            
        if (!topics || topics.length === 0) throw new Error("No topic found");
        console.log(`[Generate] Topic Created: ${topics[0].title} (ID: ${topics[0].id})`);
        return topics[0];
    } catch (e) {
        console.error("Failed to call generate-topics API. Is the dev server running?");
        throw e;
    }
}

// 2. Commit Vote (Chain + DB)
async function vote(
    wallet: Ed25519Keypair, 
    topic: any, 
    choice: string, 
    client: SuiClient
) {
    const address = wallet.getPublicKey().toSuiAddress();
    console.log(`[Vote] ${address} voting for "${choice}" on topic ${topic.id}`);

    // Encrypt
    const onChainData = await client.getObject({ id: topic.on_chain_id, options: { showContent: true } });
    // @ts-ignore
    const createdAt = Number(onChainData.data?.content?.fields?.created_at);
    const endTime = createdAt + POLL_DURATION;
    const round = Math.ceil((endTime / 1000 - DRAND_GENESIS_TIME) / DRAND_PERIOD) + 1;

    // Salt
    const saltBytes = new Uint8Array(16);
    crypto.getRandomValues(saltBytes);
    const salt = Buffer.from(saltBytes).toString('hex');

    // Tlock Encrypt
    const payload = JSON.stringify({ choice, salt });
    // Note: In real test, we need to wait for round? No, encrypt for future.
    const ciphertext = await tlock.timelockEncrypt(
        round,
        Buffer.from(payload),
        tlock.mainnetClient()
    );

    // Hash for Chain
    const choiceBytes = new TextEncoder().encode(choice);
    const saltBuffer = Buffer.from(salt, 'hex'); // Salt is hex string
    const combined = new Uint8Array(choiceBytes.length + saltBuffer.length);
    combined.set(choiceBytes);
    combined.set(saltBuffer, choiceBytes.length);
    // Move vector::append logic: append choice, then append salt.
    
    // Import blake2b dynamically or assume it's available
    const hash = blake2b(combined, undefined, 32);

    // Chain Tx
    const tx = new Transaction();
    const [coin] = tx.splitCoins(tx.gas, [100_000_000]); // 0.1 SUI
    tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::commit_vote`,
        arguments: [
            tx.object(topic.on_chain_id),
            tx.pure.vector('u8', hash),
            coin,
            tx.object('0x6')
        ]
    });

    const res = await client.signAndExecuteTransaction({
        signer: wallet,
        transaction: tx,
        options: { showEffects: true }
    });

    if (res.effects?.status.status !== 'success') {
        throw new Error(`Vote Tx Failed: ${res.effects?.status.error}`);
    }

    await client.waitForTransaction({ digest: res.digest });

    // Backup to DB (Call API)
    const backupRes = await fetch('http://localhost:3000/api/vote/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            topic_id: topic.id,
            user_address: address,
            choice: 'ENCRYPTED',
            salt: ciphertext,
            tx_digest: res.digest,
            network: 'testnet'
        })
    });
    
    if (!backupRes.ok) throw new Error("Backup API failed");
    console.log(`[Vote] Success: ${address}`);
}

// 3. Reveal (Call API)
async function triggerReveal() {
    console.log(`[Reveal] Triggering reveal API...`);
    const res = await fetch('http://localhost:3000/api/cron/reveal-votes');
    const data = await res.json();
    console.log(`[Reveal] Result:`, JSON.stringify(data, null, 2));
    return data;
}

// 4. Claim (Chain)
async function claim(wallet: Ed25519Keypair, topic: any, client: SuiClient) {
    const address = wallet.getPublicKey().toSuiAddress();
    console.log(`[Claim] ${address} attempting to claim...`);
    
    const tx = new Transaction();
    // Set gas budget for claim transaction
    tx.setGasBudget(100_000_000); // 0.1 SUI
    tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::claim_reward`,
        arguments: [tx.object(topic.on_chain_id), tx.object('0x6')]
    });

    try {
        const res = await client.signAndExecuteTransaction({
            signer: wallet,
            transaction: tx,
            options: { showEffects: true, showBalanceChanges: true }
        });
        
        await client.waitForTransaction({ digest: res.digest });

        if (res.effects?.status.status === 'success') {
             // Find balance change
             const change = res.balanceChanges?.find(b => {
                 const owner = b.owner as any;
                 return owner && typeof owner === 'object' && 'AddressOwner' in owner && owner.AddressOwner === address && Number(b.amount) > 0;
             });
             console.log(`[Claim] Success! Received ~${Number(change?.amount || 0) / 1e9} SUI`);
        } else {
            console.error(`[Claim] Failed: ${res.effects?.status.error}`);
        }
    } catch (e) {
        console.error(`[Claim] Error: ${e}`);
    }
}


async function runScenario(
    name: string, 
    votes: { walletIdx: number, choice: 'A' | 'B' }[], 
    wallets: Ed25519Keypair[],
    client: SuiClient
) {
    console.log(`\n=== Running Scenario: ${name} ===`);
    
    // 1. Generate Topic
    const topic = await generateTopic(name);
    console.log(`Topic Option A: ${topic.option_a}, Option B: ${topic.option_b}`);
    
    // 2. Vote
    for (const v of votes) {
        const choice = v.choice === 'A' ? topic.option_a : topic.option_b;
        await vote(wallets[v.walletIdx], topic, choice, client);
    }

    // 3. Wait for Poll End
    console.log(`[Wait] Waiting 2 minutes for poll to end...`);
    // Wait slightly more than 2 mins + buffer for drand round
    await sleep(130 * 1000); 

    // 4. Reveal
    await triggerReveal();
    
    // Wait for reveal txs to process
    await sleep(10000);

    // 5. Verify & Claim
    console.log(`[Verify] Checking results...`);
    // Fetch Poll Data
    const onChain = await client.getObject({ id: topic.on_chain_id, options: { showContent: true } });
    // @ts-ignore
    const fields = onChain.data?.content?.fields;
    console.log(`Votes A: ${fields.count_a}, Votes B: ${fields.count_b}`);
    console.log(`Option A: "${fields.option_a}"`);
    console.log(`Option B: "${fields.option_b}"`);
    
    // 7. Test Claim Reward
    console.log("\n7️⃣  Testing Claim Reward...")
    // We need to wait for Reveal Phase to END (CreatedAt + 180s)
    
    // Fetch actual creation time from chain to be precise
    const pollObjForTime = await client.getObject({
        id: topic.on_chain_id,
        options: { showContent: true }
    });
    // @ts-ignore
    const createdAtMs = Number(pollObjForTime.data?.content?.fields?.created_at);
    const revealEndMs = createdAtMs + 180 * 1000;
    const nowMs = Date.now();
    const claimWaitMs = revealEndMs - nowMs + 5000; // +5s buffer

    if (claimWaitMs > 0) {
        console.log(`Waiting for Reveal Phase to end (${Math.floor(claimWaitMs/1000)}s)...`)
        await new Promise(r => setTimeout(r, claimWaitMs));
    }
    
    // Attempt Claims for all voters
    for (const v of votes) {
        await claim(wallets[v.walletIdx], topic, client);
    }
}

async function main() {
    const wallets = await getWallets();
    const client = new SuiClient({ url: getFullnodeUrl('testnet') });
    
    // Scenario 1: Minority Wins
    // W1 (A) vs W2, W3 (B). A is minority. W1 wins.
    await runScenario(
        "Minority Win", 
        [
            { walletIdx: 0, choice: 'A' },
            { walletIdx: 1, choice: 'B' },
            { walletIdx: 2, choice: 'B' }
        ],
        wallets,
        client
    );

    // Scenario 2: Draw
    // W1, W2 (A) vs W3, W4 (B). Draw. All refund.
    await runScenario(
        "Draw",
        [
            { walletIdx: 0, choice: 'A' },
            { walletIdx: 1, choice: 'A' },
            { walletIdx: 2, choice: 'B' },
            { walletIdx: 3, choice: 'B' }
        ],
        wallets,
        client
    );

    // Scenario 3: No Votes
    await runScenario("No Votes", [], wallets, client);
}

main().catch(console.error);
