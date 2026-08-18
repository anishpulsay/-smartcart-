# ==============================================================================
# Scovery SmartCart - Remote Raspberry Pi Auto-Sync and Start Script
# ==============================================================================
param (
    [string]$PiUser = "pi123",
    [string]$PiIP = "172.28.243.98"
)

Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "[Scovery] Automating Raspberry Pi Camera Sync and Launch..." -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan

$piHost = "$PiUser@$PiIP"

Write-Host "[1/3] Checking SSH connection to $piHost..." -ForegroundColor Yellow
$sshCheck = ssh -o ConnectTimeout=5 -o BatchMode=yes $piHost 'echo connected' 2>&1
if ($sshCheck -notmatch "connected") {
    Write-Host "Note: You may be prompted for your Raspberry Pi password." -ForegroundColor DarkGray
}

Write-Host "[2/3] Transferring latest camera code and launcher to Raspberry Pi..." -ForegroundColor Yellow
scp "$PSScriptRoot\pi_stream_cached.py" "$PSScriptRoot\run_camera.sh" "${piHost}:/home/pi123/scovery-ml-camera/"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to transfer files via SCP. Check IP or credentials." -ForegroundColor Red
    exit 1
}

Write-Host "[3/3] Launching camera streamer on Raspberry Pi..." -ForegroundColor Yellow
# Run launcher script cleanly without Windows PowerShell argument splitting bugs
ssh $piHost "bash /home/pi123/scovery-ml-camera/run_camera.sh"

Write-Host "`n[SUCCESS] Raspberry Pi camera script launched! Waiting 3 seconds to check live log..." -ForegroundColor Green
Start-Sleep -Seconds 3

Write-Host "`n--- Raspberry Pi Live Output (camera_stream.log) ---" -ForegroundColor Cyan
ssh $piHost "tail -n 20 /home/pi123/camera_stream.log"
Write-Host "--------------------------------------------------------" -ForegroundColor Cyan
Write-Host "Check the live video feed on your website: http://localhost:5173" -ForegroundColor Cyan
