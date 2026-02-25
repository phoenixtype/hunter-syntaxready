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
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'

interface ConfirmationEmailProps {
  supabase_url: string
  token_hash: string
  redirect_to: string
  email_action_type: string
}

export const ConfirmationEmail = ({
  supabase_url,
  token_hash,
  redirect_to,
  email_action_type,
}: ConfirmationEmailProps) => {
  const confirmUrl = `${supabase_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`

  const isPasswordReset = email_action_type === 'recovery'
  const title = isPasswordReset ? 'Reset Your Password' : 'Confirm Your Email'
  const previewText = isPasswordReset
    ? 'Reset your Hunter password'
    : 'Welcome to Hunter — confirm your email to get started'
  const buttonText = isPasswordReset ? 'Reset Password' : 'Confirm Email Address'
  const description = isPasswordReset
    ? "You requested a password reset. Click the button below to set a new password."
    : "Thanks for signing up for Hunter! Please confirm your email address to activate your account and start your autonomous job search."

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={logoText}>Hunter</Heading>
          </Section>

          <Section style={content}>
            <Heading style={h1}>{title}</Heading>
            <Text style={text}>{description}</Text>

            <Section style={buttonContainer}>
              <Link href={confirmUrl} target="_blank" style={button}>
                {buttonText}
              </Link>
            </Section>

            <Text style={smallText}>
              If the button doesn't work, copy and paste this link into your browser:
            </Text>
            <Text style={linkText}>{confirmUrl}</Text>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            This link expires in 24 hours. If you didn't {isPasswordReset ? 'request a password reset' : 'create an account'}, you can safely ignore this email.
          </Text>
          <Text style={footer}>
            © {new Date().getFullYear()} Hunter. Your autonomous job search companion.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default ConfirmationEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
}

const container = {
  margin: '0 auto',
  padding: '20px 0 48px',
  maxWidth: '560px',
}

const header = {
  padding: '24px 0',
  textAlign: 'center' as const,
}

const logoText = {
  fontSize: '28px',
  fontWeight: '700',
  color: '#10b981',
  margin: '0',
  letterSpacing: '-0.5px',
}

const content = {
  padding: '0 24px',
}

const h1 = {
  color: '#1a1a1a',
  fontSize: '24px',
  fontWeight: '600',
  lineHeight: '1.3',
  margin: '16px 0',
  padding: '0',
}

const text = {
  color: '#4a4a4a',
  fontSize: '15px',
  lineHeight: '1.6',
  margin: '16px 0',
}

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
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
}

const smallText = {
  color: '#888888',
  fontSize: '13px',
  lineHeight: '1.5',
  margin: '16px 0 4px',
}

const linkText = {
  color: '#2754C5',
  fontSize: '12px',
  lineHeight: '1.4',
  wordBreak: 'break-all' as const,
  margin: '0 0 16px',
}

const hr = {
  borderColor: '#e6e6e6',
  margin: '32px 0 24px',
}

const footer = {
  color: '#999999',
  fontSize: '12px',
  lineHeight: '1.5',
  margin: '4px 0',
  textAlign: 'center' as const,
}
