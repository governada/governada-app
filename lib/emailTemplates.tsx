/**
 * React Email Templates for DRepScore notifications.
 * Each template is a React component that Resend renders to HTML.
 */

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://drepscore.io';

// ── Shared Styles ────────────────────────────────────────────────────────────

const main: React.CSSProperties = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container: React.CSSProperties = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '40px 20px',
  maxWidth: '580px',
  borderRadius: '8px',
};

const heading: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: '700',
  color: '#1a1a2e',
  margin: '0 0 16px',
};

const paragraph: React.CSSProperties = {
  fontSize: '16px',
  lineHeight: '26px',
  color: '#374151',
  margin: '0 0 16px',
};

const button: React.CSSProperties = {
  backgroundColor: '#6366f1',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  padding: '12px 24px',
};

const footer: React.CSSProperties = {
  fontSize: '12px',
  color: '#9ca3af',
  lineHeight: '20px',
  marginTop: '32px',
};

const hr: React.CSSProperties = {
  borderColor: '#e5e7eb',
  margin: '24px 0',
};

// ── Shared Layout ────────────────────────────────────────────────────────────

function EmailLayout({
  preview,
  children,
  unsubscribeUrl,
}: {
  preview: string;
  children: React.ReactNode;
  unsubscribeUrl?: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text
            style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#6366f1',
              letterSpacing: '0.5px',
              margin: '0 0 24px',
            }}
          >
            DREPSCORE
          </Text>
          {children}
          <Hr style={hr} />
          <Text style={footer}>
            DRepScore — Cardano Governance Intelligence
            <br />
            <Link href={BASE_URL} style={{ color: '#6366f1' }}>
              drepscore.io
            </Link>
            {unsubscribeUrl && (
              <>
                {' · '}
                <Link href={unsubscribeUrl} style={{ color: '#9ca3af' }}>
                  Unsubscribe
                </Link>
              </>
            )}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

// ── Generic Notification ────────────────────────────────────────────────────

export function GenericNotificationEmail({
  title,
  body,
  url,
  unsubscribeUrl,
}: {
  title: string;
  body: string;
  url?: string;
  unsubscribeUrl?: string;
}) {
  return (
    <EmailLayout preview={body.slice(0, 140)} unsubscribeUrl={unsubscribeUrl}>
      <Heading style={heading}>{title}</Heading>
      <Text style={paragraph}>{body}</Text>
      {url && (
        <Section style={{ textAlign: 'center', margin: '24px 0' }}>
          <Button style={button} href={url.startsWith('http') ? url : `${BASE_URL}${url}`}>
            View on DRepScore
          </Button>
        </Section>
      )}
    </EmailLayout>
  );
}

// ── Email Verification ──────────────────────────────────────────────────────

export function EmailVerificationEmail({ verifyUrl }: { verifyUrl: string }) {
  return (
    <EmailLayout preview="Verify your email address for DRepScore governance notifications">
      <Heading style={heading}>Verify Your Email</Heading>
      <Text style={paragraph}>
        Click the button below to verify your email address and start receiving governance
        notifications from DRepScore.
      </Text>
      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <Button style={button} href={verifyUrl}>
          Verify Email Address
        </Button>
      </Section>
      <Text style={{ ...paragraph, fontSize: '14px', color: '#6b7280' }}>
        This link expires in 24 hours. If you didn&apos;t request this, you can safely ignore this
        email.
      </Text>
    </EmailLayout>
  );
}

// ── Score Change Alert ──────────────────────────────────────────────────────

export function ScoreChangeEmail({
  drepName,
  oldScore,
  newScore,
  delta,
  url,
  unsubscribeUrl,
}: {
  drepName: string;
  oldScore: number;
  newScore: number;
  delta: number;
  url: string;
  unsubscribeUrl?: string;
}) {
  const direction = delta > 0 ? 'increased' : 'decreased';
  const color = delta > 0 ? '#22c55e' : '#ef4444';

  return (
    <EmailLayout
      preview={`Your DRepScore ${direction} by ${Math.abs(delta)} points`}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Heading style={heading}>Score {direction === 'increased' ? 'Up' : 'Down'}</Heading>
      <Text style={paragraph}>
        {drepName}&apos;s DRepScore {direction} from <strong>{oldScore}</strong> to{' '}
        <strong style={{ color }}>{newScore}</strong> (
        <span style={{ color }}>
          {delta > 0 ? '+' : ''}
          {delta}
        </span>{' '}
        points).
      </Text>
      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <Button style={button} href={url.startsWith('http') ? url : `${BASE_URL}${url}`}>
          View Dashboard
        </Button>
      </Section>
    </EmailLayout>
  );
}

