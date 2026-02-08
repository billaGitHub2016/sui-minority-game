
'use client'

import { createClient } from '@/utils/supabase/client'
import { Button, Heading, Text, Flex, Card } from '@radix-ui/themes'

export default function LoginPage() {
  const supabase = createClient()

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${location.origin}/auth/callback`,
      },
    })
  }

  return (
    <Flex height="100vh" align="center" justify="center" style={{ backgroundColor: 'var(--gray-2)' }}>
      <Card size="4" style={{ width: 400, padding: 30 }}>
        <Flex direction="column" gap="4" align="center">
          <Heading as="h2" size="6">Sui Minority Report</Heading>
          <Text size="2" color="gray">Sign in to join the game</Text>
          <Button onClick={handleLogin} size="3" style={{ width: '100%', cursor: 'pointer' }}>
            Sign in with Google
          </Button>
        </Flex>
      </Card>
    </Flex>
  )
}
