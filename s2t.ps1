# Recover-Closed-Tab 简 → 繁 直译转换（PowerShell 封装）
# 用法:
#   .\s2t.ps1                       # 用 zh_CN/messages.json 重写 zh_TW/messages.json
#   .\s2t.ps1 -Check                # 只校验是否与直译结果一致
#   .\s2t.ps1 -Text "恢复历史记录"    # 转换一段文字并打印
#   .\s2t.ps1 -File a.txt -Out b.txt
param(
    [string]$Text = $null,
    [string]$File = $null,
    [string]$Out = $null,
    [switch]$Check,
    [switch]$Stdin
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$py = Get-Command python -ErrorAction SilentlyContinue
if (-not $py) {
    Write-Host "[错误] 未找到 python，请先安装 Python 3。" -ForegroundColor Red
    exit 1
}

# 统一 UTF-8 输出，避免控制台中文乱码
$env:PYTHONIOENCODING = 'utf-8'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$argsList = @($root + '\s2t.py')
if ($Text)  { $argsList += '--text'; $argsList += $Text }
if ($File)  { $argsList += '--file'; $argsList += $File }
if ($Out)   { $argsList += '--out';  $argsList += $Out }
if ($Check) { $argsList += '--check' }
if ($Stdin) { $argsList += '--stdin' }

& python $argsList
exit $LASTEXITCODE
