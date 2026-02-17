'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Box, Card, Flex, Text, Heading, Badge, Avatar, Table, ScrollArea } from '@radix-ui/themes'
import { Trophy, ExternalLink, Medal } from 'lucide-react'

type LeaderboardItem = {
  user_address: string
  total_rewards: number
}

export default function LeaderboardTicker() {
  const [leaders, setLeaders] = useState<LeaderboardItem[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchLeaderboard = async () => {
      const { data, error } = await supabase
        .from('leaderboard')
        .select('*')
        .order('total_rewards', { ascending: false })
        .limit(30)

      if (error) {
        console.error('Error fetching leaderboard:', error)
      } else {
        setLeaders(data || [])
      }
      setLoading(false)
    }

    fetchLeaderboard()
    const interval = setInterval(fetchLeaderboard, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) return null
  if (leaders.length === 0) return null

  const formatAddress = (addr: string) => {
    if (!addr) return 'Unknown'
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const formatAmount = (amount: number) => {
    // return new Intl.NumberFormat('en-US', {
    //   minimumFractionDigits: 0,
    //   maximumFractionDigits: 2,
    // }).format(amount)
    return (amount / 1000000000).toFixed(2)
  }

  const getRankIcon = (index: number) => {
    // if (index === 0) return <Medal size={20} className="text-yellow-400" fill="currentColor" />
    // if (index === 1) return <Medal size={20} className="text-gray-300" fill="currentColor" />
    // if (index === 2) return <Medal size={20} className="text-amber-700" fill="currentColor" />
    return <Text color="gray" size="2" weight="bold">#{index + 1}</Text>
  }

  return (
    <Card 
        className="tech-card"
        style={{ 
            width: '100%', 
            maxWidth: '600px', 
            marginTop: '40px',
            padding: '0',
            overflow: 'hidden',
            background: 'rgba(255, 255, 255, 0.03)',
            backdropFilter: 'blur(10px)',
            border: '1px solid var(--tech-border)'
        }}
    >
      <Box p="4" style={{ borderBottom: '1px solid var(--tech-border)', background: 'rgba(0,0,0,0.2)' }}>
        <Flex align="center" justify="between">
            <Flex align="center" gap="2">
                <Trophy size={20} className="text-yellow-400" />
                <Heading size="4" style={{ color: 'var(--tech-accent)' }}>Hall of Fame</Heading>
            </Flex>
            <Badge color="grass" variant="soft">Top 30 Winners</Badge>
        </Flex>
      </Box>

      <ScrollArea type="auto" scrollbars="vertical" style={{ height: '400px' }}>
        <Table.Root variant="surface" style={{ width: '100%', background: 'transparent' }}>
            <Table.Header>
                <Table.Row style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <Table.ColumnHeaderCell width="60px">Rank</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Player</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell align="right">Total Won</Table.ColumnHeaderCell>
                </Table.Row>
            </Table.Header>

            <Table.Body>
                {leaders.map((leader, index) => (
                    <Table.Row key={leader.user_address} className="hover:bg-white/5 transition-colors">
                        <Table.RowHeaderCell>
                            <Flex align="center" justify="center">
                                {getRankIcon(index)}
                            </Flex>
                        </Table.RowHeaderCell>
                        <Table.Cell>
                            <a 
                                href={`https://suiscan.xyz/testnet/account/${leader.user_address}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 group text-decoration-none"
                            >
                                {/* <Avatar 
                                    size="1" 
                                    radius="full" 
                                    fallback={leader.user_address.slice(2,4).toUpperCase()} 
                                    color={index < 3 ? 'gold' : 'gray'}
                                    variant="soft"
                                /> */}
                                <Text size="2" className="group-hover:text-blue-400 transition-colors font-mono">
                                    {formatAddress(leader.user_address)}
                                </Text>
                                <ExternalLink size={12} className="opacity-0 group-hover:opacity-50 transition-opacity" />
                            </a>
                        </Table.Cell>
                        <Table.Cell align="right">
                            <Text weight="bold" style={{ color: '#46A758' }}>
                                {formatAmount(leader.total_rewards)} <span className="text-xs text-gray-500">SUI</span>
                            </Text>
                        </Table.Cell>
                    </Table.Row>
                ))}
            </Table.Body>
        </Table.Root>
      </ScrollArea>
    </Card>
  )
}
