# Configure Vercel Production env for Wazo Digital payments (PayDunya live-ready).
# Usage: powershell -ExecutionPolicy Bypass -File scripts/setup-vercel-payment-live.ps1

$ErrorActionPreference = "Continue"
Set-Location (Join-Path $PSScriptRoot "..")

$envPath = Join-Path $PWD ".env.local"
if (-not (Test-Path $envPath)) {
  Write-Error ".env.local introuvable. Creez-le depuis .env.example"
}

function Read-DotEnvValue([string]$key) {
  $line = Get-Content $envPath | Where-Object { $_ -match "^$key=" } | Select-Object -First 1
  if (-not $line) { return "" }
  return ($line -replace "^$key=", "").Trim()
}

function Set-VercelEnv([string]$name, [string]$value) {
  if ([string]::IsNullOrWhiteSpace($value)) {
    Write-Host "[skip] $name (vide)"
    return
  }
  Write-Host "[set] $name"
  vercel env rm $name production --yes 2>$null | Out-Null
  $value | vercel env add $name production 2>&1 | Out-String | Write-Host
}

Write-Host "=== Wazo Digital - setup Vercel Production ===" -ForegroundColor Cyan

$map = @{
  "NEXT_PUBLIC_SUPABASE_URL"       = Read-DotEnvValue "NEXT_PUBLIC_SUPABASE_URL"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"  = Read-DotEnvValue "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  "SUPABASE_SERVICE_ROLE_KEY"      = Read-DotEnvValue "SUPABASE_SERVICE_ROLE_KEY"
  "NEXT_PUBLIC_APP_URL"            = Read-DotEnvValue "NEXT_PUBLIC_APP_URL"
  "NEXT_PUBLIC_LANDING_URL"        = Read-DotEnvValue "NEXT_PUBLIC_LANDING_URL"
  "PAYMENT_MODE"                   = Read-DotEnvValue "PAYMENT_MODE"
  "PAYMENT_PROVIDER"               = Read-DotEnvValue "PAYMENT_PROVIDER"
  "PAYMENT_API_KEY"                = Read-DotEnvValue "PAYMENT_API_KEY"
  "PAYMENT_SECRET_KEY"             = Read-DotEnvValue "PAYMENT_SECRET_KEY"
  "PAYMENT_TOKEN"                  = Read-DotEnvValue "PAYMENT_TOKEN"
  "PAYMENT_CALLBACK_SECRET"        = Read-DotEnvValue "PAYMENT_CALLBACK_SECRET"
  "CINETPAY_SITE_ID"               = Read-DotEnvValue "CINETPAY_SITE_ID"
  "CRON_SECRET"                    = Read-DotEnvValue "CRON_SECRET"
}

foreach ($entry in $map.GetEnumerator()) {
  Set-VercelEnv $entry.Key $entry.Value
}

Write-Host ""
Write-Host "Redeploy production..." -ForegroundColor Cyan
vercel --prod --yes

Write-Host ""
Write-Host "Termine. Verifiez /billing et Supabase (billing_subscriptions)." -ForegroundColor Green
