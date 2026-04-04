$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

function Invoke-Git {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments,
    [switch]$AllowFailure,
    [string]$WorkingDirectory = (Get-Location).Path
  )

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = 'git'
  $psi.Arguments = (Join-NativeArguments -Arguments $Arguments)
  $psi.WorkingDirectory = $WorkingDirectory
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true

  $process = New-Object System.Diagnostics.Process
  $process.StartInfo = $psi
  $null = $process.Start()
  $stdout = $process.StandardOutput.ReadToEnd()
  $stderr = $process.StandardError.ReadToEnd()
  $process.WaitForExit()

  $exitCode = $process.ExitCode
  $parts = @()
  if ($stdout) {
    $parts += $stdout.TrimEnd()
  }
  if ($stderr) {
    $parts += $stderr.TrimEnd()
  }
  $text = ($parts -join "`n").TrimEnd()

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

function Join-NativeArguments {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  return ($Arguments | ForEach-Object {
    if ($_ -eq '') {
      '""'
    } elseif ($_ -match '[\s"]') {
      '"' + ($_ -replace '([\\]*)"', '$1$1\"' -replace '([\\]+)$', '$1$1') + '"'
    } else {
      $_
    }
  }) -join ' '
}

function Get-Lines([string]$Text) {
  if ([string]::IsNullOrWhiteSpace($Text)) {
    return @()
  }

  return $Text -split "\r?\n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
}

function Get-RealDiffLines([string[]]$Arguments) {
  return Get-Lines ((Invoke-Git -Arguments $Arguments -AllowFailure).Output) |
    ForEach-Object { $_.Trim() } |
    Where-Object {
      $parts = $_ -split '\s+'
      $added = if ($parts.Count -gt 0) { $parts[0] } else { '0' }
      $removed = if ($parts.Count -gt 1) { $parts[1] } else { '0' }
      $added -ne '0' -or $removed -ne '0'
    }
}

function Test-GitOk([string[]]$Arguments) {
  return (Invoke-Git -Arguments $Arguments -AllowFailure).ExitCode -eq 0
}

function Test-HasRelevantUntrackedFiles {
  $output = (Invoke-Git -Arguments @('ls-files', '--others', '--exclude-standard') -AllowFailure).Output
  return (Get-Lines $output | Where-Object { -not $_.StartsWith('.claude/') }).Count -gt 0
}

function Remove-CrlfPhantoms {
  if (Test-GitOk @('diff', '--quiet', 'HEAD')) {
    return
  }

  if ((Get-RealDiffLines @('diff', '--numstat', 'HEAD')).Count -gt 0) {
    return
  }

  $changedFiles = Get-Lines ((Invoke-Git -Arguments @('diff', '--name-only', 'HEAD') -AllowFailure).Output)
  if ($changedFiles.Count -eq 0) {
    return
  }

  Invoke-Git -Arguments @('checkout', '--', '.') | Out-Null
  Write-Output "Git: discarded $($changedFiles.Count) CRLF phantom diff(s)."
}

function Test-HasRealChanges {
  $unstaged = Get-RealDiffLines @('diff', '--numstat', 'HEAD')
  $staged = Get-RealDiffLines @('diff', '--cached', '--numstat', 'HEAD')
  return $unstaged.Count -gt 0 -or $staged.Count -gt 0 -or (Test-HasRelevantUntrackedFiles)
}

function Get-RevCount([string]$Range) {
  $value = (Invoke-Git -Arguments @('rev-list', '--count', $Range)).Output
  $count = 0
  if ([int]::TryParse($value, [ref]$count)) {
    return $count
  }

  return 0
}

function Ensure-EnvLocal([string]$RepoRoot, [string]$MainCheckoutRoot) {
  $worktreeEnv = Join-Path $RepoRoot '.env.local'
  $mainEnv = Join-Path $MainCheckoutRoot '.env.local'
  if (-not (Test-Path $worktreeEnv) -and (Test-Path $mainEnv)) {
    Copy-Item -LiteralPath $mainEnv -Destination $worktreeEnv
    Write-Output '.env.local: copied from main checkout.'
  }
}

