import { createClient } from '@/utils/supabase/client'
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
  Avatar,
  Tooltip,
} from '@radix-ui/themes'
import { 
  ExternalLinkIcon, 
  CheckCircledIcon, 
  CrossCircledIcon,
  LockClosedIcon,
  ClockIcon
} from '@radix-ui/react-icons'
import { useEffect, useState } from 'react'

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
  const supabase = createClient()
  
  const onChainData = pollData[topic.id]
  const createdAt = topic.created_at ? new Date(topic.created_at).getTime() : null

  let status = topic.status
  let timeRemaining = 0

  if (status === 'closed') {
    status = 'ended'
  } else {
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
  }

  const [realtimeVotes, setRealtimeVotes] = useState<number | null>(null)
  
  useEffect(() => {
    // Fetch vote count from user_votes table if status is voting
    const fetchVoteCount = async () => {
        if (status === 'voting') {
            const { count } = await supabase
                .from('user_votes')
                .select('*', { count: 'exact', head: true })
                .eq('topic_id', topic.id)
            setRealtimeVotes(count)
        }
    }
    fetchVoteCount()
  }, [status, topic.id])

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

  const getStatusBadge = () => {
    switch (status) {
      case 'voting':
        return <Badge color="grass" variant="solid" className="tech-badge">LIVE VOTING</Badge>
      case 'revealing':
        return <Badge color="orange" variant="solid" className="tech-badge">REVEALING</Badge>
      case 'ended':
        return <Badge color="gray" variant="outline" className="tech-badge">ENDED</Badge>
      default:
        return <Badge color="gray" variant="soft" className="tech-badge">DRAFT</Badge>
    }
  }

  return (
    <Card className="tech-card" size="3">
      <Flex direction="column" gap="4">
        {/* Header */}
        <Flex justify="between" align="center">
          {getStatusBadge()}
          <Flex align="center" gap="2">
             <ClockIcon color="gray" />
             <Text size="1" color="gray" style={{ fontFamily: 'monospace' }}>
                {new Date(topic.created_at).toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
             </Text>
          </Flex>
        </Flex>

        {/* Title & Description */}
        <Flex direction="column" gap="2">
            <Flex align="center" gap="2" justify="between">
                <Heading size="5" weight="bold" style={{ color: 'var(--tech-text-primary)' }}>
                    {topic.title}
                </Heading>
                {topic.on_chain_id && (
                    <Tooltip content="View on Suiscan">
                        <IconButton
                        size="1"
                        variant="ghost"
                        onClick={() =>
                            window.open(
                            `https://suiscan.xyz/testnet/object/${topic.on_chain_id}`,
                            '_blank'
                            )
                        }
                        style={{ cursor: 'pointer', color: 'var(--tech-text-secondary)' }}
                        >
                        <ExternalLinkIcon width="16" height="16" />
                        </IconButton>
                    </Tooltip>
                )}
            </Flex>
            <Text size="2" style={{ color: 'var(--tech-text-secondary)' }}>
                {topic.description}
            </Text>
        </Flex>

        {/* Action Area */}
        <Box 
            p="3" 
            style={{ 
                backgroundColor: 'rgba(255,255,255,0.03)', 
                borderRadius: 'var(--radius-3)',
                border: '1px solid var(--tech-border)'
            }}
        >
            {topic.on_chain_id ? (
                <Flex direction="column" gap="3">
                    
                    {/* Voting Phase UI */}
                    {status === 'voting' && (
                        <>
                             <Flex justify="between" align="center" mb="1">
                                <Flex align="center" gap="2">
                                    <LockClosedIcon width="16" height="16" color="gray" />
                                    <Text size="2" weight="bold" color="gray">Secret Ballot</Text>
                                </Flex>
                                {realtimeVotes !== null && (
                                    <Badge color="grass" variant="soft" style={{ fontSize: '1.1em' }}>
                                        <Text weight="bold">{realtimeVotes}</Text> Votes Cast
                                    </Badge>
                                )}
                             </Flex>

                             {userVotes[topic.id] ? (
                                 <Flex 
                                    align="center" 
                                    justify="center" 
                                    p="4" 
                                    direction="column" 
                                    gap="2"
                                    style={{ 
                                        backgroundColor: 'rgba(70, 167, 88, 0.1)', 
                                        borderRadius: '8px',
                                        border: '1px solid var(--tech-accent)'
                                    }}
                                 >
                                    <CheckCircledIcon width="32" height="32" color="var(--tech-accent)" />
                                    <Text weight="bold" color="grass">Vote Encrypted & Submitted</Text>
                                    <Text size="1" color="gray">Waiting for reveal phase...</Text>
                                 </Flex>
                             ) : (
                                <Grid columns="2" gap="3">
                                    <Button
                                        size="3"
                                        variant="outline"
                                        style={{ 
                                            height: 'auto', 
                                            padding: '16px', 
                                            whiteSpace: 'normal',
                                            borderColor: 'var(--tech-border)',
                                            color: 'var(--tech-text-primary)'
                                        }}
                                        onClick={() => onVote(topic, topic.option_a)}
                                        className="hover:bg-white/5 hover:border-green-500 transition-colors"
                                    >
                                        <Flex direction="column" align="center" gap="1">
                                            <Text size="2" align="center">{topic.option_a}</Text>
                                        </Flex>
                                    </Button>
                                    <Button
                                        size="3"
                                        variant="outline"
                                        style={{ 
                                            height: 'auto', 
                                            padding: '16px', 
                                            whiteSpace: 'normal',
                                            borderColor: 'var(--tech-border)',
                                            color: 'var(--tech-text-primary)'
                                        }}
                                        onClick={() => onVote(topic, topic.option_b)}
                                        className="hover:bg-white/5 hover:border-green-500 transition-colors"
                                    >
                                        <Flex direction="column" align="center" gap="1">
                                            <Text size="2" align="center">{topic.option_b}</Text>
                                        </Flex>
                                    </Button>
                                </Grid>
                             )}
                        </>
                    )}

                    {/* Revealing Phase UI */}
                    {status === 'revealing' && (
                        <Flex direction="column" align="center" gap="2" py="4">
                            <ClockIcon width="32" height="32" className="animate-pulse text-orange-500" />
                            <Heading size="3" color="orange">Revealing Votes...</Heading>
                            <Text size="2" color="gray">Decrypting via Drand Time-Lock</Text>
                            <Text size="1" color="gray" style={{ fontFamily: 'monospace' }}>
                                Ends in {Math.floor(timeRemaining / 1000)}s
                            </Text>
                        </Flex>
                    )}

                    {/* Ended Phase UI */}
                    {status === 'ended' && (
                        <Flex direction="column" gap="3">
                            <Heading size="3">Final Results</Heading>
                            
                            {/* Stats Bar */}
                            <Box 
                                style={{ 
                                    height: '40px', 
                                    backgroundColor: '#222', 
                                    borderRadius: '6px', 
                                    overflow: 'hidden', 
                                    position: 'relative',
                                    display: 'flex',
                                    border: '1px solid var(--tech-border)'
                                }}
                            >
                                {/* Draw or No Votes State */}
                                {Number(onChainData?.count_a || 0) === Number(onChainData?.count_b || 0) ? (
                                    <Flex 
                                        justify="center" 
                                        align="center" 
                                        style={{ width: '100%', height: '100%', backgroundColor: 'var(--tech-accent)' }}
                                    >
                                        <Text size="2" weight="bold" style={{ color: 'black' }}>
                                            DRAW: {topic.option_a} ({onChainData?.count_a || 0}) vs {topic.option_b} ({onChainData?.count_b || 0})
                                        </Text>
                                    </Flex>
                                ) : (
                                    <>
                                        {/* Option A (Left) */}
                                        <Box 
                                            style={{ 
                                                width: `${(Number(onChainData?.count_a || 0) / (Number(onChainData?.count_a || 0) + Number(onChainData?.count_b || 0) || 1)) * 100}%`,
                                                height: '100%',
                                                backgroundColor: Number(onChainData?.count_a) < Number(onChainData?.count_b) ? 'var(--tech-accent)' : '#EF4444',
                                                transition: 'width 1s ease-out',
                                                display: 'flex',
                                                alignItems: 'center',
                                                paddingLeft: '10px',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden'
                                            }} 
                                        >
                                            <Text size="2" weight="bold" style={{ color: 'white', textShadow: '0 1px 2px black' }}>
                                                {topic.option_a} ({onChainData?.count_a || 0})
                                            </Text>
                                        </Box>

                                        {/* Option B (Right) */}
                                        <Box 
                                            style={{ 
                                                flexGrow: 1,
                                                height: '100%',
                                                backgroundColor: Number(onChainData?.count_b) < Number(onChainData?.count_a) ? 'var(--tech-accent)' : '#EF4444',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'flex-end',
                                                paddingRight: '10px',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                transition: 'background-color 0.3s'
                                            }} 
                                        >
                                            <Text size="2" weight="bold" style={{ color: 'white', textShadow: '0 1px 2px black' }}>
                                                {topic.option_b} ({onChainData?.count_b || 0})
                                            </Text>
                                        </Box>
                                    </>
                                )}
                            </Box>

                            {/* User Outcome */}
                            {userChoice && userChoice !== 'ENCRYPTED' && (
                                <Box mt="2">
                                    {userWon ? (
                                        <Button 
                                            color="gold" 
                                            size="3" 
                                            variant="soft" 
                                            style={{ width: '100%', fontWeight: 'bold' }}
                                            onClick={() => onClaim(topic)}
                                        >
                                            🏆 {isDraw ? "It's a Draw! Refund" : "You Won! Claim Reward"}
                                        </Button>
                                    ) : (
                                        <Flex 
                                            justify="center" 
                                            align="center" 
                                            p="2" 
                                            style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid #EF4444' }}
                                        >
                                            <CrossCircledIcon color="red" className="mr-2" />
                                            <Text color="red">You joined the Majority. Better luck next time.</Text>
                                        </Flex>
                                    )}
                                </Box>
                            )}
                        </Flex>
                    )}

                </Flex>
            ) : (
                <Button 
                    size="3" 
                    color="orange" 
                    variant="soft" 
                    style={{ width: '100%' }} 
                    onClick={() => onActivate(topic)}
                >
                    🚀 Activate On-Chain
                </Button>
            )}
        </Box>
      </Flex>
    </Card>
  )
}
