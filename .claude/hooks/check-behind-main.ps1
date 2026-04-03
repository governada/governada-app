$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

. "$PSScriptRoot\HookUtils.ps1"

$rawInput = Get-HookInputRaw
$inputObject = Get-HookInputObject -Raw $rawInput
$command = Get-ToolInputValue -InputObject $inputObject -Name 'command'

if (-not $command) {
  $command = $rawInput
}

if ($command -notmatch '(?i)\bgit push\b|\bpush -u origin\b') {
  exit 0
}

if (Test-Path '.git' -PathType Container) {
  exit 0
}

$fetchResult = Invoke-GitCommand -Arguments @('fetch', 'origin', 'main', '--quiet')
if ($fetchResult.ExitCode -ne 0) {
  exit 0
}

$behindCount = (Get-GitLines -Arguments @('rev-list', 'HEAD..origin/main', '--count') | Select-Object -First 1)
if (-not $behindCount) {
  $behindCount = '0'
}

if ([int]$behindCount -gt 0) {
  $branch = (Get-GitLines -Arguments @('rev-parse', '--abbrev-ref', 'HEAD') | Select-Object -First 1)
  if (-not $branch) {
    $branch = 'this branch'
  }

  Write-Host ""
  Write-Host "PUSH BLOCKED: '$branch' is $behindCount commit(s) behind origin/main."
  Write-Host "Pushing a behind branch causes rebase conflicts or CI failures."
  Write-Host ""
  Write-Host "If working tree is CLEAN:"
  Write-Host "  git rebase origin/main"
  Write-Host ""
  Write-Host "If working tree is DIRTY (uncommitted changes):"
  Write-Host "  git stash && git rebase origin/main && git stash pop"
  Write-Host "Or commit your incremental work first, then rebase:"
  Write-Host "  git add -p && git commit -m 'wip: <description>'"
  Write-Host "  git rebase origin/main"
  Write-Host ""
  exit 2
}

exit 0
