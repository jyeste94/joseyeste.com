# 👨🏻‍💻 Porfolio para programadores y desarrolladores

<div align="center">
<a href="https://porfolio.dev/">
<img src="./public/porfolio.webp">
</a>
<p></p>
</div>

<div align="center">

![Astro Badge](https://img.shields.io/badge/Astro-FF3E00?logo=astro&logoColor=fff&style=flat)
![Tailwind CSS Badge](https://img.shields.io/badge/Tailwind%20CSS-06B6D4?logo=tailwindcss&logoColor=fff&style=flat)
![GitHub stars](https://img.shields.io/github/stars/midudev/porfolio.dev)
![GitHub PRs](https://img.shields.io/github/issues-pr/midudev/porfolio.dev)
![GitHub forks](https://img.shields.io/github/forks/midudev/porfolio.dev)
![GitHub issues](https://img.shields.io/github/issues/midudev/porfolio.dev)

</div>

## 🫂 Contribuidores

<a href="https://github.com/midudev/porfolio.dev/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=midudev/porfolio.dev" />
</a>

<p></p>

## Desarrollo y publicación del blog

El sitio usa Astro y Content Collections. Para restaurar el lockfile y comprobar la salida de producción:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm preview
```

`pnpm build` ejecuta `astro check` y el build estático. No hay un script de lint independiente.

La entrada `.NET 10 vs .NET 11` está en `src/content/blog/dotnet-10-vs-dotnet-11.md`. Conserva las tablas y los ejemplos de la investigación; `.gitattributes` mantiene sus finales de línea LF. La fecha de publicación y `researchCutoff` tienen significados distintos y no deben intercambiarse.

Los 17 PNG publicados están en `public/blog/dotnet-10-vs-dotnet-11/`; su procedencia, dimensiones y hashes constan en `src/data/dotnet-study-images.json`. `rehype-dotnet-study.mjs` prepara únicamente esta entrada: dimensiones y carga diferida, tablas desplazables y referencias de investigación hacia un catálogo de rutas. Ese catálogo no publica ni permite descargar los archivos privados del laboratorio.

`DotnetStudyReader.astro` conserva la tipografía, el ancho y el tema del blog; sus reglas están limitadas al artículo. El controlador del visor se inicializa y limpia con los eventos de navegación de Astro. El menú móvil utiliza `details` nativo y las opciones del selector de tema son botones accesibles por teclado.

El repositorio técnico sigue pendiente de revisión de privacidad y publicación. No copiar logs, trazas, entornos locales, credenciales o el repositorio completo dentro de los recursos del sitio. Cuando exista una URL técnica aprobada, actualizar sus referencias de forma explícita, sin inventar destinos.

El flujo existente publica desde `main` y también versiona `dist`. Tras verificar el build, incluir los cambios de fuente y la salida generada correspondiente, sin `node_modules` ni cachés. El push activa Vercel; comprobar el estado del despliegue del commit y el dominio real antes de considerar publicada una entrada. Un resultado correcto de GitHub Pages no acredita la publicación en `joseyeste.com`.
