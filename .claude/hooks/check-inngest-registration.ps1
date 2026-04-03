$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

. "$PSScriptRoot\HookUtils.ps1"

$inputObject = Get-HookInputObject
$filePath = Get-ToolInputValue -InputObject $inputObject -Name 'file_path'

if (-not $filePath -or -not (Test-Path $filePath)) {
  exit 0
}

if ($filePath -match '[\\/]inngest[\\/]functions[\\/].*\.ts$') {
  $funcName = [System.IO.Path]::GetFileNameWithoutExtension($filePath)
  $repoRoot = (& git rev-parse --show-toplevel 2>$null | Select-Object -First 1)
  if (-not $repoRoot) {
    exit 0
  }

  $routePath = Join-Path $repoRoot 'app\api\inngest\route.ts'
  if (-not (Test-Path $routePath)) {
    exit 0
  }

  $isRegistered = Select-String -Path $routePath -Pattern ([regex]::Escape($funcName)) -Quiet -ErrorAction SilentlyContinue
  if (-not $isRegistered) {
    Write-Host "REMINDER: New Inngest function '$funcName' -- register it in app/api/inngest/route.ts in the same commit."
  }
}

exit 0
