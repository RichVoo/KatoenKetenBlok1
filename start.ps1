#!/usr/bin/env pwsh

Write-Host "🚀 Starting Cotton Supply Chain Development Environment" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""

# Function to start a process in a new window
function Start-InNewWindow {
    param(
        [string]$Title,
        [string]$Command,
        [string]$WorkingDirectory
    )
    
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$WorkingDirectory'; Write-Host '$Title' -ForegroundColor Cyan; $Command"
}

Write-Host "Starting all services..." -ForegroundColor Yellow
Write-Host ""

# Get current directory
$rootDir = Get-Location

# Start Hardhat node
Write-Host "1. Starting Hardhat local blockchain..." -ForegroundColor Cyan
Start-InNewWindow -Title "Hardhat Node" -Command "npx hardhat node" -WorkingDirectory "$rootDir\contracts"

# Wait a bit for blockchain to start
Start-Sleep -Seconds 5

# Deploy contracts
Write-Host "2. Deploying smart contracts..." -ForegroundColor Cyan
Set-Location contracts
npx hardhat run scripts/deploy.js --network localhost

# Setup roles and initial data
Write-Host "3. Setting up roles and initial data..." -ForegroundColor Cyan
npx hardhat run scripts/setup.js --network localhost
Set-Location ..

# Wait for setup
Start-Sleep -Seconds 3

# Start backend
Write-Host "4. Starting backend server..." -ForegroundColor Cyan
Start-InNewWindow -Title "Backend Server" -Command "npm start" -WorkingDirectory "$rootDir\backend"

# Wait for backend to start
Start-Sleep -Seconds 5

# Start frontend (Simple HTTP Server)
Write-Host "5. Starting frontend..." -ForegroundColor Cyan
Start-InNewWindow -Title "Frontend" -Command "cd public; python -m http.server 8000" -WorkingDirectory "$rootDir\frontend"

Write-Host ""
Write-Host "✅ All services started!" -ForegroundColor Green
Write-Host ""
Write-Host "Access points:" -ForegroundColor Cyan
Write-Host "- Frontend (integrated.html): http://localhost:8000/integrated.html" -ForegroundColor Green
Write-Host "- Frontend (full.html): http://localhost:8000/full.html" -ForegroundColor White
Write-Host "- Frontend (direct.html): http://localhost:8000/direct.html" -ForegroundColor White
Write-Host "- Backend API: http://localhost:3001" -ForegroundColor White
Write-Host "- Hardhat Node: http://127.0.0.1:8545" -ForegroundColor White
Write-Host ""
Write-Host "🌾 STAKEHOLDER PAGINA (rol-gebaseerde dashboards) op:" -ForegroundColor Green  
Write-Host "   http://localhost:8000/stakeholder.html" -ForegroundColor Green
Write-Host ""
Write-Host "   Ook beschikbaar: integrated.html (complete flow)" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
