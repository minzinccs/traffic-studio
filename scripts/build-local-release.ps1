$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$manifest = Join-Path $projectRoot 'src-tauri/Cargo.toml'
$executable = Join-Path $projectRoot 'src-tauri/target/release/traffic-studio.exe'

Push-Location $projectRoot
try {
  npm run build
  if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }

  cargo build --release --manifest-path $manifest
  if ($LASTEXITCODE -ne 0) { throw 'Native release build failed.' }
  if (-not (Test-Path -LiteralPath $executable -PathType Leaf)) {
    throw "Release executable was not produced: $executable"
  }

  Write-Output "Local release executable: $executable"
  if (Test-Path -LiteralPath (Join-Path $projectRoot '.runtime/capture-runtime.json')) {
    Write-Output 'Capture runtime configuration exists. The app validates Python, dependencies and adapter before advertising capture.'
  } else {
    Write-Output 'Capture runtime is absent. Run scripts/setup-capture.ps1 to enable local capture.'
  }
  Write-Output 'This build runs from this checkout. It is not a distributable installer.'
}
finally {
  Pop-Location
}
