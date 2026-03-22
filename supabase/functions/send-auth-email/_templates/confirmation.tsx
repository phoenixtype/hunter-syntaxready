import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
  Section,
  Hr,
  Row,
  Column,
} from 'https://esm.sh/@react-email/components@0.0.22?deps=react@18.3.1'
import * as React from 'https://esm.sh/react@18.3.1'

interface ConfirmationEmailProps {
  supabase_url: string
  token_hash: string
  redirect_to: string
  email_action_type: string
}

type ActionConfig = {
  preview: string
  heading: string
  body: string
  buttonText: string
  footerNote: string
}

function getActionConfig(type: string): ActionConfig {
  switch (type) {
    case 'recovery':
      return {
        preview: 'Reset your Hunter password — link expires in 1 hour.',
        heading: 'Reset your password',
        body: "We received a request to reset the password for your Hunter account. Click the button below to choose a new password. This link expires in 1 hour.",
        buttonText: 'Reset Password',
        footerNote: "If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.",
      }
    case 'magiclink':
      return {
        preview: 'Your one-click login link for Hunter.',
        heading: 'Your login link',
        body: "Here's your one-click login link for Hunter. This link is single-use and expires in 1 hour — don't share it with anyone.",
        buttonText: 'Log in to Hunter',
        footerNote: "If you didn't request this link, you can safely ignore this email.",
      }
    case 'email_change':
      return {
        preview: 'Confirm your new email address for Hunter.',
        heading: 'Confirm your new email',
        body: "You've requested to change your email address on Hunter. Click the button below to confirm this change. If you didn't make this request, please contact us immediately.",
        buttonText: 'Confirm New Email',
        footerNote: "If you didn't request this change, please contact support@syntaxready.com immediately.",
      }
    case 'signup':
    case 'email':
    default:
      return {
        preview: 'Confirm your Hunter account and start your job search.',
        heading: 'Confirm your account',
        body: "Welcome to Hunter — your AI-powered job search companion. Confirm your email address to activate your account and unlock AI resume tailoring, interview coaching, and smart job matching.",
        buttonText: 'Confirm Email Address',
        footerNote: "If you didn't create a Hunter account, you can safely ignore this email.",
      }
  }
}

export const ConfirmationEmail = ({
  supabase_url,
  token_hash,
  redirect_to,
  email_action_type,
}: ConfirmationEmailProps) => {
  const confirmUrl = `${supabase_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`
  const config = getActionConfig(email_action_type)

  return (
    <Html lang="en">
      <Head />
      <Preview>{config.preview}</Preview>
      <Body style={main}>
        <Container style={container}>

          {/* ── Logo ─────────────────────────────────────── */}
          <Section style={logoSection}>
            <Row>
              <Column align="center">
                <div style={logoCircle}>
                  <span style={logoLetter}>H</span>
                </div>
                <Text style={brandName}>Hunter</Text>
              </Column>
            </Row>
          </Section>

          {/* ── Card ─────────────────────────────────────── */}
          <Section style={card}>
            <Heading style={heading}>{config.heading}</Heading>
            <Text style={bodyText}>{config.body}</Text>

            <Section style={buttonWrapper}>
              <Link href={confirmUrl} style={button}>
                {config.buttonText}
              </Link>
            </Section>

            <Hr style={divider} />

            <Text style={fallbackLabel}>
              Button not working? Copy and paste this link into your browser:
            </Text>
            <Text style={fallbackLink}>{confirmUrl}</Text>
          </Section>

          {/* ── Footer ───────────────────────────────────── */}
          <Section style={footerSection}>
            <Text style={footerNote}>{config.footerNote}</Text>
            <Text style={footerMeta}>
              © {new Date().getFullYear()} Hunter by SyntaxReady Inc. ·{' '}
              <Link href="https://usehunter.app/privacy" style={footerLink}>
                Privacy Policy
              </Link>{' '}
              ·{' '}
              <Link href="mailto:support@syntaxready.com" style={footerLink}>
                Contact Support
              </Link>
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  )
}

export default ConfirmationEmail

/* ── Styles ─────────────────────────────────────────────────────────── */

const main = {
  backgroundColor: '#f3f4f6',
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  margin: '0',
  padding: '0',
}

const container = {
  margin: '0 auto',
  padding: '40px 20px 60px',
  maxWidth: '560px',
}

const logoSection = {
  textAlign: 'center' as const,
  marginBottom: '24px',
}

const logoCircle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '44px',
  height: '44px',
  borderRadius: '50%',
  backgroundColor: '#10b981',
  margin: '0 auto 8px',
}

const logoLetter = {
  color: '#ffffff',
  fontSize: '20px',
  fontWeight: '700',
  lineHeight: '1',
}

const brandName = {
  color: '#111827',
  fontSize: '16px',
  fontWeight: '700',
  letterSpacing: '-0.3px',
  margin: '0',
}

const card = {
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  border: '1px solid #e5e7eb',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04)',
  padding: '36px 40px',
}

const heading = {
  color: '#111827',
  fontSize: '22px',
  fontWeight: '700',
  lineHeight: '1.3',
  margin: '0 0 12px',
  padding: '0',
  letterSpacing: '-0.3px',
}

const bodyText = {
  color: '#4b5563',
  fontSize: '15px',
  lineHeight: '1.65',
  margin: '0 0 28px',
}

const buttonWrapper = {
  textAlign: 'center' as const,
  margin: '0 0 28px',
}

const button = {
  backgroundColor: '#10b981',
  borderRadius: '8px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '15px',
  fontWeight: '600',
  lineHeight: '1',
  padding: '14px 32px',
  textDecoration: 'none',
  letterSpacing: '-0.1px',
}

const divider = {
  borderColor: '#f3f4f6',
  margin: '0 0 20px',
}

const fallbackLabel = {
  color: '#9ca3af',
  fontSize: '12px',
  lineHeight: '1.5',
  margin: '0 0 6px',
}

const fallbackLink = {
  color: '#6b7280',
  fontSize: '11px',
  lineHeight: '1.5',
  wordBreak: 'break-all' as const,
  margin: '0',
  textDecoration: 'underline',
}

const footerSection = {
  textAlign: 'center' as const,
  marginTop: '28px',
  padding: '0 8px',
}

const footerNote = {
  color: '#6b7280',
  fontSize: '13px',
  lineHeight: '1.6',
  margin: '0 0 16px',
}

const footerMeta = {
  color: '#9ca3af',
  fontSize: '11px',
  lineHeight: '1.5',
  margin: '0',
}

const footerLink = {
  color: '#9ca3af',
  textDecoration: 'underline',
}
