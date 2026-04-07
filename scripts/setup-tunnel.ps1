# ==============================================================================
# CRM Cloudflare Tunnel Setup Script
# Exposes your local MinIO (port 9000) to the internet so that:
#   - dg-crm-client.netlify.app can call the local storage functions
#   - Files still save to C:\crm-storage on this SSD
#
# Run once (no admin needed):  .\setup-tunnel.ps1
# Prerequisites: setup-local-storage.ps1 must have run first.
# ==============================================================================

$ErrorActionPreference = "Stop"

function Write-Step([string]$msg) {
    Write-Host ""
    Write-Host ">>> $msg" -ForegroundColor Cyan
}

# ── 1. Check ngrok is installed ───────────────────────────────────────────────
Write-Step "Checking for ngrok..."
if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) {
    Write-Step "Installing ngrok via winget..."
    winget install ngrok.ngrok --accept-package-agreements --accept-source-agreements
    # Refresh PATH
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("PATH","User")
    if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) {
        Write-Host ""
        Write-Host "ERROR: ngrok not found after install. Please restart PowerShell and re-run this script." -ForegroundColor Red
        exit 1
    }
    Write-Host "  ngrok installed."
} else {
    Write-Host "  ngrok already installed."
}

# ── 2. Get ngrok auth token ───────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host "  You need a FREE ngrok account (takes 2 minutes):" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "  1. Go to: https://dashboard.ngrok.com/signup"
Write-Host "  2. Sign up (free — no credit card)"
Write-Host "  3. After login, copy your Authtoken from:"
Write-Host "     https://dashboard.ngrok.com/get-started/your-authtoken"
Write-Host "  4. Claim your FREE static domain from:"
Write-Host "     https://dashboard.ngrok.com/domains"
Write-Host "     (Click 'New Domain' — you get 1 free static domain)"
Write-Host "     It will look like: abc-xyz-123.ngrok-free.app"
Write-Host ""

$authToken = Read-Host "Paste your ngrok Authtoken here"
if (-not $authToken -or $authToken.Trim() -eq '') {
    Write-Host "ERROR: Authtoken is required." -ForegroundColor Red
    exit 1
}

$staticDomain = Read-Host "Paste your ngrok static domain (e.g. abc-xyz-123.ngrok-free.app)"
$staticDomain = $staticDomain.Trim().ToLower()
# Strip any https:// prefix if user pasted the full URL
$staticDomain = $staticDomain -replace '^https?://', ''
$staticDomain = $staticDomain.TrimEnd('/')

if (-not $staticDomain -or $staticDomain -eq '') {
    Write-Host "ERROR: Static domain is required." -ForegroundColor Red
    exit 1
}

# ── 3. Authenticate ngrok ─────────────────────────────────────────────────────
Write-Step "Authenticating ngrok..."
ngrok authtoken $authToken.Trim()
Write-Host "  ngrok authenticated."

# ── 4. Update .env with the tunnel domain ─────────────────────────────────────
Write-Step "Updating .env with tunnel domain..."
$envPath = Join-Path $PSScriptRoot ".env"

if (-not (Test-Path $envPath)) {
    Write-Host "ERROR: .env not found. Run setup-local-storage.ps1 first." -ForegroundColor Red
    exit 1
}

$envContent = Get-Content $envPath -Raw

# Remove existing NGROK_DOMAIN line if present
$envContent = $envContent -replace '\r?\nNGROK_DOMAIN=.*', ''
$envContent = $envContent.TrimEnd()

# Append the new values
$tunnelBase = "https://$staticDomain"
$envContent += "`n`n# ── Cloudflare/ngrok Tunnel (for Netlify cloud access) ──────────────────────"
$envContent += "`nNGROK_DOMAIN=$staticDomain"
$envContent += "`n`n# ── Override: Netlify functions + browser use the tunnel URL ────────────────"
$envContent += "`n# Uncomment these lines AFTER running setup-tunnel.ps1 if you want the Netlify"
$envContent += "`n# hosted site (dg-crm-client.netlify.app) to work with local storage."
$envContent += "`n# IMPORTANT: Also set these same vars in Netlify Dashboard > Environment variables"
$envContent += "`n#R2_ENDPOINT=$tunnelBase"
$envContent += "`n#R2_PUBLIC_URL=$tunnelBase/crm-uploads"
$envContent += "`n#VITE_R2_PUBLIC_URL=$tunnelBase/crm-uploads"

Set-Content -Path $envPath -Value $envContent -Encoding UTF8
Write-Host "  Updated $envPath"

# ── 5. Test that MinIO is running ─────────────────────────────────────────────
Write-Step "Checking MinIO is running..."
$svc = Get-Service -Name "MinIOCRM" -ErrorAction SilentlyContinue
if (-not $svc -or $svc.Status -ne "Running") {
    Write-Host "  WARNING: MinIO service is not running. Starting it now..." -ForegroundColor Yellow
    Start-Service -Name "MinIOCRM" -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
}
Write-Host "  MinIO is running on port 9000."

# ── 6. Quick tunnel test ──────────────────────────────────────────────────────
Write-Step "Testing tunnel connection (10 second test)..."
$proc = Start-Process ngrok -ArgumentList "http", "--domain=$staticDomain", "9000", "--log=stdout" `
    -PassThru -RedirectStandardOutput "$env:TEMP\ngrok-test.log" -NoNewWindow
Start-Sleep -Seconds 8

try {
    $response = Invoke-WebRequest -Uri "https://$staticDomain/minio/health/live" `
        -TimeoutSec 6 -UseBasicParsing -ErrorAction SilentlyContinue
    if ($response.StatusCode -lt 500) {
        Write-Host "  Tunnel is working — MinIO is reachable at https://$staticDomain" -ForegroundColor Green
    }
} catch {
    Write-Host "  Could not verify tunnel in test window — this is normal, it may need a few more seconds." -ForegroundColor Yellow
}

$proc | Stop-Process -Force -ErrorAction SilentlyContinue
Remove-Item "$env:TEMP\ngrok-test.log" -ErrorAction SilentlyContinue

# ── 7. Instructions ───────────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  Tunnel configured!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Your public MinIO tunnel URL: https://$staticDomain" -ForegroundColor White
Write-Host ""
Write-Host "  NEXT STEP — Set these in Netlify Dashboard:" -ForegroundColor Yellow
Write-Host "  Go to: Netlify > dg-crm-client > Site configuration > Environment variables"
Write-Host ""
Write-Host "  Add / update these 5 variables:" -ForegroundColor Cyan
Write-Host ""
Write-Host "    R2_ENDPOINT            =  https://$staticDomain"
Write-Host "    R2_ACCESS_KEY_ID       =  crm_admin"
Write-Host "    R2_SECRET_ACCESS_KEY   =  crm_secret_2024"
Write-Host "    R2_PUBLIC_URL          =  https://$staticDomain/crm-uploads"
Write-Host "    VITE_R2_PUBLIC_URL     =  https://$staticDomain/crm-uploads"
Write-Host ""
Write-Host "  After saving, click 'Trigger deploy' > 'Deploy site' in Netlify." -ForegroundColor Yellow
Write-Host ""
Write-Host "  HOW TO USE:" -ForegroundColor Cyan
Write-Host "  Run this single command to start everything (Vite + functions + tunnel):"
Write-Host ""
Write-Host "    npm run dev:local" -ForegroundColor White
Write-Host ""
Write-Host "  The tunnel must be running for dg-crm-client.netlify.app to upload files here."
Write-Host "  When npm run dev:local is running, BOTH the local URL and Netlify URL work."
Write-Host ""
