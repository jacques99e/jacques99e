# Passe Wazo Digital sur Celo MAINNET (production).
# Prerequis: wallet finance avec du CELO reel pour le gas (~0.01 CELO par ancrage).
# Usage: powershell -ExecutionPolicy Bypass -File scripts/setup-celo-mainnet.ps1

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

Write-Host "=== Celo MAINNET (production) ===" -ForegroundColor Cyan

$pk = Read-DotEnvValue "CELO_PRIVATE_KEY"
if (-not $pk) {
  Write-Host "[gen] Nouveau wallet mainnet..." -ForegroundColor Cyan
  $walletJson = node --input-type=module -e @"
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
const pk = generatePrivateKey();
const account = privateKeyToAccount(pk);
console.log(JSON.stringify({ address: account.address, privateKey: pk }));
"@
  $wallet = $walletJson | ConvertFrom-Json
  Set-DotEnvValue "CELO_PRIVATE_KEY" $wallet.privateKey
  $pk = $wallet.privateKey
  Write-Host "[ok] Nouvelle adresse: $($wallet.address)" -ForegroundColor Green
} else {
  $addr = node --input-type=module -e @"
import { privateKeyToAccount } from 'viem/accounts';
const pk = process.argv[1];
const account = privateKeyToAccount(pk.startsWith('0x') ? pk : '0x' + pk);
console.log(account.address);
"@ $pk
  Write-Host "[ok] Wallet existant: $addr" -ForegroundColor Green
}

Set-DotEnvValue "CELO_MODE" "celo"
Set-DotEnvValue "CELO_RPC_URL" "https://forno.celo.org"

$vercelVars = @{
  "CELO_MODE"        = "celo"
  "CELO_RPC_URL"     = "https://forno.celo.org"
  "CELO_PRIVATE_KEY" = Read-DotEnvValue "CELO_PRIVATE_KEY"
}

Write-Host "`n=== Vercel Production ===" -ForegroundColor Cyan
foreach ($entry in $vercelVars.GetEnumerator()) {
  Set-VercelEnv $entry.Key $entry.Value
}

Write-Host "`n=== IMPORTANT ===" -ForegroundColor Yellow
Write-Host "1. Envoyez du CELO REEL sur l'adresse wallet ci-dessus (min. ~0.1 CELO pour demarrer)"
Write-Host "2. Chaque ancrage coute ~0.001 CELO de gas"
Write-Host "3. Redeploy: vercel --prod"
Write-Host "4. Verifiez: https://app.wazo-digital.com/api/health -> celo.mode = celo"
