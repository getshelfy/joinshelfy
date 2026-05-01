import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/unsubscribe')({
  component: UnsubscribePage,
})

type State =
  | { kind: 'loading' }
  | { kind: 'invalid'; message: string }
  | { kind: 'already' }
  | { kind: 'ready' }
  | { kind: 'submitting' }
  | { kind: 'done' }
  | { kind: 'error'; message: string }

function UnsubscribePage() {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token')
    if (!t) {
      setState({ kind: 'invalid', message: 'Missing unsubscribe token.' })
      return
    }
    setToken(t)
    fetch(`/email/unsubscribe?token=${encodeURIComponent(t)}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}))
        if (!r.ok) {
          setState({ kind: 'invalid', message: data?.error || 'Invalid or expired link.' })
          return
        }
        if (data?.valid === false && data?.reason === 'already_unsubscribed') {
          setState({ kind: 'already' })
          return
        }
        if (data?.valid) {
          setState({ kind: 'ready' })
          return
        }
        setState({ kind: 'invalid', message: 'Invalid link.' })
      })
      .catch(() => setState({ kind: 'invalid', message: 'Could not reach server.' }))
  }, [])

  async function confirm() {
    if (!token) return
    setState({ kind: 'submitting' })
    try {
      const r = await fetch('/email/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) {
        setState({ kind: 'error', message: data?.error || 'Something went wrong.' })
        return
      }
      if (data?.success) setState({ kind: 'done' })
      else if (data?.reason === 'already_unsubscribed') setState({ kind: 'already' })
      else setState({ kind: 'error', message: 'Could not unsubscribe.' })
    } catch {
      setState({ kind: 'error', message: 'Network error. Try again.' })
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="font-serif text-3xl text-foreground">Shelfy</h1>
        <div className="mt-6">
          {state.kind === 'loading' && <p className="text-muted-foreground">Checking your link…</p>}

          {state.kind === 'ready' && (
            <>
              <h2 className="font-serif text-2xl text-foreground">Unsubscribe from reminders?</h2>
              <p className="mt-3 text-muted-foreground">
                You'll stop getting expiry reminders by email. You can keep using Shelfy normally.
              </p>
              <Button className="mt-6 w-full" onClick={confirm}>
                Confirm unsubscribe
              </Button>
            </>
          )}

          {state.kind === 'submitting' && <p className="text-muted-foreground">Unsubscribing…</p>}

          {state.kind === 'done' && (
            <>
              <h2 className="font-serif text-2xl text-foreground">You're unsubscribed</h2>
              <p className="mt-3 text-muted-foreground">
                We won't email you any more reminders. Sorry to see you go.
              </p>
            </>
          )}

          {state.kind === 'already' && (
            <>
              <h2 className="font-serif text-2xl text-foreground">Already unsubscribed</h2>
              <p className="mt-3 text-muted-foreground">This link has already been used.</p>
            </>
          )}

          {state.kind === 'invalid' && (
            <>
              <h2 className="font-serif text-2xl text-foreground">Link not valid</h2>
              <p className="mt-3 text-muted-foreground">{state.message}</p>
            </>
          )}

          {state.kind === 'error' && (
            <>
              <h2 className="font-serif text-2xl text-foreground">Something went wrong</h2>
              <p className="mt-3 text-muted-foreground">{state.message}</p>
              <Button className="mt-6 w-full" onClick={confirm}>
                Try again
              </Button>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
