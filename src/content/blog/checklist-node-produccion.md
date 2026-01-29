---
title: "Checklist para lanzar un servicio Node a producción"
date: "2025-01-12"
category: "Backend"
summary: "Apunta lo esencial antes de darle deploy a un servicio: logs útiles, métricas y saneamiento de errores para no ir a ciegas."
readingTime: "6 min"
tags: ["Node.js", "Observabilidad", "DevOps"]
---

Cada despliegue debería salir con un checklist claro. Antes de pensar en la infraestructura, deja atado lo que vas a medir y cómo reaccionarás cuando algo falle.

Errores: usa un middleware global que normalice el error y devuelva códigos coherentes. Envía trazas a un colector (Sentry, OpenTelemetry) y añade un correlation-id para seguir las peticiones.

Logs: estructura en JSON y añade nivel, servicio, versión, request-id, user-id y latencia. Pocos logs, pero buenos. Evita `console.log` suelto: centraliza un logger y define cuándo se loguea cada cosa.

Salud: expón `/health` para el load balancer y `/ready` para saber si el servicio puede recibir tráfico. Añade un `/metrics` en formato Prometheus y etiqueta cada métrica con la versión desplegada.

Backpressure: limita concurrencia en pools y usa timeouts agresivos en HTTP/DB. Si algo externo va lento, responde rápido con un 503 y reintenta por colas cuando tenga sentido.

Post-deploy: automatiza un smoke test contra producción y deja un dashboard mínimo (p50/p95, tasa de errores, saturación de recursos). Si cualquier métrica se dispara, haz rollback sin dudar.
