# Smart VPN - GitHub Publisher (PowerShell)
# Usage: .\publish-to-github.ps1

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host ''
Write-Host '==========================================' -ForegroundColor Cyan
Write-Host '   Smart VPN - GitHub Publisher        ' -ForegroundColor Cyan
Write-Host '==========================================' -ForegroundColor Cyan
Write-Host ''

Write-Host '[INFO] Checking Git...' -ForegroundColor Cyan
try {
    $gitVersion = git --version 2>&1
    Write-Host "[OK] Git installed: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host '[ERROR] Git not installed!' -ForegroundColor Red
    Write-Host 'Install from: https://git-scm.com/download/win'
    exit 1
}

if (-not (Test-Path '.git')) {
    Write-Host '[WARN] Git repo not initialized' -ForegroundColor Yellow
    $init = Read-Host 'Initialize? (y/N)'
    if ($init -eq 'y' -or $init -eq 'Y') {
        git init
        Write-Host '[OK] Git repo initialized' -ForegroundColor Green
    } else {
        exit 1
    }
} else {
    Write-Host '[OK] Git repo found' -ForegroundColor Green
}

if (-not (Test-Path '.gitignore')) {
    Write-Host '[INFO] Creating .gitignore...' -ForegroundColor Cyan
    $gitignore = @"
node_modules/
.env
logs/
*.log
.DS_Store
.vscode/
*.pem
*.key
config/certs/
config/xray/
dist/
build/
backup-*/
"@
    Set-Content -Path '.gitignore' -Value $gitignore -Encoding UTF8
    Write-Host '[OK] .gitignore created' -ForegroundColor Green
} else {
    Write-Host '[OK] .gitignore found' -ForegroundColor Green
}

Write-Host ''
Write-Host '==========================================' -ForegroundColor Cyan
Write-Host '   Setup Complete                      ' -ForegroundColor Cyan
Write-Host '==========================================' -ForegroundColor Cyan
Write-Host ''
Write-Host 'Next steps:' -ForegroundColor Yellow
Write-Host '  1. Create repo on GitHub'
Write-Host '     https://github.com/new'
Write-Host '  2. Add remote:'
Write-Host '     git remote add origin YOUR_URL'
Write-Host '  3. Commit and push:'
Write-Host '     git add -A'
Write-Host '     git commit -m "Initial commit"'
Write-Host '     git push -u origin main'
Write-Host ''
Write-Host '[OK] Done!' -ForegroundColor Green
Write-Host ''
pause
