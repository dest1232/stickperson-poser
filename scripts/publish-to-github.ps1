param(
  [string]$Owner = "dest1232",
  [string]$Repo = "stickperson-poser",
  [ValidateSet("public", "private")]
  [string]$Visibility = "public"
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

$repoFullName = "$Owner/$Repo"

Write-Host "Checking GitHub CLI authentication..."
gh auth status | Out-Host

git config --global --add safe.directory $root

$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
git rev-parse --verify HEAD *> $null
$revParseExitCode = $LASTEXITCODE
$ErrorActionPreference = $previousErrorActionPreference

$hasCommit = $revParseExitCode -eq 0

git add .

$status = git status --porcelain
if (-not $hasCommit) {
  git commit -m "Initial stickperson poser project"
} elseif ($status) {
  git commit -m "Update stickperson poser project"
} else {
  Write-Host "No local changes to commit."
}

$currentBranch = git branch --show-current
if ($currentBranch -ne "main") {
  git branch -M main
}

$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
gh repo view $repoFullName *> $null
$repoViewExitCode = $LASTEXITCODE
$ErrorActionPreference = $previousErrorActionPreference

if ($repoViewExitCode -ne 0) {
  Write-Host "Creating GitHub repository $repoFullName..."
  gh repo create $repoFullName --$Visibility --source . --remote origin --push
} else {
  Write-Host "Repository exists. Ensuring origin remote points to $repoFullName..."
  $origin = git remote get-url origin 2>$null
  if ($LASTEXITCODE -ne 0) {
    git remote add origin "https://github.com/$repoFullName.git"
  } elseif ($origin -notmatch [regex]::Escape($repoFullName)) {
    git remote set-url origin "https://github.com/$repoFullName.git"
  }
  git push -u origin main
}

Write-Host "Published: https://github.com/$repoFullName"
