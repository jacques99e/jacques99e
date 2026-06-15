# Verification production — Wazo Digital (Landing + App)
# Usage: powershell -ExecutionPolicy Bypass -File scripts\verify-production.ps1

$ErrorActionPreference = "Continue"
$landing = "https://wazo-digital.com"
$app = "https://app.wazo-digital.com"
$fail = 0
$pass = 0

function Test-Url {
  param([string]$Name, [string]$Url, [int[]]$OkStatus = @(200), [switch]$FollowRedirect)
  try {
    $params = @{ Uri = $Url; UseBasicParsing = $true; TimeoutSec = 20 }
    if (-not $FollowRedirect) { $params.MaximumRedirection = 0 }
    $r = Invoke-WebRequest @params -ErrorAction Stop
    $code = [int]$r.StatusCode
    if ($OkStatus -contains $code) {
      Write-Host "[OK] $Name -> $code" -ForegroundColor Green
      $script:pass++
    } else {
      Write-Host "[FAIL] $Name -> $code (expected: $($OkStatus -join ','))" -ForegroundColor Red
      $script:fail++
    }
  } catch {
    $code = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
    if ($OkStatus -contains $code) {
      Write-Host "[OK] $Name -> $code" -ForegroundColor Green
      $script:pass++
    } else {
      Write-Host "[FAIL] $Name -> $code" -ForegroundColor Red
      $script:fail++
    }
  }
}

Write-Host "=== Wazo Digital - verification production ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "--- Landing ---" -ForegroundColor Yellow
Test-Url "Home" "$landing/"
Test-Url "Login" "$landing/login"
Test-Url "Register" "$landing/register"
Test-Url "Pricing" "$landing/tarifs"
Test-Url "Health API" "$landing/api/health"
Test-Url "Phone-login redirect" "$landing/phone-login" -OkStatus @(307,308,302,301)

Write-Host ""
Write-Host "--- App ---" -ForegroundColor Yellow
Test-Url "Suivi" "$app/suivi"
Test-Url "Formation" "$app/formation"
Test-Url "Trace" "$app/trace"
Test-Url "Boutique test" "$app/boutique/boutique-test-roles-wazo"
Test-Url "Health API" "$app/api/health"
Test-Url "Login redirect" "$app/login" -OkStatus @(307,308,302,301)

Write-Host ""
Write-Host "--- Health JSON ---" -ForegroundColor Yellow
try {
  $h = Invoke-RestMethod "$app/api/health" -TimeoutSec 15
  if ($h.ok -eq $true) {
    Write-Host "[OK] App health payment.mode=$($h.payment.mode)" -ForegroundColor Green
    $script:pass++
  } else {
    Write-Host "[FAIL] App health ok=false" -ForegroundColor Red
    $script:fail++
  }
} catch {
  Write-Host "[FAIL] App health JSON" -ForegroundColor Red
  $script:fail++
}

Write-Host ""
if ($fail -eq 0) {
  Write-Host "Done: $pass passed, 0 failed" -ForegroundColor Green
} else {
  Write-Host "Done: $pass passed, $fail failed" -ForegroundColor Red
  exit 1
}
