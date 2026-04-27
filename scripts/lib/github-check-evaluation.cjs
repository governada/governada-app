const SUCCESSFUL_CHECK_CONCLUSIONS = new Set(['success', 'neutral', 'skipped']);

function evaluateGithubChecks({
  checkRuns,
  checkRunsTotalCount,
  combinedStatus,
  missingMessage = 'no check runs or commit statuses were found',
}) {
  const blockers = [];
  const passes = [];
  const rawRuns = Array.isArray(checkRuns) ? checkRuns : [];
  const runs = latestCheckRunsByName(rawRuns);
  const statuses = Array.isArray(combinedStatus?.statuses) ? combinedStatus.statuses : [];
  const totalCount = Number.isFinite(Number(checkRunsTotalCount))
    ? Number(checkRunsTotalCount)
    : rawRuns.length;

  if (totalCount > rawRuns.length) {
    blockers.push(`check runs response is truncated (${rawRuns.length}/${totalCount})`);
  }

  for (const run of runs) {
    if (run.status !== 'completed') {
      blockers.push(`check run "${run.name || run.id || 'unknown'}" is ${run.status || 'unknown'}`);
      continue;
    }

    if (!SUCCESSFUL_CHECK_CONCLUSIONS.has(run.conclusion)) {
      blockers.push(
        `check run "${run.name || run.id || 'unknown'}" concluded ${run.conclusion || 'unknown'}`,
      );
    }
  }

  for (const status of statuses) {
    if (status.state !== 'success') {
      blockers.push(
        `commit status "${status.context || status.id || 'unknown'}" is ${
          status.state || 'unknown'
        }`,
      );
    }
  }

  if (statuses.length > 0 && combinedStatus?.state && combinedStatus.state !== 'success') {
    blockers.push(`combined commit status is ${combinedStatus.state}`);
  }

  if (runs.length === 0 && statuses.length === 0) {
    blockers.push(missingMessage);
  }

  if (blockers.length === 0) {
    const checkCount = runs.length + statuses.length;
    passes.push(`${checkCount} check/status result(s) are green`);
  }

  return { blockers, passes };
}

function latestCheckRunsByName(checkRuns) {
  const latestByName = new Map();

  for (const run of checkRuns) {
    const key = String(run.name || run.id || 'unknown');
    const current = latestByName.get(key);

    if (!current || compareCheckRuns(run, current) > 0) {
      latestByName.set(key, run);
    }
  }

  return Array.from(latestByName.values()).sort((left, right) => compareCheckRuns(right, left));
}

function compareCheckRuns(left, right) {
  const leftTime = checkRunTime(left);
  const rightTime = checkRunTime(right);

  if (leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  return checkRunId(left) - checkRunId(right);
}

function checkRunTime(run) {
  for (const key of ['completed_at', 'started_at', 'run_started_at', 'created_at']) {
    const value = run?.[key];
    if (!value) {
      continue;
    }

    const time = Date.parse(value);
    if (Number.isFinite(time)) {
      return time;
    }
  }

  return 0;
}

function checkRunId(run) {
  const id = Number(run?.id);
  return Number.isFinite(id) ? id : 0;
}

module.exports = {
  evaluateGithubChecks,
  latestCheckRunsByName,
};
