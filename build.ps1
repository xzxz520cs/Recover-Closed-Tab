# Recover-Closed-Tab 构建封装脚本（PowerShell）
# 用法:
#   .\build.ps1            # 生成 Chrome/ 与 Edge/，并在 dist/ 打包发布 zip
#   .\build.ps1 -Version 3.66
#   .\build.ps1 -NoZip     # 只生成产物目录，不打包
#   .\build.ps1 -Clean     # 生成前清空产物目录
param(
    [string]$Version = $null,
    [switch]$Clean,
    [switch]$Zip,
    [switch]$NoZip
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$py = Get-Command python -ErrorAction SilentlyContinue
if (-not $py) {
    Write-Host "[错误] 未找到 python，请先安装 Python 3。" -ForegroundColor Red
    exit 1
}

# 统一 UTF-8 输出，避免管道/控制台中文乱码
$env:PYTHONIOENCODING = 'utf-8'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$argsList = @($root + '\build.py')
if ($Version) { $argsList += '--version'; $argsList += $Version }
if ($Clean)   { $argsList += '--clean' }
if ($NoZip)   { $argsList += '--no-zip' }
if ($Zip -and -not $NoZip) {
    Write-Host '[提示] zip 现在默认就会打包，-Zip 可以省略。' -ForegroundColor DarkGray
}

& python $argsList
exit $LASTEXITCODE
