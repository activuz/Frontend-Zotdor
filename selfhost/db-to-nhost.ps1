<#
.SYNOPSIS
  Lokal bazani (public sxema) Nhost'ga ko'chiradi: B rejadan Render'ga qaytish (docs/SELFHOST.md).
.DESCRIPTION
  1. Lokal API, worker va ngrok to'xtatilgan bo'lishi shart (yangi yozuv tushmasin).
  2. Avval Nhost'ning hozirgi holati zaxiraga olinadi (selfhost\backups\nhost-before-push-*.dump).
  3. Lokal nusxa Nhost'ga BITTA tranzaksiyada yoziladi: xato bo'lsa, Nhost o'zgarmaydi.
  4. Jadval qatorlari soni lokal va Nhost'da solishtiriladi.
  Nhost'ning auth/storage sxemalari va fayllar (rasm, video) tegilmaydi.
#>
. "$PSScriptRoot\common.ps1"
Import-SelfHostEnv
Assert-NothingRunning

$nhost = Get-RequiredEnv 'NHOST_DATABASE_URL'
$local = Get-RequiredEnv 'DATABASE_URL'
if (-not (Test-LocalDatabaseUrl $local)) { Stop-WithError "DATABASE_URL lokal emas ($(Get-UrlHost $local))." }
if (Test-LocalDatabaseUrl $nhost) { Stop-WithError 'NHOST_DATABASE_URL lokal manzilga qaragan.' }

$nhostMajor = Get-ServerMajor $nhost
$localMajor = Get-ServerMajor $local
Write-Host "Lokal: PostgreSQL $localMajor -> Nhost: PostgreSQL $nhostMajor ($(Get-UrlHost $nhost))"

# Other sessions on the Nhost database, e.g. a Render API or worker that is still running.
$psql = Get-PgTool 'psql'
$others = & $psql -X -A -t -q -d $nhost -c "select coalesce(nullif(application_name, ''), '-') || ' ' || coalesce(client_addr::text, 'local') from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid() and usename = current_user;"
if ($LASTEXITCODE -ne 0) { Stop-WithError "Nhost'ga ulanib bo'lmadi." }
$others = @($others | Where-Object { $_ -ne '' })
if ($others.Count -gt 0) {
    Write-Host "Nhost bazasida boshqa ulanishlar bor ($($others.Count)): Render API yoki worker hali ishlayotgan bo'lishi mumkin." -ForegroundColor Yellow
    $others | ForEach-Object { Write-Host "    $_" }
}

Confirm-Typed "Nhost'dagi Zotdor jadvallari lokal nusxa bilan ALMASHTIRILADI. Render API va worker to'xtatilganmi?" 'NHOSTGA YOZ'

$stamp = Get-Timestamp
$nhostBackup = Join-Path $BackupDir "nhost-before-push-$stamp.dump"
$dump = Join-Path $BackupDir "local-$stamp.dump"
$sql = Join-Path $BackupDir "push-$stamp.sql"

Write-Step "Nhost'ning zaxira nusxasi"
Export-PublicSchema $nhost $nhostBackup
Write-Step 'Lokal nusxa'
Export-PublicSchema $local $dump
$expected = Get-RowCounts $local

Write-Step "Nhost'ga yozish (bitta tranzaksiya)"
Convert-DumpToSql $dump $sql $nhostMajor
Invoke-SqlFile $nhost $sql
Remove-Item $sql -Force

Write-Step 'Tekshiruv: jadval qatorlari soni'
$actual = Get-RowCounts $nhost
if (-not (Compare-RowCounts $expected $actual)) {
    Stop-WithError "Sonlar mos emas. Nhost'ning oldingi holati: $nhostBackup (tiklash: docs/SELFHOST.md)."
}
Write-Host "    $($actual.Count) ta jadval, hammasi mos." -ForegroundColor Green
Write-Host "Nhost'ning oldingi holati saqlandi: $nhostBackup"
Write-Host "Keyingi qadam: Render'da API va worker'ni yoqing (Resume), keyin webhook'ni qaytaring:"
Write-Host "    cd backend; .venv\Scripts\python manage.py telegram_set_webhook https://api.zotdor.uz"
