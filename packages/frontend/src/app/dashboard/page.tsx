'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from '@mysten/dapp-kit'
import {
  Button,
  Flex,
  Text,
  Heading,
  Grid,
  Tabs,
  Box,
  TextField,
  Card,
  Skeleton,
} from '@radix-ui/themes'
import { Transaction } from '@mysten/sui/transactions'
import { isValidSuiObjectId } from '@mysten/sui/utils'
import TopicCard from '@/components/TopicCard'
import { Search } from 'lucide-react'

const PACKAGE_ID =
  process.env.NEXT_PUBLIC_PACKAGE_ID
const MODULE_NAME = 'minority_game'
const POLL_DURATION = 3600 * 1000 // 60 minutes
const REVEAL_DURATION = 600 * 1000 // 10 minutes
const ITEMS_PER_PAGE = 4

export default function DashboardPage() {
  const supabase = createClient()
  const account = useCurrentAccount()
  const client = useSuiClient()
  const { mutate: signAndExecute } = useSignAndExecuteTransaction()
  
  // Data State
  const [topics, setTopics] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [pollData, setPollData] = useState<Record<string, any>>({})
  const [userVotes, setUserVotes] = useState<Record<string, any>>({})
  const [currentTime, setCurrentTime] = useState(Date.now())
  const [totalCount, setTotalCount] = useState(0)

  // Filter & Pagination State
  const [filters, setFilters] = useState({
    searchQuery: '',
    dateFrom: '',
    dateTo: '',
    page: 1,
    activeTab: 'my-votes'
  })

  useEffect(() => {
    fetchTopics()
    if (account) fetchUserVotes()
  }, [account, filters.page, filters.activeTab]) // Refetch when filters change

  useEffect(() => {
    const interval = setInterval(() => {
        // Only refresh time for countdowns, don't refetch data automatically
        setCurrentTime(Date.now())
    }, 1000) // Update time every second for smooth countdowns
    return () => clearInterval(interval)
  }, [])

  const fetchUserVotes = async () => {
    if (!account) return
    const { data } = await supabase
      .from('user_votes')
      .select('topic_id, status, choice, tx_digest')
      .eq('user_address', account.address)

    const votesMap: Record<string, any> = {}
    data?.forEach((v) => {
      votesMap[v.topic_id] = {
        status: v.status,
        choice: v.choice,
        tx_digest: v.tx_digest,
      }
    })
    setUserVotes(votesMap)
  }

  const fetchTopics = async (currentFilters = filters) => {
    setLoading(true)
    
    // Simulate a minimum loading time for better UX
    const minLoadTime = new Promise(resolve => setTimeout(resolve, 800))
    
    let query = supabase
      .from('topics')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    // Apply Search
    if (currentFilters.searchQuery) {
        query = query.ilike('title', `%${currentFilters.searchQuery}%`)
    }

    // Apply Date Range
    if (currentFilters.dateFrom) {
        query = query.gte('created_at', new Date(currentFilters.dateFrom).toISOString())
    }
    if (currentFilters.dateTo) {
        const nextDay = new Date(currentFilters.dateTo)
        nextDay.setDate(nextDay.getDate() + 1)
        query = query.lt('created_at', nextDay.toISOString())
    }

    // Apply Tab Filter (Join logic needed for 'my-votes' is complex in simple query, 
    // for MVP we might fetch IDs first or handle 'my-votes' differently.
    // However, Supabase doesn't support easy semi-join in JS client without foreign keys setup perfectly.
    // For 'my-votes', let's filter client side if the dataset is small, OR 
    // better: fetch user votes first, get topic IDs, then fetch those topics.)
    
    if (currentFilters.activeTab === 'my-votes') {
        if (!account) {
            setTopics([])
            setTotalCount(0)
            setLoading(false)
            return
        }
        // Fetch topic IDs user voted on
        const { data: voteData } = await supabase
            .from('user_votes')
            .select('topic_id')
            .eq('user_address', account.address)
        
        const votedTopicIds = voteData?.map(v => v.topic_id) || []
        
        if (votedTopicIds.length === 0) {
            setTopics([])
            setTotalCount(0)
            setLoading(false)
            return
        }
        query = query.in('id', votedTopicIds)
    } else if (currentFilters.activeTab === 'ended-topics') {
        query = query.eq('status', 'closed') // Assuming status is updated in DB
    }

    // Apply Pagination
    const from = (currentFilters.page - 1) * ITEMS_PER_PAGE
    const to = from + ITEMS_PER_PAGE - 1
    query = query.range(from, to)

    const { data, count } = await query
    
    // Wait for both the query and the minimum load time
    await minLoadTime
    
    setTopics(data || [])
    setTotalCount(count || 0)
    setLoading(false)
  }

  useEffect(() => {
    const fetchPollData = async () => {
      const validTopics = topics.filter(
        (t) => t.on_chain_id && isValidSuiObjectId(t.on_chain_id)
      )

      if (validTopics.length === 0) return

      const newPollData: Record<string, any> = {}
      
      // Use a sequential approach or Promise.allSettled to handle errors gracefully
      const results = await Promise.allSettled(validTopics.map(async (topic) => {
          const obj = await client.getObject({
              id: topic.on_chain_id,
              options: { showContent: true },
          })
          return { topicId: topic.id, obj }
      }))

      results.forEach((result) => {
          if (result.status === 'fulfilled') {
              const { topicId, obj } = result.value
              if (obj.data?.content?.dataType === 'moveObject') {
                  // @ts-ignore
                  newPollData[topicId] = obj.data?.content?.fields || {}
              }
          } else {
              console.warn('Failed to fetch individual topic', result.reason)
          }
      })

      setPollData((prev) => ({ ...prev, ...newPollData }))
    }

    if (topics.length > 0) {
        fetchPollData()
    }
  }, [topics, client])

  const claimReward = async (topic: any) => {
    if (!topic.on_chain_id) return
    if (!account) return alert('Connect wallet first')

    const userVote = userVotes[topic.id]
    if (!userVote || !userVote.choice)
      return alert('Vote record not found. Did you vote?')

    if (userVote.choice === 'ENCRYPTED')
      return alert("Your vote hasn't been revealed yet. Please wait.")

    const onChainData = pollData[topic.id]
    if (!onChainData) return alert('Loading results...')

    const countA = Number(onChainData.count_a)
    const countB = Number(onChainData.count_b)

    if (countA !== countB) {
      const isAMinority = countA < countB
      const winningChoice = isAMinority ? topic.option_a : topic.option_b

      if (userVote.choice !== winningChoice) {
        return alert(
          `Sorry, you voted for "${userVote.choice}" which is the Majority. Only the Minority wins!`
        )
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
          alert('Reward claimed!')
          fetchTopics()
        },
        onError: (err) => {
          console.error(err)
          alert('Failed to claim. Ensure reveal phase is over and you won.')
        },
      }
    )
  }

  // Helper to determine status
  const getStatus = (topic: any) => {
    const onChainData = pollData[topic.id]
    const createdAt = onChainData?.created_at
      ? Number(onChainData.created_at)
      : null

    if (createdAt) {
      if (currentTime < createdAt + POLL_DURATION) {
        return 'voting'
      } else if (currentTime < createdAt + POLL_DURATION + REVEAL_DURATION) {
        return 'revealing'
      } else {
        return 'ended'
      }
    }
    return 'draft'
  }

  const handleTabChange = (val: string) => {
    if (val === filters.activeTab) return;
    setTopics([]) // Clear current topics to show loading state immediately
    setFilters(prev => ({
        ...prev,
        activeTab: val,
        page: 1
    }))
  }

  return (
    <Flex direction="column" width="100%" align="center">
      <Box style={{ width: '100%', maxWidth: '1200px' }}>
        <Heading>Dashboard</Heading>

        {/* Filters */}
        <Card className="tech-card" style={{ marginBottom: '20px' }}>
            <Flex gap="4" wrap="wrap" align="end">
            <Box flexGrow="1">
                <Text as="div" size="2" mb="1" weight="bold" color="gray">
                Search Topics
                </Text>
                <TextField.Root
                placeholder="Search by title..."
                value={filters.searchQuery}
                onChange={(e) => {
                    setFilters(prev => ({ ...prev, searchQuery: e.target.value }))
                }}
                variant="soft"
                >
                <TextField.Slot>
                    <Search size={16} />
                </TextField.Slot>
                </TextField.Root>
            </Box>
            <Box>
                <Text as="div" size="2" mb="1" weight="bold" color="gray">
                From Date
                </Text>
                <TextField.Root
                type="date"
                value={filters.dateFrom}
                onChange={(e) => {
                    setFilters(prev => ({ ...prev, dateFrom: e.target.value, page: 1 }))
                }}
                variant="soft"
                />
            </Box>
            <Box>
                <Text as="div" size="2" mb="1" weight="bold" color="gray">
                To Date
                </Text>
                <TextField.Root
                type="date"
                value={filters.dateTo}
                onChange={(e) => {
                    setFilters(prev => ({ ...prev, dateTo: e.target.value }))
                }}
                variant="soft"
                />
            </Box>
            <Button
                variant="solid"
                color="grass"
                loading={loading}
                disabled={loading}
                onClick={() => {
                    if (filters.page === 1) {
                        fetchTopics()
                        if (account) fetchUserVotes()
                    } else {
                        setFilters(prev => ({ ...prev, page: 1 }))
                    }
                }}
                style={{ cursor: 'pointer' }}
            >
                Search
            </Button>
            <Button
                variant="soft"
                color="gray"
                onClick={() => {
                    const newFilters = {
                        ...filters,
                        searchQuery: '',
                        dateFrom: '',
                        dateTo: '',
                        page: 1
                    }
                    setFilters(newFilters)
                    // Explicitly fetch with new filters since useEffect might not trigger if page was already 1
                    fetchTopics(newFilters)
                }}
                style={{ cursor: 'pointer' }}
            >
                Clear
            </Button>
            </Flex>
        </Card>

        <Tabs.Root value={filters.activeTab} onValueChange={handleTabChange}>
            <Tabs.List>
            <Tabs.Trigger value="my-votes" style={{ cursor: 'pointer' }}>
                My Votes
            </Tabs.Trigger>
            <Tabs.Trigger value="ended-topics" style={{ cursor: 'pointer' }}>
                Ended Topics
            </Tabs.Trigger>
            </Tabs.List>

            <Box pt="4">
                {loading ? (
                    <Grid columns={{ initial: '1', md: '2' }} gap="4">
                        {[...Array(4)].map((_, i) => (
                            <Card key={i} className="tech-card" size="3">
                                <Flex direction="column" gap="3">
                                    <Skeleton width="100px" height="20px" />
                                    <Skeleton width="80%" height="24px" />
                                    <Skeleton width="100%" height="16px" />
                                    <Skeleton width="100%" height="100px" />
                                </Flex>
                            </Card>
                        ))}
                    </Grid>
                ) : topics.length === 0 ? (
                    <Flex justify="center" p="9" direction="column" align="center" gap="2">
                        <Text size="4" weight="bold">No topics found.</Text>
                        <Text color="gray">Try adjusting your filters or voting on some topics!</Text>
                    </Flex>
                ) : (
                    <>
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
                                onVote={() => {}}
                                onClaim={claimReward}
                                onActivate={() => {}}
                                />
                            ))}
                        </Grid>
                        <PaginationControl
                            totalItems={totalCount}
                            page={filters.page}
                            setPage={(p) => setFilters(prev => ({ ...prev, page: p }))}
                        />
                    </>
                )}
            </Box>
        </Tabs.Root>
      </Box>
    </Flex>
  )
}

function PaginationControl({
  totalItems,
  page,
  setPage,
}: {
  totalItems: number
  page: number
  setPage: (p: number) => void
}) {
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE)
  // Always show pagination control if there are items, even if just 1 page
  if (totalItems === 0) return null

  return (
    <Flex justify="center" align="center" gap="4" mt="4">
      <Text size="2" color="gray">
        Total: {totalItems}
      </Text>
      <Button
        variant="soft"
        disabled={page === 1}
        onClick={() => setPage(page - 1)}
      >
        Previous
      </Button>
      <Text size="2">
        Page {page} of {totalPages}
      </Text>
      <Button
        variant="soft"
        disabled={page === totalPages}
        onClick={() => setPage(page + 1)}
      >
        Next
      </Button>
    </Flex>
  )
}
