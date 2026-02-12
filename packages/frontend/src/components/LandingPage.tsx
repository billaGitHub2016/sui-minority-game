import Link from 'next/link'
import { Flex, Heading, Text, Card, Grid, Box, Badge, Separator, Button } from '@radix-ui/themes'
import { Clock, Shield, Brain, Trophy, Coins, Users, Lock, Zap } from 'lucide-react'

export default function LandingPage() {
  return (
    <Flex direction="column" gap="9" py="9">
      {/* Hero Section */}
      <Flex direction="column" align="center" gap="6" style={{ textAlign: 'center', position: 'relative', overflow: 'hidden', padding: '60px 20px' }}>
        
        {/* Animated Background Grid */}
        <div className="tech-grid-background" />
        
        {/* Background Glow Effect */}
        <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '600px',
            height: '300px',
            background: 'radial-gradient(circle, rgba(70, 167, 88, 0.4) 0%, rgba(0,0,0,0) 70%)',
            zIndex: -1,
            pointerEvents: 'none',
            animation: 'pulse-scale 3s infinite ease-in-out',
            filter: 'blur(40px)'
        }} />

        <Badge 
            color="grass" 
            variant="outline" 
            size="2" 
            style={{ 
                borderColor: 'var(--tech-accent)', 
                color: 'var(--tech-accent)',
                backgroundColor: 'rgba(70, 167, 88, 0.1)',
                backdropFilter: 'blur(5px)'
            }}
        >
            <Zap size={12} style={{ marginRight: 4 }} /> Live on Sui Testnet
        </Badge>

        <Heading size="9" style={{ lineHeight: '1.1', fontWeight: 800, letterSpacing: '-0.02em', position: 'relative' }}>
          <span style={{ color: 'white' }}>Sui</span> 
          <span style={{ 
              background: 'linear-gradient(to right, #46A758, #86efac)', 
              WebkitBackgroundClip: 'text', 
              WebkitTextFillColor: 'transparent',
              marginLeft: '10px'
          }}>
            Minority Game
          </span>
        </Heading>

        <Text size="5" style={{ maxWidth: 600, color: 'var(--tech-text-secondary)' }}>
          Where the few rule the many. Vote on AI-generated topics, join the minority side, and win the prize pool.
        </Text>
        
        <Flex gap="4" align="center" mt="4">
           <Link href="/game">
             <Button 
                size="4" 
                className="tech-hero-button"
                style={{ cursor: 'pointer' }}
             >
                Play Now
             </Button>
           </Link>
        </Flex>
      </Flex>

      <Separator size="4" style={{ opacity: 0.1 }} />

      {/* How It Works Section */}
      <Flex direction="column" gap="6">
        <Flex direction="column" align="center" gap="2">
            <Heading size="7" align="center">How It Works</Heading>
            <Text color="gray">Simple rules. High stakes.</Text>
        </Flex>
        
        <Grid columns={{ initial: '1', sm: '2', md: '4' }} gap="4">
          <Card className="tech-grid-card">
            <Flex direction="column" gap="3" p="2">
              <Box>
                <Clock size={32} className="text-blue-400" />
              </Box>
              <Heading size="4" style={{ color: 'white' }}>1. Hourly Topics</Heading>
              <Text size="2" style={{ color: 'var(--tech-text-secondary)' }}>
                Every hour, AI generates 4 new controversial topics. You have 60 minutes to cast your vote.
              </Text>
              <Badge color="blue" variant="soft">Cost: 0.1 SUI</Badge>
            </Flex>
          </Card>

          <Card className="tech-grid-card">
            <Flex direction="column" gap="3" p="2">
              <Box>
                <Shield size={32} className="text-green-400" />
              </Box>
              <Heading size="4" style={{ color: 'white' }}>2. Secret Voting</Heading>
              <Text size="2" style={{ color: 'var(--tech-text-secondary)' }}>
                Your vote is encrypted using Time-Lock encryption. No one (not even us) can see the results until voting ends.
              </Text>
              <Badge color="grass" variant="soft">1% Fee</Badge>
            </Flex>
          </Card>

          <Card className="tech-grid-card">
            <Flex direction="column" gap="3" p="2">
              <Box>
                <Users size={32} className="text-orange-400" />
              </Box>
              <Heading size="4" style={{ color: 'white' }}>3. Minority Wins</Heading>
              <Text size="2" style={{ color: 'var(--tech-text-secondary)' }}>
                When time is up, votes are revealed. The side with FEWER votes is the winner.
              </Text>
              <Badge color="orange" variant="soft">Win Big</Badge>
            </Flex>
          </Card>

          <Card className="tech-grid-card">
            <Flex direction="column" gap="3" p="2">
              <Box>
                <Trophy size={32} className="text-yellow-400" />
              </Box>
              <Heading size="4" style={{ color: 'white' }}>4. Claim Rewards</Heading>
              <Text size="2" style={{ color: 'var(--tech-text-secondary)' }}>
                Winners get their principal back PLUS an equal share of the losers' total stake.
              </Text>
              <Badge color="yellow" variant="soft">Instant Payout</Badge>
            </Flex>
          </Card>
        </Grid>
      </Flex>

      {/* Features / Tech Section */}
      <Card style={{ 
          background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)', 
          border: '1px solid var(--tech-border)' 
      }}>
        <Flex direction={{ initial: 'column', md: 'row' }} gap="6" p="4" align="center">
            <Flex direction="column" gap="4" flexGrow="1">
                <Heading size="6" style={{ color: 'var(--tech-accent)' }}>Powered by Advanced Tech</Heading>
                <Flex gap="3" direction="column">
                    <Flex gap="3" align="center">
                        <Brain size={20} color="var(--tech-text-secondary)" />
                        <Text style={{ color: 'var(--tech-text-primary)' }}><strong>AI-Generated Content:</strong> Never run out of interesting topics.</Text>
                    </Flex>
                    <Flex gap="3" align="center">
                        <Lock width={20} height={20} color="var(--tech-text-secondary)" />
                        <Text style={{ color: 'var(--tech-text-primary)' }}><strong>Drand Time-Lock:</strong> Cryptographically guaranteed fairness.</Text>
                    </Flex>
                    <Flex gap="3" align="center">
                        <Coins size={20} color="var(--tech-text-secondary)" />
                        <Text style={{ color: 'var(--tech-text-primary)' }}><strong>Sui Smart Contracts:</strong> Transparent, fast, and secure payouts.</Text>
                    </Flex>
                </Flex>
            </Flex>
            <Box>
                <Heading size="8" style={{ opacity: 0.5 }}>🤖 ⚡ 🔒</Heading>
            </Box>
        </Flex>
      </Card>

      <Flex direction="column" align="center" gap="4" mt="4">
        <Text size="3" color="gray">Ready to test your luck and strategy?</Text>
        <Link href="/game">
             <Button 
                size="3" 
                variant="outline" 
                style={{ 
                    borderColor: 'var(--tech-accent)', 
                    color: 'var(--tech-accent)',
                    cursor: 'pointer'
                }}
                className="hover:bg-green-900/20"
             >
                Enter the Arena
             </Button>
        </Link>
      </Flex>
    </Flex>
  )
}
