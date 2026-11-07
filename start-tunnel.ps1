# AutoExam Cloudflare Tunnel Launcher
$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$cloudflared = Join-Path $rootDir "tools\cloudflared.exe"

# 1. Terminate any previous or orphaned cloudflared processes
Get-Process -Name cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 400

# 2. Use a unique session log file to guarantee no old URLs are ever cached or locked
$uniqueId = (Get-Date -Format "yyyyMMdd_HHmmss") + "_" + (Get-Random -Minimum 1000 -Maximum 9999)
$logFile = Join-Path $env:TEMP ("autoexam_tunnel_" + $uniqueId + ".log")

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

# Monitor for newly assigned trycloudflare URL in the clean unique log file
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

    Write-Host "[*] Verifying Cloudflare edge routing and DNS propagation..." -ForegroundColor Gray
    $domain = $tunnelUrl.Replace("https://", "").TrimEnd("/")
    $tunnelReady = $false
    for ($d = 0; $d -lt 20; $d++) {
        Start-Sleep -Seconds 1
        try {
            $code = curl.exe -s -o NUL -w "%{http_code}" --max-time 3 $tunnelUrl
            if ($code -match '^(200|301|302|307|308|401|403|404)$') {
                $tunnelReady = $true
                break
            }
        } catch {}
        Write-Host -NoNewline "." -ForegroundColor Gray
    }
    Write-Host ""

    if (-not $tunnelReady) {
        # Fallback short sleep to give public DNS a moment to converge
        Start-Sleep -Seconds 3
    }

    Write-Host "[*] Platform ready! Launching in default browser..." -ForegroundColor Green
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
            try { $proc.Kill() } catch {}
        }
        Remove-Item $logFile -Force -ErrorAction SilentlyContinue
    }
} else {
    Write-Host "[!] Timed out waiting for tunnel domain. Falling back to console mode..." -ForegroundColor Red
    if (-not $proc.HasExited) { try { $proc.Kill() } catch {} }
    Remove-Item $logFile -Force -ErrorAction SilentlyContinue
    & $cloudflared tunnel --url http://localhost:80 --no-prechecks
}
