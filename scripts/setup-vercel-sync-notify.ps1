# Configure Vercel Production env for sync cloud, weekly email cron, and web push.
# Usage: powershell -ExecutionPolicy Bypass -File scripts/setup-vercel-sync-notify.ps1
# Optional: set RESEND_API_KEY in .env.local before running for real emails.

$ErrorActionPreference = "Continue"
Set-Location (Join-Path $PSScriptRoot "..")

function Read-DotEnvValue([string]$key) {
  $envPath = Join-Path $PWD ".env.local"
  if (-not (Test-Path $envPath)) { return "" }
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

Write-Host "=== Wazo Digital - sync / email / push (Production) ===" -ForegroundColor Cyan

$cronSecret = Read-DotEnvValue "CRON_SECRET"
if (-not $cronSecret) {
  $cronSecret = -join ((48..57) + (97..102) | Get-Random -Count 64 | ForEach-Object { [char]$_ })
  Write-Host "[gen] CRON_SECRET (nouveau)"
}

$vapidPublic = Read-DotEnvValue "NEXT_PUBLIC_VAPID_PUBLIC_KEY"
$vapidPrivate = Read-DotEnvValue "VAPID_PRIVATE_KEY"
if (-not $vapidPublic -or -not $vapidPrivate) {
  Write-Host "[gen] Paires VAPID via web-push..."
  $out = npx web-push generate-vapid-keys 2>&1 | Out-String
  if ($out -match "Public Key:\s*(\S+)") { $vapidPublic = $Matches[1] }
  if ($out -match "Private Key:\s*(\S+)") { $vapidPrivate = $Matches[1] }
}

$resendKey = Read-DotEnvValue "RESEND_API_KEY"
$emailFrom = Read-DotEnvValue "REPORT_EMAIL_FROM"
if (-not $emailFrom) { $emailFrom = "Wazo Digital <onboarding@resend.dev>" }

Set-VercelEnv "CRON_SECRET" $cronSecret
Set-VercelEnv "NEXT_PUBLIC_VAPID_PUBLIC_KEY" $vapidPublic
Set-VercelEnv "VAPID_PRIVATE_KEY" $vapidPrivate
Set-VercelEnv "VAPID_SUBJECT" (Read-DotEnvValue "VAPID_SUBJECT")
if (-not (Read-DotEnvValue "VAPID_SUBJECT")) {
  Set-VercelEnv "VAPID_SUBJECT" "mailto:support@wazo-digital.app"
}
Set-VercelEnv "REPORT_EMAIL_FROM" $emailFrom

if ($resendKey) {
  Set-VercelEnv "RESEND_API_KEY" $resendKey
  vercel env rm REPORT_EMAIL_SIMULATE production --yes 2>$null | Out-Null
} else {
  Write-Host "[info] RESEND_API_KEY absent - mode simulation active"
  Set-VercelEnv "REPORT_EMAIL_SIMULATE" "true"
}

Write-Host "=== Termine. Lancez: npx vercel --prod ===" -ForegroundColor Green
