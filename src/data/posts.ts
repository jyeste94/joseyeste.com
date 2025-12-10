export type BlogPost = {
  slug: string
  title: string
  date: string
  category: string
  summary: string
  readingTime: string
  tags: string[]
  body: string[]
}

export const posts: BlogPost[] = [
  {
    slug: "checklist-node-produccion",
    title: "Checklist para lanzar un servicio Node a producción",
    date: "2025-01-12",
    category: "Backend",
    summary:
      "Apunta lo esencial antes de darle deploy a un servicio: logs útiles, métricas y saneamiento de errores para no ir a ciegas.",
    readingTime: "6 min",
    tags: ["Node.js", "Observabilidad", "DevOps"],
    body: [
      "Cada despliegue debería salir con un checklist claro. Antes de pensar en la infraestructura, deja atado lo que vas a medir y cómo reaccionarás cuando algo falle.",
      "Errores: usa un middleware global que normalice el error y devuelva códigos coherentes. Envía trazas a un colector (Sentry, OpenTelemetry) y añade un correlation-id para seguir las peticiones.",
      "Logs: estructura en JSON y añade nivel, servicio, versión, request-id, user-id y latencia. Pocos logs, pero buenos. Evita `console.log` suelto: centraliza un logger y define cuándo se loguea cada cosa.",
      "Salud: expón `/health` para el load balancer y `/ready` para saber si el servicio puede recibir tráfico. Añade un `/metrics` en formato Prometheus y etiqueta cada métrica con la versión desplegada.",
      "Backpressure: limita concurrencia en pools y usa timeouts agresivos en HTTP/DB. Si algo externo va lento, responde rápido con un 503 y reintenta por colas cuando tenga sentido.",
      "Post-deploy: automatiza un smoke test contra producción y deja un dashboard mínimo (p50/p95, tasa de errores, saturación de recursos). Si cualquier métrica se dispara, haz rollback sin dudar.",
    ],
  },
  {
    slug: "documentar-apis-openapi",
    title: "Documentar APIs sin morir: OpenAPI + Redoc rápidos",
    date: "2024-12-02",
    category: "APIs",
    summary:
      "Cómo generar y publicar documentación útil en menos de una hora usando OpenAPI y un pipeline barato.",
    readingTime: "5 min",
    tags: ["OpenAPI", "DX", "Productividad"],
    body: [
      "No basta con un README: la API necesita contratos versionados. Define primero los esquemas y los errores comunes (422, 429, 500) y no dejes que el código diverja del contrato.",
      "Si estás en Node, genera el contrato desde zod o tsoa y publica el YAML en cada build. Sube siempre el artefacto versionado (`/docs/openapi-1.3.0.yaml`).",
      "Para el frontend, sirve un Redoc estático desde `/docs` y un playground Swagger sólo en staging. La documentación tiene que vivir pegada al dominio real, no en un PDF perdido.",
      "Incluye ejemplos de negocio, no sólo payloads. Añade un `curl`, un fetch y un snippet en el lenguaje principal que usen tus consumidores. La DX importa más que la perfección del contrato.",
      "Automatiza revisiones: si cambia el contrato, exige un check de compatibilidad (breaking vs non-breaking). Cualquier breaking debería requerir un version bump y un plan de migración.",
    ],
  },
  {
    slug: "patrones-ecommerce-headless",
    title: "Patrones que no fallan en un ecommerce headless",
    date: "2024-11-10",
    category: "Ecommerce",
    summary:
      "Lecciones rápidas al montar tiendas headless: performance, catálogo y experiencia de checkout sin sustos.",
    readingTime: "7 min",
    tags: ["Headless", "Performance", "UX"],
    body: [
      "El catálogo manda. Cachea las consultas populares y usa invalidación por eventos (webhooks) en lugar de refetch masivo. Cuida los filtros: agrupa en facetas y evita peticiones redundantes.",
      "Rendimiento: prerenderiza categorías y landing pages. Para el detalle de producto, mezcla prerender con hydratation mínima (solo precio y stock en cliente).",
      "Checkout: cada campo extra reduce conversión. Pide sólo lo necesario y valida en tiempo real. Ofrece un modo exprés (wallet, autocompletado) y evita redirecciones externas siempre que puedas.",
      "Contenido: usa bloques reutilizables (banners, comparativas, bundles) y deja que marketing los mueva sin desplegar. Un CMS headless con bloques tipados evita romper el layout.",
      "Observa: captura embudos y errores de cliente (NetworkError, 3DS, rechazos de fraude) y levanta alertas cuando caiga el ratio de conversión. Sin telemetría, todo es una corazonada.",
    ],
  },
]

export const getAllPosts = () =>
  [...posts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )

export const getPostBySlug = (slug: string) =>
  posts.find((post) => post.slug === slug)
