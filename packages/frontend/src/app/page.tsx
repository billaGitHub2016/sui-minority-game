
'use client'

import { createClient } from '@/utils/supabase/client'
import MinorityGame from '@/components/MinorityGame'
import { Button, Container, Flex, Heading, Text } from '@radix-ui/themes'
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit'
import Link from 'next/link'

export default function Home() {
  const account = useCurrentAccount()
  // const supabase = createClient() // Supabase client not needed for auth check anymore

  return (
    <Container size="3" p="4">
      <Flex direction="column" gap="6">
        <Flex justify="between" align="center">
            <Heading>Sui Minority Report</Heading>
            <Flex gap="3" align="center">
                <ConnectButton />
            </Flex>
        </Flex>

        {account ? (
            <MinorityGame />
        ) : (
            <Flex direction="column" align="center" gap="4" py="9">
                <Heading size="8">Welcome to the Minority Game</Heading>
                <Text size="5" align="center">
                    Vote on controversial topics. The minority wins.<br/>
                    Powered by Sui Blockchain & AI.
                </Text>
                <Text size="3" color="gray">Connect your wallet to start playing.</Text>
                <ConnectButton />
            </Flex>
        )}
      </Flex>
    </Container>
  )
}
