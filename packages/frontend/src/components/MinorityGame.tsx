'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
  useSuiClientContext,
} from '@mysten/dapp-kit'
import {
  Button,
  Flex,
  Text,
  Heading,
  Grid,
  Skeleton,
  Card,
  Box,
} from '@radix-ui/themes'
import { Transaction } from '@mysten/sui/transactions'
import { isValidSuiObjectId } from '@mysten/sui/utils'
import * as tlock from 'tlock-js'
import toast from 'react-hot-toast'
import { Bot, Moon } from 'lucide-react'
import TopicCard from './TopicCard'

const PACKAGE_ID =
  process.env.NEXT_PUBLIC_PACKAGE_ID ||
  '0x1aff31d8692f6e87404624eafbcd574eaac0c4752890b49e017d02a9e58101f7'
const MODULE_NAME = 'minority_game'
const STAKE_AMOUNT = 100_000_000 // 0.1 SUI
const POLL_DURATION = 3600 * 1000 // 60 minutes
const REVEAL_DURATION = 600 * 1000 // 10 minute

// Drand Mainnet Chain Hash
const DRAND_CHAIN_HASH =
  '8990e7a9aaed2ffed73dbd7092123d6f289930540d7651336225dc172e51b2ce'
// Drand Mainnet Genesis (Time of round 1)
const DRAND_GENESIS_TIME = 1595431050 // seconds
const DRAND_PERIOD = 30 // seconds

