param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$PrNumber
)

$ErrorActionPreference = 'Stop'

. "$PSScriptRoot\set_gh_context.ps1"

function Write-Result([pscustomobject]$Result) {
  if ($Result.StdOut) {
    [Console]::Out.Write($Result.StdOut)
  }

  if ($Result.StdErr) {
    [Console]::Error.Write($Result.StdErr)
  }
}

$repo = if ($env:GH_REPO) { $env:GH_REPO } else { 'governada/governada-app' }
$result = Invoke-GhCommand -Arguments @('pr', 'ready', $PrNumber, '--repo', $repo)
Write-Result $result

if ($result.ExitCode -ne 0) {
  exit $result.ExitCode
}
