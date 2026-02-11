
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient, useSuiClientContext } from '@mysten/dapp-kit'
import { Button, Card, Flex, Text, Badge, Heading, Grid, Box } from '@radix-ui/themes'
import { Transaction } from '@mysten/sui/transactions'
import { isValidSuiObjectId } from '@mysten/sui/utils'
import * as tlock from 'tlock-js'

const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID || '0x1aff31d8692f6e87404624eafbcd574eaac0c4752890b49e017d02a9e58101f7';
const MODULE_NAME = 'minority_game';
const STAKE_AMOUNT = 100_000_000; // 0.1 SUI
const POLL_DURATION = 120 * 1000; // 2 minutes
const REVEAL_DURATION = 60 * 1000; // 1 minute

// Drand Mainnet Chain Hash
const DRAND_CHAIN_HASH = "8990e7a9aaed2ffed73dbd7092123d6f289930540d7651336225dc172e51b2ce";
// Drand Mainnet Genesis (Time of round 1)
const DRAND_GENESIS_TIME = 1595431050; // seconds
const DRAND_PERIOD = 30; // seconds

export default function MinorityGame() {
  const supabase = createClient()
  const account = useCurrentAccount()
  const client = useSuiClient()
  const ctx = useSuiClientContext()
  const { mutate: signAndExecute } = useSignAndExecuteTransaction()
  const [topics, setTopics] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [pollData, setPollData] = useState<Record<string, any>>({})
  const [currentTime, setCurrentTime] = useState(Date.now())

  useEffect(() => {
    fetchTopics()
    const interval = setInterval(() => {
        fetchTopics()
        setCurrentTime(Date.now())
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    topics.forEach(async (topic) => {
      if (topic.on_chain_id && isValidSuiObjectId(topic.on_chain_id)) {
        try {
          const obj = await client.getObject({
            id: topic.on_chain_id,
            options: { showContent: true }
          })
          if (obj.data?.content?.dataType === 'moveObject') {
            setPollData(prev => ({
              ...prev,
              [topic.id]: obj.data.content.fields
            }))
          }
        } catch (e) {
          console.error("Failed to fetch poll data", e)
        }
      }
    })
  }, [topics, client])

  const fetchTopics = async () => {
    const { data } = await supabase.from('topics').select('*').order('created_at', { ascending: false })
    setTopics(data || [])
    setLoading(false)
  }

  const createPollOnChain = async (topic: any) => {
    if (!account) return alert('Connect wallet first')
    const tx = new Transaction()
    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAME}::create_poll`,
      arguments: [
        tx.pure.string(topic.title),
        tx.pure.string(topic.option_a),
        tx.pure.string(topic.option_b),
        tx.object('0x6')
      ]
    })

    signAndExecute({
      transaction: tx,
    }, {
      onSuccess: async (result) => {
        alert('Poll created! Waiting for confirmation...')
        try {
            const tx = await client.waitForTransaction({
                digest: result.digest,
                options: { showObjectChanges: true }
            });
            const createdObject = tx.objectChanges?.find(
              (change) => change.type === 'created' && change.objectType.includes('::minority_game::Poll')
            );
            if (createdObject && 'objectId' in createdObject) {
                await supabase.from('topics').update({ on_chain_id: createdObject.objectId, status: 'active' }).eq('id', topic.id)
                fetchTopics()
                alert('Poll activated successfully!')
            }
        } catch (e) {
            console.error("Error waiting for transaction:", e);
        }
      },
      onError: (err) => {
        console.error(err)
        alert('Failed to create poll.')
      }
    })
  }

  // Generate random salt
  const generateSalt = () => {
      const array = new Uint8Array(16);
      window.crypto.getRandomValues(array);
      return Buffer.from(array).toString('hex');
  }

  const commitVote = async (topic: any, choice: string) => {
     if (!topic.on_chain_id) return alert('Poll not active on chain')
     if (!account) return alert('Connect wallet first')
     
     // 1. Calculate Voting End Time
     // We need on-chain creation time to be accurate.
     const onChainData = pollData[topic.id];
     if (!onChainData) return alert("Loading chain data...");
     
     const createdAt = Number(onChainData.created_at);
     const endTime = createdAt + POLL_DURATION;
     
     // Calculate Drand Round for End Time
     // round = (time - genesis) / period + 1
     // Add buffer (e.g. + 1 round) to ensure key is available AFTER end time.
     const round = Math.ceil((endTime / 1000 - DRAND_GENESIS_TIME) / DRAND_PERIOD) + 1;
     
     console.log(`Encrypting for Drand Round: ${round} (approx ${new Date(endTime).toLocaleTimeString()})`);

     const salt = generateSalt();
     
     // 2. Encrypt (Choice + Salt) using tlock
     const payload = JSON.stringify({ choice, salt });
     let ciphertext = "";
     
     try {
         // Using tlock to encrypt for the future round
         const client = await tlock.timelockEncrypt(
             round,
             Buffer.from(payload),
             tlock.mainnetClient() // Uses mainnet by default
         );
         ciphertext = client; // tlock returns base64 encoded ciphertext string? No, it returns a string usually.
         // Let's check type. tlock.timelockEncrypt returns Promise<string> (age header + ciphertext).
     } catch (e) {
         console.error("Encryption failed:", e);
         return alert("Encryption failed. Please try again.");
     }

     // 3. Compute Commitment Hash for Contract
     // Hash = Blake2b(Choice + Salt)
     // Must match contract logic
     const choiceBytes = new TextEncoder().encode(choice);
     const saltBytes = Buffer.from(salt, 'hex');
     // IMPORTANT: We need blakejs to match Move's blake2b256
     // Move: vector::append(choice, salt); blake2b256(data)
     const combined = new Uint8Array(choiceBytes.length + saltBytes.length);
     combined.set(choiceBytes);
     combined.set(saltBytes, choiceBytes.length);
     
     // Import blake2b dynamically or assume it's available
     const { blake2b } = require('blakejs'); 
     const hash = blake2b(combined, undefined, 32);
     
     const tx = new Transaction()
     const [coin] = tx.splitCoins(tx.gas, [STAKE_AMOUNT]);
     
     tx.moveCall({
         target: `${PACKAGE_ID}::${MODULE_NAME}::commit_vote`,
         arguments: [
             tx.object(topic.on_chain_id),
             tx.pure.vector('u8', hash),
             coin,
             tx.object('0x6')
         ]
     })

     signAndExecute({
         transaction: tx
     }, {
         onSuccess: async (result) => {
             alert('Transaction submitted! Waiting for confirmation on chain...');
             try {
                 // Wait for transaction to be finalized
                 await client.waitForTransaction({
                     digest: result.digest
                 });

                 // 4. Backup ENCRYPTED Vote to Server
                await fetch('/api/vote/backup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        topic_id: topic.id,
                        user_address: account.address,
                        choice: "ENCRYPTED", // Hide choice
                        salt: ciphertext, // Store ciphertext in salt field (hacky but works for MVP)
                        tx_digest: result.digest,
                        network: ctx.network,
                    })
                });
                
                alert(`Vote Encrypted & Committed! It will be automatically decrypted and revealed after voting ends.`)
                fetchTopics()
             } catch (e) {
                 console.error("Error waiting for transaction:", e);
                 alert("Transaction submitted but verification failed. Please check explorer.");
             }
         },
         onError: (err) => {
             console.error(err)
             alert('Vote failed')
         }
     })
  }

  const claimReward = async (topic: any) => {
    if (!topic.on_chain_id) return
    if (!account) return alert('Connect wallet first')

    const tx = new Transaction()
    tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE_NAME}::claim_reward`,
        arguments: [
            tx.object(topic.on_chain_id),
            tx.object('0x6')
        ]
    })

    signAndExecute({
        transaction: tx
    }, {
        onSuccess: async () => {
            alert('Reward claimed!')
            fetchTopics()
        },
        onError: (err) => {
            console.error(err)
            alert('Failed to claim. Ensure reveal phase is over and you won.')
        }
    })
  }

  const generateTopics = async () => {
      const res = await fetch('/api/cron/generate-topics')
      const data = await res.json()
      if (data.success) {
          alert('Topics generated!')
          fetchTopics()
      } else {
          alert('Failed to generate topics')
      }
  }

  if (loading) return <Text>Loading...</Text>

  return (
    <Flex direction="column" gap="4" width="100%">
      <Flex justify="between" align="center">
        <Heading>Active Topics</Heading>
        <Button onClick={generateTopics} variant="outline">Generate New Topics (AI)</Button>
      </Flex>
      
      <Grid columns={{ initial: '1', md: '2' }} gap="4">
        {topics.map(topic => {
           const onChainData = pollData[topic.id]
           const createdAt = onChainData?.created_at ? Number(onChainData.created_at) : null;
           
           let status = 'draft';
           let timeRemaining = 0;
           
           if (createdAt) {
               if (currentTime < createdAt + POLL_DURATION) {
                   status = 'voting';
                   timeRemaining = createdAt + POLL_DURATION - currentTime;
               } else if (currentTime < createdAt + POLL_DURATION + REVEAL_DURATION) {
                   status = 'revealing';
                   timeRemaining = createdAt + POLL_DURATION + REVEAL_DURATION - currentTime;
               } else {
                   status = 'ended';
               }
           }

           return (
            <Card key={topic.id}>
                <Flex direction="column" gap="3">
                    <Flex justify="between">
                        <Badge color={status === 'voting' ? 'green' : status === 'revealing' ? 'orange' : 'gray'}>
                            {status.toUpperCase()}
                        </Badge>
                        <Text size="1" color="gray">{new Date(topic.created_at).toLocaleDateString()}</Text>
                    </Flex>
                    <Heading size="4">{topic.title}</Heading>
                    <Text>{topic.description}</Text>
                    
                    {topic.on_chain_id ? (
                        <Flex direction="column" gap="2">
                             {status === 'ended' ? (
                                <>
                                    <Text size="2" weight="bold">Final Results:</Text>
                                    <Flex justify="between">
                                        <Text>{topic.option_a}: {onChainData?.count_a || 0}</Text>
                                        <Text>{topic.option_b}: {onChainData?.count_b || 0}</Text>
                                    </Flex>
                                    <Button color="gold" variant="soft" onClick={() => claimReward(topic)}>Claim Reward (If Won)</Button>
                                </>
                             ) : status === 'revealing' ? (
                                <>
                                    <Text size="2" weight="bold">Revealing Votes...</Text>
                                    <Text size="1">Decrypting via Drand Time-Lock...</Text>
                                    <Flex justify="between">
                                        <Text>{topic.option_a}: {onChainData?.count_a || 0}</Text>
                                        <Text>{topic.option_b}: {onChainData?.count_b || 0}</Text>
                                    </Flex>
                                    <Text size="1" color="gray">Ends in {Math.floor(timeRemaining / 1000)}s</Text>
                                </>
                             ) : (
                                <>
                                    <Text size="2" weight="bold">Secret Voting Phase</Text>
                                    <Grid columns="2" gap="2">
                                        <Button onClick={() => commitVote(topic, topic.option_a)}>{topic.option_a}</Button>
                                        <Button onClick={() => commitVote(topic, topic.option_b)}>{topic.option_b}</Button>
                                    </Grid>
                                    <Text size="1" color="gray">Voting ends in {Math.floor(timeRemaining / 1000)}s</Text>
                                    <Text size="1" color="blue" style={{ fontStyle: 'italic' }}>
                                        Votes are encrypted with Time-Lock. Even we can't read them until voting ends.
                                    </Text>
                                </>
                             )}
                        </Flex>
                    ) : (
                        <Button color="orange" onClick={() => createPollOnChain(topic)}>Activate On-Chain</Button>
                    )}
                </Flex>
            </Card>
           )
        })}
      </Grid>
    </Flex>
  )
}
