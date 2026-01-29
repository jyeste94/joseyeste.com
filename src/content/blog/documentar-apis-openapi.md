---
title: "Documentar APIs sin morir: OpenAPI + Redoc rápidos"
date: "2024-12-02"
category: "APIs"
summary: "Cómo generar y publicar documentación útil en menos de una hora usando OpenAPI y un pipeline barato."
readingTime: "5 min"
tags: ["OpenAPI", "DX", "Productividad"]
---

No basta con un README: la API necesita contratos versionados. Define primero los esquemas y los errores comunes (422, 429, 500) y no dejes que el código diverja del contrato.

Si estás en Node, genera el contrato desde zod o tsoa y publica el YAML en cada build. Sube siempre el artefacto versionado (`/docs/openapi-1.3.0.yaml`).

Para el frontend, sirve un Redoc estático desde `/docs` y un playground Swagger sólo en staging. La documentación tiene que vivir pegada al dominio real, no en un PDF perdido.

Incluye ejemplos de negocio, no sólo payloads. Añade un `curl`, un fetch y un snippet en el lenguaje principal que usen tus consumidores. La DX importa más que la perfección del contrato.

Automatiza revisiones: si cambia el contrato, exige un check de compatibilidad (breaking vs non-breaking). Cualquier breaking debería requerir un version bump y un plan de migración.
