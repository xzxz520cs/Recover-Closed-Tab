@echo off
REM Recover-Closed-Tab 构建脚本（双击运行）
REM 生成 Chrome/ 与 Edge/，并在 dist/ 打包两个商店的发布 zip
cd /d "%~dp0"
python build.py %*
if errorlevel 1 (
    echo 构建失败。请确认已安装 Python 3 并加入 PATH。
    pause
)
