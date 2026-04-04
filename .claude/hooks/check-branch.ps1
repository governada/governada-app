$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

. "$PSScriptRoot\HookUtils.ps1"

$rawInput = Get-HookInputRaw
$inputObject = Get-HookInputObject -Raw $rawInput
$filePath = Get-ToolInputValue -InputObject $inputObject -Name 'file_path'

if ($filePath -and $filePath -match '[\\/]\.claude[\\/].*(plans|projects)[\\/]') {
  exit 0
}

$branch = (Get-GitLines -Arguments @('rev-parse', '--abbrev-ref', 'HEAD') | Select-Object -First 1)

if ($branch -in @('main', 'master')) {
  if ($env:ALLOW_MAIN_EDIT -eq '1') {
    exit 0
  }

  Write-Host "BLOCKED: You're on '$branch'. Create a feature branch in a worktree:"
  Write-Host "  powershell -ExecutionPolicy Bypass -File scripts/new-worktree.ps1 <name>"
  Write-Host "  # Creates .claude/worktrees/<name> on feat/<name> from origin/main"
  Write-Host ""
  Write-Host "For intentional hotfixes, set ALLOW_MAIN_EDIT=1"
  exit 2
}

if ($env:ALLOW_SHARED_CHECKOUT -eq '1') {
  exit 0
}

$topLevel = (Get-GitLines -Arguments @('rev-parse', '--show-toplevel') | Select-Object -First 1)
if (-not $topLevel) {
  exit 0
}

if (Test-Path (Join-Path $topLevel '.git') -PathType Container) {
  Write-Host "BLOCKED: Feature branch '$branch' in the shared main checkout."
  Write-Host ""
  Write-Host "Parallel agents share this directory. Switching branches here"
  Write-Host "causes other agents to lose their working branch."
  Write-Host ""
  Write-Host "Create a worktree instead:"
  Write-Host "  git checkout main"
  Write-Host "  powershell -ExecutionPolicy Bypass -File scripts/new-worktree.ps1 $branch -Branch $branch"
  Write-Host ""
  Write-Host "Or start Claude Code with:  claude --worktree <name>"
  Write-Host ""
  Write-Host "To override (ONLY if you're the sole agent): ALLOW_SHARED_CHECKOUT=1"
  exit 2
}

exit 0
