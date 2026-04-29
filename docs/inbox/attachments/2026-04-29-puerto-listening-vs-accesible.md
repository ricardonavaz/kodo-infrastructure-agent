### Correcto

1. Verify port is listening (netstat)
2. Check firewall rule for that port
3. Check firewall PROFILE (Public/Domain/Private)
4. Only alert if Public profile allows access

## Ejemplo Real

- Windows Server tiene puerto 445 escuchando
- Netstat lo reporta como "listening on 0.0.0.0"
- PERO firewall tiene regla "File Sharing - Disabled - Public"
- CONCLUSION: NO es vulnerable porque WAN no puede acceder

## Origen de este documento

Aportado por Ricardo en sesion del 2026-04-29 durante test de diagnostico
en servidor DATAVAULT RNZ (Windows Server 2016). El agente de KODO
identifico inicialmente puertos como expuestos. Solo despues de que
Ricardo (con conocimiento de Windows) cuestionara el diagnostico, el
agente recalibro y dio analisis correcto distinguiendo listening vs
accesible via firewall.

Este documento sirve como ejemplo concreto de:

1. Tipo de conocimiento que el sistema de Knowledge Base de KODO debe
   poder absorber
2. Caso de aprendizaje que el agente debe internalizar
3. Regla de diagnostico que deberia aplicarse automaticamente en
   playbooks de seguridad de Windows
