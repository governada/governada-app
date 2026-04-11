const endpoint = process.env.SYSTEMS_JOURNEY_VERIFICATION_URL;
const token = process.env.SYSTEMS_JOURNEY_VERIFICATION_TOKEN;

if (!endpoint || !token) {
  console.log('Skipping systems journey verification report: endpoint or token not configured.');
  process.exit(0);
}

const statusInput = (process.env.SYSTEMS_JOURNEY_STATUS || '').toLowerCase();
const status = statusInput === 'success' || statusInput === 'passed' ? 'passed' : 'failed';
const journeyIds = process.env.SYSTEMS_JOURNEY_IDS?.split(',')
  .map((value) => value.trim())
  .filter(Boolean) ?? ['J01', 'J02', 'J03', 'J05', 'J06', 'J13'];

const runUrl =
  process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : null;

const payload = {
  verificationType: 'ci',
  workflowName: process.env.GITHUB_WORKFLOW || 'CI',
  jobName: process.env.SYSTEMS_JOURNEY_JOB_NAME || process.env.GITHUB_JOB || 'e2e-critical',
  commitSha: process.env.GITHUB_SHA || null,
  runUrl,
  executedAt: process.env.SYSTEMS_JOURNEY_EXECUTED_AT || new Date().toISOString(),
  journeys: journeyIds.map((journeyId) => ({
    journeyId,
    status,
    details: {
      source: 'github-actions',
      workflow: process.env.GITHUB_WORKFLOW || null,
      job: process.env.SYSTEMS_JOURNEY_JOB_NAME || process.env.GITHUB_JOB || null,
      runId: process.env.GITHUB_RUN_ID || null,
      repository: process.env.GITHUB_REPOSITORY || null,
      eventName: process.env.GITHUB_EVENT_NAME || null,
      ref: process.env.GITHUB_REF || null,
      refName: process.env.GITHUB_REF_NAME || null,
    },
  })),
};

const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify(payload),
});

if (!response.ok) {
  const text = await response.text().catch(() => '');
  console.error(`Failed to report systems journey verifications: ${response.status} ${text}`);
  process.exit(1);
}

console.log(
  `Reported ${journeyIds.length} systems journey verification result(s) as ${status} to ${endpoint}.`,
);
