
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import MinorityGame from '@/components/MinorityGame'
import { Button, Container, Flex, Heading, Text } from '@radix-ui/themes'
import { ConnectButton } from '@mysten/dapp-kit'
import Link from 'next/link'

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()
  }, [])

  return (
    <Container size="3" p="4">
      <Flex direction="column" gap="6">
        <Flex justify="between" align="center">
            <Heading>Sui Minority Report</Heading>
            <Flex gap="3" align="center">
                <ConnectButton />
                {user ? (
                    <Button variant="soft" onClick={() => supabase.auth.signOut().then(() => setUser(null))}>
                        Sign Out
                    </Button>
                ) : (
                    <Link href="/login">
                        <Button>Sign In</Button>
                    </Link>
                )}
            </Flex>
        </Flex>

        {user ? (
            <MinorityGame />
        ) : (
            <Flex direction="column" align="center" gap="4" py="9">
                <Heading size="8">Welcome to the Minority Game</Heading>
                <Text size="5" align="center">
                    Vote on controversial topics. The minority wins.<br/>
                    Powered by Sui Blockchain & AI.
                </Text>
                <Link href="/login">
                    <Button size="4">Get Started</Button>
                </Link>
            </Flex>
        )}
      </Flex>
    </Container>
  )
}
