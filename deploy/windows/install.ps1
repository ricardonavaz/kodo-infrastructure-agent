# ============================================================
# Kodo Infrastructure Agent - Windows Server Installation Script
# ============================================================
# Run as Administrator

param(
    [string]$InstallPath = "C:\Kodo",
    [int]$NodePort = 3001,
    [string]$IISSiteName = "Kodo",
    [int]$IISPort = 443
)

$ErrorActionPreference = "Stop"

Write-Host "================================================" -ForegroundColor Green
Write-Host "  Kodo Infrastructure Agent - Instalador Windows" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""

# 1. Check prerequisites
Write-Host "[1/8] Verificando prerequisitos..." -ForegroundColor Cyan

# Node.js
$nodeVersion = & node --version 2>$null
if (-not $nodeVersion) {
    Write-Host "  ERROR: Node.js no esta instalado." -ForegroundColor Red
    Write-Host "  Descarga desde: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}
Write-Host "  Node.js: $nodeVersion" -ForegroundColor Green

# IIS
$iis = Get-WindowsFeature Web-Server -ErrorAction SilentlyContinue
if (-not $iis -or -not $iis.Installed) {
    Write-Host "  Instalando IIS..." -ForegroundColor Yellow
    Install-WindowsFeature Web-Server -IncludeManagementTools
}
Write-Host "  IIS: Instalado" -ForegroundColor Green

# URL Rewrite Module
$urlRewrite = Get-WebGlobalModule -Name "RewriteModule" -ErrorAction SilentlyContinue
if (-not $urlRewrite) {
    Write-Host "  ADVERTENCIA: URL Rewrite Module no detectado." -ForegroundColor Yellow
    Write-Host "  Descarga desde: https://www.iis.net/downloads/microsoft/url-rewrite" -ForegroundColor Yellow
    Write-Host "  Instala manualmente y vuelve a ejecutar este script." -ForegroundColor Yellow
}

# ARR (Application Request Routing)
$arr = Get-WebGlobalModule -Name "ApplicationRequestRouting" -ErrorAction SilentlyContinue
if (-not $arr) {
    Write-Host "  ADVERTENCIA: ARR no detectado." -ForegroundColor Yellow
    Write-Host "  Descarga desde: https://www.iis.net/downloads/microsoft/application-request-routing" -ForegroundColor Yellow
}

# 2. Copy files
Write-Host ""
Write-Host "[2/8] Copiando archivos a $InstallPath..." -ForegroundColor Cyan

if (Test-Path $InstallPath) {
    Write-Host "  Directorio existente, actualizando..." -ForegroundColor Yellow
} else {
    New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
}

# Copy project files (excluding node_modules and .db files)
$source = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$excludeDirs = @("node_modules", ".git", "backups")
Get-ChildItem -Path $source -Exclude $excludeDirs | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination $InstallPath -Recurse -Force
}
Write-Host "  Archivos copiados" -ForegroundColor Green

# 3. Install dependencies
Write-Host ""
Write-Host "[3/8] Instalando dependencias..." -ForegroundColor Cyan

Push-Location "$InstallPath\server"
& npm install --production 2>&1 | Out-Null
Write-Host "  Server dependencies: OK" -ForegroundColor Green
Pop-Location

Push-Location "$InstallPath\client"
& npm install 2>&1 | Out-Null
Write-Host "  Client dependencies: OK" -ForegroundColor Green

# 4. Build frontend
Write-Host ""
Write-Host "[4/8] Compilando frontend..." -ForegroundColor Cyan
& npx vite build 2>&1 | Out-Null
Write-Host "  Frontend build: OK" -ForegroundColor Green
Pop-Location

# 5. Copy web.config for IIS
Write-Host ""
Write-Host "[5/8] Configurando IIS..." -ForegroundColor Cyan
Copy-Item -Path "$InstallPath\deploy\windows\web.config" -Destination "$InstallPath\client\dist\web.config" -Force

# 6. Install as Windows Service using nssm (if available) or sc.exe
Write-Host ""
Write-Host "[6/8] Configurando servicio Windows..." -ForegroundColor Cyan

$serviceName = "KodoAgent"
$existingService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue

if ($existingService) {
    Write-Host "  Deteniendo servicio existente..." -ForegroundColor Yellow
    Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
    & sc.exe delete $serviceName 2>$null
    Start-Sleep -Seconds 2
}

