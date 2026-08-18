# ==============================================================================
# Scovery SmartCart - Remote Raspberry Pi Master Launcher (Camera + Load Cell)
# ==============================================================================
param (
    [string]$PiUser = "pi123",
    [string]$PiIP = "172.28.243.98"
)

Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "[Scovery] Launching Camera AND Load Cell on Raspberry Pi..." -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan

$piHost = "$PiUser@$PiIP"

Write-Host "[1/3] Checking SSH connection to $piHost..." -ForegroundColor Yellow
$sshCheck = ssh -o ConnectTimeout=5 -o BatchMode=yes $piHost 'echo connected' 2>&1
if ($sshCheck -notmatch "connected") {
    Write-Host "Note: You may be prompted for your Raspberry Pi password." -ForegroundColor DarkGray
}

Write-Host "[2/3] Transferring latest camera streamer, load cell driver, and launcher scripts..." -ForegroundColor Yellow
scp "$PSScriptRoot\pi_stream_cached.py" "$PSScriptRoot\pi_scale.py" "$PSScriptRoot\run_camera.sh" "$PSScriptRoot\run_scale.sh" "${piHost}:/home/pi123/scovery-ml-camera/"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to transfer files to Raspberry Pi. Check SSH connection." -ForegroundColor Red
    exit 1
}

Write-Host "[3/3] Launching both services on Raspberry Pi (`pi_stream_cached.py` + `pi_scale.py`)..." -ForegroundColor Yellow
ssh $piHost "bash /home/pi123/scovery-ml-camera/run_camera.sh"
ssh $piHost "bash /home/pi123/scovery-ml-camera/run_scale.sh"

Write-Host "`n[SUCCESS] Both Camera and Load Cell services launched on Raspberry Pi!" -ForegroundColor Green
Start-Sleep -Seconds 2

Write-Host "`n--- Raspberry Pi Camera Log ---" -ForegroundColor Cyan
ssh $piHost "tail -n 10 /home/pi123/camera_stream.log"
Write-Host "`n--- Raspberry Pi Load Cell Log ---" -ForegroundColor Cyan
ssh $piHost "tail -n 10 /home/pi123/scale_service.log"
Write-Host "--------------------------------------------------------" -ForegroundColor Cyan
Write-Host "Check live feed and weight on your website: http://localhost:5173" -ForegroundColor Cyan
