# Smoke Test — 19 Abril 2026

## Contexto
Tests en vivo despues de merge de A1+A2+A3 a main. Version corriendo
confirmada como actualizada (tool_limit de A2 dispara correctamente).

## Hallazgos

### Hallazgo 1: tool_limit event no manejado en frontend
- Trigger: prompt "ejecuta todas las recomendaciones" despues de una
  auditoria
- Backend: correctamente emite evento tool_limit al alcanzar
  MAX_TOOL_ITERATIONS (10)
- Frontend: muestra "Error: Load failed" generico
- Prioridad: ALTA — afecta experiencia de usuario en caso comun
- Fix sugerido: agregar handler del evento tool_limit en el componente
  de chat que muestre mensaje informativo con opcion de continuar

### Hallazgo 2: Contraste pobre en botones de accion
- Ubicacion: footer del mensaje (Reporte IA, HTML, MD, TXT)
- Problema: dorado sobre negro insuficiente para legibilidad
- Prioridad: MEDIA
- Fix sugerido: revisar tokens de color del tema oscuro

### Hallazgo 3: Botones de export (HTML/MD/TXT) posiblemente no
ejecutan
- Reportado por Ricardo: "no ejecutan nada"
- Pendiente: confirmar en proximo smoke test si hay error en consola
  al click
- Prioridad: ALTA si se confirma

### Observacion: Model Router de A1
- Auditoria de seguridad uso Haiku segun metric footer del screenshot
- Hipotesis original: router enruta mal
- Hipotesis revisada: el prompt "Hazme una auditoria" puede no matchear
  patrones SONNET_PATTERNS. Verificar en siguiente sesion.

## Acciones propuestas (no ejecutadas hoy)
- Backlog: fix de tool_limit handling en frontend
- Backlog: auditoria de contraste de tema oscuro
- Backlog: test de funcionalidad de botones export
- Backlog: revisar patrones de SONNET_PATTERNS en model-router y
  agent.js detectTaskType