function Ensure-NodeModulesLink([string]$RepoRoot, [string]$MainCheckoutRoot) {
  $worktreeNodeModules = Join-Path $RepoRoot 'node_modules'
  $mainNodeModules = Join-Path $MainCheckoutRoot 'node_modules'
  $worktreePackageJson = Join-Path $RepoRoot 'package.json'
  $mainPackageJson = Join-Path $MainCheckoutRoot 'package.json'

  if ((Test-Path $worktreeNodeModules) -or -not (Test-Path $mainNodeModules)) {
    return
  }

  $samePackageJson =
    (Test-Path $worktreePackageJson) -and
    (Test-Path $mainPackageJson) -and
    ((Get-Content -LiteralPath $worktreePackageJson -Raw) -eq (Get-Content -LiteralPath $mainPackageJson -Raw))

  if (-not $samePackageJson) {
    Write-Output 'node_modules: package.json differs from main checkout. Run npm ci.'
    return
  }

  try {
    New-Item -ItemType Junction -Path $worktreeNodeModules -Target $mainNodeModules | Out-Null
    Write-Output 'node_modules: linked from main checkout.'
  } catch {
    Write-Output "node_modules: link failed ($($_.Exception.Message)). Run npm ci."
  }
}

function Write-DirtyBlock([string]$Kind) {
  Write-Output ''
  Write-Output "BLOCKED: $Kind is behind origin/main and has uncommitted changes."
  Write-Output 'Run one of these, then re-run npm run worktree:sync:'
  Write-Output '  git stash && git rebase origin/main && git stash pop'
  Write-Output "  git add -A && git commit -m 'wip: save progress' && git rebase origin/main"
  Write-Output ''
}

$repoRoot = (Invoke-Git -Arguments @('rev-parse', '--show-toplevel')).Output
$branch = (Invoke-Git -Arguments @('branch', '--show-current') -AllowFailure).Output
if ([string]::IsNullOrWhiteSpace($branch)) {
  $branch = '(detached)'
}

$gitEntry = Get-ChildItem -LiteralPath $repoRoot -Force | Where-Object { $_.Name -eq '.git' } | Select-Object -First 1
if ($null -eq $gitEntry) {
  $gitEntry = Resolve-Path -LiteralPath (Join-Path $repoRoot '.git') | Get-Item
}
$isSharedCheckout = $gitEntry.PSIsContainer
$commonGitDir = (Invoke-Git -Arguments @('rev-parse', '--path-format=absolute', '--git-common-dir')).Output
$mainCheckoutRoot = Split-Path -Parent $commonGitDir

Write-Output "Syncing $(if ($isSharedCheckout) { 'shared checkout' } else { 'worktree' }) on '$branch'..."
Invoke-Git -Arguments @('fetch', 'origin', 'main', '--quiet') | Out-Null
Remove-CrlfPhantoms

if ($isSharedCheckout) {
  if ($branch -notin @('main', 'master')) {
    Write-Error "Shared checkout is on '$branch'. Only main/master can be synced here."
  }

  $ahead = Get-RevCount 'origin/main..HEAD'
  $behind = Get-RevCount 'HEAD..origin/main'

  if ($ahead -gt 0) {
    Write-Error "Shared checkout has $ahead local commit(s) ahead of origin/main. Reconcile manually."
  }

  if ($behind -eq 0) {
    Write-Output 'Shared checkout is already up to date.'
    exit 0
  }

  if (Test-HasRealChanges) {
    Write-DirtyBlock 'Shared checkout'
    exit 1
  }

  Invoke-Git -Arguments @('pull', '--ff-only', 'origin', $branch) | Out-Null
  Write-Output "Shared checkout fast-forwarded $behind commit(s)."
  exit 0
}

$ahead = Get-RevCount 'origin/main..HEAD'
$behind = Get-RevCount 'HEAD..origin/main'

if ($behind -gt 0 -and (Test-HasRealChanges)) {
  Write-DirtyBlock 'Worktree'
  exit 1
}

if ($behind -gt 0) {
  try {
    Invoke-Git -Arguments @('rebase', 'origin/main') | Out-Null
    Write-Output "Git: rebased $behind commit(s) from origin/main."
  } catch {
    Invoke-Git -Arguments @('rebase', '--abort') -AllowFailure | Out-Null
    Write-Error 'Rebase onto origin/main failed. Resolve manually with: git rebase origin/main'
  }
} else {
  Write-Output "Git: already up to date with origin/main (ahead $ahead commit(s))."
}

Ensure-EnvLocal -RepoRoot $repoRoot -MainCheckoutRoot $mainCheckoutRoot
Ensure-NodeModulesLink -RepoRoot $repoRoot -MainCheckoutRoot $mainCheckoutRoot
