# Baseline de banco NOVO (ex.: INAC na Vercel) quando `migrate deploy` falha
# por histórico fora de ordem (ALTER em tabela antes do CREATE).
#
# Uso (PowerShell), com a URL DIRETA do banco da INAC:
#
#   $env:APP_DIRECT_URL="postgres://USER:SENHA@db.prisma.io:5432/postgres?sslmode=verify-full"
#   $env:DATABASE_URL=$env:APP_DIRECT_URL
#   .\scripts\baseline-fresh-db.ps1
#
# ATENÇÃO: apaga TODOS os dados desse banco. Só use em banco vazio/novo da INAC.

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

if (-not $env:APP_DIRECT_URL -and -not $env:DATABASE_URL -and -not $env:DIRECT_URL) {
  Write-Error "Defina APP_DIRECT_URL (ou DATABASE_URL) com a URL do banco alvo antes de rodar."
}

Write-Host "==> 1/2 Reset + schema atual (db push --force-reset)..."
npx prisma db push --force-reset --accept-data-loss

Write-Host "==> 2/2 Baseline: marcando todas as migrations como aplicadas..."
$migrations = Get-ChildItem "prisma\migrations" -Directory | Sort-Object Name
$i = 0
foreach ($m in $migrations) {
  $i++
  Write-Host ("  [{0}/{1}] resolve --applied {2}" -f $i, $migrations.Count, $m.Name)
  npx prisma migrate resolve --applied $m.Name | Out-Null
}

Write-Host ""
Write-Host "Concluído."
Write-Host "  1) Abra /setup no site da INAC e crie o MASTER"
Write-Host "  2) Confirme: npx prisma migrate status"
Write-Host "  3) Daqui pra frente: npx prisma migrate deploy"
