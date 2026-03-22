import React from 'npm:react@18.3.1'
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'
import { Resend } from 'https://esm.sh/resend@4.0.0'
import { renderAsync } from 'https://esm.sh/@react-email/components@0.0.22?bundle'
import { ConfirmationEmail } from './_templates/confirmation.tsx'

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string)
const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET') as string

const SUBJECTS: Record<string, string> = {
  recovery:     'Reset your Hunter password',
  magiclink:    'Your Hunter login link',
  email_change: 'Confirm your new Hunter email',
  signup:       'Confirm your Hunter account',
  email:        'Confirm your Hunter account',
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('not allowed', { status: 400 })
  }

  const payload = await req.text()
  const headers = Object.fromEntries(req.headers)
  const wh = new Webhook(hookSecret)

  try {
    const {
      user,
      email_data: { token_hash, redirect_to, email_action_type },
    } = wh.verify(payload, headers) as {
      user: { email: string }
      email_data: {
        token: string
        token_hash: string
        redirect_to: string
        email_action_type: string
        site_url: string
        token_new: string
        token_hash_new: string
      }
    }

    const subject = SUBJECTS[email_action_type] ?? SUBJECTS.email

    const html = await renderAsync(
      React.createElement(ConfirmationEmail, {
        supabase_url: Deno.env.get('SUPABASE_URL') ?? '',
        token_hash,
        redirect_to: redirect_to || Deno.env.get('SITE_URL') || 'https://usehunter.app',
        email_action_type,
      })
    )

    const { error } = await resend.emails.send({
      from: 'Hunter <noreply@usehunter.app>',
      to: [user.email],
      subject,
      html,
    })

    if (error) {
      console.error('Resend error:', error)
      throw error
    }

    console.log(`Auth email sent — type: ${email_action_type}, to: ${user.email}`)
  } catch (error: unknown) {
    console.error('send-auth-email error:', error)
    const err = error as Record<string, unknown>
    return new Response(
      JSON.stringify({
        error: {
          http_code: err.code,
          message: err.message ?? 'Unknown error',
        },
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
