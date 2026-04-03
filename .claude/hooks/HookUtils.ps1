function Get-HookInputRaw {
  return [Console]::In.ReadToEnd()
}

function Get-HookInputObject {
  param(
    [string]$Raw = (Get-HookInputRaw)
  )

  if ([string]::IsNullOrWhiteSpace($Raw)) {
    return $null
  }

  try {
    return $Raw | ConvertFrom-Json -Depth 20
  } catch {
    return $null
  }
}

function Get-ToolInputValue {
  param(
    $InputObject,
    [string]$Name
  )

  if ($null -eq $InputObject) {
    return $null
  }

  if ($InputObject.PSObject.Properties.Name -contains 'tool_input') {
    $toolInput = $InputObject.tool_input
    if ($toolInput -and $toolInput.PSObject.Properties.Name -contains $Name) {
      return $toolInput.$Name
    }
  }

  return $null
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

function Invoke-GitCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  try {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = 'git'
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

function Get-GitLines {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  $result = Invoke-GitCommand -Arguments $Arguments
  if ($result.ExitCode -ne 0 -or [string]::IsNullOrEmpty($result.StdOut)) {
    return @()
  }

  return @($result.StdOut -split "`r?`n" | Where-Object { $_ -ne '' })
}
