interface DigestData {
  recipientName?: string;
  drepName: string;
  drepScore: number;
  drepTier: string;
  votesThisPeriod: number;
  rationalCount: number;
  openProposals: Array<{
    title: string;
    daysRemaining: number | null;
    txHash: string;
    index: number;
  }>;
  alignmentStatus: 'stable' | 'shifting' | 'unknown';
  insight: string;
}

export function renderGovernanceDigestEmail(
  data: DigestData,
  baseUrl = 'https://drepscore.app',
): string {
  const {
    recipientName,
    drepName,
    drepScore,
    drepTier,
    votesThisPeriod,
    rationalCount,
    openProposals,
    insight,
  } = data;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Your Governance Digest — DRepScore</title>
  <style>
    body { font-family: -apple-system, sans-serif; background: #0c1222; color: #e2e8f0; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; }
    .header { text-align: center; padding: 32px 0 24px; }
    .header h1 { color: #6366f1; font-size: 24px; margin: 0; }
    .section { background: #1e293b; border-radius: 12px; padding: 24px; margin-bottom: 16px; }
    .section-title { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 12px; }
    .stat-row { display: flex; gap: 16px; }
    .stat { text-align: center; }
    .stat-value { font-size: 28px; font-weight: 700; color: #e2e8f0; }
    .stat-label { font-size: 12px; color: #64748b; margin-top: 4px; }
    .proposal-item { padding: 12px 0; border-bottom: 1px solid #334155; }
    .proposal-item:last-child { border-bottom: none; }
    .cta-button { display: block; background: #6366f1; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; text-align: center; font-weight: 600; margin: 24px auto; max-width: 200px; }
    .footer { text-align: center; color: #475569; font-size: 12px; padding: 24px 0; }
    .unsubscribe { color: #475569; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>DRepScore</h1>
      <p style="color: #64748b; margin: 8px 0 0;">Your Governance Digest</p>
    </div>

    ${recipientName ? `<p>Hi ${recipientName},</p>` : ''}

    <div class="section">
      <div class="section-title">Your DRep</div>
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div>
          <div style="font-size: 18px; font-weight: 600;">${drepName}</div>
          <div style="color: #64748b; font-size: 14px; margin-top: 4px;">${drepTier} tier</div>
        </div>
        <div style="font-size: 36px; font-weight: 700; color: #6366f1;">${drepScore}</div>
      </div>
      <div class="stat-row" style="margin-top: 16px;">
        <div class="stat">
          <div class="stat-value">${votesThisPeriod}</div>
          <div class="stat-label">Proposals voted</div>
        </div>
        <div class="stat">
          <div class="stat-value">${rationalCount}</div>
          <div class="stat-label">With rationales</div>
        </div>
      </div>
    </div>

    ${
      openProposals.length > 0
        ? `
    <div class="section">
      <div class="section-title">Open Proposals</div>
      ${openProposals
        .slice(0, 3)
        .map(
          (p) => `
        <div class="proposal-item">
          <div style="font-weight: 500;">${p.title}</div>
          ${p.daysRemaining != null ? `<div style="color: #64748b; font-size: 13px; margin-top: 4px;">${p.daysRemaining} days remaining</div>` : ''}
        </div>
      `,
        )
        .join('')}
    </div>`
        : ''
    }

    <div class="section">
      <div class="section-title">Insight</div>
      <p style="margin: 0; color: #94a3b8;">${insight}</p>
    </div>

    <a href="${baseUrl}/my-gov" class="cta-button">Open Civica</a>

    <div class="footer">
      <p>DRepScore · Cardano Governance Intelligence</p>
      <p><a href="${baseUrl}/my-gov/profile#notifications" class="unsubscribe">Manage notifications</a></p>
    </div>
  </div>
</body>
</html>`;
}
