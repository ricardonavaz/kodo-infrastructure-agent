# Deploy en Windows Server con IIS

## Prerequisitos

| Componente | Requerido | Descarga |
|---|---|---|
| Windows Server 2016+ | Si | — |
| Node.js 18+ | Si | https://nodejs.org/ |
| IIS (Web Server role) | Si | Server Manager → Add Roles |
| URL Rewrite Module | Si | https://www.iis.net/downloads/microsoft/url-rewrite |
| ARR (Application Request Routing) | Si | https://www.iis.net/downloads/microsoft/application-request-routing |
| NSSM (recomendado) | Opcional | https://nssm.cc/ |

## Instalacion automatica

```powershell
# Ejecutar como Administrador
cd C:\path\to\SuSSH\deploy\windows
.\install.ps1
```

El script:
1. Verifica Node.js, IIS, URL Rewrite, ARR
2. Copia archivos a `C:\Kodo`
3. Instala dependencias (npm install)
4. Compila frontend (vite build)
5. Crea servicio Windows (con NSSM si esta disponible)
6. Configura sitio IIS con reverse proxy
7. Configura firewall (HTTPS abierto, Node.js port bloqueado externamente)
8. Inicia el servicio

## Instalacion manual

### 1. Copiar proyecto

```powershell
mkdir C:\Kodo
# Copiar contenido del proyecto (sin node_modules)
xcopy /E /I .\SuSSH C:\Kodo
```

### 2. Instalar dependencias

```powershell
cd C:\Kodo\server
npm install --production

cd C:\Kodo\client
npm install
npx vite build
```

### 3. Instalar como servicio Windows

**Con NSSM (recomendado):**
```powershell
nssm install KodoAgent "C:\Program Files\nodejs\node.exe" "C:\Kodo\server\index.js"
nssm set KodoAgent AppDirectory "C:\Kodo\server"
nssm set KodoAgent AppEnvironmentExtra "PORT=3001" "NODE_ENV=production"
nssm set KodoAgent Start SERVICE_AUTO_START
nssm set KodoAgent AppStdout "C:\Kodo\logs\service.log"
nssm set KodoAgent AppStderr "C:\Kodo\logs\error.log"
mkdir C:\Kodo\logs
nssm start KodoAgent
```

**Sin NSSM (basico):**
```powershell
sc.exe create KodoAgent binPath= "cmd /c cd /d C:\Kodo\server && node index.js" start= auto
sc.exe start KodoAgent
```

### 4. Configurar IIS como reverse proxy

#### Instalar modulos IIS
1. Descargar e instalar URL Rewrite Module
2. Descargar e instalar ARR (Application Request Routing)
3. Reiniciar IIS: `iisreset`

#### Habilitar proxy en ARR
```powershell
# PowerShell (como admin)
Set-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST' -filter "system.webServer/proxy" -name "enabled" -value "True"
Set-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST' -filter "system.webServer/proxy" -name "preserveHostHeader" -value "True"
```

#### Crear sitio
1. Abrir IIS Manager
2. Clic derecho en Sites → Add Website
3. Nombre: `Kodo`
4. Physical Path: `C:\Kodo\client\dist`
5. Binding: HTTPS, puerto 443
6. SSL Certificate: seleccionar certificado

#### Copiar web.config
```powershell
copy C:\Kodo\deploy\windows\web.config C:\Kodo\client\dist\web.config
```

### 5. Certificado SSL

**Opcion A: Certificado auto-firmado (desarrollo/testing)**
```powershell
New-SelfSignedCertificate -DnsName "kodo.tudominio.com" -CertStoreLocation "cert:\LocalMachine\My"
```

**Opcion B: Let's Encrypt (produccion)**
- Usar win-acme: https://www.win-acme.com/
```powershell
# Descargar y ejecutar
.\wacs.exe --target iis --siteid 1 --installation iis
```

**Opcion C: Certificado comercial**
- Importar en IIS → Server Certificates → Import

### 6. Firewall

```powershell
# Permitir HTTPS
New-NetFirewallRule -DisplayName "Kodo HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow

# Bloquear acceso directo a Node.js desde fuera
New-NetFirewallRule -DisplayName "Kodo Block Direct" -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Block
New-NetFirewallRule -DisplayName "Kodo Allow Localhost" -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow -RemoteAddress 127.0.0.1
```

## Configuracion post-deploy

1. Abrir `https://tu-servidor/` en navegador
2. Login: `admin` / `admin`
3. Cambiar password del admin (obligatorio en primer ingreso)
4. Ir a Configuracion → agregar API Key de Anthropic
5. Crear usuarios adicionales (operadores, viewers)
6. Agregar servidores a administrar

## Actualizaciones

```powershell
# 1. Detener servicio
Stop-Service KodoAgent

# 2. Actualizar archivos (preservar kodo.db y backups)
# Copiar nuevos archivos excepto server/kodo.db y server/backups/

# 3. Reinstalar dependencias
cd C:\Kodo\server && npm install --production
cd C:\Kodo\client && npm install && npx vite build

# 4. Reiniciar
Start-Service KodoAgent
```

## Troubleshooting

### El servicio no inicia
```powershell
# Ver logs
Get-Content C:\Kodo\logs\error.log -Tail 50

# Probar manualmente
cd C:\Kodo\server
node index.js
```

### IIS no hace proxy
1. Verificar ARR esta habilitado: IIS Manager → Server → Application Request Routing → Server Proxy Settings → Enable proxy
2. Verificar URL Rewrite Module instalado
3. Verificar web.config existe en `C:\Kodo\client\dist\`
4. Revisar Event Viewer → Windows Logs → Application

### SSE (streaming) no funciona
IIS puede bufferar respuestas SSE. Verificar:
1. `responseBufferLimit` no este habilitado
2. ARR proxy tenga `reverseRewriteHostInResponseHeaders` en false
3. En web.config agregar: `<httpErrors existingResponse="PassThrough" />`

### Error de timeout en SSE
Aumentar timeout en ARR:
```powershell
Set-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST' -filter "system.webServer/proxy" -name "timeout" -value "00:10:00"
```

## Arquitectura de deploy

```
Internet → Firewall (443 open)
  → IIS (HTTPS + SSL)
    → URL Rewrite + ARR (reverse proxy)
      → Node.js localhost:3001 (Kodo server)
        → SQLite (C:\Kodo\server\kodo.db)
        → SSH connections to managed servers
        → Claude API (Anthropic)
```
