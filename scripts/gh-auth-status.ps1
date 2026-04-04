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

$status = Invoke-GhCommand -Arguments @('auth', 'status', '--hostname', 'github.com')
Write-Result $status

if ($status.ExitCode -ne 0) {
  exit $status.ExitCode
}

$user = Invoke-GhCommand -Arguments @('api', 'user', '--jq', '.login')
if ($user.ExitCode -eq 0) {
  $login = $user.StdOut.Trim()
  if ($login) {
    Write-Output "Active GitHub user: $login"
  }
}

$repo = if ($env:GH_REPO) { $env:GH_REPO } else { 'governada/governada-app' }
Write-Output "Repo context: $repo"
