# ==============================================================================
# Scovery SmartCart - Remote Raspberry Pi Load Cell Hardware Doctor Launcher
# ==============================================================================
param (
    [string]$PiUser = "pi123",
    [string]$PiIP = "172.28.243.98"
)

Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "[Scovery] Launching Raspberry Pi Load Cell Hardware Doctor..." -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan

$piHost = "$PiUser@$PiIP"

Write-Host "[1/2] Transferring pi_scale_doctor.py and run_scale.sh to Raspberry Pi..." -ForegroundColor Yellow
scp "$PSScriptRoot\pi_scale_doctor.py" "$PSScriptRoot\run_scale.sh" "${piHost}:/home/pi123/scovery-ml-camera/"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to transfer diagnostic script. Check SSH connection." -ForegroundColor Red
    exit 1
}

Write-Host "[2/2] Running Hardware Scanner on Raspberry Pi..." -ForegroundColor Yellow
ssh -t $piHost "bash /home/pi123/scovery-ml-camera/run_scale.sh --doctor"
