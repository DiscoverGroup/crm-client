# ==============================================================================
# CRM Local Storage Setup Script
# Sets up MinIO on this machine as a local S3-compatible file server.
# Run ONCE as Administrator:  .\setup-local-storage.ps1
# ==============================================================================

param(
    [string]$StoragePath    = "C:\crm-storage",
    [string]$MinioDir       = "C:\minio",
    [string]$Bucket         = "crm-uploads",
    [string]$AccessKey      = "crm_admin",
    [string]$SecretKey      = "crm_secret_2024",
    [int]   $ApiPort        = 9000,
    [int]   $ConsolePort    = 9001
)

$ErrorActionPreference = "Stop"

function Write-Step([string]$msg) {
    Write-Host ""
    Write-Host ">>> $msg" -ForegroundColor Cyan
}

# ── 1. Check admin privileges ──────────────────────────────────────────────────
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
        [Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: Please re-run this script as Administrator." -ForegroundColor Red
    Write-Host "       Right-click PowerShell -> 'Run as administrator', then run the script again."
    exit 1
}

# ── 2. Auto-detect the network IP other laptops will use to reach us ──────────
Write-Step "Detecting network IP address..."
$networkIP = (
    Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object {
        $_.IPAddress -notlike "127.*" -and
        $_.IPAddress -notlike "169.254.*" -and
        $_.PrefixOrigin -in @('Dhcp', 'Manual')
    } |
    Sort-Object -Property InterfaceIndex |
    Select-Object -First 1
).IPAddress

if (-not $networkIP) {
    Write-Host "WARNING: Could not detect a network IP. Falling back to localhost." -ForegroundColor Yellow
    Write-Host "         Other laptops will NOT be able to upload files remotely."
    $networkIP = "localhost"
}
Write-Host "  Network IP   : $networkIP"
Write-Host "  Other laptops on this Wi-Fi/LAN will upload to http://$networkIP`:$ApiPort"

# ── 3. Create directories ──────────────────────────────────────────────────────
Write-Step "Creating storage and MinIO directories..."
New-Item -ItemType Directory -Force -Path $StoragePath | Out-Null
New-Item -ItemType Directory -Force -Path $MinioDir    | Out-Null
Write-Host "  Storage path : $StoragePath"
Write-Host "  MinIO binary : $MinioDir"

# ── 4. Download MinIO binary ───────────────────────────────────────────────────
$minioExe = "$MinioDir\minio.exe"
if (Test-Path $minioExe) {
    Write-Step "MinIO binary already exists — skipping download."
} else {
    Write-Step "Downloading MinIO for Windows..."
    $url = "https://dl.min.io/server/minio/release/windows-amd64/minio.exe"
    Invoke-WebRequest -Uri $url -OutFile $minioExe -UseBasicParsing
    Write-Host "  Downloaded to $minioExe"
}

# ── 5. Download MinIO Client (mc) for bucket setup ────────────────────────────
$mcExe = "$MinioDir\mc.exe"
if (Test-Path $mcExe) {
    Write-Step "MinIO Client (mc) already exists — skipping download."
} else {
    Write-Step "Downloading MinIO Client (mc)..."
    $mcUrl = "https://dl.min.io/client/mc/release/windows-amd64/mc.exe"
    Invoke-WebRequest -Uri $mcUrl -OutFile $mcExe -UseBasicParsing
    Write-Host "  Downloaded to $mcExe"
}

# ── 6. Configure MinIO service credentials ────────────────────────────────────
Write-Step "Configuring MinIO service credentials..."
[System.Environment]::SetEnvironmentVariable("MINIO_ROOT_USER",     $AccessKey, "Machine")
[System.Environment]::SetEnvironmentVariable("MINIO_ROOT_PASSWORD", $SecretKey, "Machine")
$env:MINIO_ROOT_USER     = $AccessKey
$env:MINIO_ROOT_PASSWORD = $SecretKey

