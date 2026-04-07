$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

. "$PSScriptRoot\set_gh_context.ps1"

function Invoke-Git {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments,
    [switch]$AllowFailure
  )

  $output = & git @Arguments 2>&1
  $exitCode = $LASTEXITCODE
  $text = (($output | ForEach-Object { $_.ToString() }) -join "`n").TrimEnd()

  if (-not $AllowFailure -and $exitCode -ne 0) {
    if ($text) {
      throw $text
    }

    throw "git $($Arguments -join ' ') failed."
  }

  return [PSCustomObject]@{
    ExitCode = $exitCode
    Output   = $text
  }
}

function Write-Result([pscustomobject]$Result) {
  if ($Result.StdOut) {
    [Console]::Out.Write($Result.StdOut)
  }

  if ($Result.StdErr) {
    [Console]::Error.Write($Result.StdErr)
  }
}

function Show-LoginHelp([string]$GhConfigDir) {
  Write-Output "GitHub auth is not ready for the repo-scoped profile at $GhConfigDir."
  Write-Output 'Run this once in PowerShell:'
  Write-Output "  `$env:GH_CONFIG_DIR = '$GhConfigDir'"
  Write-Output '  gh auth logout --hostname github.com'
  Write-Output '  gh auth login --hostname github.com --git-protocol https --web'
  Write-Output ''
  Write-Output 'Then re-run: npm run auth:repair'
}

function Test-EmbeddedCredentialRemote([string]$RemoteUrl) {
  return $RemoteUrl -match '^https://[^/@]+:[^@]+@github\.com/'
}

$expectedUser = 'governada'
$canonicalRemote = 'https://github.com/governada/governada-app.git'
$ghConfigDir = Set-RepoGhContext

Write-Output 'Repairing GitHub auth for this repo...'

$status = Invoke-GhCommand -Arguments @('auth', 'status', '--hostname', 'github.com')
Write-Result $status

if ($status.ExitCode -ne 0) {
  Show-LoginHelp -GhConfigDir $ghConfigDir
  exit 1
}

$user = Invoke-GhCommand -Arguments @('api', 'user', '--jq', '.login')
Write-Result $user

if ($user.ExitCode -ne 0) {
  Show-LoginHelp -GhConfigDir $ghConfigDir
  exit 1
}

$login = $user.StdOut.Trim()
if ([string]::IsNullOrWhiteSpace($login)) {
  Show-LoginHelp -GhConfigDir $ghConfigDir
  exit 1
}

if ($login -ne $expectedUser) {
  Write-Output "GitHub auth is using '$login' in the repo-scoped profile at $ghConfigDir."
  Write-Output "Expected '$expectedUser'. Re-authenticate this profile instead of switching a global gh account:"
  Write-Output "  `$env:GH_CONFIG_DIR = '$GhConfigDir'"
  Write-Output '  gh auth logout --hostname github.com'
  Write-Output '  gh auth login --hostname github.com --git-protocol https --web'
  exit 1
}

$setup = Invoke-GhCommand -Arguments @('auth', 'setup-git', '--hostname', 'github.com')
Write-Result $setup
if ($setup.ExitCode -ne 0) {
  exit $setup.ExitCode
}

$currentRemote = (Invoke-Git -Arguments @('remote', 'get-url', 'origin') -AllowFailure).Output
if ($currentRemote -and ($currentRemote -ne $canonicalRemote -or (Test-EmbeddedCredentialRemote -RemoteUrl $currentRemote))) {
  Invoke-Git -Arguments @('remote', 'set-url', 'origin', $canonicalRemote) | Out-Null
  Write-Output "GitHub remote: set origin to $canonicalRemote"
}

Write-Output "GitHub auth: ready as $login"
Write-Output "Repo context: $env:GH_REPO"
