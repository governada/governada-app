function Set-RepoGhContext {
  $baseDir = if ($env:USERPROFILE) { $env:USERPROFILE } elseif ($HOME) { $HOME } else { [Environment]::GetFolderPath('UserProfile') }
  $ghConfigDir = Join-Path $baseDir '.config\gh-governada'
  $env:GH_CONFIG_DIR = $ghConfigDir
  $env:GH_HOST = 'github.com'
  $env:GH_REPO = 'governada/governada-app'
  Remove-Item Env:GH_TOKEN -ErrorAction SilentlyContinue
  Remove-Item Env:GITHUB_TOKEN -ErrorAction SilentlyContinue
  Clear-DisabledLocalProxyEnv

  return $ghConfigDir
}

function Test-DisabledLocalProxyValue {
  param(
    [string]$Value
  )

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return $false
  }

  $normalized = $Value.Trim().TrimEnd('/')
  return $normalized -in @(
    'http://127.0.0.1:9',
    'https://127.0.0.1:9',
    'http://localhost:9',
    'https://localhost:9'
  )
}

function Clear-DisabledLocalProxyEnv {
  foreach ($name in @(
    'ALL_PROXY',
    'HTTP_PROXY',
    'HTTPS_PROXY',
    'GIT_HTTP_PROXY',
    'GIT_HTTPS_PROXY'
  )) {
    $value = [Environment]::GetEnvironmentVariable($name, 'Process')
    if (Test-DisabledLocalProxyValue -Value $value) {
      Remove-Item "Env:$name" -ErrorAction SilentlyContinue
      [Environment]::SetEnvironmentVariable($name, $null, 'Process')
    }
  }
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
