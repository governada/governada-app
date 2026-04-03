$ErrorActionPreference = 'Continue'
$PSNativeCommandUseErrorActionPreference = $false

. "$PSScriptRoot\HookUtils.ps1"
. "$PSScriptRoot\..\..\scripts\set_gh_context.ps1"

function Test-InWorktree {
  $result = Invoke-GitCommand -Arguments @('rev-parse', '--git-dir')
  if ($result.ExitCode -ne 0) {
    return $false
  }

  return -not (Test-Path '.git' -PathType Container)
}

function Test-NumstatHasRealChanges {
  param(
    [string[]]$Lines
  )

  foreach ($line in $Lines) {
    if (-not $line) {
      continue
    }

    $parts = $line -split '\s+', 3
    if ($parts.Length -lt 2) {
      continue
    }

    if ($parts[0] -eq '0' -and $parts[1] -eq '0') {
      continue
    }

    return $true
  }

  return $false
}

function Cleanup-CrlfPhantoms {
  $quietResult = Invoke-GitCommand -Arguments @('diff', '--quiet', 'HEAD')
  if ($quietResult.ExitCode -eq 0) {
    return
  }

  $numstat = Get-GitLines -Arguments @('diff', '--numstat', 'HEAD')
  if (Test-NumstatHasRealChanges -Lines $numstat) {
    return
  }

  $count = (Get-GitLines -Arguments @('diff', '--name-only', 'HEAD')).Count
  $checkoutResult = Invoke-GitCommand -Arguments @('checkout', '--', '.')
  if ($checkoutResult.ExitCode -eq 0 -and $count -gt 0) {
    Write-Host "Git: discarded $count CRLF phantom diffs"
  }
}

function Sync-Git {
  $fetchMain = Invoke-GitCommand -Arguments @('fetch', 'origin', 'main', '--quiet')
  if ($fetchMain.ExitCode -ne 0) {
    Write-Host "WARN: Could not fetch origin/main; check network/auth."
    return
  }

  $fetchLocalMain = Invoke-GitCommand -Arguments @('fetch', 'origin', 'main:main', '--quiet')
  if ($fetchLocalMain.ExitCode -eq 0) {
    Write-Host "Git: local main fast-forwarded to origin/main"
  }

  Cleanup-CrlfPhantoms

  $local = (Get-GitLines -Arguments @('rev-parse', 'HEAD') | Select-Object -First 1)
  $mergeBase = (Get-GitLines -Arguments @('merge-base', 'HEAD', 'origin/main') | Select-Object -First 1)
  $remote = (Get-GitLines -Arguments @('rev-parse', 'origin/main') | Select-Object -First 1)

  if (-not $local -or -not $mergeBase -or -not $remote) {
    return
  }

  $behindCount = (Get-GitLines -Arguments @('rev-list', "$mergeBase..$remote", '--count') | Select-Object -First 1)
  $aheadCount = (Get-GitLines -Arguments @('rev-list', "$remote..HEAD", '--count') | Select-Object -First 1)

  if ($mergeBase -eq $remote) {
    Write-Host "Git: up-to-date with origin/main (ahead $aheadCount commits)."
    return
  }

  $realChanges = Get-GitLines -Arguments @('diff', '--numstat', 'HEAD')
  $stagedChanges = Get-GitLines -Arguments @('diff', '--cached', '--numstat', 'HEAD')
  $untracked = Get-GitLines -Arguments @('ls-files', '--others', '--exclude-standard') |
    Where-Object { $_ -notmatch '^\.claude/' } |
    Select-Object -First 1

  $isDirty = (Test-NumstatHasRealChanges -Lines $realChanges) -or
    (Test-NumstatHasRealChanges -Lines $stagedChanges) -or
    -not [string]::IsNullOrWhiteSpace($untracked)

  if ($isDirty) {
    Write-Host ""
    Write-Host "========================================================================="
    Write-Host "BLOCKED: Worktree is $behindCount commit(s) behind origin/main"
    Write-Host "         AND has uncommitted changes (auto-rebase not possible)."
    Write-Host ""
    Write-Host "Planning or coding on stale code wastes the session; you'll hit"
    Write-Host "conflicts on every file that changed on main since you branched."
    Write-Host ""
    Write-Host "Fix (pick one):"
    Write-Host ""
    Write-Host "  Option A - Stash, rebase, pop:"
    Write-Host "    git stash"
    Write-Host "    git rebase origin/main"
    Write-Host "    git stash pop"
    Write-Host ""
    Write-Host "  Option B - Commit WIP first, then rebase:"
    Write-Host "    git add -A && git commit -m 'wip: save progress'"
    Write-Host "    git rebase origin/main"
    Write-Host ""
    Write-Host "  Option C - Discard local changes and rebase (DESTRUCTIVE):"
    Write-Host "    git checkout -- ."
    Write-Host "    git rebase origin/main"
    Write-Host ""
    Write-Host "Uncommitted files:"
    Get-GitLines -Arguments @('status', '--short') | Select-Object -First 10
    Write-Host "========================================================================="
    Write-Host ""
    exit 2
  }

  $rebaseResult = Invoke-GitCommand -Arguments @('rebase', 'origin/main', '--quiet')
  if ($rebaseResult.ExitCode -ne 0) {
    Invoke-GitCommand -Arguments @('rebase', '--abort') | Out-Null
    Write-Host ""
    Write-Host "Auto-rebase onto origin/main FAILED (conflicts). Run manually:"
    Write-Host "  git rebase origin/main"
    Write-Host ""
    return
  }

  Write-Host "Git: rebased $behindCount commits from origin/main"
}

