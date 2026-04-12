param(
  [Parameter(Mandatory = $true)]
  [string]$Name,
  [string]$Branch,
  [switch]$NoNodeModulesLink
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

function Get-Slug([string]$Value) {
  $slug = $Value.ToLowerInvariant() -replace '[^a-z0-9]+', '-'
  $slug = $slug.Trim('-')
  if ([string]::IsNullOrWhiteSpace($slug)) {
    throw "Name must contain at least one alphanumeric character."
  }

  return $slug
}

function Get-Lines([string]$Text) {
  if ([string]::IsNullOrWhiteSpace($Text)) {
    return @()
  }

  return $Text -split "\r?\n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
}

function Get-RevCount([string]$Range) {
  $value = (git rev-list --count $Range).Trim()
  $count = 0
  if ([int]::TryParse($value, [ref]$count)) {
    return $count
  }

  return 0
}

function Copy-LocalBootstrapFile([string]$SourceRoot, [string]$WorktreeRoot, [string]$RelativePath) {
  $sourcePath = Join-Path $SourceRoot $RelativePath
  $destinationPath = Join-Path $WorktreeRoot $RelativePath

  if (-not (Test-Path $sourcePath) -or (Test-Path $destinationPath)) {
    return
  }

  $destinationDir = Split-Path -Parent $destinationPath
  if ($destinationDir) {
    New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null
  }

  Copy-Item -LiteralPath $sourcePath -Destination $destinationPath
  Write-Host "$RelativePath copied."
}

try {
  $repoRoot = (git rev-parse --show-toplevel).Trim()
  if (-not $repoRoot) {
    throw "Run this script from inside the repository."
  }

  $gitDir = (git rev-parse --path-format=absolute --git-dir).Trim()
  $commonDir = (git rev-parse --path-format=absolute --git-common-dir).Trim()
  if (-not $gitDir -or -not $commonDir -or -not [System.StringComparer]::OrdinalIgnoreCase.Equals(
    [System.IO.Path]::GetFullPath($gitDir),
    [System.IO.Path]::GetFullPath($commonDir)
  )) {
    throw 'Run this script from the shared checkout, not from an existing worktree.'
  }

  $currentBranch = (git branch --show-current).Trim()
  if (-not $currentBranch) {
    $currentBranch = '(detached)'
  }

  if ($currentBranch -notin @('main', 'master')) {
    throw "Shared checkout must stay on main/master before creating a new worktree. Current branch: $currentBranch."
  }

  $statusLines = Get-Lines (git status --short)
  if ($statusLines.Count -gt 0) {
    throw 'Shared checkout is dirty. Clean it before creating another worktree. Run npm run session:doctor.'
  }

  $stashCount = (Get-Lines (git stash list)).Count
  if ($stashCount -gt 0) {
    throw "Repo has $stashCount stash(es). Clear or export them before creating another worktree. Run npm run session:doctor."
  }

  $slug = Get-Slug $Name
  $branchName = if ($Branch) { $Branch } else { "feat/$slug" }
  $worktreesRoot = Join-Path $repoRoot '.claude\worktrees'
  $worktreePath = Join-Path $worktreesRoot $slug

  if (Test-Path $worktreePath) {
    throw "Target worktree path already exists: $worktreePath"
  }

  New-Item -ItemType Directory -Path $worktreesRoot -Force | Out-Null

  Write-Host "Fetching origin/main..."
  git fetch origin main

  $ahead = Get-RevCount 'origin/main..HEAD'
  if ($ahead -gt 0) {
    throw "Shared checkout has $ahead local commit(s) ahead of origin/main. Reconcile them before creating another worktree."
  }

  Write-Host "Creating worktree $worktreePath on branch $branchName..."
  git worktree add $worktreePath -b $branchName origin/main

  foreach ($relativePath in @(
    '.env.local',
    '.mcp.json',
    '.claude/settings.local.json'
  )) {
    Copy-LocalBootstrapFile -SourceRoot $repoRoot -WorktreeRoot $worktreePath -RelativePath $relativePath
  }

  $mainNodeModules = Join-Path $repoRoot 'node_modules'
  $worktreeNodeModules = Join-Path $worktreePath 'node_modules'
  $mainPackageJson = Join-Path $repoRoot 'package.json'
  $worktreePackageJson = Join-Path $worktreePath 'package.json'
  if (
    -not $NoNodeModulesLink `
    -and (Test-Path $mainNodeModules) `
    -and -not (Test-Path $worktreeNodeModules) `
    -and ((Get-FileHash $mainPackageJson).Hash -eq (Get-FileHash $worktreePackageJson).Hash)
  ) {
    New-Item -ItemType Junction -Path $worktreeNodeModules -Target $mainNodeModules | Out-Null
    Write-Host "node_modules junction created."
  }

  Write-Host ""
  Write-Host "Worktree ready:"
  Write-Host "  Path:   $worktreePath"
  Write-Host "  Branch: $branchName"
  Write-Host ""
  Write-Host "Next:"
  Write-Host "  Set-Location '$worktreePath'"
  Write-Host "  git status --short --branch"
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
}