export default function MinorityGame() {
  const supabase = createClient()
  const account = useCurrentAccount()
  const client = useSuiClient()
  const ctx = useSuiClientContext()
  const { mutate: signAndExecute } = useSignAndExecuteTransaction()
  const [topics, setTopics] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [pollData, setPollData] = useState<Record<string, any>>({})
  const [userVotes, setUserVotes] = useState<Record<string, any>>({}) // Track user votes per topic: { topicId: { status, choice } }
  const [currentTime, setCurrentTime] = useState(Date.now())

  useEffect(() => {
    fetchTopics()
    if (account) fetchUserVotes()
    
    // Refresh data every minute
    const dataInterval = setInterval(() => {
        fetchTopics()
        if (account) fetchUserVotes()
    }, 60000)

    // Update timer every 100ms for smoother millisecond display
    const timerInterval = setInterval(() => {
        setCurrentTime(Date.now())
    }, 100)

    return () => {
        clearInterval(dataInterval)
        clearInterval(timerInterval)
    }
  }, [account]) // Refetch when account changes

  // Helper to format remaining time
  const formatTimeRemaining = (ms: number) => {
    if (ms <= 0) return "00:00:00";
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = Math.floor((ms % 1000) / 10); // Show 2 digits
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${milliseconds.toString().padStart(2, '0')}`;
  }

  // Calculate global time remaining (based on the first active voting topic found)
  let globalTimeRemaining = null;
  
  const activeTopic = topics.find(t => {
      // We rely on Supabase 'created_at' since on-chain data might lag or be missing initially
      // And we filtered for 'active' status in fetchTopics.
      const createdAt = new Date(t.created_at).getTime();
      return currentTime < createdAt + POLL_DURATION;
  });

  if (activeTopic) {
      const createdAt = new Date(activeTopic.created_at).getTime();
      const remaining = (createdAt + POLL_DURATION) - currentTime;
      if (remaining > 0) {
          globalTimeRemaining = formatTimeRemaining(remaining);
      } else {
          // If poll ended, don't show negative timer
          globalTimeRemaining = "00:00:00"; 
      }
  }

  // Fetch user's vote history
  const fetchUserVotes = async () => {
      if (!account) return
      const { data } = await supabase
          .from('user_votes')
          .select('topic_id, status, choice, tx_digest')
          .eq('user_address', account.address)
      
      const votesMap: Record<string, any> = {}
      data?.forEach(v => {
          votesMap[v.topic_id] = { status: v.status, choice: v.choice, tx_digest: v.tx_digest }
      })
      setUserVotes(votesMap)
  }

  useEffect(() => {
    topics.forEach(async (topic) => {
      if (topic.on_chain_id && isValidSuiObjectId(topic.on_chain_id)) {
        try {
          const obj = await client.getObject({
            id: topic.on_chain_id,
            options: { showContent: true },
          })
          if (obj.data?.content?.dataType === 'moveObject') {
            setPollData((prev) => ({
              ...prev,
              // @ts-ignore
              [topic.id]: obj?.data?.content?.fields || {},
            }))
          }
        } catch (e) {
          console.error('Failed to fetch poll data', e)
        }
      }
    })
  }, [topics, client])

  const fetchTopics = async () => {
    // Simulate a minimum loading time for better UX
    const minLoadTime = new Promise(resolve => setTimeout(resolve, 800))

    const { data } = await supabase
      .from('topics')
      .select('*')
      .eq('status', 'active') // Only fetch active topics
      .order('created_at', { ascending: false })

    // Wait for minimum load time
    await minLoadTime

    setTopics(data || [])
    setLoading(false)
  }

  const createPollOnChain = async (topic: any) => {
    if (!account) return toast.error('Connect wallet first')
    const tx = new Transaction()
    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAME}::create_poll`,
      arguments: [
        tx.pure.string(topic.title),
        tx.pure.string(topic.option_a),
        tx.pure.string(topic.option_b),
        tx.object('0x6'),
      ],
    })

    signAndExecute(
      {
        transaction: tx,
      },
      {
        onSuccess: async (result) => {
          toast.success('Poll created! Waiting for confirmation...')
          try {
            const tx = await client.waitForTransaction({
              digest: result.digest,
              options: { showObjectChanges: true },
            })
            const createdObject = tx.objectChanges?.find(
              (change) =>
                change.type === 'created' &&
                change.objectType.includes('::minority_game::Poll')
            )
            if (createdObject && 'objectId' in createdObject) {
              await supabase
                .from('topics')
                .update({
                  on_chain_id: createdObject.objectId,
                  status: 'active',
                })
                .eq('id', topic.id)
              fetchTopics()
              toast.success('Poll activated successfully!')
            }
          } catch (e) {
            console.error('Error waiting for transaction:', e)
          }
        },
        onError: (err) => {
          console.error(err)
          toast.error('Failed to create poll.')
        },
      }
    )
  }

  // Generate random salt
  const generateSalt = () => {
    const array = new Uint8Array(16)
    window.crypto.getRandomValues(array)
    return Buffer.from(array).toString('hex')
  }

  const commitVote = async (topic: any, choice: string) => {
    if (!topic.on_chain_id) return toast.error('Poll not active on chain')
    if (!account) return toast.error('Connect wallet first')
    if (userVotes[topic.id])
      return toast.error('You have already voted on this topic!')

    // 1. Calculate Voting End Time
    // We need on-chain creation time to be accurate.
    const onChainData = pollData[topic.id]
    if (!onChainData) return toast('Loading chain data...')

    const createdAt = Number(onChainData.created_at)
    const endTime = createdAt + POLL_DURATION

    // Calculate Drand Round for End Time
    // round = (time - genesis) / period + 1
    // Add buffer (e.g. + 1 round) to ensure key is available AFTER end time.
    const round =
      Math.ceil((endTime / 1000 - DRAND_GENESIS_TIME) / DRAND_PERIOD) + 1

    console.log(
      `Encrypting for Drand Round: ${round} (approx ${new Date(endTime).toLocaleTimeString()})`
    )

    const salt = generateSalt()

    // 2. Encrypt (Choice + Salt) using tlock
    const payload = JSON.stringify({ choice, salt })
    let ciphertext = ''

    try {
      // Using tlock to encrypt for the future round
      const client = await tlock.timelockEncrypt(
        round,
        Buffer.from(payload),
        tlock.mainnetClient() // Uses mainnet by default
      )
      ciphertext = client // tlock returns base64 encoded ciphertext string? No, it returns a string usually.
      // Let's check type. tlock.timelockEncrypt returns Promise<string> (age header + ciphertext).
    } catch (e) {
      console.error('Encryption failed:', e)
      return toast.error('Encryption failed. Please try again.')
    }

    // 3. Compute Commitment Hash for Contract
    // Hash = Blake2b(Choice + Salt)
    // Must match contract logic
    const choiceBytes = new TextEncoder().encode(choice)
    const saltBytes = Buffer.from(salt, 'hex')
    // IMPORTANT: We need blakejs to match Move's blake2b256
    // Move: vector::append(choice, salt); blake2b256(data)
    const combined = new Uint8Array(choiceBytes.length + saltBytes.length)
    combined.set(choiceBytes)
    combined.set(saltBytes, choiceBytes.length)

    // Import blake2b dynamically or assume it's available
    const { blake2b } = require('blakejs')
    const hash = blake2b(combined, undefined, 32)

    const tx = new Transaction()
    const [coin] = tx.splitCoins(tx.gas, [STAKE_AMOUNT])

    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAME}::commit_vote`,
      arguments: [
        tx.object(topic.on_chain_id),
        tx.pure.vector('u8', hash),
        coin,
        tx.object('0x6'),
      ],
    })

    tx.setGasBudget(100000000) // 0.1 SUI

    signAndExecute(
      {
        transaction: tx,
      },
      {
        onSuccess: async (result) => {
          
          toast.success('Transaction submitted! Waiting for confirmation on chain...')
          try {
            debugger
            // Wait for transaction to be finalized
            await client.waitForTransaction({
              digest: result.digest,
            })

            // 4. Backup ENCRYPTED Vote to Server
            await fetch('/api/vote/backup', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                topic_id: topic.id,
                user_address: account.address,
                choice: 'ENCRYPTED', // Hide choice
                salt: ciphertext, // Store ciphertext in salt field (hacky but works for MVP)
                tx_digest: result.digest,
                network: ctx.network,
              }),
            })

            toast.success(
              `Vote Encrypted & Committed! It will be automatically decrypted and revealed after voting ends.`
            )
            fetchTopics()
            fetchUserVotes() // Refresh vote status
          } catch (e) {
            console.error('Error waiting for transaction:', e)
            toast.error(
              'Transaction submitted but verification failed. Please check explorer.'
            )
          }
        },
        onError: (err) => {
          console.error(err)
          toast.error('Vote failed')
        },
      }
    )
  }

  const claimReward = async (topic: any) => {
    if (!topic.on_chain_id) return
    if (!account) return toast.error('Connect wallet first')

    // Verify Winner Status locally first
    const userVote = userVotes[topic.id];
    if (!userVote || !userVote.choice) return toast.error("Vote record not found. Did you vote?");
    
    // If choice is still ENCRYPTED, it means reveal failed or DB not updated.
    if (userVote.choice === 'ENCRYPTED') return toast.error("Your vote hasn't been revealed yet. Please wait.");

    const onChainData = pollData[topic.id];
    if (!onChainData) return toast("Loading results...");

    const countA = Number(onChainData.count_a);
    const countB = Number(onChainData.count_b);
    
    // Draw: Everyone wins (refund net stake)
    if (countA === countB) {
        // Allow claim
    } else {
        const isAMinority = countA < countB;
        const winningChoice = isAMinority ? topic.option_a : topic.option_b;
        
        if (userVote.choice !== winningChoice) {
            return toast.error(`Sorry, you voted for "${userVote.choice}" which is the Majority. Only the Minority wins!`);
        }
    }

    const tx = new Transaction()
    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAME}::claim_reward`,
      arguments: [tx.object(topic.on_chain_id), tx.object('0x6')],
    })

    signAndExecute(
      {
        transaction: tx,
      },
      {
        onSuccess: async () => {
          toast.success('Reward claimed!')
          fetchTopics()
        },
        onError: (err) => {
          console.error(err)
          toast.error('Failed to claim. Ensure reveal phase is over and you won.')
        },
      }
    )
  }

  return (
    <Flex direction="column" gap="4" width="100%">
      <Flex justify="between" align="center">
        <Flex direction="column" gap="1">
            <Flex gap="3" align="center">
                <Heading>Active Topics</Heading>
                {globalTimeRemaining && (
                    <Text size="8" weight="bold" color="red" style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                        ⏱ {globalTimeRemaining}
                    </Text>
                )}
            </Flex>
            <Text size="2" color="blue" style={{ fontStyle: 'italic' }}>
                Note: Votes are encrypted with Time-Lock. Even we can't read them until voting ends.
            </Text>
        </Flex>
      </Flex>

      {loading ? (
        <Grid columns={{ initial: '1', md: '2' }} gap="4">
            {[...Array(4)].map((_, i) => (
                <Card key={i} className="tech-card" size="3">
                    <Flex direction="column" gap="3">
                        <Skeleton width="100%" height="24px" />
                        <Skeleton width="80%" height="20px" />
                        <Skeleton width="100%" height="16px" />
                        <Skeleton width="100%" height="120px" />
                    </Flex>
                </Card>
            ))}
        </Grid>
      ) : topics.length > 0 ? (
        <Grid columns={{ initial: '1', md: '2' }} gap="4">
            {topics.map((topic) => (
            <TopicCard
                key={topic.id}
                topic={topic}
                pollData={pollData}
                userVotes={userVotes}
                currentTime={currentTime}
                POLL_DURATION={POLL_DURATION}
                REVEAL_DURATION={REVEAL_DURATION}
                onVote={commitVote}
                onClaim={claimReward}
                onActivate={createPollOnChain}
            />
            ))}
        </Grid>
      ) : (
        <Flex direction="column" align="center" justify="center" gap="4" py="9" style={{ opacity: 0.8 }}>
            <Box position="relative" style={{ width: '120px', height: '120px' }}>
                <Bot size={120} strokeWidth={1.5} color="var(--gray-8)" />
                <Box position="absolute" top="0" right="0" style={{ transform: 'translate(20%, -20%)' }}>
                    <Moon size={40} strokeWidth={2} color="var(--accent-9)" fill="var(--accent-9)" style={{ opacity: 0.6 }} />
                </Box>
                <Text 
                    size="6" 
                    weight="bold" 
                    color="gray" 
                    style={{ 
                        position: 'absolute', 
                        top: '-20px', 
                        right: '-40px', 
                        transform: 'rotate(15deg)',
                        opacity: 0.5
                    }}
                >
                    Zzz...
                </Text>
            </Box>
            <Text size="4" weight="medium" color="gray" align="center" mt="4">
                The AI is taking a nap... 😴 <br/>
                <Text size="2" weight="regular">Come back later for fresh topics!</Text>
            </Text>
        </Flex>
      )}
    </Flex>
  )
}
