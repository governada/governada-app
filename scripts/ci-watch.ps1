param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Arguments
)

$ErrorActionPreference = 'Stop'

. "$PSScriptRoot\set_gh_context.ps1"

function Write-Result([pscustomobject]$Result) {
  if ($Result.StdOut) {
    [Console]::Out.Write($Result.StdOut)
  }

  if ($Result.StdErr) {
    [Console]::Error.Write($Result.StdErr)
  }
}

function Parse-Args([string[]]$CliArgs) {
  $parsed = [ordered]@{
    Branch = ''
  }

  for ($index = 0; $index -lt $CliArgs.Count; $index += 1) {
    $value = $CliArgs[$index]

    if ($value -in @('--branch', '-Branch') -and $index + 1 -lt $CliArgs.Count) {
      $parsed.Branch = $CliArgs[$index + 1]
      $index += 1
      continue
    }

    if ($value.StartsWith('--branch=')) {
      $parsed.Branch = $value.Substring('--branch='.Length)
      continue
    }

    if ($value.StartsWith('-Branch:')) {
      $parsed.Branch = $value.Substring('-Branch:'.Length)
      continue
    }

    if ([string]::IsNullOrWhiteSpace($parsed.Branch)) {
      $parsed.Branch = $value
    }
  }

  return [pscustomobject]$parsed
}

function Get-CurrentBranch {
  $output = & git branch --show-current 2>$null
  if ($LASTEXITCODE -ne 0) {
    return ''
  }

  return (($output | ForEach-Object { $_.ToString() }) -join "`n").Trim()
}

function Get-Runs([string]$TargetBranch) {
  $result = Invoke-GhCommand -Arguments @(
    'run',
    'list',
    '--branch',
    $TargetBranch,
    '--limit',
    '10',
    '--json',
    'databaseId,status,conclusion,workflowName,displayTitle,url'
  )

  if ($result.ExitCode -ne 0) {
    Write-Result $result
    exit $result.ExitCode
  }

  if ([string]::IsNullOrWhiteSpace($result.StdOut)) {
    return @()
  }

  return @($result.StdOut | ConvertFrom-Json)
}

function Select-Run([object[]]$Runs) {
  if ($null -eq $Runs -or $Runs.Count -eq 0) {
    return $null
  }

  foreach ($run in $Runs) {
    if ($run.workflowName -eq 'CI') {
      return $run
    }
  }

  return $Runs[0]
}

function Summarize-Run($Run) {
  $workflow = if ([string]::IsNullOrWhiteSpace([string]$Run.workflowName)) {
    'CI'
  } else {
    [string]$Run.workflowName
  }
  $status = if ([string]::IsNullOrWhiteSpace([string]$Run.status)) {
    'unknown'
  } else {
    [string]$Run.status
  }
  $conclusion = if ([string]::IsNullOrWhiteSpace([string]$Run.conclusion)) {
    ''
  } else {
    "/$($Run.conclusion)"
  }
  $title = if ([string]::IsNullOrWhiteSpace([string]$Run.displayTitle)) {
    ''
  } else {
    " - $($Run.displayTitle)"
  }

  return "$workflow`: $status$conclusion$title"
}

$Branch = ''

if ([string]::IsNullOrWhiteSpace($Branch)) {
  $parsedArgs = Parse-Args -CliArgs $Arguments
  $Branch = $parsedArgs.Branch
}

if ([string]::IsNullOrWhiteSpace($Branch)) {
  $Branch = Get-CurrentBranch
}

if ([string]::IsNullOrWhiteSpace($Branch)) {
  throw 'Could not determine branch. Pass --branch <name>.'
}

Write-Output "Watching latest CI run for branch $Branch..."

$lastSummary = ''
$seenRunId = ''

while ($true) {
  $runs = Get-Runs -TargetBranch $Branch
  $run = Select-Run -Runs $runs

  if ($null -eq $run) {
    Write-Output 'No workflow runs found yet. Waiting...'
    Start-Sleep -Seconds 10
    continue
  }

  $runId = [string]$run.databaseId
  $summary = Summarize-Run -Run $run

  if ($runId -ne $seenRunId -or $summary -ne $lastSummary) {
    Write-Output $summary
    if (-not [string]::IsNullOrWhiteSpace([string]$run.url)) {
      Write-Output $run.url
    }
    $seenRunId = $runId
    $lastSummary = $summary
  }

  if ($run.status -eq 'completed') {
    if ($run.conclusion -eq 'success') {
      exit 0
    }

    $conclusion = if ([string]::IsNullOrWhiteSpace([string]$run.conclusion)) {
      'unknown'
    } else {
      [string]$run.conclusion
    }
    [Console]::Error.WriteLine("CI finished with conclusion=$conclusion.")
    exit 1
  }

  Start-Sleep -Seconds 10
}
