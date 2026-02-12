import {
  Button,
  Card,
  Flex,
  Text,
  Badge,
  Heading,
  Grid,
  Box,
  IconButton,
} from '@radix-ui/themes'
import { ExternalLinkIcon } from '@radix-ui/react-icons'

interface TopicCardProps {
  topic: any
  pollData: Record<string, any>
  userVotes: Record<string, any>
  currentTime: number
  POLL_DURATION: number
  REVEAL_DURATION: number
  onVote: (topic: any, choice: string) => void
  onClaim: (topic: any) => void
  onActivate: (topic: any) => void
}

export default function TopicCard({
  topic,
  pollData,
  userVotes,
  currentTime,
  POLL_DURATION,
  REVEAL_DURATION,
  onVote,
  onClaim,
  onActivate,
}: TopicCardProps) {
  const onChainData = pollData[topic.id]
  const createdAt = onChainData?.created_at
    ? Number(onChainData.created_at)
    : null

  let status = topic.status
  let timeRemaining = 0

  if (createdAt) {
    if (currentTime < createdAt + POLL_DURATION) {
      status = 'voting'
      timeRemaining = createdAt + POLL_DURATION - currentTime
    } else if (currentTime < createdAt + POLL_DURATION + REVEAL_DURATION) {
      status = 'revealing'
      timeRemaining =
        createdAt + POLL_DURATION + REVEAL_DURATION - currentTime
    } else {
      status = 'ended'
    }
  }

  // Determine Winner Logic for UI
  let userWon = false
  let isDraw = false
  let userChoice = userVotes[topic.id]?.choice

  if (
    status === 'ended' &&
    onChainData &&
    userChoice &&
    userChoice !== 'ENCRYPTED'
  ) {
    const countA = Number(onChainData.count_a)
    const countB = Number(onChainData.count_b)
    if (countA === countB) {
      isDraw = true
      userWon = true // Everyone wins (refund)
    } else {
      const isAMinority = countA < countB
      const winningChoice = isAMinority ? topic.option_a : topic.option_b
      if (userChoice === winningChoice) {
        userWon = true
      }
    }
  }

  return (
    <Card key={topic.id}>
      <Flex direction="column" gap="3">
        <Flex justify="between">
          <Badge
            color={
              status === 'voting'
                ? 'green'
                : status === 'revealing'
                  ? 'orange'
                  : 'gray'
            }
          >
            {status.toUpperCase()}
          </Badge>
          <Text size="1" color="gray">
            Start at {new Date(topic.created_at).toLocaleString()}
          </Text>
        </Flex>
        <Flex align="center" gap="2">
          <Heading size="4">{topic.title}</Heading>
          {topic.on_chain_id && (
            <IconButton
              size="1"
              variant="ghost"
              onClick={() =>
                window.open(
                  `https://suiscan.xyz/testnet/object/${topic.on_chain_id}`,
                  '_blank'
                )
              }
              style={{ cursor: 'pointer' }}
            >
              <ExternalLinkIcon width="16" height="16" />
            </IconButton>
          )}
        </Flex>
        <Text>{topic.description}</Text>

        {topic.on_chain_id ? (
          <Flex direction="column" gap="2">
            {status === 'ended' ? (
              <>
                <Text size="2" weight="bold">
                  Final Results:
                </Text>

                {/* Percentage Bar */}
                <Flex
                  width="100%"
                  style={{
                    height: '10px',
                    borderRadius: '5px',
                    overflow: 'hidden',
                    backgroundColor: '#e0e0e0',
                  }}
                  my="2"
                >
                  {(() => {
                    const countA = Number(onChainData?.count_a || 0)
                    const countB = Number(onChainData?.count_b || 0)
                    const total = countA + countB
                    if (total === 0) return null

                    const percentA = (countA / total) * 100
                    const percentB = (countB / total) * 100

                    // Determine colors: Minority is Green, Majority is Red
                    // If countA < countB, A is Green.
                    const colorA = countA < countB ? '#30A46C' : '#E54D2E' // Green : Red (Radix colors roughly)
                    const colorB = countB < countA ? '#30A46C' : '#E54D2E'
                    // If equal, both maybe orange or gray? Or just red (no winner). Let's stick to rule. Draw = refund.
                    // If draw, both equal, let's use orange for both.
                    const isDraw = countA === countB

                    return (
                      <>
                        <Box
                          style={{
                            width: `${percentA}%`,
                            backgroundColor: isDraw ? '#F76B15' : colorA,
                            transition: 'width 0.5s',
                          }}
                        />
                        <Box
                          style={{
                            width: `${percentB}%`,
                            backgroundColor: isDraw ? '#F76B15' : colorB,
                            transition: 'width 0.5s',
                          }}
                        />
                      </>
                    )
                  })()}
                </Flex>

                <Flex justify="between">
                  <Text
                    color={
                      Number(onChainData?.count_a) <
                      Number(onChainData?.count_b)
                        ? 'green'
                        : 'red'
                    }
                  >
                    {topic.option_a}: {onChainData?.count_a || 0}
                  </Text>
                  <Text
                    color={
                      Number(onChainData?.count_b) <
                      Number(onChainData?.count_a)
                        ? 'green'
                        : 'red'
                    }
                  >
                    {topic.option_b}: {onChainData?.count_b || 0}
                  </Text>
                </Flex>

                {userChoice && (
                  <Flex align="center" gap="2" mt="2">
                    <Text size="2">
                      Your Vote:{' '}
                      <Text weight="bold">
                        {userChoice === 'ENCRYPTED'
                          ? 'Decrypting...'
                          : userChoice}
                      </Text>
                    </Text>
                    {userVotes[topic.id]?.tx_digest && (
                      <IconButton
                        size="1"
                        variant="ghost"
                        onClick={() =>
                          window.open(
                            `https://suiscan.xyz/testnet/tx/${userVotes[topic.id].tx_digest}`,
                            '_blank'
                          )
                        }
                        style={{ cursor: 'pointer' }}
                        title="View Vote Transaction"
                      >
                        <ExternalLinkIcon width="14" height="14" />
                      </IconButton>
                    )}
                  </Flex>
                )}

                {userChoice && userChoice !== 'ENCRYPTED' ? (
                  userWon ? (
                    <Button
                      color="gold"
                      variant="soft"
                      onClick={() => onClaim(topic)}
                      mt="2"
                    >
                      {isDraw
                        ? "It's a Draw! Claim Refund"
                        : 'You Won! Claim Reward'}
                    </Button>
                  ) : (
                    <Box
                      mt="2"
                      p="2"
                      style={{
                        backgroundColor: 'var(--gray-3)',
                        borderRadius: 'var(--radius-2)',
                      }}
                    >
                      <Text color="gray" size="2">
                        Unfortunately, you are in the Majority. Better luck next
                        time!
                      </Text>
                    </Box>
                  )
                ) : null}
              </>
            ) : status === 'revealing' ? (
              <>
                <Text size="2" weight="bold">
                  Revealing Votes...
                </Text>
                <Text size="1">Decrypting via Drand Time-Lock...</Text>
                <Flex justify="between">
                  <Text>
                    {topic.option_a}: {onChainData?.count_a || 0}
                  </Text>
                  <Text>
                    {topic.option_b}: {onChainData?.count_b || 0}
                  </Text>
                </Flex>
                <Text size="1" color="gray">
                  Ends in {Math.floor(timeRemaining / 1000)}s
                </Text>
              </>
            ) : (
              <>
                <Text size="2" weight="bold">
                  Secret Voting Phase
                </Text>
                {userVotes[topic.id] && <Badge color="green">Voted</Badge>}
                <Grid columns="2" gap="2">
                  <Button
                    disabled={userVotes[topic.id]}
                    onClick={() => onVote(topic, topic.option_a)}
                  >
                    {topic.option_a}
                  </Button>
                  <Button
                    disabled={userVotes[topic.id]}
                    onClick={() => onVote(topic, topic.option_b)}
                  >
                    {topic.option_b}
                  </Button>
                </Grid>
              </>
            )}
          </Flex>
        ) : (
          <Button color="orange" onClick={() => onActivate(topic)}>
            Activate On-Chain
          </Button>
        )}
      </Flex>
    </Card>
  )
}