# Check for nssm
$nssm = Get-Command nssm -ErrorAction SilentlyContinue
if ($nssm) {
    & nssm install $serviceName (Get-Command node).Source "$InstallPath\server\index.js"
    & nssm set $serviceName AppDirectory "$InstallPath\server"
    & nssm set $serviceName AppEnvironmentExtra "PORT=$NodePort" "NODE_ENV=production"
    & nssm set $serviceName DisplayName "Kodo Infrastructure Agent"
    & nssm set $serviceName Description "AI-powered infrastructure management agent"
    & nssm set $serviceName Start SERVICE_AUTO_START
    & nssm set $serviceName AppStdout "$InstallPath\logs\service.log"
    & nssm set $serviceName AppStderr "$InstallPath\logs\error.log"
    New-Item -ItemType Directory -Path "$InstallPath\logs" -Force | Out-Null
    Write-Host "  Servicio creado con NSSM" -ForegroundColor Green
} else {
    Write-Host "  NSSM no encontrado. Instalando con sc.exe (basico)..." -ForegroundColor Yellow
    Write-Host "  Para mejor gestion, instala NSSM: https://nssm.cc/" -ForegroundColor Yellow
    & sc.exe create $serviceName binPath= "cmd /c `"cd /d $InstallPath\server && node index.js`"" start= auto DisplayName= "Kodo Infrastructure Agent"
    Write-Host "  Servicio creado con sc.exe" -ForegroundColor Green
}

# 7. Configure IIS Site
Write-Host ""
Write-Host "[7/8] Creando sitio IIS..." -ForegroundColor Cyan

$existingSite = Get-Website -Name $IISSiteName -ErrorAction SilentlyContinue
if ($existingSite) {
    Write-Host "  Sitio IIS existente, removiendo..." -ForegroundColor Yellow
    Remove-Website -Name $IISSiteName
}

# Enable ARR proxy
try {
    Set-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST' -filter "system.webServer/proxy" -name "enabled" -value "True"
    Set-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST' -filter "system.webServer/proxy" -name "preserveHostHeader" -value "True"
} catch {
    Write-Host "  Advertencia: No se pudo configurar ARR proxy. Hazlo manualmente en IIS Manager." -ForegroundColor Yellow
}

New-Website -Name $IISSiteName -PhysicalPath "$InstallPath\client\dist" -Port $IISPort -Ssl -Force | Out-Null
Write-Host "  Sitio IIS '$IISSiteName' creado en puerto $IISPort" -ForegroundColor Green

# 8. Configure Firewall
Write-Host ""
Write-Host "[8/8] Configurando firewall..." -ForegroundColor Cyan

# Allow HTTPS
$existingRule = Get-NetFirewallRule -DisplayName "Kodo HTTPS" -ErrorAction SilentlyContinue
if (-not $existingRule) {
    New-NetFirewallRule -DisplayName "Kodo HTTPS" -Direction Inbound -Protocol TCP -LocalPort $IISPort -Action Allow | Out-Null
    Write-Host "  Regla firewall HTTPS (puerto $IISPort): Creada" -ForegroundColor Green
}

# Block direct access to Node.js port from outside
$blockRule = Get-NetFirewallRule -DisplayName "Kodo Block Direct" -ErrorAction SilentlyContinue
if (-not $blockRule) {
    New-NetFirewallRule -DisplayName "Kodo Block Direct" -Direction Inbound -Protocol TCP -LocalPort $NodePort -Action Block -RemoteAddress "0.0.0.0/0" | Out-Null
    New-NetFirewallRule -DisplayName "Kodo Allow Localhost" -Direction Inbound -Protocol TCP -LocalPort $NodePort -Action Allow -RemoteAddress "127.0.0.1" | Out-Null
    Write-Host "  Puerto $NodePort bloqueado externamente, solo localhost" -ForegroundColor Green
}

# Start service
Write-Host ""
Write-Host "Iniciando servicio..." -ForegroundColor Cyan
Start-Service -Name $serviceName
Start-Sleep -Seconds 3

$svcStatus = (Get-Service -Name $serviceName).Status
if ($svcStatus -eq "Running") {
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Green
    Write-Host "  Kodo instalado exitosamente!" -ForegroundColor Green
    Write-Host "================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  URL: https://localhost:$IISPort" -ForegroundColor Cyan
    Write-Host "  Login: admin / admin (cambiar en primer ingreso)" -ForegroundColor Yellow
    Write-Host "  Servicio: $serviceName (auto-start)" -ForegroundColor Cyan
    Write-Host "  Logs: $InstallPath\logs\" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  IMPORTANTE:" -ForegroundColor Yellow
    Write-Host "  1. Configura un certificado SSL valido en IIS" -ForegroundColor Yellow
    Write-Host "  2. Cambia la password del admin inmediatamente" -ForegroundColor Yellow
    Write-Host "  3. Configura tu API key de Anthropic en Settings" -ForegroundColor Yellow
} else {
    Write-Host "  ADVERTENCIA: El servicio no inicio. Revisa los logs." -ForegroundColor Red
    Write-Host "  Intenta: Start-Service $serviceName" -ForegroundColor Yellow
}
