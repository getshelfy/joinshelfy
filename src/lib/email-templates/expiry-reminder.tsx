import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Button, Hr,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

const SITE_NAME = 'Shelfy'
const APP_URL = 'https://joinshelfy.lovable.app'

interface ExpiryItem {
  name: string
  expiry_date: string
}

interface ExpiryReminderProps {
  firstName?: string
  windowLabel?: '3day' | '1day'
  items?: ExpiryItem[]
}

const ExpiryReminderEmail = ({
  firstName,
  windowLabel = '3day',
  items = [],
}: ExpiryReminderProps) => {
  const isUrgent = windowLabel === '1day'
  const count = items.length
  const names = items.map((i) => i.name)
  const namesText =
    names.length <= 1
      ? names[0] || 'an item'
      : names.length === 2
      ? `${names[0]} and ${names[1]}`
      : `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`

  const headline = isUrgent
    ? count === 1
      ? `Last chance — your ${names[0]} expires tomorrow`
      : `Last chance — ${count} items expire tomorrow`
    : count === 1
    ? `Heads up — your ${names[0]} expires in 3 days`
    : `Heads up — ${count} items expire in 3 days`

  const body = isUrgent
    ? `Don't let ${namesText} go to waste. Open ${SITE_NAME} for a quick recipe idea.`
    : `You've got time to plan a meal around ${namesText}. Open ${SITE_NAME} to see recipe ideas.`

  const greeting = firstName ? `Hi ${firstName},` : 'Hi there,'

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{headline}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={brand}>{SITE_NAME}</Heading>
          <Heading style={h1}>{headline}</Heading>
          <Text style={text}>{greeting}</Text>
          <Text style={text}>{body}</Text>

          {count > 1 ? (
            <Section style={listBox}>
              {items.map((it) => (
                <Text key={it.name} style={listItem}>
                  • {it.name}
                </Text>
              ))}
            </Section>
          ) : null}

          <Section style={{ textAlign: 'center', margin: '28px 0 8px' }}>
            <Button href={`${APP_URL}/recipes`} style={button}>
              See recipe ideas
            </Button>
          </Section>

          <Hr style={hr} />
          <Text style={footer}>
            You're getting this because you have items in {SITE_NAME}. We send at
            most two reminders per item — one 3 days before, one the day before.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: ExpiryReminderEmail,
  subject: (data: Record<string, any>) => {
    const items = (data?.items ?? []) as ExpiryItem[]
    const isUrgent = data?.windowLabel === '1day'
    const count = items.length
    if (isUrgent) {
      return count === 1
        ? `Last chance — ${items[0]?.name ?? 'an item'} expires tomorrow`
        : `${count} items expire tomorrow`
    }
    return count === 1
      ? `${items[0]?.name ?? 'An item'} expires in 3 days`
      : `${count} items expire in 3 days`
  },
  displayName: 'Expiry reminder',
  previewData: {
    firstName: 'Sam',
    windowLabel: '1day',
    items: [
      { name: 'Whole Milk', expiry_date: '2026-05-02' },
      { name: 'Baby Spinach', expiry_date: '2026-05-02' },
      { name: 'Greek Yogurt', expiry_date: '2026-05-02' },
    ],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif', margin: 0, padding: 0 }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const brand = { fontFamily: 'Fraunces, Georgia, serif', fontSize: '20px', color: '#2D9B6F', margin: '0 0 24px', fontWeight: 600 as const }
const h1 = { fontFamily: 'Fraunces, Georgia, serif', fontSize: '24px', color: '#1C1C1A', lineHeight: '1.25', margin: '0 0 20px', fontWeight: 600 as const }
const text = { fontSize: '15px', color: '#333333', lineHeight: '1.6', margin: '0 0 14px' }
const listBox = { backgroundColor: '#F4F1EA', borderRadius: '12px', padding: '14px 18px', margin: '8px 0 4px' }
const listItem = { fontSize: '15px', color: '#1C1C1A', margin: '4px 0' }
const button = { backgroundColor: '#2D9B6F', color: '#ffffff', padding: '12px 24px', borderRadius: '999px', textDecoration: 'none', fontWeight: 600 as const, fontSize: '15px', display: 'inline-block' }
const hr = { borderColor: '#EAE6DC', margin: '32px 0 16px' }
const footer = { fontSize: '12px', color: '#888', lineHeight: '1.5', margin: 0 }
