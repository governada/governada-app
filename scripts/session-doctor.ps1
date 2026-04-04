$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

function Invoke-Git {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments,
    [switch]$AllowFailure
  )

  $output = & git @Arguments 2>&1
  $exitCode = $LASTEXITCODE
  $text = (($output | ForEach-Object { $_.ToString() }) -join "`n").TrimEnd()

  if (-not $AllowFailure -and $exitCode -ne 0) {
    if ($text) {
      throw $text
    }

    throw "git $($Arguments -join ' ') failed."
  }

  return [PSCustomObject]@{
    ExitCode = $exitCode
    Output   = $text
  }
}

function Get-Lines([string]$Text) {
  if ([string]::IsNullOrWhiteSpace($Text)) {
    return @()
  }

  return $Text -split "\r?\n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
}

function Parse-Worktrees([string]$Porcelain) {
  $worktrees = @()
  $current = $null

  foreach ($line in ($Porcelain -split "\r?\n")) {
    if ([string]::IsNullOrWhiteSpace($line)) {
      if ($null -ne $current) {
        $worktrees += $current
        $current = $null
      }
      continue
    }

    if ($line.StartsWith('worktree ')) {
      if ($null -ne $current) {
        $worktrees += $current
      }

      $current = [ordered]@{
        Path   = $line.Substring('worktree '.Length).Trim()
        Branch = '(detached)'
      }
      continue
    }

    if ($null -eq $current) {
      continue
    }

    if ($line.StartsWith('branch ')) {
      $current.Branch = $line.Substring('branch '.Length).Trim().Replace('refs/heads/', '')
      continue
    }

    if ($line -eq 'detached') {
      $current.Branch = '(detached)'
    }
  }

  if ($null -ne $current) {
    $worktrees += $current
  }

  return $worktrees
}

function Test-RepoFile([string]$RelativePath) {
  if (Test-Path (Join-Path $repoRoot $RelativePath)) {
    return $RelativePath
  }

  return "$RelativePath (missing)"
}

function Print-Section([string]$Title, [string[]]$Lines) {
  Write-Output "${Title}:"
  if ($Lines.Count -eq 0) {
    Write-Output '  - none'
    return
  }

  foreach ($line in $Lines) {
    Write-Output "  - $line"
  }
}

$repoRoot = (Invoke-Git -Arguments @('rev-parse', '--show-toplevel')).Output
$branch = (Invoke-Git -Arguments @('branch', '--show-current') -AllowFailure).Output
if ([string]::IsNullOrWhiteSpace($branch)) {
  $branch = '(detached)'
}

$statusLines = Get-Lines ((Invoke-Git -Arguments @('status', '--short') -AllowFailure).Output)
$stashLines = Get-Lines ((Invoke-Git -Arguments @('stash', 'list') -AllowFailure).Output)
$worktrees = Parse-Worktrees ((Invoke-Git -Arguments @('worktree', 'list', '--porcelain') -AllowFailure).Output)

Write-Output '=== Session Doctor ==='
Write-Output "Repo: $repoRoot"
Write-Output "Branch: $branch"
Write-Output ("Status: " + ($(if ($statusLines.Count -eq 0) { 'clean' } else { "dirty ($($statusLines.Count) changes)" })))
Write-Output "Stashes: $($stashLines.Count)"
Write-Output "Worktrees: $($worktrees.Count)"
Write-Output ''

if ($statusLines.Count -gt 0) {
  Print-Section 'Changed files' ($statusLines | Select-Object -First 10)
  if ($statusLines.Count -gt 10) {
    Write-Output "  - ... and $($statusLines.Count - 10) more"
  }
  Write-Output ''
}

Print-Section 'Stashes' ($stashLines | Select-Object -First 5)
if ($stashLines.Count -gt 5) {
  Write-Output "  - ... and $($stashLines.Count - 5) more"
}
Write-Output ''

Print-Section 'Worktrees' ($worktrees | ForEach-Object { "$($_.Branch) -> $($_.Path)" })
Write-Output ''

Print-Section 'Session files' @(
  (Test-RepoFile '.cursor/tasks/lessons.md'),
  (Test-RepoFile '.cursor/tasks/todo.md')
)
