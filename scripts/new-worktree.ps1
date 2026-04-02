param(
  [Parameter(Mandatory = $true)]
  [string]$Name,
  [string]$Branch,
  [switch]$NoNodeModulesLink
)

$ErrorActionPreference = 'Stop'

function Get-Slug([string]$Value) {
  $slug = $Value.ToLowerInvariant() -replace '[^a-z0-9]+', '-'
  $slug = $slug.Trim('-')
  if ([string]::IsNullOrWhiteSpace($slug)) {
    throw "Name must contain at least one alphanumeric character."
  }
  return $slug
}

$repoRoot = (git rev-parse --show-toplevel).Trim()
if (-not $repoRoot) {
  throw "Run this script from inside the repository."
}

$slug = Get-Slug $Name
$branchName = if ($Branch) { $Branch } else { "feat/$slug" }
$workspaceRoot = Split-Path -Parent $repoRoot
$worktreePath = Join-Path $workspaceRoot "governada-$slug"

if (Test-Path $worktreePath) {
  throw "Target worktree path already exists: $worktreePath"
}

Write-Host "Fetching origin/main..."
git fetch origin main

Write-Host "Creating worktree $worktreePath on branch $branchName..."
git worktree add $worktreePath -b $branchName origin/main

$mainEnv = Join-Path $repoRoot '.env.local'
$worktreeEnv = Join-Path $worktreePath '.env.local'
if ((Test-Path $mainEnv) -and -not (Test-Path $worktreeEnv)) {
  Copy-Item -LiteralPath $mainEnv -Destination $worktreeEnv
  Write-Host ".env.local copied."
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
