param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$PrNumber,

  [ValidateSet('squash', 'merge', 'rebase')]
  [string]$Method = 'squash',

  [string]$CommitTitle = '',

  [string]$CommitMessage = ''
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
$arguments = @(
  'api',
  "repos/$repo/pulls/$PrNumber/merge",
  '-X',
  'PUT',
  '-f',
  "merge_method=$Method"
)

if (-not [string]::IsNullOrWhiteSpace($CommitTitle)) {
  $arguments += @('-f', "commit_title=$CommitTitle")
}

if (-not [string]::IsNullOrWhiteSpace($CommitMessage)) {
  $arguments += @('-f', "commit_message=$CommitMessage")
}

$result = Invoke-GhCommand -Arguments $arguments
Write-Result $result

if ($result.ExitCode -ne 0) {
  exit $result.ExitCode
}
