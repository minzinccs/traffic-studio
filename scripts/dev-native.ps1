param([switch]$NoWatch)
$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$cargoRoot = if ($env:CARGO_HOME) { $env:CARGO_HOME } else { Join-Path $env:USERPROFILE '.cargo' }
$cargoBin = Join-Path $cargoRoot 'bin'
if (Test-Path -LiteralPath (Join-Path $cargoBin 'cargo.exe')) { $env:PATH = "$cargoBin;$env:PATH" }
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) { throw 'Rust/Cargo not found. Install the Windows MSVC Rust toolchain, then reopen the shell.' }
Push-Location -LiteralPath $workspace
try {
  & (Join-Path $PSScriptRoot 'setup-capture.ps1')
  if ($NoWatch) { & npm.cmd run tauri -- dev --no-watch }
  else { & npm.cmd run tauri -- dev }
  if ($LASTEXITCODE -ne 0) { throw "Native dev exited with code $LASTEXITCODE." }
} finally { Pop-Location }
