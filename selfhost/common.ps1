# Shared helpers for the self-hosted API scripts (docs/SELFHOST.md). Dot-source it: . "$PSScriptRoot\common.ps1"
$ErrorActionPreference = 'Stop'

$Root      = Split-Path -Parent $PSScriptRoot
$SelfHost  = $PSScriptRoot
$Backend   = Join-Path $Root 'backend'
$EnvFile   = Join-Path $SelfHost '.env'
$LogDir    = Join-Path $SelfHost 'logs'
$RunDir    = Join-Path $SelfHost 'run'
$BackupDir = Join-Path $SelfHost 'backups'
$Python    = Join-Path $Backend '.venv\Scripts\python.exe'

foreach ($d in @($LogDir, $RunDir, $BackupDir)) {
    if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d | Out-Null }
}

function Write-Step([string]$Text) { Write-Host "==> $Text" -ForegroundColor Cyan }
function Stop-WithError([string]$Text) { Write-Host "XATO: $Text" -ForegroundColor Red; exit 1 }

# Loads selfhost/.env into this process (children inherit it). backend/.env is not read:
# ZOTDOR_ENV_FILE points Django at this file instead.
function Import-SelfHostEnv {
    if (-not (Test-Path $EnvFile)) {
        Stop-WithError "selfhost\.env topilmadi. Nusxa oling: Copy-Item selfhost\.env.example selfhost\.env va to'ldiring."
    }
    foreach ($raw in Get-Content -Path $EnvFile -Encoding UTF8) {
        $line = $raw.Trim()
        if ($line -eq '' -or $line.StartsWith('#') -or -not $line.Contains('=')) { continue }
        $i = $line.IndexOf('=')
        $key = $line.Substring(0, $i).Trim()
        $value = $line.Substring($i + 1).Trim().Trim('"').Trim("'")
        Set-Item -Path "Env:$key" -Value $value
    }
    $env:ZOTDOR_ENV_FILE = $EnvFile
    $env:DJANGO_SETTINGS_MODULE = 'config.settings'
    $env:PYTHONUNBUFFERED = '1'
}

function Get-RequiredEnv([string]$Name) {
    $value = [Environment]::GetEnvironmentVariable($Name)
    if ([string]::IsNullOrWhiteSpace($value) -or $value.Contains('CHANGE_ME') -or $value.Contains('<')) {
        Stop-WithError "selfhost\.env da $Name to'ldirilmagan."
    }
    return $value
}

function Get-UrlHost([string]$Url) {
    try { return ([Uri]$Url).Host } catch { return '' }
}

function Test-LocalDatabaseUrl([string]$Url) {
    return @('localhost', '127.0.0.1', '[::1]', '::1') -contains (Get-UrlHost $Url)
}

function Get-PgTool([string]$Name) {
    $bin = $env:PG_BIN
    if ([string]::IsNullOrWhiteSpace($bin)) { $bin = 'C:\Program Files\PostgreSQL\19\bin' }
    $path = Join-Path $bin "$Name.exe"
    if (-not (Test-Path $path)) { Stop-WithError "$path topilmadi. selfhost\.env da PG_BIN ni to'g'rilang." }
    return $path
}

function Get-PidFile([string]$Name) { return Join-Path $RunDir "$Name.pid" }

function Get-RunningProcess([string]$Name) {
    $file = Get-PidFile $Name
    if (-not (Test-Path $file)) { return $null }
    $id = [int]((Get-Content $file -Raw).Trim())
    $proc = Get-Process -Id $id -ErrorAction SilentlyContinue
    if ($null -eq $proc) { Remove-Item $file -Force; return $null }
    return $proc
}

function Assert-NothingRunning {
    foreach ($name in @('api', 'worker', 'ngrok')) {
        if ($null -ne (Get-RunningProcess $name)) {
            Stop-WithError "'$name' ishlab turibdi. Avval selfhost\stop.ps1 ni ishga tushiring."
        }
    }
}

function Get-Timestamp { return (Get-Date).ToString('yyyyMMdd-HHmmss') }

