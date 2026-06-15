# Configure Celo (Alfajores testnet) for Wazo Digital traceability.
# Usage: powershell -ExecutionPolicy Bypass -File scripts/setup-celo.ps1

$ErrorActionPreference = "Continue"
Set-Location (Join-Path $PSScriptRoot "..")

$envPath = Join-Path $PWD ".env.local"

function Read-DotEnvValue([string]$key) {
  if (-not (Test-Path $envPath)) { return "" }
  $line = Get-Content $envPath | Where-Object { $_ -match "^$key=" } | Select-Object -First 1
  if (-not $line) { return "" }
  return ($line -replace "^$key=", "").Trim().Trim('"')
}

function Set-DotEnvValue([string]$key, [string]$value) {
  if (-not (Test-Path $envPath)) {
    Copy-Item (Join-Path $PWD ".env.example") $envPath
  }
  $lines = Get-Content $envPath
  $found = $false
  $out = foreach ($line in $lines) {
    if ($line -match "^$key=") {
      $found = $true
      "$key=$value"
    } else { $line }
  }
  if (-not $found) { $out += "$key=$value" }
  $out | Set-Content $envPath -Encoding utf8
}

function Set-VercelEnv([string]$name, [string]$value) {
  if ([string]::IsNullOrWhiteSpace($value)) {
    Write-Host "[skip] $name (vide)" -ForegroundColor Yellow
    return
  }
  Write-Host "[set] $name" -ForegroundColor Green
  vercel env rm $name production --yes 2>$null | Out-Null
  $value | vercel env add $name production 2>&1 | Out-String | Write-Host
}

Write-Host "=== Wazo Digital - configuration Celo Alfajores ===" -ForegroundColor Cyan

$existingPk = Read-DotEnvValue "CELO_PRIVATE_KEY"
if (-not $existingPk) {
  Write-Host "[gen] Nouveau wallet Celo..." -ForegroundColor Cyan
  $walletJson = node --input-type=module -e @"
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
const pk = generatePrivateKey();
const account = privateKeyToAccount(pk);
console.log(JSON.stringify({ address: account.address, privateKey: pk }));
"@
  $wallet = $walletJson | ConvertFrom-Json
  Set-DotEnvValue "CELO_PRIVATE_KEY" $wallet.privateKey
  Set-DotEnvValue "CELO_MODE" "alfajores"
  Set-DotEnvValue "CELO_RPC_URL" "https://alfajores-forno.celo-testnet.org"
  Write-Host "[ok] Adresse wallet: $($wallet.address)" -ForegroundColor Green
  Write-Host "[info] Demandez des CELO test sur https://faucet.celo.org" -ForegroundColor Yellow
} else {
  Write-Host "[ok] CELO_PRIVATE_KEY deja present dans .env.local" -ForegroundColor Green
}

Set-DotEnvValue "CELO_MODE" "alfajores"
Set-DotEnvValue "CELO_RPC_URL" "https://alfajores-forno.celo-testnet.org"

$cronVars = @{
  "CELO_MODE"         = "alfajores"
  "CELO_RPC_URL"      = "https://alfajores-forno.celo-testnet.org"
  "CELO_PRIVATE_KEY"  = Read-DotEnvValue "CELO_PRIVATE_KEY"
}

Write-Host "`n=== Vercel Production ===" -ForegroundColor Cyan
foreach ($entry in $cronVars.GetEnumerator()) {
  Set-VercelEnv $entry.Key $entry.Value
}

Write-Host "`n=== Migration Supabase 007 ===" -ForegroundColor Cyan
node scripts/apply-celo-migration.mjs

Write-Host "`n=== Test ancrage Celo ===" -ForegroundColor Cyan
node scripts/test-celo-anchor.mjs

Write-Host "`nRedeploy recommande: vercel --prod" -ForegroundColor Cyan
