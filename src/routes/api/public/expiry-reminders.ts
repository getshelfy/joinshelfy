// Daily cron endpoint — runs at 5pm in each user's local timezone (server cron
// fires hourly; we filter by each user's local hour). Sends at most one email
// per user per run, batching all expiring items into a single message.
//
// Rules:
//  - 3 days before expiry: "Heads up" reminder
//  - 1 day before expiry: "Last chance" reminder
//  - Never send between 10pm and 8am local time
//  - One reminder per (item, type) — tracked in expiry_reminder_log
//  - All items expiring on the same day are batched into one email
//  - Honors suppression list (handled by send-transactional-email)

import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'

const QUIET_START = 22 // 10pm
const QUIET_END = 8 // 8am
const PREFERRED_HOUR = 17 // 5pm local

interface FoodItem {
  id: string
  user_id: string
  name: string
  expiry_date: string
}

interface AuthUser {
  id: string
  email: string | null
  user_metadata: Record<string, any>
  raw_user_meta_data?: Record<string, any>
}

function localHour(timeZone: string): number {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      hour12: false,
    })
    return parseInt(fmt.format(new Date()), 10)
  } catch {
    return new Date().getUTCHours()
  }
}

function localDateISO(timeZone: string): string {
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    return fmt.format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export const Route = createFileRoute('/api/public/expiry-reminders')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = process.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        const cronSecret = process.env.EXPIRY_CRON_SECRET

        if (!supabaseUrl || !serviceKey) {
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }

        // Auth: require either the service role key OR the cron secret
        const auth = request.headers.get('Authorization') || ''
        const provided = auth.replace(/^Bearer\s+/i, '').trim()
        const apikey = request.headers.get('apikey') || ''
        const ok =
          (cronSecret && (provided === cronSecret || apikey === cronSecret)) ||
          provided === serviceKey ||
          apikey === serviceKey
        if (!ok) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const supabase = createClient(supabaseUrl, serviceKey)

        // 1. Pull all auth users (paged) so we can check each user's timezone & profile
        const users: AuthUser[] = []
        let page = 1
        while (true) {
          const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
          if (error) {
            console.error('Failed to list users', error)
            return Response.json({ error: 'Failed to list users' }, { status: 500 })
          }
          for (const u of data.users) users.push(u as unknown as AuthUser)
          if (data.users.length < 1000) break
          page++
          if (page > 20) break // safety
        }

        let processed = 0
        let queued = 0

        for (const user of users) {
          if (!user.email) continue

          const meta = user.user_metadata || (user as any).raw_user_meta_data || {}
          const tz: string = meta.timezone || meta.tz || 'UTC'
          const hour = localHour(tz)

          // Quiet hours: never between 10pm and 8am local time
          if (hour >= QUIET_START || hour < QUIET_END) continue
          // Only send at the preferred hour (5pm local). The cron fires hourly,
          // so each user gets exactly one chance per day at their local 5pm.
          if (hour !== PREFERRED_HOUR) continue

          const today = localDateISO(tz)
          const day3 = addDays(today, 3)
          const day1 = addDays(today, 1)

          // 2. Pull this user's active items expiring exactly 3 days or 1 day from now
          const { data: items, error: itemsErr } = await supabase
            .from('food_items')
            .select('id,user_id,name,expiry_date')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .in('expiry_date', [day3, day1])

          if (itemsErr) {
            console.error('Failed to load items', { user_id: user.id, error: itemsErr })
            continue
          }
          if (!items || items.length === 0) continue

          // 3. Filter out items already reminded for this window
          const itemIds = items.map((i: FoodItem) => i.id)
          const { data: alreadySent } = await supabase
            .from('expiry_reminder_log')
            .select('food_item_id, reminder_type')
            .in('food_item_id', itemIds)

          const sentSet = new Set(
            (alreadySent || []).map((r: any) => `${r.food_item_id}:${r.reminder_type}`),
          )

          const toRemind3day: FoodItem[] = []
          const toRemind1day: FoodItem[] = []
          for (const it of items as FoodItem[]) {
            const type = it.expiry_date === day1 ? '1day' : '3day'
            if (sentSet.has(`${it.id}:${type}`)) continue
            if (type === '1day') toRemind1day.push(it)
            else toRemind3day.push(it)
          }

          // 4. Send at most ONE email per user per run.
          // Prioritize 1-day urgency over 3-day heads-up. (If both buckets have
          // items, 3-day items will be picked up tomorrow as 2-day items expire
          // — they still get their 1-day reminder. We never send two emails
          // back-to-back to the same user.)
          let bucket: { type: '1day' | '3day'; items: FoodItem[] } | null = null
          if (toRemind1day.length > 0) bucket = { type: '1day', items: toRemind1day }
          else if (toRemind3day.length > 0) bucket = { type: '3day', items: toRemind3day }
          if (!bucket) continue

          processed++

          // 5. Pre-mark as sent BEFORE enqueuing — prevents duplicates if the
          // cron runs twice (idempotent: unique (food_item_id, reminder_type))
          const logRows = bucket.items.map((it) => ({
            user_id: user.id,
            food_item_id: it.id,
            reminder_type: bucket!.type,
            expiry_date: it.expiry_date,
          }))

          const { error: logErr } = await supabase
            .from('expiry_reminder_log')
            .insert(logRows)
          if (logErr) {
            // If insert failed entirely (not unique violation), skip — we'd risk dupes
            if (!String(logErr.message || '').includes('duplicate')) {
              console.error('Failed to log reminder', { user_id: user.id, error: logErr })
              continue
            }
          }

          // 6. Render + enqueue via shared transactional pipeline
          const firstName =
            meta.first_name ||
            meta.given_name ||
            (typeof meta.full_name === 'string' ? meta.full_name.split(' ')[0] : undefined) ||
            (typeof meta.name === 'string' ? meta.name.split(' ')[0] : undefined)

          const messageId = crypto.randomUUID()
          const idempotencyKey = `expiry-${user.id}-${today}-${bucket.type}`

          // Check suppression
          const { data: suppressed } = await supabase
            .from('suppressed_emails')
            .select('id')
            .eq('email', user.email.toLowerCase())
            .maybeSingle()
          if (suppressed) continue

          // Get / create unsubscribe token
          const normalized = user.email.toLowerCase()
          let unsubToken: string
          const { data: tok } = await supabase
            .from('email_unsubscribe_tokens')
            .select('token, used_at')
            .eq('email', normalized)
            .maybeSingle()
          if (tok && !tok.used_at) {
            unsubToken = tok.token
          } else if (!tok) {
            const bytes = new Uint8Array(32)
            crypto.getRandomValues(bytes)
            unsubToken = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
            await supabase
              .from('email_unsubscribe_tokens')
              .upsert({ token: unsubToken, email: normalized }, { onConflict: 'email', ignoreDuplicates: true })
            const { data: re } = await supabase
              .from('email_unsubscribe_tokens')
              .select('token')
              .eq('email', normalized)
              .maybeSingle()
            unsubToken = re?.token || unsubToken
          } else {
            continue // token used = unsubscribed (should be in suppressed list)
          }

          // Render template
          const React = (await import('react')).default
          const { render } = await import('@react-email/components')
          const { TEMPLATES } = await import('@/lib/email-templates/registry')
          const tpl = TEMPLATES['expiry-reminder']
          const data = {
            firstName,
            windowLabel: bucket.type,
            items: bucket.items.map((i) => ({ name: i.name, expiry_date: i.expiry_date })),
          }
          const element = React.createElement(tpl.component, data)
          const html = await render(element)
          const text = await render(element, { plainText: true })
          const subject = typeof tpl.subject === 'function' ? tpl.subject(data) : tpl.subject

          await supabase.from('email_send_log').insert({
            message_id: messageId,
            template_name: 'expiry-reminder',
            recipient_email: user.email,
            status: 'pending',
          })

          const { error: enqErr } = await supabase.rpc('enqueue_email', {
            queue_name: 'transactional_emails',
            payload: {
              message_id: messageId,
              to: user.email,
              from: 'Shelfy <noreply@notify.tryshelfy.com>',
              sender_domain: 'notify.tryshelfy.com',
              subject,
              html,
              text,
              purpose: 'transactional',
              label: 'expiry-reminder',
              idempotency_key: idempotencyKey,
              unsubscribe_token: unsubToken,
              queued_at: new Date().toISOString(),
            },
          })

          if (enqErr) {
            console.error('Failed to enqueue reminder', { user_id: user.id, error: enqErr })
            // Roll back the log so we retry next run
            await supabase
              .from('expiry_reminder_log')
              .delete()
              .in(
                'food_item_id',
                bucket.items.map((i) => i.id),
              )
              .eq('reminder_type', bucket.type)
            continue
          }

          queued++
        }

        return Response.json({ ok: true, processed, queued, users: users.length })
      },
    },
  },
})
