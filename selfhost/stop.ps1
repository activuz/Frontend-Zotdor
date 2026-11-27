<#
.SYNOPSIS
  start.ps1 ishga tushirgan ngrok, API va worker'ni to'xtatadi (docs/SELFHOST.md).
#>
. "$PSScriptRoot\common.ps1"

foreach ($name in @('ngrok', 'api', 'worker')) {
    $proc = Get-RunningProcess $name
    if ($null -eq $proc) { Write-Host "    ${name}: ishlamayapti"; continue }
    Stop-Process -Id $proc.Id -Force
    Remove-Item (Get-PidFile $name) -Force
    Write-Host "    $name to'xtatildi (PID $($proc.Id))"
}
