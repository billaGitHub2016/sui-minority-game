
'use client'

import { createClient } from '@/utils/supabase/client'
import MinorityGame from '@/components/MinorityGame'
import LandingPage from '@/components/LandingPage'
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
            <LandingPage />
        )}
      </Flex>
    </Container>
  )
}
