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
} from '@radix-ui/themes'
import { Transaction } from '@mysten/sui/transactions'
import { isValidSuiObjectId } from '@mysten/sui/utils'
import TopicCard from '@/components/TopicCard'
import { Search } from 'lucide-react'

const PACKAGE_ID =
  process.env.NEXT_PUBLIC_PACKAGE_ID ||
  '0x1aff31d8692f6e87404624eafbcd574eaac0c4752890b49e017d02a9e58101f7'
const MODULE_NAME = 'minority_game'
const POLL_DURATION = 120 * 1000 // 2 minutes
const REVEAL_DURATION = 60 * 1000 // 1 minute
const ITEMS_PER_PAGE = 5

export default function DashboardPage() {
  const supabase = createClient()
  const account = useCurrentAccount()
  const client = useSuiClient()
  const { mutate: signAndExecute } = useSignAndExecuteTransaction()
  const [topics, setTopics] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [pollData, setPollData] = useState<Record<string, any>>({})
  const [userVotes, setUserVotes] = useState<Record<string, any>>({})
  const [currentTime, setCurrentTime] = useState(Date.now())

  // Filter & Pagination State
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    fetchTopics()
    if (account) fetchUserVotes()

    const interval = setInterval(() => {
      fetchTopics()
      if (account) fetchUserVotes()
      setCurrentTime(Date.now())
    }, 60000)
    return () => clearInterval(interval)
  }, [account])

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

  const fetchTopics = async () => {
    const { data } = await supabase
      .from('topics')
      .select('*')
      .order('created_at', { ascending: false })
    setTopics(data || [])
    setLoading(false)
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

  // Generic Filter Function
  const filterTopics = (list: any[]) => {
    return list.filter((topic) => {
      // Search Query
      const matchesSearch = topic.title
        .toLowerCase()
        .includes(searchQuery.toLowerCase())

      // Date Range
      const topicDate = new Date(topic.created_at).getTime()
      let matchesDate = true
      if (dateFrom) {
        matchesDate = matchesDate && topicDate >= new Date(dateFrom).getTime()
      }
      if (dateTo) {
        // Add 1 day to include the end date fully (end of day)
        const nextDay = new Date(dateTo)
        nextDay.setDate(nextDay.getDate() + 1)
        matchesDate = matchesDate && topicDate < nextDay.getTime()
      }

      return matchesSearch && matchesDate
    })
  }

  // Filtered Lists
  const myVoteTopics = topics.filter((t) => userVotes[t.id])
  const endedTopics = topics.filter((t) => getStatus(t) === 'ended')

  // Apply filters and pagination based on Active Tab?
  // Since we render both tabs, we can prepare filtered lists for both.
  const filteredMyVotes = filterTopics(myVoteTopics)
  const filteredEndedTopics = filterTopics(endedTopics)

  // Pagination Helper
  const getPaginated = (list: any[]) => {
    const start = (page - 1) * ITEMS_PER_PAGE
    const end = start + ITEMS_PER_PAGE
    return list.slice(start, end)
  }

  const handleTabChange = () => {
    setPage(1) // Reset page on tab switch
  }

  if (loading) return <Text>Loading...</Text>

  return (
    <Flex direction="column" gap="4" width="100%" p="4">
      <Heading>Dashboard</Heading>

      {/* Filters */}
      <Card>
        <Flex gap="4" wrap="wrap" align="end">
          <Box flexGrow="1">
            <Text as="div" size="2" mb="1" weight="bold">
              Search Topics
            </Text>
            <TextField.Root
              placeholder="Search by title..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setPage(1)
              }}
            >
              <TextField.Slot>
                <Search size={16} />
              </TextField.Slot>
            </TextField.Root>
          </Box>
          <Box>
            <Text as="div" size="2" mb="1" weight="bold">
              From Date
            </Text>
            <TextField.Root
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value)
                setPage(1)
              }}
            />
          </Box>
          <Box>
            <Text as="div" size="2" mb="1" weight="bold">
              To Date
            </Text>
            <TextField.Root
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value)
                setPage(1)
              }}
            />
          </Box>
          <Button
            variant="soft"
            color="gray"
            onClick={() => {
              setSearchQuery('')
              setDateFrom('')
              setDateTo('')
              setPage(1)
            }}
          >
            Clear
          </Button>
        </Flex>
      </Card>

      <Tabs.Root defaultValue="my-votes" onValueChange={handleTabChange}>
        <Tabs.List>
          <Tabs.Trigger value="my-votes">
            My Votes ({filteredMyVotes.length})
          </Tabs.Trigger>
          <Tabs.Trigger value="ended-topics">
            Ended Topics ({filteredEndedTopics.length})
          </Tabs.Trigger>
        </Tabs.List>

        <Box pt="3">
          <Tabs.Content value="my-votes">
            {!account ? (
              <Text>Please connect your wallet to view your votes.</Text>
            ) : filteredMyVotes.length === 0 ? (
              <Text>No votes found matching your criteria.</Text>
            ) : (
              <>
                <Grid columns={{ initial: '1', md: '2' }} gap="4">
                  {getPaginated(filteredMyVotes).map((topic) => (
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
                  totalItems={filteredMyVotes.length}
                  page={page}
                  setPage={setPage}
                />
              </>
            )}
          </Tabs.Content>

          <Tabs.Content value="ended-topics">
            {filteredEndedTopics.length === 0 ? (
              <Text>No ended topics found matching your criteria.</Text>
            ) : (
              <>
                <Grid columns={{ initial: '1', md: '2' }} gap="4">
                  {getPaginated(filteredEndedTopics).map((topic) => (
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
                  totalItems={filteredEndedTopics.length}
                  page={page}
                  setPage={setPage}
                />
              </>
            )}
          </Tabs.Content>
        </Box>
      </Tabs.Root>
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