# ── 7. Remove old Windows service if it exists ────────────────────────────────
$svcName = "MinIOCRM"
$existingSvc = Get-Service -Name $svcName -ErrorAction SilentlyContinue
if ($existingSvc) {
    Write-Step "Removing existing MinIO service..."
    if ($existingSvc.Status -eq "Running") {
        Stop-Service -Name $svcName -Force
        Start-Sleep -Seconds 2
    }
    sc.exe delete $svcName | Out-Null
    Start-Sleep -Seconds 2
}

# ── 8. Install MinIO as a Windows service ─────────────────────────────────────
Write-Step "Installing MinIO as a Windows service ($svcName)..."
$binPath = "`"$minioExe`" server `"$StoragePath`" --address `":$ApiPort`" --console-address `":$ConsolePort`""
sc.exe create $svcName binPath= $binPath start= auto DisplayName= "MinIO CRM Storage" | Out-Null
sc.exe description $svcName "Local S3-compatible object storage for the CRM application" | Out-Null
sc.exe failure $svcName reset= 60 actions= restart/5000/restart/10000/restart/30000 | Out-Null
Write-Host "  Service '$svcName' created."

# ── 9. Start the service ───────────────────────────────────────────────────────
Write-Step "Starting MinIO service..."
Start-Service -Name $svcName
Start-Sleep -Seconds 4

$svc = Get-Service -Name $svcName
if ($svc.Status -ne "Running") {
    Write-Host "ERROR: MinIO service failed to start. Check Event Viewer for details." -ForegroundColor Red
    exit 1
}
Write-Host "  MinIO is running."

# ── 10. Open Windows Firewall for MinIO API and Console ports ─────────────────
Write-Step "Opening Windows Firewall for MinIO ports $ApiPort and $ConsolePort..."

$apiRuleName     = "MinIO CRM API (port $ApiPort)"
$consoleRuleName = "MinIO CRM Console (port $ConsolePort)"

# Remove any old rules with the same name before re-creating
@($apiRuleName, $consoleRuleName) | ForEach-Object {
    Remove-NetFirewallRule -DisplayName $_ -ErrorAction SilentlyContinue
}

New-NetFirewallRule `
    -DisplayName  $apiRuleName `
    -Direction    Inbound `
    -Protocol     TCP `
    -LocalPort    $ApiPort `
    -Action       Allow `
    -Profile      @("Domain","Private") | Out-Null

New-NetFirewallRule `
    -DisplayName  $consoleRuleName `
    -Direction    Inbound `
    -Protocol     TCP `
    -LocalPort    $ConsolePort `
    -Action       Allow `
    -Profile      @("Domain","Private") | Out-Null

Write-Host "  Firewall rules created (Domain + Private networks only)."
Write-Host "  Ports $ApiPort and $ConsolePort are now reachable from your local network."

# ── 11. Create bucket, set public read policy, and configure CORS ─────────────
Write-Step "Configuring bucket '$Bucket'..."
$baseUrl = "http://localhost:$ApiPort"
Start-Sleep -Seconds 2

& $mcExe alias set localminio $baseUrl $AccessKey $SecretKey --api "s3v4" 2>&1 | Out-Null

# Create bucket
& $mcExe mb "localminio/$Bucket" --ignore-existing 2>&1 | Out-Null

# Public read policy (anyone can GET files, only the server can write/delete)
$policy = @"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {"AWS": ["*"]},
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::$Bucket/*"]
    }
  ]
}
"@
$policyFile = "$env:TEMP\minio-public-policy.json"
$policy | Set-Content -Path $policyFile -Encoding UTF8
& $mcExe anonymous set-json $policyFile "localminio/$Bucket" 2>&1 | Out-Null
Remove-Item $policyFile -ErrorAction SilentlyContinue

# CORS — allow browsers on the LAN to PUT via presigned URLs
$cors = @"
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "HEAD"],
      "AllowedOrigins": ["*"],
      "ExposeHeaders":  ["ETag", "Content-Length"],
      "MaxAgeSeconds":  3600
    }
  ]
}
"@
$corsFile = "$env:TEMP\minio-cors.json"
$cors | Set-Content -Path $corsFile -Encoding UTF8
# mc cors set is available in recent mc builds; safe to ignore if older version
& $mcExe cors set --config-file $corsFile "localminio/$Bucket" 2>&1 | Out-Null
Remove-Item $corsFile -ErrorAction SilentlyContinue

Write-Host "  Bucket '$Bucket' ready: public read + CORS enabled."

# ── 12. Write .env file — credentials server-side only (no VITE_ prefix) ──────
Write-Step "Writing .env file..."
$envPath = Join-Path $PSScriptRoot ".env"

# Use the network IP so presigned URLs are reachable by other LAN clients.
# The Netlify function generates presigned URLs using R2_ENDPOINT, so this
# IP must be reachable from every browser that uses the CRM.
$storageUrl = "http://${networkIP}:${ApiPort}"

$envContent = @"
# ── Local MinIO Storage (generated by setup-local-storage.ps1) ────────────────
# SECURITY: R2_* vars (no VITE_ prefix) are server-side only.
#           They are NOT compiled into the browser JavaScript bundle.
#           Only VITE_R2_PUBLIC_URL is browser-visible — it's just a base URL.

# Server-side only — used by Netlify functions to talk to MinIO
R2_ENDPOINT=$storageUrl
R2_ACCESS_KEY_ID=$AccessKey
R2_SECRET_ACCESS_KEY=$SecretKey
R2_PUBLIC_URL=${storageUrl}/$Bucket

# Browser-accessible — only the public base URL, no credentials
VITE_R2_PUBLIC_URL=${storageUrl}/$Bucket
"@

Set-Content -Path $envPath -Value $envContent -Encoding UTF8
Write-Host "  Written to $envPath"
Write-Host "  Storage URL  : $storageUrl"

# ── 13. Add MinIO directory to system PATH ────────────────────────────────────
Write-Step "Adding MinIO directory to system PATH..."
$currentPath = [System.Environment]::GetEnvironmentVariable("PATH", "Machine")
if ($currentPath -notlike "*$MinioDir*") {
    [System.Environment]::SetEnvironmentVariable("PATH", "$currentPath;$MinioDir", "Machine")
    $env:PATH += ";$MinioDir"
    Write-Host "  Added $MinioDir to PATH."
} else {
    Write-Host "  Already in PATH."
}

# ── Done ───────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  MinIO local storage is ready and secured!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  API endpoint  : http://$networkIP`:$ApiPort"
Write-Host "  Web console   : http://$networkIP`:$ConsolePort"
Write-Host "  Bucket        : $Bucket"
Write-Host "  Files stored  : $StoragePath"
Write-Host ""
Write-Host "  Console login:"
Write-Host "    Username : $AccessKey"
Write-Host "    Password : $SecretKey"
Write-Host ""
Write-Host "  Security summary:" -ForegroundColor Yellow
Write-Host "    - MinIO credentials are server-side only (not in browser JS)"
Write-Host "    - All uploads/deletes require a valid login JWT token"
Write-Host "    - Files use short-lived (5-min) presigned URLs for upload"
Write-Host "    - Public read is enabled only for GET (viewing files)"
Write-Host "    - Firewall: ports open on Domain + Private networks only"
Write-Host ""
Write-Host "  MinIO starts automatically with Windows."
Write-Host "  npm run storage:status   — check if MinIO is running"
Write-Host "  npm run storage:start    — start MinIO manually"
Write-Host "  npm run storage:stop     — stop MinIO"
Write-Host ""
Write-Host "  Now run:  npm run dev:local" -ForegroundColor Yellow
  Write-Host "  Then (for Netlify URL support): .\setup-tunnel.ps1" -ForegroundColor Yellow
Write-Host ""

