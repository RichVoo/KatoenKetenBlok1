#!/usr/bin/env pwsh

Write-Host "🌾 Cotton Supply Chain - Setup Script" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""

# Check if Node.js is installed
Write-Host "Checking prerequisites..." -ForegroundColor Yellow
$nodeVersion = node --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Node.js is not installed. Please install Node.js v18 or higher." -ForegroundColor Red
    exit 1
}
Write-Host "✓ Node.js $nodeVersion found" -ForegroundColor Green

# Install contracts dependencies
Write-Host ""
Write-Host "📦 Installing contract dependencies..." -ForegroundColor Yellow
Set-Location contracts
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install contract dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Contract dependencies installed" -ForegroundColor Green

# Copy .env.example to .env if not exists
if (!(Test-Path .env)) {
    Copy-Item .env.example .env
    Write-Host "✓ Created contracts/.env file" -ForegroundColor Green
}

Set-Location ..

# Install backend dependencies
Write-Host ""
Write-Host "📦 Installing backend dependencies..." -ForegroundColor Yellow
Set-Location backend
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install backend dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Backend dependencies installed" -ForegroundColor Green

# Copy .env.example to .env if not exists
if (!(Test-Path .env)) {
    Copy-Item .env.example .env
    Write-Host "✓ Created backend/.env file" -ForegroundColor Green
}

Set-Location ..

# Install frontend dependencies
Write-Host ""
Write-Host "📦 Installing frontend dependencies..." -ForegroundColor Yellow
Set-Location frontend
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install frontend dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Frontend dependencies installed" -ForegroundColor Green

# Copy .env.example to .env if not exists
if (!(Test-Path .env)) {
    Copy-Item .env.example .env
    Write-Host "✓ Created frontend/.env file" -ForegroundColor Green
}

Set-Location ..

Write-Host ""
Write-Host "✅ Setup completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Configure your .env files in contracts/, backend/, and frontend/" -ForegroundColor White
Write-Host "2. Start local blockchain: cd contracts; npx hardhat node" -ForegroundColor White
Write-Host "3. Deploy contracts: cd contracts; npx hardhat run scripts/deploy.js --network localhost" -ForegroundColor White
Write-Host "4. Start backend: cd backend; npm start" -ForegroundColor White
Write-Host "5. Start frontend: cd frontend; npm start" -ForegroundColor White
Write-Host ""
Write-Host "For detailed instructions, see INSTALLATION.md" -ForegroundColor Cyan