# Runs a native tool and stops the script if it fails.
function Invoke-Tool([string]$Exe, [string[]]$Arguments) {
    & $Exe @Arguments
    if ($LASTEXITCODE -ne 0) { Stop-WithError "$(Split-Path -Leaf $Exe) xato bilan tugadi (kod $LASTEXITCODE)." }
}

# "table|rows" lines for every table in the public schema, for before/after comparisons.
$RowCountSql = "select table_name || '|' || (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text " +
    "from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name;"

function Get-RowCounts([string]$Url) {
    $psql = Get-PgTool 'psql'
    $out = & $psql -X -A -t -q -d $Url -c $RowCountSql
    if ($LASTEXITCODE -ne 0) { Stop-WithError "Jadval sonlarini olib bo'lmadi: $(Get-UrlHost $Url)" }
    return @($out | Where-Object { $_ -ne '' })
}

function Get-ServerMajor([string]$Url) {
    $psql = Get-PgTool 'psql'
    $num = & $psql -X -A -t -q -d $Url -c 'show server_version_num;'
    if ($LASTEXITCODE -ne 0) { Stop-WithError "Bazaga ulanib bo'lmadi: $(Get-UrlHost $Url)" }
    return [int][math]::Floor([int]("$num".Trim()) / 10000)
}

# Compares two Get-RowCounts results; returns $true when every table has the same row count.
function Compare-RowCounts([string[]]$Expected, [string[]]$Actual) {
    $diff = Compare-Object -ReferenceObject $Expected -DifferenceObject $Actual
    if ($null -eq $diff) { return $true }
    $diff | ForEach-Object { Write-Host "    farq: $($_.InputObject) ($($_.SideIndicator))" -ForegroundColor Yellow }
    return $false
}

function Confirm-Typed([string]$Prompt, [string]$Expected) {
    Write-Host $Prompt -ForegroundColor Yellow
    $answer = Read-Host "Davom etish uchun '$Expected' deb yozing"
    if ($answer -cne $Expected) { Write-Host 'Bekor qilindi.'; exit 1 }
}

# pg_dump of the public schema only: Nhost keeps its own auth/storage schemas, never touched here.
function Export-PublicSchema([string]$Url, [string]$File) {
    $pgDump = Get-PgTool 'pg_dump'
    Invoke-Tool $pgDump @('--format=custom', '--schema=public', '--no-owner', '--no-privileges', '--file', $File, '--dbname', $Url)
}

# Turns a dump into one SQL script that replaces the tables in public. The "SCHEMA public"
# entry itself is left out so the schema (and its grants on Nhost) is kept.
function Convert-DumpToSql([string]$Dump, [string]$SqlFile, [int]$TargetMajor) {
    $pgRestore = Get-PgTool 'pg_restore'
    $list = "$SqlFile.list"
    $toc = & $pgRestore --list $Dump
    if ($LASTEXITCODE -ne 0) { Stop-WithError "pg_restore --list xato bilan tugadi." }
    $toc | Where-Object { $_ -notmatch ' SCHEMA - public ' -and $_ -notmatch ' COMMENT - SCHEMA public ' } |
        Set-Content -Path $list -Encoding ASCII
    Invoke-Tool $pgRestore @('--clean', '--if-exists', '--no-owner', '--no-privileges', '--use-list', $list, '--file', $SqlFile, $Dump)
    Remove-Item $list -Force
    if ($TargetMajor -lt 17) {
        # pg_dump 17+ writes this setting; older servers reject it.
        $lines = Get-Content -Path $SqlFile -Encoding UTF8 | Where-Object { $_ -notmatch '^SET transaction_timeout' }
        [IO.File]::WriteAllLines($SqlFile, [string[]]$lines, (New-Object Text.UTF8Encoding $false))
    }
}

# Runs the SQL in one transaction: any error rolls everything back and the target is unchanged.
function Invoke-SqlFile([string]$Url, [string]$SqlFile) {
    $psql = Get-PgTool 'psql'
    Invoke-Tool $psql @('-X', '-q', '-v', 'ON_ERROR_STOP=1', '--single-transaction', '-d', $Url, '-f', $SqlFile)
}
