function Set-RepoGhContext {
  $baseDir = if ($env:USERPROFILE) { $env:USERPROFILE } elseif ($HOME) { $HOME } else { [Environment]::GetFolderPath('UserProfile') }
  $ghConfigDir = Join-Path $baseDir '.config\gh-governada'
  $env:GH_CONFIG_DIR = $ghConfigDir
  $env:GH_HOST = 'github.com'
  $env:GH_REPO = 'governada/governada-app'

  $tokenPath = Join-Path $ghConfigDir 'token.txt'
  if (Test-Path $tokenPath) {
    $token = (Get-Content -LiteralPath $tokenPath -Raw -ErrorAction SilentlyContinue).Trim()
    if ($token) {
      $env:GH_TOKEN = $token
      $env:GITHUB_TOKEN = $token
    }
  }

  return $ghConfigDir
}

function Join-NativeArguments {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  return ($Arguments | ForEach-Object {
    if ($_ -eq '') {
      '""'
    } elseif ($_ -match '[\s"]') {
      '"' + ($_ -replace '([\\]*)"', '$1$1\"' -replace '([\\]+)$', '$1$1') + '"'
    } else {
      $_
    }
  }) -join ' '
}

function Invoke-GhCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  try {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = 'gh'
    $psi.Arguments = Join-NativeArguments -Arguments $Arguments
    $psi.WorkingDirectory = (Get-Location).Path
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true

    foreach ($key in @($psi.EnvironmentVariables.Keys)) {
      $psi.EnvironmentVariables.Remove($key)
    }

    $envs = [Environment]::GetEnvironmentVariables('Process')
    foreach ($key in $envs.Keys) {
      if ($null -eq $key) {
        continue
      }

      $name = [string]$key
      if ([string]::IsNullOrWhiteSpace($name)) {
        continue
      }

      $value = [string]$envs[$key]
      $psi.EnvironmentVariables[$name] = $value
    }

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $psi
    $null = $process.Start()
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()

    return [PSCustomObject]@{
      ExitCode = $process.ExitCode
      StdOut   = $stdout
      StdErr   = $stderr
    }
  } catch {
    return [PSCustomObject]@{
      ExitCode = 1
      StdOut   = ''
      StdErr   = $_.Exception.Message
    }
  }
}

function Test-GhAuthStatus {
  $result = Invoke-GhCommand -Arguments @('auth', 'status', '--hostname', 'github.com')
  return $result.ExitCode -eq 0
}

Set-RepoGhContext | Out-Null
