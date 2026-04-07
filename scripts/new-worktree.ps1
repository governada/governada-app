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

$repoRoot = (git rev-parse --show-toplevel).Trim()
if (-not $repoRoot) {
  throw "Run this script from inside the repository."
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