function Setup-DevEnv {
  $commonDir = (Get-GitLines -Arguments @('rev-parse', '--path-format=absolute', '--git-common-dir') | Select-Object -First 1)
  if (-not $commonDir) {
    return
  }

  $mainCheckout = if ($commonDir -match '[\\/]\.git$') { Split-Path -Parent $commonDir } else { $commonDir }
  if (-not (Test-Path $mainCheckout -PathType Container)) {
    return
  }

  $mainEnv = Join-Path $mainCheckout '.env.local'
  $worktreeEnv = Join-Path (Get-Location) '.env.local'
  if (-not (Test-Path $worktreeEnv) -and (Test-Path $mainEnv)) {
    Copy-Item -LiteralPath $mainEnv -Destination $worktreeEnv -ErrorAction SilentlyContinue
    if ($?) {
      Write-Host ".env.local: copied from main checkout"
    }
  }

  $mainNodeModules = Join-Path $mainCheckout 'node_modules'
  $worktreeNodeModules = Join-Path (Get-Location) 'node_modules'
  $mainPackageJson = Join-Path $mainCheckout 'package.json'
  $worktreePackageJson = Join-Path (Get-Location) 'package.json'

  if (-not (Test-Path $worktreeNodeModules) -and (Test-Path $mainNodeModules)) {
    $samePackage = $false
    if ((Test-Path $mainPackageJson) -and (Test-Path $worktreePackageJson)) {
      $samePackage = (Get-FileHash $mainPackageJson).Hash -eq (Get-FileHash $worktreePackageJson).Hash
    }

    if ($samePackage) {
      try {
        New-Item -ItemType Junction -Path $worktreeNodeModules -Target $mainNodeModules -ErrorAction Stop | Out-Null
        Write-Host "node_modules: junctioned from main checkout"
      } catch {
        Write-Host "node_modules: junction failed; running npm install..."
        & npm install --prefer-offline --silent 2>$null
        if ($LASTEXITCODE -eq 0) {
          Write-Host "node_modules: installed"
        } else {
          Write-Host "WARN: npm install failed; run it manually."
        }
      }
    } else {
      Write-Host "node_modules: package.json differs from main; running npm install..."
      & npm install --prefer-offline --silent 2>$null
      if ($LASTEXITCODE -eq 0) {
        Write-Host "node_modules: installed"
      } else {
        Write-Host "WARN: npm install failed; run it manually."
      }
    }
  }
}

function Setup-GitCredentials {
  if (Test-GhAuthStatus) {
    $result = Invoke-GhCommand -Arguments @('auth', 'setup-git', '--hostname', 'github.com')
    if ($result.ExitCode -eq 0) {
      Write-Host "Git credentials: HTTPS push configured via gh"
    }
  }
}

function Check-DiffHealth {
  $untrackedFiles = Get-GitLines -Arguments @('ls-files', '--others', '--exclude-standard')
  $untrackedLineCount = 0

  foreach ($file in $untrackedFiles) {
    if (-not (Test-Path $file -PathType Leaf)) {
      continue
    }

    try {
      $untrackedLineCount += (Get-Content -LiteralPath $file -ErrorAction Stop | Measure-Object -Line).Lines
    } catch {
      continue
    }
  }

  $shortStat = (Get-GitLines -Arguments @('diff', '--shortstat', 'HEAD') | Select-Object -First 1)
  $modifiedLineCount = 0
  if ($shortStat) {
    foreach ($match in [regex]::Matches($shortStat, '(\d+)\s+(insertion|deletion)')) {
      $modifiedLineCount += [int]$match.Groups[1].Value
    }
  }

  $total = $untrackedLineCount + $modifiedLineCount
  if ($total -gt 500) {
    Write-Host ""
    Write-Host "LARGE DIFF DETECTED: ~$total lines of uncommitted/untracked changes"
    Write-Host "Untracked files:"
    $untrackedFiles | Select-Object -First 10 | ForEach-Object { Write-Host "  $_" }
    Write-Host "Modified files:"
    Get-GitLines -Arguments @('diff', '--name-only', 'HEAD') | Select-Object -First 10 | ForEach-Object { Write-Host "  $_" }
    Write-Host ""
    Write-Host "This will show in the session diff display. If unexpected,"
    Write-Host "add to .gitignore or delete before starting work."
    Write-Host ""
  }
}

if (-not (Test-InWorktree)) {
  exit 0
}

$branch = (Get-GitLines -Arguments @('rev-parse', '--abbrev-ref', 'HEAD') | Select-Object -First 1)
Write-Host "=== Worktree setup: $branch ==="
Cleanup-CrlfPhantoms
Sync-Git
Setup-DevEnv
Setup-GitCredentials
Check-DiffHealth
Write-Host "=== Setup complete ==="
exit 0
