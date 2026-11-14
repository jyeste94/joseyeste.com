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

La edición narrativa mantiene los 24 capítulos, los 46 bloques de código, las 14 tablas y las 17 imágenes. Las fuentes se enlazan donde explican un resultado; el índice y el catálogo de archivos reúnen la navegación, sin cierres de auditoría repetidos en cada capítulo. Mantener una voz cercana y explicaciones completas, sin inventar experiencias personales ni atribuir causas que las pruebas no han aislado. La edición previa queda conservada en el commit `619d03632b0015787260ea777874ff71600f1f9a`.

Los 17 PNG publicados están en `public/blog/dotnet-10-vs-dotnet-11/`; su procedencia, dimensiones y hashes constan en `src/data/dotnet-study-images.json`. Ese manifiesto también registra `repository`, `commit` y la URL pública fijada de cada referencia de investigación. `rehype-dotnet-study.mjs` prepara únicamente esta entrada: dimensiones y carga diferida, tablas desplazables y resolución obligatoria de las referencias relativas conservadas en las tablas hacia sus destinos públicos. El catálogo del artículo enlaza las fuentes sin duplicar los archivos del laboratorio en los recursos del sitio.

`DotnetStudyReader.astro` conserva la tipografía, el ancho y el tema del blog; sus reglas están limitadas al artículo. El controlador del visor se inicializa y limpia con los eventos de navegación de Astro. El menú móvil utiliza `details` nativo y las opciones del selector de tema son botones accesibles por teclado.

El repositorio técnico público pertenece a `jyeste94`: [`.NET11vs.NET11`](https://github.com/jyeste94/.NET11vs.NET11). La versión enlazada por esta entrada es el commit [`5c8a5419e8330afcd954d87be5547fc1fdf725b5`](https://github.com/jyeste94/.NET11vs.NET11/commit/5c8a5419e8330afcd954d87be5547fc1fdf725b5). Para actualizarla, revisar primero la privacidad y la existencia de cada destino en el nuevo commit público; actualizar juntos el pin del manifiesto, sus URLs, los enlaces del artículo y este registro. Usar `blob` para código/documentación, `tree` para directorios y enlaces raw para datos descargables, conservando los fragmentos originales. No copiar entornos locales, herramientas instaladas, credenciales ni el repositorio completo dentro de los recursos del sitio; un nuevo pin no reconstruye los commits históricos ausentes.

El flujo existente publica desde `main` y también versiona `dist`. Tras verificar el build, incluir los cambios de fuente y la salida generada correspondiente, sin `node_modules` ni cachés. El push activa Vercel; comprobar el estado del despliegue del commit y el dominio real antes de considerar publicada una entrada. Un resultado correcto de GitHub Pages no acredita la publicación en `joseyeste.com`.
