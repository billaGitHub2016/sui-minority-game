
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
      const { topic_id, user_address, choice, salt, tx_digest } = await request.json()
      
      // Store backup securely (using Service Role to bypass RLS if needed, though user should be able to write their own)
      // We upsert based on user + topic
      const { data, error } = await supabase.from('vote_backups').upsert({
          topic_id,
          user_address,
          choice,
          salt,
          tx_digest,
          status: 'committed'
      }, { onConflict: 'topic_id, user_address' }).select()

      if (error) throw error

      return NextResponse.json({ success: true, data })
  } catch (e) {
      console.error("Backup failed:", e)
      return NextResponse.json({ error: 'Backup failed' }, { status: 500 })
  }
}
