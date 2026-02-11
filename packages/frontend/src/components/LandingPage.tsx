import Link from 'next/link'
import { Flex, Heading, Text, Card, Grid, Box, Badge, Separator, Button } from '@radix-ui/themes'
import { Clock, Shield, Brain, Trophy, Coins, Users, Lock } from 'lucide-react'

export default function LandingPage() {
  return (
    <Flex direction="column" gap="9" py="9">
      {/* Hero Section */}
      <Flex direction="column" align="center" gap="5" style={{ textAlign: 'center' }}>
        <Badge color="ruby" size="2">Live on Sui Testnet</Badge>
        <Heading size="9" style={{ lineHeight: '1.1' }}>
          Sui Minority Game
        </Heading>
        <Text size="5" color="gray" style={{ maxWidth: 600 }}>
          Where the few rule the many. Vote on AI-generated topics, join the minority side, and win the prize pool.
        </Text>
        
        <Flex gap="4" align="center" mt="4">
           <Link href="/game">
             <Button size="4">Play Now</Button>
           </Link>
        </Flex>
      </Flex>

      <Separator size="4" />

      {/* How It Works Section */}
      <Flex direction="column" gap="6">
        <Heading size="7" align="center">How It Works</Heading>
        
        <Grid columns={{ initial: '1', sm: '2', md: '4' }} gap="4">
          <Card>
            <Flex direction="column" gap="3" p="2">
              <Box>
                <Clock size={32} className="text-blue-500" />
              </Box>
              <Heading size="4">1. Hourly Topics</Heading>
              <Text size="2" color="gray">
                Every hour, AI generates 4 new controversial topics. You have 60 minutes to cast your vote.
              </Text>
              <Badge color="blue">Cost: 0.1 SUI</Badge>
            </Flex>
          </Card>

          <Card>
            <Flex direction="column" gap="3" p="2">
              <Box>
                <Shield size={32} className="text-green-500" />
              </Box>
              <Heading size="4">2. Secret Voting</Heading>
              <Text size="2" color="gray">
                Your vote is encrypted using Time-Lock encryption. No one (not even us) can see the results until voting ends.
              </Text>
              <Badge color="green">1% Fee</Badge>
            </Flex>
          </Card>

          <Card>
            <Flex direction="column" gap="3" p="2">
              <Box>
                <Users size={32} className="text-orange-500" />
              </Box>
              <Heading size="4">3. Minority Wins</Heading>
              <Text size="2" color="gray">
                When time is up, votes are revealed. The side with FEWER votes is the winner.
              </Text>
              <Badge color="orange">Win Big</Badge>
            </Flex>
          </Card>

          <Card>
            <Flex direction="column" gap="3" p="2">
              <Box>
                <Trophy size={32} className="text-yellow-500" />
              </Box>
              <Heading size="4">4. Claim Rewards</Heading>
              <Text size="2" color="gray">
                Winners get their principal back PLUS an equal share of the losers' total stake.
              </Text>
              <Badge color="yellow">Instant Payout</Badge>
            </Flex>
          </Card>
        </Grid>
      </Flex>

      {/* Features / Tech Section */}
      <Card style={{ backgroundColor: 'var(--gray-2)' }}>
        <Flex direction={{ initial: 'column', md: 'row' }} gap="6" p="4" align="center">
            <Flex direction="column" gap="4" flexGrow="1">
                <Heading size="6">Powered by Advanced Tech</Heading>
                <Flex gap="3" direction="column">
                    <Flex gap="3" align="center">
                        <Brain size={20} />
                        <Text><strong>AI-Generated Content:</strong> Never run out of interesting topics.</Text>
                    </Flex>
                    <Flex gap="3" align="center">
                        <Lock width={20} height={20} />
                        <Text><strong>Drand Time-Lock:</strong> Cryptographically guaranteed fairness.</Text>
                    </Flex>
                    <Flex gap="3" align="center">
                        <Coins size={20} />
                        <Text><strong>Sui Smart Contracts:</strong> Transparent, fast, and secure payouts.</Text>
                    </Flex>
                </Flex>
            </Flex>
            <Box>
                <Heading size="8" color="gray">🤖 ⚡ 🔒</Heading>
            </Box>
        </Flex>
      </Card>

      <Flex direction="column" align="center" gap="2">
        <Text size="2" color="gray">Ready to test your luck and strategy?</Text>
        <Link href="/game">
             <Button size="3">Get Started</Button>
        </Link>
      </Flex>
    </Flex>
  )
}
