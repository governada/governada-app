$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

. "$PSScriptRoot\HookUtils.ps1"

$inputObject = Get-HookInputObject
$filePath = Get-ToolInputValue -InputObject $inputObject -Name 'file_path'

if (-not $filePath -or -not (Test-Path $filePath)) {
  exit 0
}

if ($filePath -match '[\\/]app[\\/].*(route|page)\.(ts|tsx)$') {
  $importsSensitiveData = Select-String -Path $filePath -Pattern '(createClient|getSupabaseAdmin|supabase|lib/data|lib/redis|process\.env\.)' -Quiet -ErrorAction SilentlyContinue
  if ($importsSensitiveData) {
    $hasForceDynamic = Select-String -Path $filePath -Pattern 'force-dynamic' -Quiet -ErrorAction SilentlyContinue
    if (-not $hasForceDynamic) {
      Write-Host "WARNING: $filePath imports Supabase/env but is missing 'export const dynamic = `"force-dynamic`"'. Railway build will fail."
    }
  }
}

exit 0
