$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

. "$PSScriptRoot\..\..\scripts\set_gh_context.ps1"

$expectedUser = 'governada'
$ghConfigDir = $env:GH_CONFIG_DIR

if (-not (Test-GhAuthStatus)) {
  Write-Host "WARNING: gh is not authenticated for the repo-scoped profile."
  if ($ghConfigDir) {
    Write-Host "Run 'npm run auth:repair' to initialize the profile at $ghConfigDir before running GitHub workflows."
  } else {
    Write-Host "Run 'npm run auth:repair' before running GitHub workflows."
  }
  exit 0
}

$currentUser = (Invoke-GhCommand -Arguments @('api', 'user', '--jq', '.login')).StdOut.Trim()

if ([string]::IsNullOrWhiteSpace($currentUser)) {
  Write-Host "GitHub auth: using repo-scoped profile at $ghConfigDir"
} elseif ($currentUser -eq $expectedUser) {
  Write-Host "GitHub auth: $currentUser via $ghConfigDir"
} else {
  Write-Host "WARNING: expected $expectedUser but gh resolved to $currentUser (profile: $ghConfigDir)"
}

exit 0
