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
    RunId  = ''
    Tail   = 20
  }

  for ($index = 0; $index -lt $CliArgs.Count; $index += 1) {
    $value = $CliArgs[$index]

    if ($value -in @('--branch', '-Branch') -and $index + 1 -lt $CliArgs.Count) {
      $parsed.Branch = $CliArgs[$index + 1]
      $index += 1
      continue
    }

    if ($value -in @('--run-id', '-RunId') -and $index + 1 -lt $CliArgs.Count) {
      $parsed.RunId = $CliArgs[$index + 1]
      $index += 1
      continue
    }

    if ($value -in @('--tail', '-Tail') -and $index + 1 -lt $CliArgs.Count) {
      $parsed.Tail = [int]$CliArgs[$index + 1]
      $index += 1
      continue
    }

    if ($value.StartsWith('--branch=')) {
      $parsed.Branch = $value.Substring('--branch='.Length)
      continue
    }

    if ($value.StartsWith('--run-id=')) {
      $parsed.RunId = $value.Substring('--run-id='.Length)
      continue
    }

    if ($value.StartsWith('--tail=')) {
      $parsed.Tail = [int]$value.Substring('--tail='.Length)
      continue
    }

    if ($value.StartsWith('-Branch:')) {
      $parsed.Branch = $value.Substring('-Branch:'.Length)
      continue
    }

    if ($value.StartsWith('-RunId:')) {
      $parsed.RunId = $value.Substring('-RunId:'.Length)
      continue
    }

    if ($value.StartsWith('-Tail:')) {
      $parsed.Tail = [int]$value.Substring('-Tail:'.Length)
      continue
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

function Get-LatestRunId([string]$TargetBranch) {
  $result = Invoke-GhCommand -Arguments @(
    'run',
    'list',
    '--branch',
    $TargetBranch,
    '--limit',
    '10',
    '--json',
    'databaseId,workflowName'
  )

  if ($result.ExitCode -ne 0) {
    Write-Result $result
    exit $result.ExitCode
  }

  if ([string]::IsNullOrWhiteSpace($result.StdOut)) {
    throw "No workflow runs found for branch $TargetBranch."
  }

  $runs = @($result.StdOut | ConvertFrom-Json)
  foreach ($run in $runs) {
    if ($run.workflowName -eq 'CI' -and $run.databaseId) {
      return [string]$run.databaseId
    }
  }

  if ($runs.Count -gt 0 -and $runs[0].databaseId) {
    return [string]$runs[0].databaseId
  }

  throw "No workflow runs found for branch $TargetBranch."
}

function Get-RelevantLines([string[]]$Lines, [int]$TailCount) {
  for ($index = $Lines.Count - 1; $index -ge 0; $index -= 1) {
    if ($Lines[$index].Contains('##[error]')) {
      $start = [Math]::Max(0, $index - [Math]::Floor($TailCount / 2))
      $end = [Math]::Min($Lines.Count - 1, $start + $TailCount - 1)
      return $Lines[$start..$end]
    }
  }

  $start = [Math]::Max(0, $Lines.Count - $TailCount)
  return $Lines[$start..($Lines.Count - 1)]
}

$parsedArgs = Parse-Args -CliArgs $Arguments
$Branch = $parsedArgs.Branch
$RunId = $parsedArgs.RunId
$Tail = $parsedArgs.Tail

if ($Tail -le 0) {
  $Tail = 20
}

if ([string]::IsNullOrWhiteSpace($RunId)) {
  if ([string]::IsNullOrWhiteSpace($Branch)) {
    $Branch = Get-CurrentBranch
  }

  if ([string]::IsNullOrWhiteSpace($Branch)) {
    throw 'Could not determine branch. Pass --branch or --run-id.'
  }

  $RunId = Get-LatestRunId -TargetBranch $Branch
}

$result = Invoke-GhCommand -Arguments @('run', 'view', $RunId, '--log-failed')
$combined = "$($result.StdOut)$($result.StdErr)".TrimEnd()

if ($result.ExitCode -ne 0) {
  if ($combined) {
    throw $combined
  }

  throw "Failed to fetch failed logs for run $RunId."
}

if ([string]::IsNullOrWhiteSpace($combined)) {
  exit 0
}

$lines = $combined -split "\r?\n"
$selected = Get-RelevantLines -Lines $lines -TailCount $Tail
foreach ($line in $selected) {
  Write-Output $line
}
