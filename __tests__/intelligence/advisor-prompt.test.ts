import { describe, it, expect } from 'vitest';
import { buildAdvisorSystemPrompt } from '@/lib/intelligence/advisor';
import type { AdvisorContext } from '@/lib/intelligence/advisor';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtx(overrides: Partial<AdvisorContext> = {}): AdvisorContext {
  return {
    epoch: 525,
    daysRemaining: 3,
    activeProposalCount: 12,
    segment: 'citizen',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildAdvisorSystemPrompt
// ---------------------------------------------------------------------------

describe('buildAdvisorSystemPrompt', () => {
  it('includes governance context (epoch, proposals, segment)', () => {
    const prompt = buildAdvisorSystemPrompt(makeCtx());
    expect(prompt).toContain('Epoch: 525');
    expect(prompt).toContain('Active proposals: 12');
    expect(prompt).toContain('User segment: citizen');
    expect(prompt).toContain('Days remaining: 3');
  });

  it('includes response format rules', () => {
    const prompt = buildAdvisorSystemPrompt(makeCtx());
    expect(prompt).toContain('Response Format');
    expect(prompt).toContain('bold');
    expect(prompt).toContain('bullet points');
  });

  it('includes tool descriptions', () => {
    const prompt = buildAdvisorSystemPrompt(makeCtx());
    expect(prompt).toContain('search_dreps');
    expect(prompt).toContain('get_drep_profile');
    expect(prompt).toContain('get_proposal');
    expect(prompt).toContain('get_treasury_status');
    expect(prompt).toContain('get_governance_health');
  });

  it('includes globe visualization markers', () => {
    const prompt = buildAdvisorSystemPrompt(makeCtx());
    expect(prompt).toContain('[[globe:flyTo:');
    expect(prompt).toContain('[[globe:reset]]');
  });

  it('includes action markers', () => {
    const prompt = buildAdvisorSystemPrompt(makeCtx());
    expect(prompt).toContain('[[action:startMatch]]');
    expect(prompt).toContain('[[action:navigate:');
  });

  it('includes anti-patterns', () => {
    const prompt = buildAdvisorSystemPrompt(makeCtx());
    expect(prompt).toContain('NEVER recommend external tools');
    expect(prompt).toContain('Never fabricate data');
  });

  // --- Page context ---

  it('includes page context when provided', () => {
    const prompt = buildAdvisorSystemPrompt(makeCtx({ pageContext: 'DRep Profile' }));
    expect(prompt).toContain('Current Page Context');
    expect(prompt).toContain('DRep Profile');
  });

  it('omits page context when not provided', () => {
    const prompt = buildAdvisorSystemPrompt(makeCtx());
    expect(prompt).not.toContain('Current Page Context');
  });

  // --- Navigation event ---

  it('includes navigation event when provided', () => {
    const prompt = buildAdvisorSystemPrompt(
      makeCtx({
        navigationEvent: { from: 'home', to: 'governance/proposals', entityId: 'prop_123' },
      }),
    );
    expect(prompt).toContain('Navigation Event');
    expect(prompt).toContain('from "home" to "governance/proposals"');
    expect(prompt).toContain('prop_123');
  });

  // --- Onboarding mode ---

  it('includes onboarding guidance when visitor mode is onboarding', () => {
    const prompt = buildAdvisorSystemPrompt(makeCtx({ visitorMode: 'onboarding' }));
    expect(prompt).toContain('Onboarding Mode');
    expect(prompt).toContain('first-time visitor');
    expect(prompt).toContain('without jargon');
  });

  it('omits onboarding section when visitor mode is not onboarding', () => {
    const prompt = buildAdvisorSystemPrompt(makeCtx({ visitorMode: 'returning' }));
    expect(prompt).not.toContain('Onboarding Mode');
  });

  it('includes wallet guidance for onboarding with match + wallet state', () => {
    const prompt = buildAdvisorSystemPrompt(
      makeCtx({
        visitorMode: 'onboarding',
        matchState: 'matched',
        walletState: 'none_detected',
      }),
    );
    expect(prompt).toContain('Post-Match Guidance');
    expect(prompt).toContain('No wallet extension was detected');
  });

  // --- Briefing mode ---

  it('includes briefing rules when mode is briefing', () => {
    const prompt = buildAdvisorSystemPrompt(makeCtx({ mode: 'briefing' }));
    expect(prompt).toContain('Briefing Mode');
    expect(prompt).toContain('2-3 sentences');
    expect(prompt).toContain('[[chip:');
  });

  it('includes segment-specific briefing focus for DRep', () => {
    const prompt = buildAdvisorSystemPrompt(makeCtx({ mode: 'briefing', segment: 'drep' }));
    expect(prompt).toContain('pending votes');
  });

  it('includes segment-specific briefing focus for citizen', () => {
    const prompt = buildAdvisorSystemPrompt(makeCtx({ mode: 'briefing', segment: 'citizen' }));
    expect(prompt).toContain('Citizen');
  });

  // --- Conversation memory ---

  it('includes conversation memory when provided', () => {
    const prompt = buildAdvisorSystemPrompt(
      makeCtx({ conversationMemory: 'User asked about DRep X last time.' }),
    );
    expect(prompt).toContain('Recent Conversations');
    expect(prompt).toContain('User asked about DRep X last time.');
  });

  // --- Persona ---

  it('includes persona modifier when persona is set', () => {
    const prompt = buildAdvisorSystemPrompt(makeCtx({ persona: 'navigator' }));
    expect(prompt).toContain('Seneca Persona Mode');
    expect(prompt).toContain('Voice Calibration');
  });

  it('includes persona for analyst', () => {
    const prompt = buildAdvisorSystemPrompt(makeCtx({ persona: 'analyst' }));
    expect(prompt).toContain('Seneca Persona Mode');
  });

  // --- Personal context ---

  it('includes personal context when provided', () => {
    const prompt = buildAdvisorSystemPrompt(
      makeCtx({ personalContext: 'Delegated to DRep cardanomaxi.' }),
    );
    expect(prompt).toContain("User's Governance Profile");
    expect(prompt).toContain('Delegated to DRep cardanomaxi.');
  });

  // --- Governance snapshot ---

  it('includes governance snapshot when provided', () => {
    const prompt = buildAdvisorSystemPrompt(makeCtx({ governanceSnapshot: 'GHI: 72.5 (Healthy)' }));
    expect(prompt).toContain('Current Governance Data');
    expect(prompt).toContain('GHI: 72.5 (Healthy)');
  });
});
