# ==============================================================================
# Scovery SmartCart - Remote Raspberry Pi Load Cell & Scale Launcher
# ==============================================================================
param (
    [string]$PiUser = "pi123",
    [string]$PiIP = "172.28.243.98",
    [switch]$Calibrate,
    [switch]$Simulate,
    [switch]$Monitor
)

Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "[Scovery] Automating Raspberry Pi Load Cell & Scale Setup..." -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan

$piHost = "$PiUser@$PiIP"

Write-Host "[1/2] Transferring pi_scale.py and run_scale.sh to Raspberry Pi..." -ForegroundColor Yellow
scp "$PSScriptRoot\pi_scale.py" "$PSScriptRoot\run_scale.sh" "${piHost}:/home/pi123/scovery-ml-camera/"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to transfer scripts. Check SSH connection." -ForegroundColor Red
    exit 1
}

if ($Calibrate) {
    Write-Host "[2/2] Running interactive Calibration Wizard on Raspberry Pi (auto-checking dependencies)..." -ForegroundColor Yellow
    ssh -t $piHost "bash /home/pi123/scovery-ml-camera/run_scale.sh --calibrate"
} elseif ($Monitor) {
    Write-Host "[2/2] Running live terminal weight monitor on Raspberry Pi (auto-checking dependencies)..." -ForegroundColor Yellow
    ssh -t $piHost "bash /home/pi123/scovery-ml-camera/run_scale.sh --monitor"
} elseif ($Simulate) {
    Write-Host "[2/2] Running interactive Scale Simulator on Raspberry Pi (auto-checking dependencies)..." -ForegroundColor Yellow
    ssh -t $piHost "bash /home/pi123/scovery-ml-camera/run_scale.sh --simulate"
} else {
    Write-Host "[2/2] Launching Load Cell scale service in background (auto-checking dependencies)..." -ForegroundColor Yellow
    ssh $piHost "bash /home/pi123/scovery-ml-camera/run_scale.sh"
    Write-Host "`n[SUCCESS] Load cell scale service running! Tailing logs for 5 seconds..." -ForegroundColor Green
    Start-Sleep -Seconds 2
    ssh $piHost "tail -n 15 /home/pi123/scale_service.log"
}
