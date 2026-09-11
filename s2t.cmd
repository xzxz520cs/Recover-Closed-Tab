@echo off
REM Recover-Closed-Tab 简 → 繁 直译转换（双击运行：用 zh_CN 重写 zh_TW）
cd /d "%~dp0"
python s2t.py %*
if errorlevel 1 (
    echo.
    echo 转换失败或校验不一致。请确认已安装 Python 3 并加入 PATH。
    pause
)
