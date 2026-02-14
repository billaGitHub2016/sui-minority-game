
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client'
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import { Transaction } from '@mysten/sui/transactions'
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography'

const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID;
const MODULE_NAME = 'minority_game';
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  
  // 1. Generate Topics
  let generatedTopics = [];

  if (!process.env.OPENAI_API_KEY) {
    // Fallback
    generatedTopics = [
      { title: "Sweet vs Salty Tofu Pudding", option_a: "Sweet", option_b: "Salty", description: "The eternal battle of flavors." },
      { title: "Cats vs Dogs", option_a: "Cats", option_b: "Dogs", description: "Which furry friend is better?" },
      { title: "Coffee vs Tea", option_a: "Coffee", option_b: "Tea", description: "Morning fuel choice." }
    ]
  } else {
    try {
        const openai = new OpenAI({ 
            apiKey: process.env.OPENAI_API_KEY,
            baseURL: process.env.OPENAI_BASE_URL
        })
        const { data: recentTopics } = await supabase.from('topics').select('title').order('created_at', { ascending: false }).limit(50)
        const existingTitles = recentTopics?.map(t => t.title).join('\n') || ''

        const completion = await openai.chat.completions.create({
          model: "deepseek-v3-aliyun",
          messages: [
            { role: "system", content: "You are a creative game master for a 'Minority Game' where players vote on binary choices. The minority side wins. Generate 4 interesting, controversial, or fun binary choice topics suitable for a global audience. Ensure the topics are diverse and cover different categories such as Technology, Philosophy, Pop Culture, Daily Habits, or Social Dilemmas. Avoid repeating themes. Output as JSON object with a key 'topics' containing an array of objects: { title, option_a, option_b, description }." },
            { role: "user", content: `Generate 4 new topics. Do not repeat these recent topics:\n${existingTitles}` }
          ],
          response_format: { type: "json_object" }
        });
        console.log('completion = ', completion)
        console.log('completion.choices[0].message.content = ', completion.choices[0].message.content)

        const content = completion.choices[0].message.content;
        if (!content) throw new Error("No content from OpenAI");
        // Sanitize content to remove markdown code blocks if present
        const jsonContent = content.replace(/```json\n|\n```/g, '').trim();
        const result = JSON.parse(jsonContent);
        if (Array.isArray(result.topics)) {
            generatedTopics = result.topics;
        }
    } catch (e) {
        console.error("OpenAI Error:", e);
        return NextResponse.json({ error: 'Failed to generate topics' }, { status: 500 })
    }
  }

  // 2. Process Topics (Deploy to Chain if key exists, then save to DB)
  const results = [];
  
  // Initialize Sui Client if Admin Key is present
  let client: SuiClient | null = null;
  let signer: Ed25519Keypair | null = null;

  if (ADMIN_SECRET_KEY && PACKAGE_ID) {
      try {
          client = new SuiClient({ url: getFullnodeUrl('testnet') });
          const { schema, secretKey } = decodeSuiPrivateKey(ADMIN_SECRET_KEY);
          if (schema !== 'ED25519') throw new Error("Only ED25519 keys supported for now");
          signer = Ed25519Keypair.fromSecretKey(secretKey);
      } catch (e) {
          console.error("Failed to init Sui Client/Signer:", e);
      }
  }

  for (const topic of generatedTopics) {
     let onChainId = null;
     let status = 'draft'; // Default to draft if not on chain

     if (client && signer && PACKAGE_ID) {
         try {
             const tx = new Transaction();
             tx.moveCall({
                 target: `${PACKAGE_ID}::${MODULE_NAME}::create_poll`,
                 arguments: [
                     tx.pure.string(topic.title),
                     tx.pure.string(topic.option_a),
                     tx.pure.string(topic.option_b),
                     tx.object('0x6') // Clock
                 ]
             });

             const res = await client.signAndExecuteTransaction({
                 signer,
                 transaction: tx,
                 options: {
                     showObjectChanges: true,
                     showEffects: true
                 }
             });

             await client.waitForTransaction({
                digest: res.digest
             });

             if (res.effects?.status.status === 'success') {
                 const createdObject = res.objectChanges?.find(
                     (change) => change.type === 'created' && change.objectType.includes(`${MODULE_NAME}::Poll`)
                 );
                 if (createdObject && 'objectId' in createdObject) {
                     onChainId = createdObject.objectId;
                     status = 'active';
                 }
             } else {
                 console.error("Tx Failed:", res.effects?.status.error);
             }
         } catch (e) {
             console.error("Failed to create poll on chain:", e);
         }
     }

     // Save to DB
     const { data, error } = await supabase.from('topics').insert({
         title: topic.title,
         option_a: topic.option_a,
         option_b: topic.option_b,
         description: topic.description,
         status: status,
         on_chain_id: onChainId
     }).select();

     console.log('Inserted Topic data = ', data);
     console.log('error = ', error)
     debugger
     
     if (!error && data) results.push(data[0]);
  }

  return NextResponse.json({ success: true, topics: results, onChain: !!(client && signer) })
}
