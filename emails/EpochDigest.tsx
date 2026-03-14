/**
 * Epoch Digest Email — sent at epoch boundaries to opted-in users.
 *
 * Personalized summary: epoch stats, DRep activity, milestones,
 * active proposals to watch.
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

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://governada.io';

export interface EpochDigestProps {
  epoch: number;
  proposalsDecided: number;
  adaGoverned: string;
  drepName: string;
  drepVotesCast: number;
  drepParticipationRate: number;
  drepScore: number;
  drepTier: string;
  newMilestones: string[];
  activeProposals: Array<{
    title: string;
    txHash: string;
    index: number;
    daysRemaining: number | null;
  }>;
  unsubscribeUrl: string;
  /** AI-generated headline from governance_briefs (optional) */
  aiHeadline?: string;
  /** Epoch check-in streak count (optional) */
  checkinStreak?: number;
}

// ── Shared Styles ────────────────────────────────────────────────────────

const main: React.CSSProperties = {
  backgroundColor: '#0c1222',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container: React.CSSProperties = {
  margin: '0 auto',
  padding: '40px 20px',
  maxWidth: '580px',
};

const card: React.CSSProperties = {
  backgroundColor: '#1e293b',
  borderRadius: '12px',
  padding: '24px',
  marginBottom: '16px',
};

const sectionTitle: React.CSSProperties = {
  fontSize: '11px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  color: '#64748b',
  margin: '0 0 12px',
  fontWeight: 600,
};

const statValue: React.CSSProperties = {
  fontSize: '28px',
  fontWeight: 700,
  color: '#e2e8f0',
  margin: 0,
  lineHeight: '1.2',
};

const statLabel: React.CSSProperties = {
  fontSize: '12px',
  color: '#64748b',
  margin: '4px 0 0',
};

const paragraph: React.CSSProperties = {
  fontSize: '15px',
  lineHeight: '24px',
  color: '#94a3b8',
  margin: '0 0 12px',
};

const button: React.CSSProperties = {
  backgroundColor: '#6366f1',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 600,
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  padding: '14px 28px',
};

const footer: React.CSSProperties = {
  fontSize: '12px',
  color: '#475569',
  lineHeight: '20px',
  textAlign: 'center' as const,
  marginTop: '32px',
};

const hr: React.CSSProperties = {
  borderColor: '#334155',
  margin: '24px 0',
};

export default function EpochDigest({
  epoch = 530,
  proposalsDecided = 3,
  adaGoverned = '12.4M',
  drepName = 'Your DRep',
  drepVotesCast = 2,
  drepParticipationRate = 85,
  drepScore = 72,
  drepTier = 'Silver',
  newMilestones = [],
  activeProposals = [],
  unsubscribeUrl = '#',
  aiHeadline,
  checkinStreak,
}: EpochDigestProps) {
  const previewText =
    aiHeadline ||
    `Epoch ${epoch}: ${proposalsDecided} proposals decided, ${adaGoverned} ADA governed`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={{ textAlign: 'center', padding: '24px 0' }}>
            <Text
              style={{
                color: '#6366f1',
                fontSize: '14px',
                fontWeight: 600,
                letterSpacing: '0.5px',
                margin: '0 0 8px',
              }}
            >
              GOVERNADA
            </Text>
            <Heading
              style={{
                color: '#e2e8f0',
                fontSize: '22px',
                fontWeight: 700,
                margin: '0 0 4px',
              }}
            >
              {aiHeadline || `Epoch ${epoch} Summary`}
            </Heading>
            <Text style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
              {proposalsDecided} proposals decided &middot; {adaGoverned} ADA governed
            </Text>
            {checkinStreak != null && checkinStreak > 1 && (
              <Text
                style={{
                  color: '#f59e0b',
                  fontSize: '13px',
                  fontWeight: 600,
                  margin: '8px 0 0',
                }}
              >
                &#128293; You&apos;ve checked in {checkinStreak} epochs in a row!
              </Text>
            )}
          </Section>

          {/* DRep Activity Card */}
          <Section style={card}>
            <Text style={sectionTitle}>Your DRep&apos;s Activity</Text>
            <table cellPadding={0} cellSpacing={0} style={{ width: '100%' }}>
              <tbody>
                <tr>
                  <td style={{ textAlign: 'left', verticalAlign: 'top' }}>
                    <Text
                      style={{
                        fontSize: '16px',
                        fontWeight: 600,
                        color: '#e2e8f0',
                        margin: '0 0 4px',
                      }}
                    >
                      {drepName}
                    </Text>
                    <Text style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                      {drepTier} tier
                    </Text>
                  </td>
                  <td style={{ textAlign: 'right', verticalAlign: 'top' }}>
                    <Text
                      style={{
                        fontSize: '32px',
                        fontWeight: 700,
                        color: '#6366f1',
                        margin: 0,
                        lineHeight: '1',
                      }}
                    >
                      {drepScore}
                    </Text>
                    <Text style={{ fontSize: '11px', color: '#64748b', margin: '2px 0 0' }}>
                      score
                    </Text>
                  </td>
                </tr>
              </tbody>
            </table>

            <Hr style={{ ...hr, margin: '16px 0' }} />

            <table cellPadding={0} cellSpacing={0} style={{ width: '100%' }}>
              <tbody>
                <tr>
                  <td style={{ textAlign: 'center', width: '50%' }}>
                    <Text style={statValue}>{drepVotesCast}</Text>
                    <Text style={statLabel}>Votes cast</Text>
                  </td>
                  <td style={{ textAlign: 'center', width: '50%' }}>
                    <Text style={statValue}>{drepParticipationRate}%</Text>
                    <Text style={statLabel}>Participation</Text>
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          {/* Milestones */}
          {newMilestones.length > 0 && (
            <Section style={card}>
              <Text style={sectionTitle}>New Milestones</Text>
              {newMilestones.map((milestone, i) => (
                <Text
                  key={i}
                  style={{
                    ...paragraph,
                    fontSize: '14px',
                    margin: '4px 0',
                    color: '#a5b4fc',
                  }}
                >
                  &#127942; {milestone}
                </Text>
              ))}
            </Section>
          )}

          {/* Active Proposals */}
          {activeProposals.length > 0 && (
            <Section style={card}>
              <Text style={sectionTitle}>Proposals to Watch</Text>
              {activeProposals.slice(0, 4).map((p, i) => (
                <Section
                  key={i}
                  style={{
                    padding: '10px 0',
                    borderBottom: i < activeProposals.length - 1 ? '1px solid #334155' : 'none',
                  }}
                >
                  <Link
                    href={`${BASE_URL}/proposal/${p.txHash}/${p.index}`}
                    style={{
                      color: '#e2e8f0',
                      fontSize: '14px',
                      fontWeight: 500,
                      textDecoration: 'none',
                    }}
                  >
                    {p.title}
                  </Link>
                  {p.daysRemaining != null && (
                    <Text
                      style={{
                        fontSize: '12px',
                        color: '#64748b',
                        margin: '4px 0 0',
                      }}
                    >
                      {p.daysRemaining} days remaining
                    </Text>
                  )}
                </Section>
              ))}
            </Section>
          )}

          {/* CTA */}
          <Section style={{ textAlign: 'center', margin: '8px 0 24px' }}>
            <Button style={button} href={`${BASE_URL}/`}>
              See your full briefing
            </Button>
            <Text style={{ fontSize: '13px', color: '#64748b', marginTop: '12px' }}>
              <Link
                href={`${BASE_URL}/share/epoch/${epoch}`}
                style={{ color: '#6366f1', textDecoration: 'none' }}
              >
                Share your epoch report &#8594;
              </Link>
            </Text>
          </Section>

          {/* Footer */}
          <Hr style={hr} />
          <Text style={footer}>
            Governada &middot; Cardano Governance Intelligence
            <br />
            <Link href={BASE_URL} style={{ color: '#6366f1', textDecoration: 'none' }}>
              governada.io
            </Link>
            {' · '}
            <Link href={unsubscribeUrl} style={{ color: '#475569', textDecoration: 'underline' }}>
              Unsubscribe
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
