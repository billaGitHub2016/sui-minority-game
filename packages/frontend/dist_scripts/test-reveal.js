"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
const client_1 = require("@mysten/sui/client");
const ed25519_1 = require("@mysten/sui/keypairs/ed25519");
const transactions_1 = require("@mysten/sui/transactions");
const cryptography_1 = require("@mysten/sui/cryptography");
const tlock = __importStar(require("tlock-js"));
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
const blakejs_1 = require("blakejs");
// Load env from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID;
const MODULE_NAME = 'minority_game';
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Drand Config
const DRAND_CHAIN_HASH = "8990e7a9aaed2ffed73dbd7092123d6f289930540d7651336225dc172e51b2ce"; // Mainnet
const DRAND_GENESIS_TIME = 1595431050;
const DRAND_PERIOD = 30;
async function main() {
    var _a, _b, _c, _d, _e, _f, _g;
    if (!PACKAGE_ID || !ADMIN_SECRET_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
        console.error("❌ Missing Environment Variables. Please check .env file.");
        process.exit(1);
    }
    console.log("🚀 Starting Test Script...");
    console.log(`📦 Package ID: ${PACKAGE_ID}`);
    const supabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_KEY);
    // Use Testnet
    const client = new client_1.SuiClient({ url: (0, client_1.getFullnodeUrl)('testnet') });
    const { schema, secretKey } = (0, cryptography_1.decodeSuiPrivateKey)(ADMIN_SECRET_KEY);
    const keypair = ed25519_1.Ed25519Keypair.fromSecretKey(secretKey);
    const address = keypair.toSuiAddress();
    console.log(`👤 Testing with Address: ${address}`);
    // 1. Create a Test Topic
    console.log("\n1️⃣  Creating Test Topic in DB...");
    const { data: topic, error: topicError } = await supabase.from('topics').insert({
        title: `Test Topic ${Date.now()}`,
        description: "Automated test topic",
        option_a: "Yes",
        option_b: "No",
        status: 'pending'
    }).select().single();
    if (topicError)
        throw topicError;
    console.log(`✅ Topic Created: ${topic.id}`);
    // 2. Create Poll on Chain
    console.log("\n2️⃣  Creating Poll on Chain...");
    const tx = new transactions_1.Transaction();
    tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::create_poll`,
        arguments: [
            tx.pure.string(topic.title),
            tx.pure.string(topic.option_a),
            tx.pure.string(topic.option_b),
            tx.object('0x6')
        ]
    });
    const res = await client.signAndExecuteTransaction({
        signer: keypair,
        transaction: tx,
        options: { showObjectChanges: true, showEffects: true }
    });
    if (((_a = res.effects) === null || _a === void 0 ? void 0 : _a.status.status) !== 'success') {
        throw new Error(`Chain creation failed: ${(_b = res.effects) === null || _b === void 0 ? void 0 : _b.status.error}`);
    }
    const createdObject = (_c = res.objectChanges) === null || _c === void 0 ? void 0 : _c.find((change) => change.type === 'created' && change.objectType.includes('::minority_game::Poll'));
    if (!createdObject)
        throw new Error("Poll object not found in effects");
    const pollId = createdObject.objectId;
    console.log(`✅ Poll Created on Chain: ${pollId}`);
    // Update Topic with on_chain_id
    await supabase.from('topics').update({ on_chain_id: pollId, status: 'active' }).eq('id', topic.id);
    // 3. Commit a Vote
    console.log("\n3️⃣  Committing a Vote...");
    // Calculate Round: Current Time + 40s (to be safe > 30s period)
    const nowSec = Math.floor(Date.now() / 1000);
    // We want to be able to reveal shortly.
    // Voting Duration = 120s. Reveal Duration = 60s.
    // To test reveal, we must be in Reveal Phase: CreatedAt + 120s < Now < CreatedAt + 180s.
    // But we just created the poll. So we have to wait > 120s to reveal.
    // That's too long for a "quick" test.
    // But we can't change the contract's clock check.
    // Wait... if I am creating a new poll, I am bound by the contract's DURATION (120s).
    // So I MUST wait 2 minutes before I can reveal.
    console.log("⚠️ Contract enforces 2 minutes Voting Phase. We must wait...");
    const targetTime = nowSec + 130; // 2m 10s from now (safely into Reveal Phase)
    const round = Math.ceil((targetTime - DRAND_GENESIS_TIME) / DRAND_PERIOD) + 1;
    console.log(`⏳ Encrypting for Drand Round: ${round} (approx ${new Date(targetTime * 1000).toLocaleTimeString()})`);
    // Encrypt
    const choice = "Yes";
    const salt = Buffer.from(new Uint8Array(16)).toString('hex'); // Dummy salt for generation, but real salt is the ciphertext
    // Wait, in the updated code, we store ciphertext in 'salt' field.
    // Real encryption:
    const payload = JSON.stringify({ choice, salt });
    const ciphertext = await tlock.timelockEncrypt(round, Buffer.from(payload), tlock.mainnetClient());
    // Hash for Contract: Blake2b(choice + salt)
    // Note: The salt used here MUST be the same as inside the encrypted payload? 
    // In the frontend code: 
    // const salt = generateSalt(); 
    // payload = { choice, salt }
    // hash = blake2b(choice + salt)
    // ...
    // So yes, we need a random salt for the hash commitment.
    const choiceBytes = new TextEncoder().encode(choice);
    const saltBytes = Buffer.from(salt, 'hex');
    const combined = new Uint8Array(choiceBytes.length + saltBytes.length);
    combined.set(choiceBytes);
    combined.set(saltBytes, choiceBytes.length);
    const hash = (0, blakejs_1.blake2b)(combined, undefined, 32);
    const voteTx = new transactions_1.Transaction();
    const [coin] = voteTx.splitCoins(voteTx.gas, [100000000]); // 0.1 SUI
    voteTx.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::commit_vote`,
        arguments: [
            voteTx.object(pollId),
            voteTx.pure.vector('u8', hash),
            coin,
            voteTx.object('0x6')
        ]
    });
    const voteRes = await client.signAndExecuteTransaction({
        signer: keypair,
        transaction: voteTx,
        options: { showEffects: true }
    });
    if (((_d = voteRes.effects) === null || _d === void 0 ? void 0 : _d.status.status) !== 'success') {
        throw new Error(`Vote failed: ${(_e = voteRes.effects) === null || _e === void 0 ? void 0 : _e.status.error}`);
    }
    console.log(`✅ Vote Committed on Chain. Digest: ${voteRes.digest}`);
    // Backup to DB
    await supabase.from('user_votes').insert({
        topic_id: topic.id,
        user_address: address,
        choice: "ENCRYPTED",
        salt: ciphertext, // Storing ciphertext here
        tx_digest: voteRes.digest,
        status: 'committed',
        network: 'testnet'
    });
    console.log("✅ Vote Backed up to DB");
    // 4. Wait for Time-Lock
    console.log("\n4️⃣  Waiting for Time-Lock to expire...");
    const waitMs = (targetTime * 1000) - Date.now() + 5000; // +5s buffer
    if (waitMs > 0) {
        console.log(`Sleeping for ${Math.floor(waitMs / 1000)} seconds...`);
        await new Promise(r => setTimeout(r, waitMs));
    }
    // 5. Trigger Reveal API
    console.log("\n5️⃣  Triggering Reveal API...");
    // We can fetch localhost if running, or just execute the logic directly?
    // User asked for a script to "call this interface".
    // Assuming dev server is running at localhost:3000
    try {
        const response = await fetch('http://localhost:3000/api/cron/reveal-votes', {
            method: 'GET'
        });
        const json = await response.json();
        console.log("API Response:", JSON.stringify(json, null, 2));
    }
    catch (e) {
        console.error("⚠️ Failed to call API (Is localhost:3000 running?):", e);
        console.log("⚠️ Please manually trigger the API or check the logs.");
    }
    // 6. Verify
    console.log("\n6️⃣  Verifying...");
    // Check DB
    const { data: voteData } = await supabase.from('user_votes')
        .select('*')
        .eq('tx_digest', voteRes.digest)
        .single();
    console.log("DB Status:", voteData === null || voteData === void 0 ? void 0 : voteData.status);
    if ((voteData === null || voteData === void 0 ? void 0 : voteData.status) === 'revealed') {
        console.log("✅ DB Updated to 'revealed'");
        console.log(`   Decrypted Choice: ${voteData.choice}`);
    }
    else {
        console.error("❌ DB Status NOT updated (Check API logs)");
    }
    // Check Chain
    // We can't easily check individual vote status without an event or object field inspection.
    // But we can check if the Poll object has recorded votes.
    const pollObj = await client.getObject({
        id: pollId,
        options: { showContent: true }
    });
    if (((_g = (_f = pollObj.data) === null || _f === void 0 ? void 0 : _f.content) === null || _g === void 0 ? void 0 : _g.dataType) === 'moveObject') {
        const fields = pollObj.data.content.fields;
        console.log(`Chain Poll Counts - A: ${fields.count_a}, B: ${fields.count_b}`);
        // Since we voted "Yes" (Option A), count_a should be >= 1 if reveal worked.
        if (fields.count_a > 0) {
            console.log("✅ Chain Vote Counted!");
        }
        else {
            console.log("⚠️ Chain Vote Count NOT incremented (Reveal transaction might have failed or not processed)");
        }
    }
    // 7. Test Claim Reward
    console.log("\n7️⃣  Testing Claim Reward...");
    // We need to wait for Reveal Phase to END (CreatedAt + 180s)
    const revealEndTime = nowSec + 180 + 5; // 5s buffer
    const claimWaitMs = (revealEndTime * 1000) - Date.now();
    if (claimWaitMs > 0) {
        console.log(`Waiting for Reveal Phase to end (${Math.floor(claimWaitMs / 1000)}s)...`);
        await new Promise(r => setTimeout(r, claimWaitMs));
    }
    // Since we are the only voter (1 vs 0), Option A (1) is Majority, Option B (0) is Minority.
    // Wait, Minority Game rules:
    // "The minority wins."
    // If A=1, B=0. Minority is B.
    // So "Yes" (A) LOSES.
    // We cannot claim reward.
    console.log("🤔 Since we are the only voter, the count is 1 vs 0.");
    console.log("   Option A (Yes) = 1 (Majority)");
    console.log("   Option B (No)  = 0 (Minority)");
    console.log("   Winner is Option B.");
    console.log("   We voted Option A. So we LOST.");
    console.log("   Skipping Claim Transaction (it would fail).");
    // To test claim, we need to create a scenario where we win.
    // e.g. Vote B.
    // Or manipulate counts? No.
    // Next time, vote B (0 votes) vs A (0 votes)? Draw?
    // If draw, reward is returned.
    console.log("\n🏁 Test Complete.");
}
main().catch(console.error);
