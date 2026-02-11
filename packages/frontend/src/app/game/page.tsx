'use client'

import MinorityGame from '@/components/MinorityGame'
import { Container, Flex, Heading } from '@radix-ui/themes'
import { ConnectButton } from '@mysten/dapp-kit'

export default function GamePage() {
  return (
    <Container size="3" p="4">
      <Flex direction="column" gap="6">
        <Flex justify="between" align="center">
        </Flex>
        <MinorityGame />
      </Flex>
    </Container>
  )
}
