$ErrorActionPreference = 'Stop'
$env:PYTHONUTF8 = '1'
$taskRoot = (Resolve-Path "$PSScriptRoot/..").Path
$python = Join-Path $taskRoot '.venv/Scripts/python.exe'
Push-Location $taskRoot
try {
  & $python scripts/genvm_lint_rc.py check contracts/rank_reserve.py
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  & "$taskRoot/.venv/Scripts/gltest.exe" tests/ -q --tb=short
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  if (Test-Path tests/deployment/receipts.test.mjs) {
    & node --test tests/deployment/receipts.test.mjs
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }
  foreach ($file in Get-ChildItem scripts -Filter '*.mjs') {
    & node --check $file.FullName
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }
  Write-Output 'CHECK_PASS: semantic lint, ASCII/header/metadata, direct tests and deployment parser'
} finally { Pop-Location }
