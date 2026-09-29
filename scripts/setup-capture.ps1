$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$runtimePath = Join-Path $projectRoot '.runtime'
if (-not (Test-Path -LiteralPath (Join-Path $runtimePath 'mitmproxy/Scripts/python.exe'))) {
 python -m venv (Join-Path $runtimePath 'mitmproxy')
}
$venvPython = Join-Path $runtimePath 'mitmproxy/Scripts/python.exe'
$installedVersion = ''
try { $installedVersion = & $venvPython -c 'import importlib.metadata; print(importlib.metadata.version(''mitmproxy''))' 2>$null }
catch { $installedVersion = '' }
if ($LASTEXITCODE -ne 0 -or $installedVersion.Trim() -ne '12.2.3') {
 & $venvPython -m pip install mitmproxy==12.2.3 --disable-pip-version-check
 if ($LASTEXITCODE -ne 0) { throw 'Capture runtime installation failed.' }
}
$basePython = & $venvPython -c 'import sys; print(sys._base_executable)'
$runtimeJson = @{python=$basePython.Trim();sitePackages=(Join-Path $runtimePath 'mitmproxy/Lib/site-packages')} | ConvertTo-Json
[System.IO.File]::WriteAllText((Join-Path $runtimePath 'capture-runtime.json'), $runtimeJson, (New-Object System.Text.UTF8Encoding($false)))
Write-Output 'Local capture runtime configured. No listener, OS proxy or trust changes were started.'
