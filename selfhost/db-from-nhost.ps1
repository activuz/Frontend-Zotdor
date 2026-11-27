<#
.SYNOPSIS
  Nhost bazasini (public sxema) lokal bazaga ko'chiradi: B rejaga o'tishning boshi (docs/SELFHOST.md).
.DESCRIPTION
  Nhost'ga faqat o'qish uchun ulanadi. Lokal bazadagi public sxema jadvallari almashtiriladi.
  Oldin Render'dagi API va worker'ni to'xtating (Suspend), aks holda ko'chirishdan keyin
  Nhost'ga yozilgan ma'lumot lokalga tushmay qoladi.
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
Write-Host "Nhost: PostgreSQL $nhostMajor ($(Get-UrlHost $nhost)) -> lokal: PostgreSQL $localMajor"

Confirm-Typed "Lokal bazadagi ($(Get-UrlHost $local)) hamma Zotdor jadvallari Nhost nusxasi bilan almashtiriladi. Render to'xtatilganmi?" 'LOKALGA'

$stamp = Get-Timestamp
$localBackup = Join-Path $BackupDir "local-before-pull-$stamp.dump"
$dump = Join-Path $BackupDir "nhost-$stamp.dump"
$sql = Join-Path $BackupDir "pull-$stamp.sql"

Write-Step 'Lokal bazaning zaxira nusxasi'
Export-PublicSchema $local $localBackup
Write-Step "Nhost'dan nusxa (faqat o'qish)"
Export-PublicSchema $nhost $dump
$expected = Get-RowCounts $nhost

Write-Step 'Lokalga yozish (bitta tranzaksiya)'
Convert-DumpToSql $dump $sql $localMajor
Invoke-SqlFile $local $sql
Remove-Item $sql -Force

Write-Step 'Tekshiruv: jadval qatorlari soni'
$actual = Get-RowCounts $local
if (-not (Compare-RowCounts $expected $actual)) {
    Stop-WithError "Sonlar mos emas. Ehtimol, ko'chirish paytida Nhost'ga yozildi (Render ishlab turibdi). Zaxira: $localBackup"
}
Write-Host "    $($actual.Count) ta jadval, hammasi mos." -ForegroundColor Green
Write-Host "Nusxa saqlandi: $dump"
Write-Host 'Keyingi qadam: selfhost\start.ps1 -SetWebhook'
