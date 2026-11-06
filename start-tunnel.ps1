# AutoExam Cloudflare Tunnel Launcher
$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$cloudflared = Join-Path $rootDir "tools\cloudflared.exe"
$logFile = Join-Path $env:TEMP "autoexam_tunnel.log"

if (Test-Path $logFile) {
    Remove-Item $logFile -Force -ErrorAction SilentlyContinue
}

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "   AutoExam - Starting Encrypted Cloudflare Tunnel      " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "[*] Forwarding traffic to local platform (http://localhost:80)..." -ForegroundColor Gray
Write-Host "[*] Establishing secure HTTPS connection with Cloudflare..." -ForegroundColor Gray

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $cloudflared
$psi.Arguments = "tunnel --url http://localhost:80 --no-prechecks --logfile `"$logFile`""
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true

$proc = [System.Diagnostics.Process]::Start($psi)

# Monitor for newly assigned trycloudflare URL
$tunnelUrl = ""
$timeoutSec = 30
$startTime = [DateTime]::UtcNow

while (($([DateTime]::UtcNow) - $startTime).TotalSeconds -lt $timeoutSec) {
    Start-Sleep -Milliseconds 400
    if (Test-Path $logFile) {
        $content = Get-Content -Path $logFile -Raw -ErrorAction SilentlyContinue
        if ($content -match 'https://[a-zA-Z0-9\-]+\.trycloudflare\.com') {
            $tunnelUrl = $matches[0]
            break
        }
    }
}

if ($tunnelUrl) {
    Write-Host ""
    Write-Host "=================================================================" -ForegroundColor Green
    Write-Host "  SUCCESS! AutoExam is publicly accessible at:" -ForegroundColor Green
    Write-Host "  $tunnelUrl" -ForegroundColor Yellow
    Write-Host "=================================================================" -ForegroundColor Green
    Write-Host "[*] URL copied to clipboard!" -ForegroundColor Cyan
    try { Set-Clipboard -Value $tunnelUrl } catch {}
    Write-Host "[*] Launching platform in default browser..." -ForegroundColor Cyan
    try { Start-Process $tunnelUrl } catch {}
    Write-Host ""
    Write-Host "Keep this window open to maintain public access." -ForegroundColor Gray
    Write-Host "To shut down the tunnel, simply close this window." -ForegroundColor Gray
    Write-Host "=================================================================" -ForegroundColor Gray

    # Keep script alive while tunnel runs
    try {
        while (-not $proc.HasExited) {
            Start-Sleep -Seconds 1
        }
    } finally {
        if (-not $proc.HasExited) {
            $proc.Kill()
        }
    }
} else {
    Write-Host "[!] Timed out waiting for tunnel domain. Falling back to console mode..." -ForegroundColor Red
    if (-not $proc.HasExited) { $proc.Kill() }
    & $cloudflared tunnel --url http://localhost:80 --no-prechecks
}
