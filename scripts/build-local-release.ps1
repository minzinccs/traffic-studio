$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$index = Join-Path $projectRoot 'dist/index.html'
$executable = Join-Path $projectRoot 'src-tauri/target/release/traffic-studio.exe'

Push-Location $projectRoot
try {
  npm run build
  if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }

  # `cargo build --release` alone is not enough here: tauri's `dev` cfg is `!custom-protocol`
  # (tauri 2 build.rs), and this package does not enable `tauri/custom-protocol` on its own.
  # Such a binary loads devUrl http://127.0.0.1:1420 and embeds no frontend, so it only works
  # while the Vite dev server runs. The Tauri CLI compiles with custom-protocol and embeds dist.
  npm run tauri -- build --no-bundle
  if ($LASTEXITCODE -ne 0) { throw 'Native release build failed.' }
  if (-not (Test-Path -LiteralPath $executable -PathType Leaf)) {
    throw "Release executable was not produced: $executable"
  }

  # Guard: fail loudly if the executable depends on the Vite dev server instead of embedding dist.
  $entry = [regex]::Match((Get-Content -LiteralPath $index -Raw), 'assets/[A-Za-z0-9_.-]+\.js').Value
  if (-not $entry) { throw 'Could not read the frontend entry asset from dist/index.html.' }
  $binary = [System.Text.Encoding]::ASCII.GetString([System.IO.File]::ReadAllBytes($executable))
  if (-not $binary.Contains($entry)) {
    throw "Release executable does not embed the frontend ($entry). Build it with the Tauri CLI, not plain cargo."
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