// ── Delegation Change Alert ─────────────────────────────────────────────────

export function DelegationChangeEmail({
  drepName,
  delta,
  totalDelegators,
  url,
  unsubscribeUrl,
}: {
  drepName: string;
  delta: number;
  totalDelegators: number;
  url: string;
  unsubscribeUrl?: string;
}) {
  const direction = delta > 0 ? 'gained' : 'lost';

  return (
    <EmailLayout
      preview={`${drepName} ${direction} ${Math.abs(delta)} delegator${Math.abs(delta) !== 1 ? 's' : ''}`}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Heading style={heading}>Delegation {delta > 0 ? 'Growth' : 'Change'}</Heading>
      <Text style={paragraph}>
        {drepName} {direction} <strong>{Math.abs(delta)}</strong> delegator
        {Math.abs(delta) !== 1 ? 's' : ''}. Total delegators: <strong>{totalDelegators}</strong>.
      </Text>
      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <Button style={button} href={url.startsWith('http') ? url : `${BASE_URL}${url}`}>
          View Dashboard
        </Button>
      </Section>
    </EmailLayout>
  );
}

// ── Proposal Deadline ───────────────────────────────────────────────────────

export function ProposalDeadlineEmail({
  proposalCount,
  urgentTitles,
  url,
  unsubscribeUrl,
}: {
  proposalCount: number;
  urgentTitles: string[];
  url: string;
  unsubscribeUrl?: string;
}) {
  return (
    <EmailLayout
      preview={`${proposalCount} proposal${proposalCount !== 1 ? 's' : ''} expiring soon`}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Heading style={heading}>Proposals Expiring Soon</Heading>
      <Text style={paragraph}>
        {proposalCount} governance proposal{proposalCount !== 1 ? 's' : ''} will expire within 2
        epochs. Vote now to maintain your participation rate.
      </Text>
      {urgentTitles.length > 0 && (
        <Section
          style={{
            margin: '16px 0',
            padding: '16px',
            backgroundColor: '#fef3c7',
            borderRadius: '6px',
          }}
        >
          {urgentTitles.map((title, i) => (
            <Text key={i} style={{ ...paragraph, fontSize: '14px', margin: '4px 0' }}>
              • {title}
            </Text>
          ))}
        </Section>
      )}
      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <Button style={button} href={url.startsWith('http') ? url : `${BASE_URL}${url}`}>
          Review & Vote
        </Button>
      </Section>
    </EmailLayout>
  );
}

// ── Governance Digest / Weekly Brief ────────────────────────────────────────

export interface BriefSection {
  heading: string;
  content: string;
}

export function GovernanceDigestEmail({
  greeting,
  sections,
  ctaText,
  ctaUrl,
  unsubscribeUrl,
}: {
  greeting: string;
  sections: BriefSection[];
  ctaText: string;
  ctaUrl: string;
  unsubscribeUrl?: string;
}) {
  return (
    <EmailLayout
      preview="Your weekly governance brief from DRepScore"
      unsubscribeUrl={unsubscribeUrl}
    >
      <Heading style={heading}>Weekly Governance Brief</Heading>
      <Text style={paragraph}>{greeting}</Text>

      {sections.map((section, i) => (
        <React.Fragment key={i}>
          <Text
            style={{
              ...paragraph,
              fontWeight: '600',
              fontSize: '14px',
              color: '#6366f1',
              margin: '20px 0 4px',
              textTransform: 'uppercase' as const,
              letterSpacing: '0.5px',
            }}
          >
            {section.heading}
          </Text>
          <Text style={paragraph}>{section.content}</Text>
        </React.Fragment>
      ))}

      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <Button style={button} href={ctaUrl.startsWith('http') ? ctaUrl : `${BASE_URL}${ctaUrl}`}>
          {ctaText}
        </Button>
      </Section>
    </EmailLayout>
  );
}
