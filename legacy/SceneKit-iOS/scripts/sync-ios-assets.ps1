$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$source = Join-Path $repoRoot "public\stickman_default.glb"
$targetDir = Join-Path $repoRoot "ios\StickpersonPoser\StickpersonPoser\Resources"
$target = Join-Path $targetDir "stickman_default.glb"
$usdz = Join-Path $targetDir "stickman_default.usdz"

if (!(Test-Path -LiteralPath $source)) {
  throw "Missing source GLB: $source"
}

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
Copy-Item -LiteralPath $source -Destination $target -Force

if (Test-Path -LiteralPath $usdz) {
  Write-Host "GLB synced. Existing USDZ remains in place:"
  Write-Host $usdz
  Write-Host "Regenerate USDZ on macOS before publishing if the GLB changed."
} else {
  Set-Content -LiteralPath $usdz -Value "Placeholder. Replace with converted USDZ on macOS." -NoNewline
  Write-Host "GLB synced and placeholder USDZ created."
}

Write-Host "Synced:"
Write-Host $target

