#!/usr/bin/env pwsh

Write-Host 'Starting Cotton Supply Chain' -ForegroundColor Green
Write-Host '======================================' -ForegroundColor Green
Write-Host ''

function Start-InNewWindow {
    param([string]$Title, [string]$Command, [string]$WorkingDirectory)
    Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$WorkingDirectory'; Write-Host '$Title' -ForegroundColor Cyan; $Command"
}

Write-Host 'Starting services...' -ForegroundColor Yellow
Write-Host ''

$rootDir = Get-Location

Write-Host '1. Starting Hardhat blockchain...' -ForegroundColor Cyan
Start-InNewWindow -Title 'Hardhat Node' -Command 'npx hardhat node' -WorkingDirectory "$rootDir\contracts"

Start-Sleep -Seconds 5

Write-Host '2. Deploying contracts...' -ForegroundColor Cyan
Set-Location contracts
npx hardhat run scripts/deploy.js --network localhost

Write-Host '3. Setup roles and data...' -ForegroundColor Cyan
npx hardhat run scripts/setup.js --network localhost
Set-Location ..

Start-Sleep -Seconds 3

Write-Host '4. Starting DID Service...' -ForegroundColor Cyan
Start-InNewWindow -Title 'DID Service (Port 3002)' -Command 'npm start' -WorkingDirectory "$rootDir\did-service"

Start-Sleep -Seconds 3

Write-Host '5. Starting frontend...' -ForegroundColor Cyan
Start-InNewWindow -Title 'Frontend' -Command 'cd public; python -m http.server 8000' -WorkingDirectory "$rootDir\frontend"

Write-Host ''
Write-Host 'All services started!' -ForegroundColor Green
Write-Host ''
Write-Host 'Open: http://localhost:8000/stakeholder.html' -ForegroundColor Green
Write-Host ''
Write-Host 'DID Service: http://localhost:3002' -ForegroundColor Cyan
Write-Host 'Blockchain: http://127.0.0.1:8545' -ForegroundColor White
Write-Host ''
Write-Host 'Press any key to exit...' -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
