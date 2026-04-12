$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

. "$PSScriptRoot\set_gh_context.ps1"

function Invoke-Git {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments,
    [switch]$AllowFailure,
    [string]$WorkingDirectory = (Get-Location).Path
  )

  $output = & git -C $WorkingDirectory @Arguments 2>&1
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

      $current = [PSCustomObject][ordered]@{
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

function Get-BootstrapSource([string]$RelativePath) {
  $currentPath = Join-Path $repoRoot $RelativePath
  if (Test-Path $currentPath) {
    return [PSCustomObject]@{
      Path  = $currentPath
      Scope = 'current checkout'
    }
  }

  if ($mainCheckoutRoot -and ($mainCheckoutRoot -ne $repoRoot)) {
    $sharedPath = Join-Path $mainCheckoutRoot $RelativePath
    if (Test-Path $sharedPath) {
      return [PSCustomObject]@{
        Path  = $sharedPath
        Scope = 'shared checkout fallback'
      }
    }
  }

  return $null
}

function Format-BootstrapFileStatus([string]$RelativePath) {
  $source = Get-BootstrapSource $RelativePath
  if ($null -eq $source) {
    return "$RelativePath (missing)"
  }

  return "$RelativePath -> $($source.Scope)"
}

function Get-RepoBootstrapLines() {
  return @(
    (Format-BootstrapFileStatus '.env.local'),
    (Format-BootstrapFileStatus '.mcp.json'),
    (Format-BootstrapFileStatus '.claude/settings.local.json'),
    (Format-BootstrapFileStatus 'scripts/lib/runtime.js'),
    (Format-BootstrapFileStatus 'scripts/set_gh_context.ps1'),
    (Format-BootstrapFileStatus 'scripts/set-gh-context.js')
  )
}

function Get-McpServerLines() {
  $mcpSource = Get-BootstrapSource '.mcp.json'
  if ($null -eq $mcpSource) {
    return @('.mcp.json -> missing; MCP discovery will fall back to higher-level config')
  }

  try {
    $config = Get-Content -LiteralPath $mcpSource.Path -Raw | ConvertFrom-Json -ErrorAction Stop
  } catch {
    return @(".mcp.json -> invalid JSON ($($_.Exception.Message))")
  }

  if ($null -eq $config.mcpServers) {
    return @('.mcp.json -> mcpServers missing')
  }

  $lines = @()
  foreach ($property in $config.mcpServers.PSObject.Properties) {
    $serverName = $property.Name
    $server = $property.Value
    $command = [string]$server.command
    $args = @($server.args)

    if ($command -eq 'cmd' -and $args.Count -ge 2 -and $args[0] -eq '/c') {
      $wrapperPath = [string]$args[1]
      $suffix = if (Test-Path $wrapperPath) { '' } else { ' (missing)' }
      $lines += "MCP $serverName -> $wrapperPath$suffix"
      continue
    }

    $summary = if ($args.Count -gt 0) {
      "$command $($args -join ' ')"
    } else {
      $command
    }

    $lines += "MCP $serverName -> $summary"
  }

  return $lines
}

function Get-RepoScopedToolLines() {
  $lines = @()
  $ghConfigDir = $env:GH_CONFIG_DIR
  if ([string]::IsNullOrWhiteSpace($ghConfigDir)) {
    $lines += 'GH_CONFIG_DIR (missing)'
  } else {
    $suffix = if (Test-Path $ghConfigDir) { '' } else { ' (missing)' }
    $lines += "GH_CONFIG_DIR -> $ghConfigDir$suffix"
  }

  if (Test-GhAuthStatus) {
    $user = (Invoke-GhCommand -Arguments @('api', 'user', '--jq', '.login')).StdOut.Trim()
    if ($user) {
      $lines += "GitHub auth -> ready as $user"
    } else {
      $lines += 'GitHub auth -> ready'
    }
  } else {
    $lines += "GitHub auth -> not ready (run 'npm run auth:repair')"
  }

  $lines += (Get-McpServerLines)
  $lines += 'Lookup order -> current checkout, shared checkout fallback, repo-scoped user paths, then global defaults'

  return $lines
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

function Test-SharedCheckout([string]$TopLevel) {
  $gitDir = (Invoke-Git -Arguments @('rev-parse', '--path-format=absolute', '--git-dir') -AllowFailure -WorkingDirectory $TopLevel).Output
  $commonDir = (Invoke-Git -Arguments @('rev-parse', '--path-format=absolute', '--git-common-dir') -AllowFailure -WorkingDirectory $TopLevel).Output
  if ([string]::IsNullOrWhiteSpace($gitDir) -or [string]::IsNullOrWhiteSpace($commonDir)) {
    return $false
  }

  return [System.StringComparer]::OrdinalIgnoreCase.Equals(
    [System.IO.Path]::GetFullPath($gitDir),
    [System.IO.Path]::GetFullPath($commonDir)
  )
}

function Test-GoneUpstream([string]$Branch) {
  if ([string]::IsNullOrWhiteSpace($Branch) -or $Branch -eq '(detached)') {
    return $false
  }

  $details = (Invoke-Git -Arguments @('branch', '-vv', '--list', $Branch) -AllowFailure -WorkingDirectory $repoRoot).Output
  return $details -like '*: gone]*'
}

try {
  $strict = $false
  foreach ($arg in $args) {
    switch ($arg) {
      '--strict' { $strict = $true }
      '--help' {
        Write-Output 'Usage: powershell -File scripts/session-doctor.ps1 [--strict]'
        exit 0
      }
      '-h' {
        Write-Output 'Usage: powershell -File scripts/session-doctor.ps1 [--strict]'
        exit 0
      }
      default {
        throw "Unknown option: $arg"
      }
    }
  }

  $repoRoot = (Invoke-Git -Arguments @('rev-parse', '--show-toplevel')).Output
  $commonGitDir = (Invoke-Git -Arguments @('rev-parse', '--path-format=absolute', '--git-common-dir')).Output
  $mainCheckoutRoot = Split-Path -Parent $commonGitDir
  $branch = (Invoke-Git -Arguments @('branch', '--show-current') -AllowFailure -WorkingDirectory $repoRoot).Output
  if ([string]::IsNullOrWhiteSpace($branch)) {
    $branch = '(detached)'
  }

  $statusLines = Get-Lines ((Invoke-Git -Arguments @('status', '--short') -AllowFailure -WorkingDirectory $repoRoot).Output)
  $stashLines = Get-Lines ((Invoke-Git -Arguments @('stash', 'list') -AllowFailure -WorkingDirectory $repoRoot).Output)
  $worktrees = Parse-Worktrees ((Invoke-Git -Arguments @('worktree', 'list', '--porcelain') -AllowFailure -WorkingDirectory $repoRoot).Output)
  $sharedCheckout = Test-SharedCheckout $repoRoot
  $checkoutLabel = if ($sharedCheckout) { 'shared checkout' } else { 'worktree' }
  $dirtyWorktrees = @()
  $goneUpstreamWorktrees = @()
  $blockingIssues = @()
  $advisories = @()

  foreach ($worktree in @($worktrees)) {
    $isCurrent = [System.StringComparer]::OrdinalIgnoreCase.Equals(
      [System.IO.Path]::GetFullPath($worktree.Path),
      [System.IO.Path]::GetFullPath($repoRoot)
    )
    $worktreeStatus = Get-Lines ((Invoke-Git -Arguments @('status', '--short') -AllowFailure -WorkingDirectory $worktree.Path).Output)
    $dirtyCount = @($worktreeStatus).Count
    if ($dirtyCount -gt 0 -and -not $isCurrent) {
      $dirtyWorktrees += "$($worktree.Branch) -> $($worktree.Path) ($dirtyCount changes)"
    }

    if (Test-GoneUpstream $worktree.Branch) {
      $goneUpstreamWorktrees += "$($worktree.Branch) -> $($worktree.Path)"
    }
  }

  if ($sharedCheckout -and $branch -notin @('main', 'master')) {
    $blockingIssues += "Shared checkout should stay on main/master. Current branch: $branch."
  }

  if ($statusLines.Count -gt 0) {
    $blockingIssues += "$(if ($sharedCheckout) { 'Shared checkout' } else { 'Current worktree' }) has $($statusLines.Count) local change(s)."
  }

  if ($stashLines.Count -gt 0) {
    $blockingIssues += "Repo has $($stashLines.Count) stash(es)."
  }

  if ($dirtyWorktrees.Count -gt 0) {
    $blockingIssues += "Repo has $($dirtyWorktrees.Count) other dirty worktree(s)."
  }

  if ($goneUpstreamWorktrees.Count -gt 0) {
    $blockingIssues += "$($goneUpstreamWorktrees.Count) worktree(s) track an upstream branch that is gone."
  }

  if (@($worktrees).Count -gt 5) {
    $advisories += "Repo has $(@($worktrees).Count) worktrees open. Prune merged or abandoned worktrees before opening more."
  }

  Write-Output '=== Session Doctor ==='
  Write-Output "Repo: $repoRoot"
  Write-Output "Checkout: $checkoutLabel"
  Write-Output "Branch: $branch"
  Write-Output ("Status: " + ($(if ($statusLines.Count -eq 0) { 'clean' } else { "dirty ($($statusLines.Count) changes)" })))
  Write-Output "Stashes: $($stashLines.Count)"
  Write-Output "Worktrees: $(@($worktrees).Count)"
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

  Print-Section 'Dirty worktrees' $dirtyWorktrees
  Write-Output ''

  Print-Section 'Gone upstream worktrees' $goneUpstreamWorktrees
  Write-Output ''

  Print-Section 'Repo bootstrap files' (Get-RepoBootstrapLines)
  Write-Output ''

  Print-Section 'Repo-scoped auth and MCP' (Get-RepoScopedToolLines)
  Write-Output ''

  Print-Section 'Session files' @(
    (Test-RepoFile '.cursor/tasks/lessons.md'),
    (Test-RepoFile '.cursor/tasks/todo.md')
  )
  Write-Output ''

  if ($blockingIssues.Count -gt 0) {
    Print-Section $(if ($strict) { 'Blocking issues' } else { 'Warnings' }) $blockingIssues
    Write-Output ''
  }

  if ($advisories.Count -gt 0) {
    Print-Section 'Advisories' $advisories
    Write-Output ''
  }

  if ($strict) {
    if ($blockingIssues.Count -gt 0) {
      [Console]::Error.WriteLine("STRICT FAILED: $($blockingIssues.Count) hygiene issue(s) found.")
      exit 1
    }

    Write-Output 'STRICT OK: local hygiene checks passed.'
  }
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
}
