<#
.SYNOPSIS
  B reja: API, worker va ngrok'ni shu kompyuterda ishga tushiradi (docs/SELFHOST.md).
.PARAMETER SetWebhook
  Telegram webhook'ni PUBLIC_API_URL ga ko'chiradi (Render'dan bu yerga o'tganda bir marta).
.PARAMETER NoNgrok
  Faqat lokal (http://127.0.0.1:8000), tashqariga chiqarmasdan.
#>
param([switch]$SetWebhook, [switch]$NoNgrok)

. "$PSScriptRoot\common.ps1"
Import-SelfHostEnv
Assert-NothingRunning

$publicUrl = (Get-RequiredEnv 'PUBLIC_API_URL').TrimEnd('/')
$dbUrl = Get-RequiredEnv 'DATABASE_URL'
Get-RequiredEnv 'DJANGO_SECRET_KEY' | Out-Null
if (-not (Test-LocalDatabaseUrl $dbUrl)) {
    Stop-WithError "DATABASE_URL lokal emas ($(Get-UrlHost $dbUrl)). B rejada API lokal bazaga ulanadi; ma'lumotni db-from-nhost.ps1 bilan ko'chiring."
}
if (-not (Test-Path $Python)) {
    Stop-WithError "backend\.venv topilmadi. Bajaring: cd backend; py -3.13 -m venv .venv"
}
$port = if ($env:PORT) { $env:PORT } else { '8000' }

Write-Step 'Paketlar (waitress bilan)'
Invoke-Tool $Python @('-m', 'pip', 'install', '-q', '-r', (Join-Path $SelfHost 'requirements.txt'))

Push-Location $Backend
try {
    Write-Step 'Django tekshiruvi'
    Invoke-Tool $Python @('manage.py', 'check', '--deploy', '--fail-level', 'ERROR')
    Write-Step 'Migratsiyalar'
    Invoke-Tool $Python @('manage.py', 'migrate', '--noinput')
} finally { Pop-Location }

function Start-Logged([string]$Name, [string]$Exe, [string[]]$Arguments, [string]$WorkDir) {
    $proc = Start-Process -FilePath $Exe -ArgumentList $Arguments -WorkingDirectory $WorkDir `
        -RedirectStandardOutput (Join-Path $LogDir "$Name.log") -RedirectStandardError (Join-Path $LogDir "$Name.err.log") `
        -WindowStyle Hidden -PassThru
    Set-Content -Path (Get-PidFile $Name) -Value $proc.Id
    Write-Host "    $Name ishga tushdi (PID $($proc.Id)), log: selfhost\logs\$Name.log"
}

Write-Step "API (waitress, 127.0.0.1:$port)"
Start-Logged 'api' $Python @("`"$(Join-Path $SelfHost 'serve.py')`"") $Backend

Write-Step 'Worker (procrastinate)'
$concurrency = if ($env:WORKER_CONCURRENCY) { $env:WORKER_CONCURRENCY } else { '4' }
Start-Logged 'worker' $Python @('manage.py', 'procrastinate', 'worker', '--concurrency', $concurrency) $Backend

Write-Step 'API javobini kutish'
$ok = $false
for ($i = 0; $i -lt 30; $i++) {
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:$port/api/health" -UseBasicParsing -TimeoutSec 3
        if ($r.StatusCode -eq 200) { $ok = $true; break }
    } catch { Start-Sleep -Seconds 1 }
}
if (-not $ok) { Stop-WithError "API javob bermadi. selfhost\logs\api.err.log ni ko'ring, keyin stop.ps1." }
Write-Host '    lokal: OK'

if (-not $NoNgrok) {
    $domain = Get-RequiredEnv 'NGROK_DOMAIN'
    $ngrokCmd = Get-Command ngrok -ErrorAction SilentlyContinue
    if ($null -eq $ngrokCmd) { Stop-WithError "ngrok topilmadi. O'rnating: winget install ngrok.ngrok, keyin: ngrok config add-authtoken <token>" }
    Write-Step "ngrok -> https://$domain"
    Start-Logged 'ngrok' $ngrokCmd.Source @('http', "127.0.0.1:$port", '--url', "https://$domain", '--log', 'stdout', '--log-format', 'logfmt') $SelfHost

    $ok = $false
    for ($i = 0; $i -lt 30; $i++) {
        try {
            $r = Invoke-WebRequest -Uri "$publicUrl/api/health" -UseBasicParsing -TimeoutSec 5 -Headers @{ 'ngrok-skip-browser-warning' = '1' }
            if ($r.StatusCode -eq 200) { $ok = $true; break }
        } catch { Start-Sleep -Seconds 2 }
    }
    if ($ok) { Write-Host "    ommaviy: OK ($publicUrl)" }
    else { Write-Host "    ommaviy manzil hali javob bermayapti. selfhost\logs\ngrok.log ni ko'ring (DNS yoki ngrok domeni)." -ForegroundColor Yellow }
}

if ($SetWebhook) {
    Write-Step 'Telegram webhook'
    Push-Location $Backend
    try { Invoke-Tool $Python @('manage.py', 'telegram_set_webhook', $publicUrl) } finally { Pop-Location }
}

Write-Host ''
Write-Host "Tayyor. To'xtatish: selfhost\stop.ps1" -ForegroundColor Green
