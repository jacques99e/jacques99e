# Quick verification after payment live setup
$base = "https://app.wazo-digital.com"
Write-Host "=== Verification paiements Wazo Digital ===" -ForegroundColor Cyan

$checks = @(
  @{ name = "Page billing"; url = "$base/billing" },
  @{ name = "Callback GET"; url = "$base/api/payments/momo/callback?tx=healthcheck" },
  @{ name = "Dashboard"; url = "$base/dashboard" }
)

foreach ($c in $checks) {
  try {
    $r = Invoke-WebRequest -Uri $c.url -UseBasicParsing -MaximumRedirection 0 -ErrorAction Stop
    Write-Host "[OK] $($c.name) -> $($r.StatusCode)" -ForegroundColor Green
  } catch {
    $code = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { "ERR" }
    Write-Host "[??] $($c.name) -> $code" -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "Manuel requis:" -ForegroundColor Yellow
Write-Host "1. Supabase SQL: executer supabase/migrations/006_billing_subscriptions.sql"
Write-Host "2. PayDunya: ajouter PAYMENT_SECRET_KEY + PAYMENT_TOKEN dans .env.local puis relancer setup-vercel-payment-live.ps1"
Write-Host "3. PayDunya callback: $base/api/payments/momo/callback"
Write-Host "4. Test connecte: $base/billing -> Payer ce plan"
