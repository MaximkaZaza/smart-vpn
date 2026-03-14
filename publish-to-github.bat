@echo off
REM Smart VPN - GitHub Publisher (Minimal Version)
REM Usage: publish-to-github.bat

chcp 65001 >nul
title Smart VPN - GitHub Publisher

echo.
echo ==========================================
echo    Smart VPN - GitHub Publisher
echo ==========================================
echo.

REM Check Git
where git >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Git is not installed!
    echo Install from: https://git-scm.com/download/win
    pause
    exit /b 1
)

echo [OK] Git is installed
echo.

REM Initialize if needed
if not exist ".git" (
    echo [INFO] Initializing Git repository...
    git init
)

REM Create .gitignore
if not exist ".gitignore" (
    echo [INFO] Creating .gitignore...
    echo node_modules/ > .gitignore
    echo .env >> .gitignore
    echo logs/ >> .gitignore
    echo *.log >> .gitignore
    echo .DS_Store >> .gitignore
    echo .vscode/ >> .gitignore
    echo *.pem >> .gitignore
    echo *.key >> .gitignore
    echo config/certs/ >> .gitignore
    echo config/xray/ >> .gitignore
    echo dist/ >> .gitignore
    echo build/ >> .gitignore
    echo backup-*/ >> .gitignore
)

echo [OK] Setup complete
echo.
echo Next steps:
echo   1. Create repository on GitHub
echo   2. Run these commands:
echo      git remote add origin YOUR_REPO_URL
echo      git add -A
echo      git commit -m "Initial commit"
echo      git push -u origin main
echo.
pause
