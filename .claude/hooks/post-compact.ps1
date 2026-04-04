$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

. "$PSScriptRoot\HookUtils.ps1"
. "$PSScriptRoot\..\..\scripts\set_gh_context.ps1"

$repoRoot = (Get-GitLines -Arguments @('rev-parse', '--show-toplevel') | Select-Object -First 1)
if (-not $repoRoot) {
  $repoRoot = (Get-Location).Path
}

Set-Location $repoRoot

Write-Host "=== POST-COMPACTION CONTEXT RECOVERY ==="
Write-Host ""

$branch = (Get-GitLines -Arguments @('rev-parse', '--abbrev-ref', 'HEAD') | Select-Object -First 1)
if (-not $branch) {
  $branch = 'unknown'
}

Write-Host "## Branch: $branch"

if ($branch -notin @('main', 'unknown')) {
  $ahead = (Get-GitLines -Arguments @('rev-list', '--count', 'origin/main..HEAD') | Select-Object -First 1)
  $behind = (Get-GitLines -Arguments @('rev-list', '--count', 'HEAD..origin/main') | Select-Object -First 1)
  Write-Host "Ahead of main: $ahead commits | Behind main: $behind commits"
  Write-Host ""

  Write-Host "## Recent commits on this branch:"
  $recentCommits = Get-GitLines -Arguments @('log', '--oneline', 'origin/main..HEAD') | Select-Object -First 15
  if ($recentCommits) {
    $recentCommits | ForEach-Object { Write-Host $_ }
  } else {
    Write-Host "(none)"
  }
  Write-Host ""
}

$staged = @(Get-GitLines -Arguments @('diff', '--cached', '--stat'))
$unstaged = @(Get-GitLines -Arguments @('diff', '--stat'))
$untracked = @(Get-GitLines -Arguments @('ls-files', '--others', '--exclude-standard') | Select-Object -First 10)

if ($staged.Count -gt 0 -or $unstaged.Count -gt 0 -or $untracked.Count -gt 0) {
  Write-Host "## Uncommitted work:"
  if ($staged.Count -gt 0) {
    Write-Host "### Staged:"
    $staged | ForEach-Object { Write-Host $_ }
  }
  if ($unstaged.Count -gt 0) {
    Write-Host "### Modified (unstaged):"
    $unstaged | ForEach-Object { Write-Host $_ }
  }
  if ($untracked.Count -gt 0) {
    Write-Host "### Untracked:"
    $untracked | ForEach-Object { Write-Host $_ }
  }
  Write-Host ""
}

$checkpointDir = Join-Path $repoRoot '.claude\checkpoints'
if (Test-Path $checkpointDir -PathType Container) {
  $checkpoints = Get-ChildItem -Path $checkpointDir -Filter *.md -File |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 5

  if ($checkpoints) {
    Write-Host "## Active checkpoints (may indicate in-progress multi-phase work):"
    foreach ($checkpoint in $checkpoints) {
      Write-Host "- $($checkpoint.FullName)"
      Get-Content -LiteralPath $checkpoint.FullName -TotalCount 5 -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host "  $_"
      }
    }
    Write-Host ""
    Write-Host "If resuming a multi-phase build, read the full checkpoint file."
    Write-Host ""
  }
}

$auditDir = Join-Path $repoRoot '.claude\audit-results'
if (Test-Path $auditDir -PathType Container) {
  $audits = Get-ChildItem -Path $auditDir -Filter *.md -File |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 5

  if ($audits) {
    Write-Host "## Recent audit results:"
    foreach ($audit in $audits) {
      Write-Host "- $($audit.FullName)"
    }
    Write-Host ""
    Write-Host "If fixing audit findings, read the relevant audit file."
    Write-Host ""
  }
}

$prResult = Invoke-GhCommand -Arguments @('pr', 'list', '--author', '@me', '--state', 'open', '--limit', '5', '--json', 'number,title,headBranch')
if ($prResult.ExitCode -eq 0 -and $prResult.StdOut) {
  $prs = $prResult.StdOut | ConvertFrom-Json
  if ($prs) {
    Write-Host "## Open PRs (may indicate in-flight deploys):"
    foreach ($pr in $prs) {
      Write-Host "  PR #$($pr.number): $($pr.title) ($($pr.headBranch))"
    }
    Write-Host ""
  }
}

Write-Host "## Key constraints (from CLAUDE.md):"
Write-Host "- force-dynamic on any page/route touching Supabase/env"
Write-Host "- Register Inngest functions in app/api/inngest/route.ts"
Write-Host "- Database reads via lib/data.ts only"
Write-Host "- TanStack Query for client fetches"
Write-Host "- npm run preflight before committing"
Write-Host ""
Write-Host "=== END RECOVERY - Read relevant files above if resuming complex work ==="
exit 0
