---
title: ".NET 10 vs .NET 11: análisis de rendimiento y cambios internos"
description: "Comparativa de .NET 10 y .NET 11: JIT, gestión de memoria, programación asíncrona, ASP.NET Core, Entity Framework y Native AOT, con pruebas de rendimiento y análisis técnico."
summary: "Comparativa de .NET 10 y .NET 11: JIT, gestión de memoria, programación asíncrona, ASP.NET Core, Entity Framework y Native AOT, con pruebas de rendimiento y análisis técnico."
date: "2026-11-13"
category: "Backend"
readingTime: "Análisis en profundidad · 24 capítulos"
tags: [".NET", "C#", "ASP.NET Core", "Rendimiento", "Benchmarking"]
image: "/blog/dotnet-10-vs-dotnet-11/cover-dotnet-study.png"
imageAlt: "Portada conceptual: .NET 10 y .NET 11 recorren las capas de compilador, runtime y bibliotecas; no representa mediciones"
researchCutoff: "2026-11-12"
---


**Qué cambia dentro de .NET, cómo afecta a nuestras aplicaciones y qué descubrimos al comparar dos generaciones del runtime con pruebas reales.**

<aside class="study-publication-notice" aria-label="Disponibilidad de las evidencias">
<p><strong>Sobre los enlaces de investigación:</strong> el repositorio de código y evidencias está pendiente de revisión de privacidad y publicación. Sus enlaces muestran <a href="#evidencias-investigacion">rutas relativas copiables en el catálogo del capítulo 22</a>, no archivos públicos ni descargas. Sólo se publican aquí las imágenes editoriales seleccionadas; no se publican los originales, los logs ni las trazas de investigación. Las menciones del cuerpo a «esta entrega» describen la preparación editorial original, anterior a la publicación de esta página.</p>
</aside>

<figure class="study-cover">
<a href="/blog/dotnet-10-vs-dotnet-11/cover-dotnet-study.png"><img src="/blog/dotnet-10-vs-dotnet-11/cover-dotnet-study.png" width="1200" height="630" alt="Portada conceptual: .NET 10 y .NET 11 recorren las capas de compilador, runtime y bibliotecas; no representa mediciones" /></a>
<figcaption>Ilustración conceptual original para este artículo. Las capas ayudan a interpretar los resultados; no representan diferencias medidas de rendimiento. <a href="/blog/dotnet-10-vs-dotnet-11/cover-dotnet-study.png">Abrir portada PNG a tamaño completo</a>.</figcaption>
</figure>

<a id="resumen-ejecutivo"></a>
## Resumen ejecutivo · 2–3 minutos

**Actualizar a .NET 11 puede mejorar una aplicación sin reescribir su lógica, pero no garantiza mejoras en todas sus dimensiones.** Esta investigación compara versiones concretas de .NET 10 y .NET 11 con pruebas pequeñas, una API HTTP, consultas de base de datos, publicaciones y muestras de lenguaje. La pregunta útil no es qué versión gana más filas, sino qué trabajo cambia en los caminos que utiliza tu aplicación y qué evidencia necesitamos para tomar una decisión.

Para situarnos: C# es el lenguaje; el SDK aporta las herramientas para construir; el runtime hace funcionar el programa, y las bibliotecas resuelven operaciones como procesar texto o convertir objetos a JSON. Una actualización puede cambiar esas capas de formas distintas. Por eso la suite principal mantiene C# 14 y utiliza el mismo SDK para ambos destinos. Las novedades de C# 15, el acceso a bases de datos con Entity Framework Core (EF) y las opciones experimentales se estudian por separado.

El caso más claro es una operación en la que el compilador que trabaja durante la ejecución conoce el tipo concreto del objeto. Su pequeño núcleo de código máquina pasa de **69 a 3 bytes** y la memoria administrada asignada, de **24 a 0 bytes por operación**. El resultado sigue utilizándose y la envoltura de medida conserva 19 bytes en ambas versiones. No se ha comprimido una aplicación entera: el compilador ha demostrado que puede devolver el mismo argumento sin crear aquel objeto ni resolver la llamada como antes. Importa porque muestra cuándo una abstracción puede dejar de tener coste material.

Otros resultados piden más cautela. El productor/consumidor con Channel vuelve a ser más lento en .NET 11 en los controles de este equipo, pero la magnitud histórica más extrema no se mantiene. El patrón incluye crear canal y tareas por operación; no representa cualquier cola de un servicio. En HTTP se conservan millones de peticiones correctas y dos bloques que incluso invierten algunas comparaciones. Generador y servidor comparten máquina: esas cifras no permiten dimensionar por sí solas una infraestructura de producción.

**Menos memoria asignada, menos espera y menos tamaño no son sinónimos.** Los ejecutables Native AOT —un modo que compila a código máquina antes de ejecutar— crecen en las dos aplicaciones examinadas. Ese modo arranca antes que la publicación que necesita un runtime instalado, pero comparar formas de publicación no equivale a comparar 11 con 10. En las operaciones asíncronas, que pueden esperar un resultado sin bloquear necesariamente un hilo, activar Runtime Async en la aplicación sigue siendo experimental, o preview: reduce parte del código intermedio y beneficia ciertos caminos, mientras otros asignan más memoria. No hace falta activarlo para migrar al runtime estable.

Para decidir, empieza por compatibilidad, corrección y datos. Actualiza el runtime conservando inicialmente lenguaje y paquetes; revisa después EF, su proveedor y sus dependencias. Comprueba la plataforma de destino, el diagnóstico y la posibilidad de volver atrás también con los datos. Si buscas rendimiento, identifica primero el cuello de botella y valida una carga representativa. .NET 10 parcheado sigue siendo una opción válida; adoptar 11 puede aportar APIs, contratos y mantenimiento sin exigir que gane cada prueba. El artículo completo conserva los experimentos, sus límites y los enlaces para distinguir lo observado, lo explicado y lo que aún no sabemos.

<a id="rutas-lectura"></a>
## Elige tu recorrido

- **Primera aproximación a .NET:** empieza por [la pregunta inicial](#introduccion), [sus componentes](#que-es-dotnet) y [las versiones](#versiones). Lee [cómo interpretar las pruebas](#metodologia) antes de abrir los resultados; el [glosario](#glosario) está disponible durante todo el recorrido.
- **Decidir una migración:** tras este resumen, ve a [la decisión por tipo de aplicación](#decision), [la secuencia de migración](#migracion) y [la reproducción](#reproduccion). Vuelve a [versiones](#versiones) y [metodología](#metodologia) para contrastar los supuestos.
- **Entender el runtime por dentro:** [metodología](#metodologia) → [JIT](#jit) → [69 a 3 bytes](#gvm) → [GC](#gc) → [async](#async). Continúa con [concurrencia](#concurrencia) y [las anomalías repetidas](#resultados).
- **Evaluar una API o su despliegue:** [metodología](#metodologia) → [HTTP](#http) → [EF](#ef-core) → [Native AOT](#native-aot) → [decisión](#decision). [JSON](#json) y [observabilidad](#otras-superficies) completan los caminos de datos y diagnóstico.

Puedes leer sólo un recorrido o seguir los 24 capítulos: ninguno sustituye los experimentos del cuerpo. Al final de cada capítulo encontrarás sus fuentes, la matriz de trazabilidad y los enlaces anterior/índice/siguiente. Cada imagen enlaza su PNG original y ofrece además un enlace de texto para abrirla a tamaño completo, también sin JavaScript.

Si una tabla o un ejemplo no cabe en tu pantalla, desplázalo lateralmente dentro del bloque. Para leer las etiquetas de un gráfico, abre la imagen a tamaño completo; si está disponible el visor, elige **Tamaño real** y desplázala dentro de su recuadro.

<details id="indice">
<summary>Índice de los 24 capítulos</summary>

[Ir al resumen ejecutivo](#resumen-ejecutivo) · [Elegir un recorrido](#rutas-lectura)

**Parte I — Entender qué estamos comparando**

1. [¿Una versión nueva es realmente más rápida?](#introduccion)
2. [¿Qué es realmente .NET?](#que-es-dotnet)
3. [.NET 10 y .NET 11: qué cambia y qué permanece](#versiones)
4. [Cómo hemos realizado las pruebas](#metodologia)

**Parte II — Qué ocurre dentro del runtime**

5. [JIT: del código intermedio a la CPU](#jit)
6. [El experimento de 69 a 3 bytes](#gvm)
7. [Garbage Collector: memoria que se reserva, vive y se libera](#gc)
8. [Async/await: esperar sin ocupar un hilo innecesariamente](#async)

**Parte III — Rendimiento del código que escribimos**

9. [Colecciones y LINQ: elegir qué trabajo hacemos](#colecciones)
10. [Strings, Span y buffers: copiar también cuesta](#strings-span)
11. [JSON: traducir objetos tiene un precio](#json)
12. [Concurrencia, ThreadPool y Channels](#concurrencia)
13. [Reflection, I/O, criptografía y observabilidad](#otras-superficies)

**Parte IV — Aplicaciones reales**

14. [ASP.NET Core: qué ocurre cuando llegan miles de peticiones](#http)
15. [Entity Framework Core 10 frente a 11](#ef-core)
16. [Native AOT: compilar antes de ejecutar](#native-aot)

**Parte V — Nuevas posibilidades y decisiones**

17. [C# 14 frente a C# 15](#csharp)
18. [Migrar una aplicación sin cambiarlo todo a la vez](#migracion)
19. [Los resultados más instructivos](#resultados)
20. [¿Merece la pena actualizar?](#decision)
21. [Conclusión: qué hemos aprendido al medir](#conclusion)
22. [Código fuente y reproducción](#reproduccion)
23. [Glosario](#glosario)
24. [Referencias](#referencias)

</details>

---

**PARTE I — ENTENDER QUÉ ESTAMOS COMPARANDO**

<a id="introduccion"></a>
## 1. ¿Una versión nueva es realmente más rápida?

Cambias la versión de .NET, compilas el mismo proyecto y vuelves a ejecutar la aplicación. No has reescrito su lógica. No has sustituido una consulta ni cambiado el formato de sus respuestas. ¿Puede ir más rápido?

Sí. Pero también puede reservar más memoria, generar un ejecutable mayor o mejorar una operación que apenas influye en el tiempo que espera el usuario. Incluso puede aparecer una diferencia enorme en una prueba pequeña y desaparecer al repetirla.

Esa es la pregunta que guía esta investigación: **qué cambia al pasar de .NET 10 a .NET 11 cuando intentamos mantener constante el trabajo**, y qué parte de lo observado podemos explicar de verdad.

El proyecto reúne 101 métodos distintos de BenchmarkDotNet —pruebas de rendimiento pequeñas y repetibles, o benchmarks—, además de una API HTTP que suma más de 15 millones de peticiones. Una API es una interfaz con la que un programa ofrece operaciones a otros. También hay consultas de Entity Framework Core, aplicaciones publicadas con distintos modos de compilación y ejemplos de C# 14 y C# 15. Hay operaciones que duran nanosegundos y otras que incluyen HTTP, una base de datos o el arranque de un proceso: el [método de lectura](#metodo-lectura) explica por qué no debemos tratarlas como un único cronómetro.

Nos interesa seguir ese cambio desde las instrucciones que ejecuta el procesador hasta las peticiones que recibe un servidor. En medio quedan los objetos que reservan memoria, las esperas asíncronas y las bibliotecas que procesan nuestros datos. Esa cadena permite distinguir una optimización local de un cambio que realmente importa al desplegar.

Un ranking de ganadores perdería la parte importante. Para interpretar esos resultados tenemos que abrir varias capas: el lenguaje que escribimos, el compilador que lo transforma, el runtime que lo ejecuta, las bibliotecas que utilizamos y el entorno donde medimos.

Si no programas habitualmente, puedes seguir el recorrido desde los fundamentos. Los ejemplos pequeños sirven para identificar qué hace cada pieza. Si trabajas con .NET, encontrarás después el código de las sondas, instrucciones ensamblador, condiciones de medida y enlaces a los originales. Los detalles no están escondidos, pero tampoco hace falta empezar por ellos.

El corte de versiones de este artículo es el **12 de noviembre de 2026**. La [investigación técnica original](#evidencia-b82e4d8fdba1) y la [auditoría crítica](#evidencia-0c5cb713ef30) se conservan por separado. Esta versión desarrolla sus explicaciones; no añade benchmarks ni convierte sus límites en certezas nuevas.

La comparación empieza por identificar las piezas que pueden cambiar. Antes de interpretar los resultados, vamos a separar el lenguaje, las herramientas y el motor de ejecución.

**Para contrastar este capítulo:** [Investigación técnica](#evidencia-b82e4d8fdba1) · [Auditoría y alcance](#evidencia-0c5cb713ef30) · [Matriz de trazabilidad](#evidencia-0f1a77641be5).

**Navegación:** [Anterior: Resumen ejecutivo](#resumen-ejecutivo) · [Índice](#indice) · [Siguiente: 2. Qué es .NET](#que-es-dotnet).
<a id="que-es-dotnet"></a>
## 2. ¿Qué es realmente .NET?

Cuando alguien dice «mi aplicación está hecha en .NET», está reuniendo varias cosas bajo un mismo nombre. Separarlas evita buena parte de las confusiones de una migración.

### El lenguaje no es el motor

**C# es un lenguaje de programación.** Permite expresar instrucciones: guardar un dato, sumar cantidades, leer un archivo, responder a una petición. Un método es un bloque con nombre que realiza una operación; una variable es un nombre asociado a un valor o a una referencia.

Este programa autónomo, compatible con C# 14, suma tres cantidades:

```csharp
// Ejemplo autónomo: fundamentos (C# 14, net10.0)
using System;

int[] cantidades = [2, 3, 5];
int total = 0;
foreach (int cantidad in cantidades)
{
    total += cantidad;
}
Console.WriteLine(total);
```

Su salida es `10`. `int[]` representa un array de enteros; `foreach` visita sus elementos; `Console.WriteLine` muestra el resultado. Es un ejemplo didáctico, no la entrada del benchmark de arrays. La operación medida y sus datos están en [CollectionsBenchmarks.cs](#evidencia-0ee69ae7579f).

La CPU —el procesador— no entiende directamente `foreach`, nombres de variables o archivos `.cs`. Ejecuta instrucciones de código máquina propias de una arquitectura, como x64 o Arm64. Entre esas dos representaciones intervienen las demás piezas.

### El SDK: las herramientas para construir

El **SDK**, *Software Development Kit*, es el conjunto de herramientas de desarrollo. Incluye el compilador de C#, herramientas de construcción y comandos como `dotnet build` y `dotnet publish`. También permite restaurar los paquetes de los que depende el proyecto.

El compilador de C# forma parte de **Roslyn**. Comprueba reglas del lenguaje y transforma el programa en una representación intermedia, acompañada de información sobre tipos y métodos. Esa información se llama **metadata**: describe el contenido del ensamblado, no los datos de negocio de una petición.

Un **ensamblado** es una unidad de código .NET, habitualmente un archivo `.dll`. Aunque su extensión coincida con la de otras bibliotecas de Windows, su contenido administrado no tiene por qué ser directamente código máquina.

Instalar el SDK 11 no significa que todas las aplicaciones del equipo empiecen a ejecutarse con el runtime 11. Y un SDK moderno puede construir proyectos para distintas versiones de destino. Son decisiones relacionadas, pero no equivalentes.

### IL: instrucciones intermedias

El **IL**, *Intermediate Language*, es un conjunto de instrucciones diseñado para el entorno .NET. Está más cerca de la ejecución que C#, pero no es aún el conjunto de instrucciones final de una CPU concreta.

Podemos imaginarlo como una representación que conserva lo que el programa quiere hacer sin haber fijado todos los detalles de la máquina donde lo hará. La analogía tiene un límite: el IL no es un texto que un traductor lea palabra a palabra. Forma parte de un formato preciso, con reglas de tipos, llamadas y manejo de excepciones.

La ventaja es que una parte del trabajo puede posponerse hasta conocer la plataforma efectiva. El código de una suma puede acabar usando instrucciones diferentes en x64 y en Arm64, o aprovechar características concretas del procesador.

### El runtime: el entorno que hace funcionar el programa

El **runtime** se ocupa de ejecutar el código administrado y ofrecer servicios que la aplicación necesita: cargar tipos, gestionar excepciones, coordinar memoria, trabajar con hilos y convertir IL en código máquina cuando corresponde.

En las aplicaciones de esta comparación, el runtime es CoreCLR. Uno de sus componentes es el **JIT**, el compilador que genera código máquina durante la ejecución. Otro es el **Garbage Collector**, que recupera memoria administrada que el programa ya no necesita. Los veremos con detalle, pero ya podemos situarlos: no son características de la sintaxis de C#, sino partes de la ejecución.

Se habla de **código administrado** porque participa en ese modelo de servicios y reglas. No significa que sea interpretado línea a línea, ni que no pueda producir instrucciones nativas muy optimizadas.

### La BCL: las herramientas que usa nuestro propio código

La **BCL**, *Base Class Library*, es el conjunto de bibliotecas fundamentales. Incluye tipos y operaciones de uso diario: `string`, colecciones, tareas, archivos, compresión, criptografía y muchas otras.

Cuando escribimos `Console.WriteLine`, `File.ReadAllText` o una consulta LINQ, nuestro código llama a implementaciones de bibliotecas. Esas implementaciones también pueden cambiar entre .NET 10 y .NET 11.

Por tanto, un programa puede mejorar sin cambiar sus archivos C# por al menos dos motivos distintos: el JIT genera mejor código para una operación, o una biblioteca hace su trabajo de otra manera. En ocasiones intervienen ambos, porque el JIT integra y optimiza código de la biblioteca dentro del método que lo llama.

[![Proceso conceptual desde un archivo C# hasta las instrucciones que ejecuta la CPU](/blog/dotnet-10-vs-dotnet-11/01-dotnet-pipeline.png)](/blog/dotnet-10-vs-dotnet-11/01-dotnet-pipeline.png)

*Figura 1. Esquema conceptual, no una captura experimental: C# pasa por el compilador y el IL; en el camino JIT, el runtime produce código máquina para la CPU. El SDK interviene al construir y el runtime al ejecutar. La ruta Native AOT adelanta la compilación nativa y se desarrolla en la sección 16. Fuente: elaboración didáctica a partir de la [metodología](#evidencia-0abaf28a964f) y la [documentación de .NET](https://learn.microsoft.com/dotnet/core/introduction).* 

[Abrir PNG a tamaño completo](/blog/dotnet-10-vs-dotnet-11/01-dotnet-pipeline.png).

### ¿Qué estamos cambiando cuando ponemos `net11.0`?

El **target framework**, o TFM, expresa el conjunto de APIs y el destino .NET para el que construimos un proyecto. `net10.0` y `net11.0` son dos de esos destinos.

Cambiar ese valor puede modificar referencias, código compilado y bibliotecas disponibles. No es simplemente pegar una etiqueta distinta sobre la misma DLL. Tampoco debemos dar por hecho que un binario dirigido a 10 se ejecutará automáticamente sobre 11: la selección y el *roll-forward* del runtime tienen reglas propias.

La investigación utiliza los mismos archivos C# en buena parte de las comparaciones, pero construye cada destino y comprueba el runtime efectivo del proceso. Esa precisión será importante cuando intentemos decidir si una diferencia corresponde al lenguaje, al compilador, al runtime o a los paquetes.

Con las piezas situadas, ya podemos dar significado a las etiquetas 10 y 11. El siguiente paso es fijar qué versiones y qué opciones se comparan realmente.

**Para contrastar este capítulo:** [Ejemplo de operación medida](#evidencia-0ee69ae7579f) · [Metodología](#evidencia-0abaf28a964f) · [Matriz de trazabilidad](#evidencia-0f1a77641be5).

**Navegación:** [Anterior: 1. Introducción](#introduccion) · [Índice](#indice) · [Siguiente: 3. Versiones](#versiones).
<a id="versiones"></a>
## 3. .NET 10 y .NET 11: qué cambia y qué permanece

Una versión nueva no es una única optimización. Es una entrega que reúne cambios de bibliotecas, generación de código, herramientas, compatibilidad y posibilidades del lenguaje.

Estas son las versiones concretas del laboratorio, no nombres genéricos como «la última 10» o «la última 11»:

| Componente | Canal 10 | Canal 11 |
|---|---|---|
| SDK instalado | 10.0.404 | 11.0.100 |
| Runtime `Microsoft.NETCore.App` | 10.0.15 | 11.0.0 |
| Framework web `Microsoft.AspNetCore.App` | 10.0.15 | 11.0.0 |
| Entity Framework Core SQLite | 10.0.15 | 11.0.0, sólo sobre .NET 11 |
| Lenguaje de la suite principal | C# 14 explícito | C# 14 explícito |
| Muestras de novedades de lenguaje | C# 14 | C# 15, con preview de memoria separada |

Fuente: [configuración y lockfiles](#evidencia-b33563055168), [dependencias auditadas](#evidencia-4240917cf8c0) y [metadatos oficiales de releases](https://builds.dotnet.microsoft.com/dotnet/release-metadata/releases-index.json).

La suite principal se construye con **SDK 11 en ambos destinos**. Mantener C# 14 reduce un factor de variación, pero no devuelve Roslyn a la versión que llevaba el SDK 10 ni garantiza que todo el IL sea idéntico. El experimento específico del SDK, que veremos más adelante, es otra comparación.

### LTS y STS: importa la fecha, no sólo la etiqueta

.NET 11 alcanzó disponibilidad general, **GA**, el 10 de noviembre de 2026. .NET 10 es LTS, con tres años de soporte desde su entrega inicial; .NET 11 es STS, con dos años según la política vigente en este corte.

Hay un detalle poco intuitivo: **ambos canales terminan su soporte el 14 de noviembre de 2028**. .NET 10 comenzó antes. Por tanto, al comparar estas dos versiones en noviembre de 2026 no es correcto afirmar que quedarse en 10 proporciona automáticamente más años restantes.

STS tampoco significa «una versión de peor calidad». Las políticas de calidad y mantenimiento son las mismas; cambia la duración del ciclo. Para conservar soporte hay que aplicar las actualizaciones correspondientes. Las versiones se fijan aquí para poder comparar, no como recomendación de congelar los parches de producción.

Fuentes: [anuncio de .NET 11](https://devblogs.microsoft.com/dotnet/announcing-dotnet-11/) y [política oficial de soporte](https://dotnet.microsoft.com/platform/support/policy/dotnet-core).

El artículo de rendimiento de Stephen Toub es una fuente útil para localizar mecanismos y PRs, pero sus pruebas usan **11.0.0-rc.1.26425.128 y 10.0.12**, anteriores a nuestra pareja GA. RC es una versión candidata previa a la entrega general. Sus cifras y su ensamblador son evidencia externa, no nuestros resultados ni una garantía de cómo se comporta la versión final. [Configuración original de Microsoft](https://devblogs.microsoft.com/dotnet/performance-improvements-in-net-11/).

### Tres clases de novedad que conviene separar

**Cambios transparentes.** El programa conserva su forma de trabajar y puede beneficiarse de código generado diferente o de mejoras internas de una biblioteca. La eliminación de trabajo redundante del JIT entra en esta categoría, siempre que aparezca el patrón que el optimizador reconoce.

**APIs o sintaxis nuevas.** Una operación como `FullJoin`, una union de C# 15 o un adaptador de memoria requiere escribir código que la utilice. Su existencia puede simplificar un problema, pero no acelera por sí misma todos los programas anteriores.

**Opciones de compilación y despliegue.** Activar Runtime Async en código propio, publicar Native AOT o cambiar el modo del GC modifica el tratamiento. No debemos presentar el efecto de activarlo sólo en un lado como una mejora inevitable de versión.

Runtime Async de la aplicación y las nuevas reglas de *memory safety* siguen siendo **preview** en esta investigación. El runtime que las contiene es estable; eso no convierte cualquier opción experimental en una recomendación para producción. Tampoco implica que el comportamiento predeterminado de todas las bibliotecas sea el del código propio.

### ¿Y lo que no cabe en un benchmark?

.NET 11 también tiene implicaciones de compatibilidad: requisitos de CPU, cambios de comportamiento, proveedores de datos, herramientas de diagnóstico e imágenes de contenedor. Una aplicación que no arranca en sus máquinas de destino no obtiene ningún beneficio de un bucle más rápido.

Compatibilidad, dependencias, datos y posibilidad de volver atrás forman parte de la decisión; retomaremos esos puntos al preparar la migración. Antes necesitamos saber cómo se midió cada tratamiento y qué incertidumbre conserva.

**Para contrastar este capítulo:** [Versiones y separación de factores](#evidencia-b33563055168) · [Dependencias auditadas](#evidencia-4240917cf8c0) · [Matriz de trazabilidad](#evidencia-0f1a77641be5).

**Navegación:** [Anterior: 2. Qué es .NET](#que-es-dotnet) · [Índice](#indice) · [Siguiente: 4. Metodología](#metodologia).
<a id="metodologia"></a>
## 4. Cómo hemos realizado las pruebas

Medir parece sencillo: arrancar un cronómetro, ejecutar una operación y mirar cuánto tarda. El problema es que el ordenador también está haciendo otras cosas y que el programa cambia de estado mientras se ejecuta.

La primera llamada puede incluir compilación JIT o preparación de metadata. Una lectura puede llegar del disco o de una caché de RAM. Un trabajo puede quedar esperando un hilo disponible. Si comparamos situaciones distintas, el cronómetro es preciso al medir algo que no era nuestra pregunta.

<a id="metodo-lectura"></a>
### Método de lectura: las reglas comunes de todo el artículo

Estos cinco criterios permiten leer las cifras en su contexto. Se aplican a todos los experimentos; las limitaciones que cambian la interpretación de una cifra permanecen junto a ella y en sus pies de figura.

1. **Compara el mismo trabajo.** Menos tiempo sólo interesa si se conserva el resultado y el contrato. Preparar una estructura, reutilizarla o cambiar el algoritmo son tratamientos distintos de actualizar el runtime. Los ejemplos didácticos explican el mecanismo; sólo los originales enlazados documentan la operación medida.
2. **Sitúa cada cifra en su campaña.** Versión efectiva, entrada, configuración, entorno, orden y unidad de repetición forman parte del resultado. No juntes iteraciones, procesos o campañas distintas como si fuesen réplicas intercambiables; tampoco conviertas una selección de filas en un promedio de rendimiento de .NET.
3. **Distingue observar, explicar y atribuir.** Una diferencia local no es una promesa para toda aplicación. El ensamblador puede mostrar trabajo eliminado; un PR puede explicar un mecanismo compatible. Ninguno aísla por sí solo la causa de todos los cambios entre dos versiones. Cuando falta una intervención causal, la explicación queda abierta.
4. **Separa las dimensiones y los tratamientos.** Tiempo, throughput, asignaciones, residencia, tamaño y arranque responden preguntas diferentes. La mejora de una no garantiza las demás. Runtime estable, lenguaje estable y opt-ins preview tampoco son una única decisión.
5. **Lee el tipo de evidencia.** Un control funcional acredita comportamiento, no velocidad. Una comprobación estática contrasta archivos o cálculos, no ejecuta un benchmark. Una guía documental no prueba una plataforma, herramienta o despliegue que no se haya ejercitado. Un hash tampoco reconstruye fuentes históricas ausentes.

Al aplicar estos criterios a producción, utiliza el contrato, los datos y el entorno de tu aplicación; el laboratorio no los sustituye.

### El ordenador de estas cifras

Las campañas se ejecutaron en Windows 11 Pro x64, en un Lenovo con Intel Core i5-1135G7, cuatro núcleos físicos y ocho procesadores lógicos. El inventario registra 16.952.647.680 bytes de RAM física y presencia de hipervisor.

No era un servidor dedicado. No se reservaron núcleos exclusivos, no se detuvieron servicios ajenos y no se vació la caché del sistema operativo. Al comenzar la campaña principal quedaban aproximadamente **376 MiB de memoria libre** según CIM. Eso indica poco margen en ese momento; no mide cuánto se paginó ni demuestra que fuese la causa de un resultado.

La frecuencia instantánea de una CPU tampoco prueba que haya mantenido esa frecuencia durante todas las medidas. El ahorro energético, el turbo, la temperatura y otras aplicaciones pueden introducir diferencias entre procesos. Registrar el entorno permite ver el límite; no lo hace desaparecer.

El [snapshot original](#evidencia-eae7c22ee92c) conserva esos datos. El blog utiliza gráficos y capturas seleccionados sin rutas personales visibles; el conjunto histórico completo necesita una revisión de privacidad independiente antes de publicarse íntegramente.

### Qué hace BenchmarkDotNet por nosotros

**BenchmarkDotNet**, BDN en las tablas, es una herramienta que construye y ejecuta pruebas de rendimiento en procesos separados. Prepara el escenario, realiza calentamientos, estima cuántas invocaciones necesita y mide varias iteraciones. También ayuda a detectar ciertos errores de configuración y a conservar resultados detallados.

El proyecto utiliza **0.16.0-preview.1** porque el intento con 0.15.8 falló al reconocer el runtime 11 con la configuración empleada. La herramienta es preview en los dos lados; los runtimes son GA. No se desactivó el validador para forzar una tabla.

El protocolo habitual pide seis iteraciones de calentamiento y quince de medida, con un objetivo de 250 ms por iteración y un lanzamiento por job. Una **iteración** puede repetir la operación muchas veces. Un **job** es un caso con una configuración concreta; no es otro método de negocio.

Por eso 101 métodos generan muchos más registros: hay dos runtimes, tamaños de entrada, números de consumidores y tratamientos. Los 101 se reparten en 88 métodos principales, siete de Runtime Async, cinco sondas JIT y uno de OpenTelemetry. No equivalen a 101 aplicaciones completas ni a 101 réplicas independientes de cada conclusión.

La campaña principal contiene 176 jobs. El barrido adicional selecciona 29 métodos y combina sus tamaños o workers en 134 jobs, 67 pares entre versiones. Son dimensiones de la prueba, no 134 algoritmos distintos. Sus datos se mantienen separados para no comparar una entrada pequeña con una grande.

El GC Workstation concurrente, la compilación por niveles y Dynamic PGO —optimización con perfiles recogidos durante la ejecución— están habilitados de forma comparable en los jobs generales. Las variantes Server GC y los diagnósticos están identificados por separado. Se comprueba la versión efectiva del proceso hijo: una lista de runtimes instalados no demuestra cuál estaba ejecutándose.

### Antes de preguntar cuánto tarda, preguntamos si hace lo correcto

Un método que no produce el resultado esperado no ha mejorado el rendimiento: ha dejado de hacer el trabajo.

Las pruebas de corrección comprueban sumas, bytes, propiedades JSON, cardinalidades, cancelación, excepciones y cambios de estado. El productor/consumidor debe procesar todos los enteros. Descomprimir debe recuperar exactamente los bytes de entrada. Una escritura EF con rollback debe devolver la base a su estado anterior.

Las aserciones se separan del tiempo cuando no forman parte del contrato medido. Si la operación estudiada consiste en crear un array, una tarea o un proveedor criptográfico, su creación sí pertenece a la medida. Lo importante no es eliminar todos los costes de preparación, sino definir cuáles son la operación.

Un **checksum** es un valor de comprobación calculado sobre el resultado; varias fixtures usan sumas con una referencia independiente. Detecta diferencias que alterarían ese valor, pero no garantiza por sí solo identidad de cualquier contenido ni seguridad criptográfica. Cuando el contrato exige bytes idénticos, se comparan también esos bytes.

Además, el resultado debe permanecer observable. Si un compilador demuestra que un cálculo no afecta a nada, puede eliminarlo. En el caso de 69 a 3 bytes distinguiremos esa trampa de una optimización legítima: conservar el resultado y demostrar que sobran pasos para producirlo.

### Unidades para no perdernos entre ceros

| Unidad o métrica | Qué expresa | Cómo leerla |
|---|---|---|
| ms, milisegundo | Una milésima de segundo | Habitual en arranque, HTTP o base de datos. |
| µs, microsegundo | Una millonésima de segundo | Útil para operaciones pequeñas o lotes cortos. |
| ns, nanosegundo | Una milmillonésima de segundo | Escala de sondas muy pequeñas; el contexto experimental importa mucho. |
| B/op | Bytes administrados asignados por operación | No son RAM residente, tamaño de ejecutable ni memoria nativa. |
| Peticiones/s | Respuestas completadas por segundo | Es throughput; mayor puede ser mejor si conserva errores y calidad. |
| P50, P95 y P99 | Umbrales de la distribución de latencias | Aproximadamente el 50%, 95% y 99% de las peticiones de esa ejecución queda por debajo de cada valor. |

Una operación de 2 ns no significa que una petición HTTP completa se resuelva en 2 ns. Puede ser sólo una llamada pequeña, repetida para estimar su coste. Y una buena media HTTP puede convivir con una minoría de respuestas muy lentas: de ahí que interesen P95 y P99.

**Menos tiempo y más throughput no comparten automáticamente el porcentaje.** Si una operación hipotética pasa de 1 ms a 0,8 ms, tarda un 20% menos. En condiciones ideales y sin otro cuello de botella permitiría pasar de 1000 a 1250 operaciones/s: un 25% más. Es un ejemplo aritmético, no una medición del laboratorio.

### La media necesita compañía

`Mean` es la media; `Median`, la mediana; `StdDev`, una medida de dispersión. `Error` en BDN es la semiamplitud del intervalo de confianza que declara la herramienta, aquí del 99,9%. No es lo mismo que la desviación estándar y no significa «el resultado será igual en el 99,9% de los ordenadores».

Quince iteraciones del mismo proceso no son quince despliegues independientes. Los intervalos describen incertidumbre dentro de ese modelo de medida, no todos los cambios posibles del host. Algunas filas conservan menos de quince observaciones porque BDN aplica su política de outliers; los originales y avisos se mantienen.

Tampoco convertimos el solapamiento de dos intervalos en un test estadístico. Para decisiones pequeñas importan las réplicas independientes y la relevancia práctica, no sólo el signo de los decimales.

Las pruebas de EF y de arranque utilizan protocolos propios. Sus rangos no se rebautizan como intervalos BDN. Los percentiles HTTP pertenecen a cada ejecución: promediar dos P99 no reconstruye el P99 de todas sus peticiones.

### De una cifra a su evidencia

El recorrido deseable es artículo → código → original → entorno → commit. La [matriz de trazabilidad](#evidencia-0f1a77641be5) permite seguirlo, pero también documenta sus huecos: algunas campañas comenzaron antes del primer commit o capturaron un estado con cambios pendientes que no se conserva íntegramente.

La auditoría realizó **4042 comprobaciones estáticas correctas** sobre datos y estructuras conservadas. No son 4042 benchmarks nuevos, una repetición independiente de todo el laboratorio ni una demostración de causalidad. Un hash ayuda a contrastar un archivo; no reconstruye una fuente ausente.

Con ese marco, podemos mirar los resultados sin pedirles más de lo que contienen. Un microbenchmark sirve para aislar una pregunta pequeña. La API, EF y la publicación añaden preguntas distintas, no una licencia para extrapolar cualquier nanosegundo a producción.

Con las reglas y las unidades claras, podemos empezar por una evidencia que deja ver el trabajo realizado: las instrucciones que genera el JIT.

**Para contrastar este capítulo:** [Metodología completa](#evidencia-0abaf28a964f) · [Entorno principal](#evidencia-eae7c22ee92c) · [Matriz de trazabilidad](#evidencia-0f1a77641be5).

**Navegación:** [Anterior: 3. Versiones](#versiones) · [Índice](#indice) · [Siguiente: 5. JIT](#jit).

---

**PARTE II — QUÉ OCURRE DENTRO DEL RUNTIME**

<a id="jit"></a>
## 5. JIT: del código intermedio a la CPU

Ya sabemos que el compilador de C# produce IL. Falta resolver una pregunta: ¿quién convierte esas instrucciones en algo ejecutable por el procesador que tenemos delante?

En el camino habitual de estas aplicaciones, lo hace el **JIT**, *Just-In-Time compiler*. Cuando un método necesita código nativo, el runtime puede pedir al JIT que lo compile. No se traduce de nuevo cada instrucción C# cada vez que se ejecuta: el código nativo generado puede reutilizarse.

Es parecido a un traductor que adapta unas instrucciones al lugar donde se van a utilizar. La parte útil de la analogía es la adaptación al destino. La parte que no debemos tomar literalmente es que el JIT no está leyendo prosa ni improvisando significado: transforma un programa sujeto a reglas precisas y debe conservar su comportamiento observable.

### ¿Por qué no generar siempre todo de antemano?

Compilar durante la ejecución tiene un coste de arranque, pero ofrece información sobre la máquina y permite optimizaciones guiadas por lo que sucede. El equilibrio depende de la aplicación. Un servicio que vive días puede amortizar ese trabajo; una herramienta que se inicia muchas veces para una operación corta puede notar más el arranque.

No es una elección absoluta entre «JIT lento» y «nativo rápido». ReadyToRun puede adelantar parte de la compilación y conservar el JIT. Native AOT cambia más profundamente la distribución. Antes de comparar sus tamaños y arranques conviene entender qué puede hacer el JIT con un método pequeño.

[![Esquema conceptual de cómo un contexto conocido habilita desvirtualización, inlining y simplificación](/blog/dotnet-10-vs-dotnet-11/02-jit-pipeline.png)](/blog/dotnet-10-vs-dotnet-11/02-jit-pipeline.png)

*Figura 2. Diagrama didáctico de oportunidades de optimización, no una traza ni un orden contractual de fases. Conocer el receptor permite razonar sobre la llamada y el trabajo necesario; el resultado depende del patrón. Fuente: [diseño del JIT de CoreCLR](https://github.com/dotnet/runtime/tree/main/docs/design/coreclr/jit) y [configuración de las sondas](#evidencia-1014f76afffd).*

[Abrir PNG a tamaño completo](/blog/dotnet-10-vs-dotnet-11/02-jit-pipeline.png).

### Compilar rápido al principio, optimizar después

Con **tiered compilation**, la compilación por niveles, el runtime puede generar inicialmente una versión menos costosa de compilar y producir después una versión más optimizada de un método utilizado con frecuencia.

**PGO**, *Profile-Guided Optimization*, utiliza información del comportamiento del programa para orientar decisiones. Dynamic PGO recoge perfiles durante la ejecución: por ejemplo, qué tipos aparecen en un punto donde podrían llegar implementaciones distintas.

Esto no autoriza a ignorar casos poco frecuentes. Si una optimización se apoya en que un receptor suele ser de cierto tipo, puede necesitar una comprobación y un camino alternativo correcto cuando aparezca otro. Un perfil probable no es una garantía lógica.

En las campañas generales tiering y Dynamic PGO estaban habilitados en ambos runtimes. Eso controla la configuración solicitada; no demuestra qué porcentaje de una diferencia se debe a PGO. Para contestar esa otra pregunta haría falta una intervención específica que aquí no se realizó.

### Inlining: quitar una frontera para poder ver más

Una llamada a un método supone preparar argumentos y transferir el control a otro bloque. El **inlining** consiste en integrar el cuerpo de un método en el punto que lo llama, cuando el compilador considera que conviene.

Imagina una función que devuelve el doble de un entero:

```csharp
// Fragmento didáctico: equivalencia, no ensamblador capturado.
static int Doble(int valor) => valor * 2;
```

En un punto que usa `Doble(entrada)`, integrar el cuerpo permite razonar sobre `entrada * 2` junto al código de alrededor. Lo interesante no es sólo ahorrarse una llamada: pueden quedar visibles constantes, condiciones redundantes u objetos que no necesitan existir.

No significa que integrar todos los métodos sea mejor. El código puede crecer, aumentar la presión sobre registros o perjudicar la caché de instrucciones. El JIT utiliza criterios de coste y beneficio. Tampoco `AggressiveInlining` es una orden que garantice la integración en cualquier circunstancia.

`NoInlining`, en cambio, sirve en nuestras sondas para conservar una frontera deliberada. Si queremos inspeccionar un kernel concreto, no nos interesa que desaparezca sin más dentro de todo el harness. Un kernel es aquí el pequeño núcleo de operación que estamos estudiando, no el núcleo del sistema operativo.

### Métodos virtuales: elegir una implementación

Un método **virtual** permite que distintos tipos proporcionen implementaciones de una misma operación. El código que llama puede conocer una base común sin saber todavía el tipo concreto.

Eso resulta útil: una aplicación puede manejar diferentes proveedores, transformaciones o estrategias mediante un contrato común. El coste potencial es que la llamada necesite resolver a qué implementación debe dirigirse. Además, mientras el destino sea desconocido, hay menos oportunidades de integrar su cuerpo.

La **desvirtualización** consiste en resolver ese destino cuando el compilador dispone de información suficiente. Puede ser una certeza —el objeto acaba de crearse con un tipo concreto— o un camino especializado protegido por una comprobación. No son situaciones intercambiables.

Un método **genérico** añade parámetros de tipo: `Echo<T>` puede trabajar con un entero, un texto u otro tipo. El tratamiento interno de esos casos no es siempre igual. La sonda de la siguiente sección utiliza un método virtual genérico no compartido con `int`; no representa cualquier combinación de genéricos y polimorfismo.

### Bounds checks: seguridad que a veces puede demostrarse sin repetir

Cuando accedemos a `array[i]`, hay que respetar sus límites. Si `i` no identifica un elemento válido, el programa debe seguir el comportamiento de error correspondiente, no leer otra parte de memoria.

Un **bounds check** es una comprobación de ese límite. Un buen compilador puede evitar comprobaciones repetidas cuando ya ha demostrado que el acceso es válido. Eso no significa retirar la seguridad, sino demostrarla con menos trabajo en tiempo de ejecución.

El siguiente programa autónomo reproduce el cuerpo de búsqueda de la sonda, con una envoltura de consola didáctica:

```csharp
// Ejemplo autónomo: lookahead (C# 14, net10.0)
using System;
using System.Runtime.CompilerServices;

Console.WriteLine(LookAhead("x%FF"));
Console.WriteLine(LookAhead("%F"));

[MethodImpl(MethodImplOptions.NoInlining)]
static bool LookAhead(ReadOnlySpan<char> span)
{
    for (int i = 0; i < span.Length; i++)
        if (span[i] == '%' && (uint)(i + 2) < (uint)span.Length
            && span[i + 1] == 'F' && span[i + 2] == 'F')
            return true;
    return false;
}
```

La salida es `True` y `False`. El segundo caso termina con un patrón truncado: no hay dos caracteres disponibles después de `%`.

La condición sobre `i+2` protege la lectura adelantada. Si ese índice cabe y se conocen los rangos adecuados, el compilador puede razonar también sobre `i+1`. No es lo mismo que comparar un bucle que siempre recorre todo con otro que sale al encontrar una coincidencia: aquí se preserva la misma búsqueda y su salida temprana.

En el ensamblador local, el kernel LookAhead pasó de **102 a 66 bytes**. En .NET 10 aparecía esta comprobación antes de leer `i+1`:

```assembly
; Fragmento real del kernel .NET 10; no es el método completo.
lea       r10d,[rdx+1]
cmp       r10d,ecx
jae       short 0000000000002840
lea       r10d,[rdx+1]
cmp       word ptr [rax+r10*2],46
```

En el fragmento correspondiente de .NET 11:

```assembly
lea       r10d,[rdx+1]
cmp       word ptr [rax+r10*2],46
```

Para leerlo sin conocer ensamblador: `lea` calcula una dirección o expresión de índice; `cmp` compara; `jae` es un salto condicionado. Lo relevante es que desaparece una comparación y su camino de error redundante. **El guard de `i+2` sigue presente.**

El [PR 124242](https://github.com/dotnet/runtime/pull/124242) describe ese patrón de optimización. Nuestro resultado sale de [las sondas propias](#evidencia-1014f76afffd) y del [ensamblador original](#evidencia-30c35e8cd5bc), no del ejemplo de código máquina del PR.

### Resolver una pregunta conocida antes de ejecutarla

El **constant folding** resuelve una expresión cuyo resultado puede determinarse de antemano. En vez de repetir el cálculo, se utiliza su resultado.

La sonda ConstantUnequal compara dos textos constantes distintos, obtenidos mediante getters: `"abcdef"` y `"bcdefg"`. Tras integrar los caminos relevantes, .NET 11 puede reducir el kernel a:

```assembly
xor       eax,eax
ret
```

`xor eax,eax` deja a cero el registro utilizado para devolver el resultado; aquí representa `false`. `ret` vuelve al llamador. Son **3 bytes**, frente a **51** en el kernel inspeccionado de .NET 10.

El [PR 121985](https://github.com/dotnet/runtime/pull/121985) trabaja sobre `SequenceEqual` con ayuda de **value numbering**, una técnica para identificar valores y equivalencias en el programa. La explicación no es «comparar cualquier texto ahora cuesta casi nada». Estas entradas son conocidas; la sonda DynamicEqual conserva comparación efectiva para cadenas construidas durante la ejecución.

El benchmark constante sigue teniendo una llamada `NoInlining`; su media fue 2,489 ns en 10 y 2,034 ns en 11, no cero. Mide lo que queda de ese camino, no el ancho de banda de comparar documentos. [Medias, Error y muestras](#evidencia-b389f565c315).

### SIMD: varias operaciones dentro de una instrucción

**SIMD** significa realizar una operación sobre varios datos a la vez. Es útil, por ejemplo, al sumar bloques de enteros o procesar buffers. No consiste en crear varios hilos: es paralelismo de datos dentro de instrucciones del procesador.

La sonda SIMD general utiliza vectores explícitos. En ambos runtimes se observa `vpaddd ymm6,ymm6,[rax+rcx*4+10]` y el avance de ocho enteros por paso: instrucciones vectoriales de 256 bits. La presencia de una capacidad AVX512 en el proceso no obliga a que ese `Vector<int>` use 512 bits.

El kernel pasó de 181 a 173 bytes; otros controles conservaron tamaños: SpanLoop 57, ConcreteDispatch 54, BoundsLoop 70 e InterfaceDispatch 95 bytes. El camino rápido de tipo de este último ya existía en ambos. Son detalles que impiden atribuir toda diferencia a una novedad exclusiva de 11.

La [captura general de seis métodos](#evidencia-4dda7b72f5af) acredita instrucciones, no una mejora universal de todos los bucles ni un experimento de autovectorización. Reducir instrucciones y reducir tiempo están relacionados, pero no son la misma medida.

Estas optimizaciones importan cuando aparecen en un camino frecuente, no sólo cuando reducen una lista de instrucciones. El siguiente experimento reúne receptor conocido, inlining y eliminación de trabajo en un único caso observable.

**Para contrastar este capítulo:** [Sondas JIT](#evidencia-1014f76afffd) · [Ensamblador de los kernels](#evidencia-30c35e8cd5bc) · [Registros temporales](#evidencia-b389f565c315) · [Matriz de trazabilidad](#evidencia-0f1a77641be5).

**Navegación:** [Anterior: 4. Metodología](#metodologia) · [Índice](#indice) · [Siguiente: 6. De 69 a 3 bytes](#gvm).
<a id="gvm"></a>
## 6. El experimento de 69 a 3 bytes

Tenemos las piezas para entender el resultado más llamativo del código generado. Ahora podemos plantearlo sin magia: ¿qué ocurre si creamos un objeto, lo usamos mediante una base abstracta y llamamos a un método genérico que sólo devuelve su argumento?

El siguiente programa es autónomo. Conserva los tipos y el cuerpo del kernel de la investigación, añadiendo únicamente una llamada de consola fuera de él. **No es el ejecutable BenchmarkDotNet que produjo los tiempos.**

```csharp
// Ejemplo autónomo: gvm (C# 14, net10.0)
using System;
using System.Runtime.CompilerServices;

Console.WriteLine(PrJitKernels.GenericVirtual(42));

public abstract class EchoBase
{
    public abstract T Echo<T>(T value);
}

public sealed class Echoer : EchoBase
{
    [MethodImpl(MethodImplOptions.AggressiveInlining)]
    public override T Echo<T>(T value) => value;
}

public static class PrJitKernels
{
    [MethodImpl(MethodImplOptions.NoInlining)]
    public static int GenericVirtual(int input)
    {
        EchoBase receiver = new Echoer();
        return receiver.Echo(input);
    }
}
```

La salida es `42`. `EchoBase` establece el contrato; `Echoer` lo implementa; `<T>` permite devolver el mismo tipo recibido. El objeto se crea dentro del método, no procede de un proveedor desconocido ni cambia de implementación según la entrada.

Esa última condición es decisiva. Aunque la variable esté declarada como `EchoBase`, el compilador puede conocer que contiene un `Echoer` recién construido. Si resuelve `Echo<int>`, integra su cuerpo y comprueba que el objeto no aporta ningún efecto observable, quedan oportunidades de eliminar pasos.

### Qué conservaba el camino de .NET 10

El kernel nativo inspeccionado de .NET 10 ocupaba 69 bytes. Incluía creación del objeto, resolución del método genérico y una llamada indirecta `call rax`. No basta con contar una llamada virtual en el C#: el coste del camino incluye también preparar y resolver ese destino.

El kernel de .NET 11 contiene:

```assembly
mov       eax,ecx
ret
```

En este contexto x64, el argumento entero llega en `ecx` y el resultado se devuelve en `eax`. `mov` copia el valor al registro de salida y `ret` retorna. No se devuelve un `42` fijo: **se devuelve el argumento recibido**.

[![Comparación didáctica del código C# del receptor conocido y los caminos nativos observados en las dos versiones](/blog/dotnet-10-vs-dotnet-11/03-gvm-code.png)](/blog/dotnet-10-vs-dotnet-11/03-gvm-code.png)

*Figura 3. Transcripción didáctica basada en código y ensamblador reales, no una captura de terminal. Los tamaños 69 y 3 corresponden al kernel GenericVirtual; el wrapper BDN conserva 19 bytes en ambos runtimes. Fuente: [PrJitKernels y PrJitConstants](#evidencia-1014f76afffd) y [asm local](#evidencia-30c35e8cd5bc).*

[Abrir PNG a tamaño completo](/blog/dotnet-10-vs-dotnet-11/03-gvm-code.png).

### ¿Se ha perdido el trabajo o se ha demostrado que sobraba?

Es una distinción fundamental en una prueba de rendimiento.

Si calculásemos algo y nunca utilizásemos su resultado, el compilador podría eliminarlo por completo. Estaríamos midiendo una operación distinta de la que creemos.

Aquí el wrapper real tiene un campo `input`, llama al kernel `NoInlining` y devuelve su resultado:

```csharp
// Fragmento real de PrJitConstants; pertenece a la clase del benchmark.
private int input = 42;
[Benchmark]
public int NonSharedGenericVirtual() => PrJitKernels.GenericVirtual(input);
```

El ensamblador del wrapper carga ese campo y conserva la llamada en las dos versiones. Su tamaño es 19 bytes en ambos casos. Las comprobaciones funcionales del kernel incluyen `int.MinValue`, `-1`, `0`, `42` e `int.MaxValue`.

No se ha eliminado el resultado. Se ha simplificado la forma de producirlo. El objeto temporal no escapa, su identidad no se observa y su implementación devuelve el mismo argumento. Materializarlo deja de ser necesario para conservar ese comportamiento.

### Los bytes de código y los bytes asignados cuentan cosas distintas

Los **69 → 3 bytes** describen instrucciones nativas del kernel. Los **24 → 0 B/op** describen memoria administrada asignada por operación. No son dos formas de medir el mismo tamaño.

Un objeto administrado no ocupa sólo sus posibles campos de negocio: hay estructura y alineación del runtime. La asignación observada de 24 bytes en el camino de 10 desaparece en el de 11 al no materializarse ese objeto. No hemos demostrado que cualquier objeto sin campos o cualquier llamada genérica termine así.

[![Resultados del kernel virtual genérico, con tiempos y asignaciones separados por unidades](/blog/dotnet-10-vs-dotnet-11/04-gvm-measurements.png)](/blog/dotnet-10-vs-dotnet-11/04-gvm-measurements.png)

*Figura 4. Resultado propio del patrón de receptor conocido. Media de 10,578 a 2,298 ns; Error BDN de 1,415 y 0,017 ns, con 15 y 13 observaciones utilizadas; 24 a 0 B/op. Tiempo y asignación se indican como métricas distintas. Es una campaña con diagnóstico de ensamblador, no una aceleración prometida para toda la aplicación. Fuente: [BDN original](#evidencia-29f7b27309c9).*

[Abrir PNG a tamaño completo](/blog/dotnet-10-vs-dotnet-11/04-gvm-measurements.png).

### Qué permite concluir y qué no

Permite afirmar que **este código**, con un receptor conocido y un método genérico no compartido, tiene esos cuerpos nativos y esas asignaciones en las versiones examinadas. El IL de los cuatro kernels inspeccionados era idéntico entre los dos destinos, con hashes conservados.

No permite asegurar que los runtimes sólo difieran en el [PR 122023](https://github.com/dotnet/runtime/pull/122023), ni que toda la BCL y metadata sean iguales. Tampoco cubre todos los genéricos compartidos, receptores polimórficos o Native AOT: ese PR inicial no tenía ese alcance.

Para un desarrollador, la lección no es sustituir clases por código manual en cada punto. Es comprender qué información facilita optimizar una abstracción y cuándo falta esa información. Una abstracción pequeña y bien conocida puede desaparecer; una llamada abierta a implementaciones arbitrarias puede conservar un coste real.

Evitar aquel objeto conecta el código generado con otra pregunta práctica: cuánto reservamos, cuánto conservamos y quién recupera la memoria. El GC necesita esas distinciones.

**Para contrastar este capítulo:** [Kernel y wrapper GVM](#evidencia-1014f76afffd) · [Ensamblador original](#evidencia-30c35e8cd5bc) · [BDN original](#evidencia-29f7b27309c9) · [Matriz de trazabilidad](#evidencia-0f1a77641be5).

**Navegación:** [Anterior: 5. JIT](#jit) · [Índice](#indice) · [Siguiente: 7. GC y memoria](#gc).
<a id="gc"></a>
## 7. Garbage Collector: memoria que se reserva, vive y se libera

Un programa no sólo ejecuta instrucciones. También necesita espacio para sus datos. Puede crear una respuesta JSON, un array, una tarea o un objeto que representa una consulta. Si hace ese trabajo muchas veces, la forma de gestionar memoria acaba influyendo en el tiempo y en la estabilidad.

Una **allocation**, o asignación, reserva espacio para un dato. No es lo mismo que cambiar el valor de una variable. Y reservar memoria no implica que esa memoria vaya a devolverse inmediatamente al sistema operativo cuando dejemos de usarla.

### Stack y heap sin una regla falsa

El **stack** o pila está relacionado con los marcos de ejecución de las llamadas: información para continuar, argumentos y valores temporales según el código generado. El **heap administrado** es el espacio donde el runtime gestiona muchos de los objetos que pueden sobrevivir a una llamada.

La simplificación «los tipos valor viven en el stack y las clases en el heap» lleva a errores. Un valor puede estar dentro de un objeto, un dato puede acabar en registros y una asignación que parecía necesaria en C# puede eliminarse, como acabamos de ver. La ubicación efectiva depende de cómo se utiliza y compila el programa.

El **Garbage Collector**, GC, recupera memoria de objetos que dejan de ser alcanzables desde las referencias que el programa conserva. No necesita que escribamos un `free` para cada objeto administrado. Pero eso no convierte en gratis crear millones de objetos.

Tampoco sustituye a cerrar recursos. Un archivo, una conexión o un identificador nativo puede necesitar `Dispose` y una construcción `using` para liberarse a tiempo. «El GC ya se encargará» no es una política adecuada para todo recurso.

### Qué son las generaciones

Muchas aplicaciones crean numerosos objetos de vida corta. El GC aprovecha esa regularidad agrupando el heap administrado en generaciones.

Los objetos nuevos suelen empezar en la generación 0. Los que sobreviven pueden promocionar a generaciones posteriores. La generación 2 reúne objetos de vida más larga y forma parte de las colecciones más amplias. Los detalles varían con el modo y las circunstancias, pero la idea es evitar examinar siempre todo con el mismo coste.

Una **pausa de GC** es un intervalo en que se detiene trabajo administrado para realizar alguna fase de la colección. Puede haber trabajo concurrente, pero «concurrente» no significa «sin pausas». Además de pausas, recoger memoria consume CPU y puede afectar a cachés y residencia.

Workstation GC y Server GC son modos con decisiones distintas sobre heaps y trabajo de recolección. Server puede aprovechar paralelismo y recursos de forma diferente; no es un botón que haga mejor cualquier programa, sobre todo en una máquina compartida.

### El LOH y los huecos que quedan entre objetos

El **Large Object Heap**, LOH, gestiona objetos grandes; el umbral habitual por defecto está alrededor de 85.000 bytes de tamaño del objeto. Los buffers de 128.000 bytes del control entran claramente en ese terreno.

Una analogía útil es una estantería con cajas. Retirar algunas deja huecos; que haya espacio libre en total no garantiza que esté distribuido como necesitamos. Compactar reorganiza el contenido para reunir espacio. La analogía no describe todos los algoritmos del GC ni significa que cada colección compacte todas las zonas.

El control del proyecto crea deliberadamente huecos: retiene buffers alternos, solicita una colección sin compactación LOH y después pide una compactación explícita. Se ejecutó en cuatro procesos: dos runtimes por Workstation/Server, comprobando el modo efectivo en cada hijo.

[![Fragmentación LOH antes y después de una compactación solicitada en los cuatro tratamientos](/blog/dotnet-10-vs-dotnet-11/05-gc-fragmentation.png)](/blog/dotnet-10-vs-dotnet-11/05-gc-fragmentation.png)

*Figura 5. Intervención artificial, un proceso por tratamiento. Los huecos observados, alrededor de 8,1 millones de bytes, se reducen a unos 4,4–4,6 miles tras la compactación explícita. No es un ranking de pausas ni una recomendación de forzar GC por petición. Fuente: [protocolo](#evidencia-66ac6b003d1b) y [resultados originales](#evidencia-eb1002fa9057).*

[Abrir PNG a tamaño completo](/blog/dotnet-10-vs-dotnet-11/05-gc-fragmentation.png).

La ventana de presión asigna y escribe 2000 buffers, mantiene 64 vivos y registra 256.048.000 bytes asignados en cada tratamiento. Se preservan los checksums después de compactar: reducir huecos no debe cambiar los datos.

El resultado demuestra el estado de esa intervención, no que una API real acumule esos mismos huecos. Un solo proceso por celda tampoco permite clasificar estadísticamente sus pausas. `GCMemoryInfo` de la última colección y el delta acumulado de `GC.GetTotalPauseDuration` responden preguntas distintas y se conservaron separados.

Las pausas de aquella ventana ilustran por qué hay que separar estados, tiempo de trabajo y pausas:

| Tratamiento, un proceso | Pausa acumulada de la ventana, ms | Tiempo transcurrido de la ventana, ms |
|---|---:|---:|
| 10 / Workstation | 2,059 | 81,607 |
| 10 / Server | 10,428 | 212,964 |
| 11 / Workstation | 2,792 | 66,359 |
| 11 / Server | 16,158 | 191,879 |

Fuente: [resultados por tratamiento](#evidencia-eb1002fa9057). El tiempo transcurrido incluye el trabajo de la presión, no sólo pausas. Con una ejecución por celda, esta tabla describe el control; no permite recomendar un modo del GC ni afirmar una regresión general de pausas.

### Reutilizar un buffer no es lo mismo que cambiar de runtime

`ArrayPool<T>` permite alquilar arrays y devolverlos para reutilizarlos. Es útil cuando repetimos operaciones con buffers, pero implica un contrato de propiedad: después de devolver un array no debemos seguir usándolo.

Este ejemplo autónomo usa sólo los tres elementos lógicos solicitados, aunque el pool entregue un array físico mayor:

```csharp
// Ejemplo autónomo: array-pool (C# 14, net10.0)
using System;
using System.Buffers;

byte[] buffer = ArrayPool<byte>.Shared.Rent(3);
try
{
    buffer.AsSpan(0, 3).Fill(2);
    int suma = 0;
    for (int i = 0; i < 3; i++) suma += buffer[i];
    Console.WriteLine(suma);
}
finally
{
    ArrayPool<byte>.Shared.Return(buffer, clearArray: true);
}
```

La salida es `6`. El `finally` garantiza la devolución incluso si falla el trabajo. Limpiar puede ser importante para no conservar datos anteriores, pero también tiene coste: se puede borrar el tamaño físico rentado, no sólo los tres bytes lógicos.

En el caso medido de 100.000 bytes, Allocate registró 100.059 B/op en ambos runtimes; ArrayPool, 21/20 B/op, y ArrayPoolClear, 21/21. El pool estaba caliente. No convertimos un byte de diferencia entre versiones en una mejora relevante, ni esos números pequeños en una garantía de «pool sin allocations» en todo momento.

El cambio grande es **reutilizar frente a crear**, una posibilidad ya disponible en .NET 10. Puede ahorrar asignaciones y, a la vez, retener más memoria para reutilización. No es una mejora automática por instalar 11.

Las [operaciones de memoria](#evidencia-1231921bcc1b) y los [seis jobs Server GC separados](#evidencia-c5f6f42177bc) están conservados. No mezclamos las campañas para atribuir a un modo del GC una diferencia que también podría depender del momento del host.

### Cuatro cifras de memoria que no conviene intercambiar

**B/op** cuenta asignación administrada de la operación bajo el diagnóstico utilizado. **Heap** describe memoria gestionada por el GC. **Working set** describe páginas residentes del proceso. **Private bytes** expresa otra medida de memoria privada comprometida.

Una aplicación puede asignar menos por operación sin bajar inmediatamente su working set. Puede reservar buffers que conserva, utilizar memoria nativa en SQLite o dejar páginas disponibles para reutilización interna. Dividir working set por peticiones no produce mágicamente allocations por petición.

La pregunta práctica depende del problema: para presión de asignación miramos objetos y B/op; para pausas, telemetría de GC; para límites del proceso o contenedor, otras medidas. Una sola columna «memoria» no responde a todas.

Gestionar la memoria explica parte del coste de ejecutar; esperar sin bloquear introduce otra clase de coste. En async veremos qué estado debe sobrevivir mientras una operación está pendiente.

**Para contrastar este capítulo:** [Operaciones de memoria](#evidencia-1231921bcc1b) · [Protocolo GC](#evidencia-66ac6b003d1b) · [Originales del control](#evidencia-eb1002fa9057) · [Server GC separado](#evidencia-c5f6f42177bc) · [Matriz de trazabilidad](#evidencia-0f1a77641be5).

**Navegación:** [Anterior: 6. De 69 a 3 bytes](#gvm) · [Índice](#indice) · [Siguiente: 8. Async/await](#async).
<a id="async"></a>
## 8. Async/await: esperar sin ocupar un hilo innecesariamente

Imagina un servidor que pide un dato a una base de datos. Durante parte de la operación no está calculando: espera a que llegue una respuesta. Mantener un hilo bloqueado en esa espera puede desperdiciar un recurso que otra petición podría utilizar.

La programación **asíncrona** permite representar una operación pendiente y continuar cuando su resultado esté disponible. No hace que el disco o la red terminen antes. Tampoco significa que todo ocurra en varios hilos a la vez.

### Task no es sinónimo de hilo

Una `Task<T>` representa la finalización y el resultado de una operación. Puede estar completada, pendiente, cancelada o fallida. Su existencia no exige un hilo dedicado esperando por ella.

`await` examina la operación. Si ya está completada, el método puede seguir sin suspenderse por esa espera. Si no, registra cómo continuar y devuelve el control al llamador. Cuando la operación termina, la continuación puede volver a ejecutarse según las reglas de contexto y planificación aplicables.

Un ejemplo controlado permite verlo sin depender de la latencia de Internet:

```csharp
// Ejemplo autónomo: async-gate (C# 14, net10.0)
using System;
using System.Threading.Tasks;

var puerta = new TaskCompletionSource<int>(
    TaskCreationOptions.RunContinuationsAsynchronously);
Task<int> pendiente = CalcularAsync(puerta.Task);
Console.WriteLine(pendiente.IsCompleted);
puerta.SetResult(41);
Console.WriteLine(await pendiente);

static async Task<int> CalcularAsync(Task<int> puerta)
    => 1 + await puerta.ConfigureAwait(false);
```

La salida es `False` y `42`. La primera línea prueba que el resultado aún no estaba listo. Después se libera la puerta con 41 y el método suma uno.

Es una demostración de consola fiel a la idea del escenario suspendido; no es el programa que produjo la tabla de rendimiento. El [kernel medido](#evidencia-b75210290e49) y el [wrapper real](#evidencia-49fbbda8a5e0) incluyen sus propias fronteras y configuración de medida.

La opción `RunContinuationsAsynchronously` evita ejecutar de forma síncrona las continuaciones correspondientes dentro de la llamada que completa esa puerta. Eso no promete un orden temporal global entre hilos ni convierte cualquier continuación en trabajo gratuito.

### La máquina de estados que no escribimos a mano

Un método suspendido necesita recordar por dónde iba y qué valores seguirá necesitando. En el modelo convencional, Roslyn genera una **máquina de estados**: código y estado que permiten entrar, suspender, reanudar y propagar resultado o error. `MoveNext` es uno de los nombres que suele aparecer al inspeccionar ese código.

La sintaxis `async`/`await` evita escribir esa coordinación manual. Pero ocultar complejidad al programador no elimina toda la infraestructura que la realiza.

`Task.WhenAll` combina la finalización de varias tareas; no obliga a que sus operaciones sean paralelas ni hace desaparecer sus arrays y resultados. `Task.Run` programa trabajo en el ThreadPool, asunto diferente de esperar una API que ya es asíncrona.

### ValueTask: una alternativa con un contrato más exigente

Un `ValueTask<T>` puede representar directamente un resultado disponible sin crear siempre una `Task<T>` separada para ese resultado. También puede apoyarse en otra representación cuando la operación queda pendiente.

Puede resultar útil en APIs donde completar de forma síncrona es frecuente y el coste de asignación importa. No significa que cambiar mecánicamente todos los `Task` por `ValueTask` ahorre memoria. La composición y las conversiones pueden añadir costes; no debe consumirse repetidamente o en paralelo sin que su contrato lo permita.

En los escenarios del proyecto se distinguen completado inmediato y suspensión real. Un `MemoryStream` tampoco fuerza automáticamente I/O pendiente, y `Task.Delay(1)` puede medir principalmente el temporizador del sistema. Por eso la campaña de Runtime Async utiliza una puerta inicialmente incompleta y la libera después de registrar la espera.

### Qué viaja con una operación: ExecutionContext y AsyncLocal

Una petición puede llevar un identificador de correlación o un estado lógico que interesa conservar al continuar. **ExecutionContext** es parte de la infraestructura que propaga estado ambiente durante la ejecución asíncrona. **AsyncLocal<T>** permite asociar un valor a ese flujo lógico.

No es simplemente una variable global del proceso ni una variable ligada siempre al mismo hilo físico. Un método puede reanudarse en otro hilo y seguir viendo el valor que corresponde a su contexto.

`ConfigureAwait(false)` indica que esa continuación no necesita volver al contexto de sincronización capturado. **No equivale a suprimir ExecutionContext ni a borrar AsyncLocal.** Tampoco AsyncLocal hace una copia profunda de cualquier objeto mutable que guardemos dentro.

El proyecto comprueba flujo de contexto, aislamiento del estado del padre, cancelación y excepciones. Los tests no se limitan a «no ha lanzado nada»: verifican valores y transiciones concretas. [Comportamiento compartido](#evidencia-a529ae37cfa4).

### Qué introduce Runtime Async

Runtime Async desplaza parte del soporte de suspensión y reanudación al runtime y al JIT, en vez de depender de la misma transformación convencional en máquina de estados emitida por C#. Cambia el código que se genera y también cómo puede verse un stack vivo.

Aquí hay que distinguir dos decisiones:

1. Ejecutar sobre .NET 11 estable, cuyas bibliotecas del runtime ya utilizan el modelo según la documentación.
2. Compilar **nuestro código** con el opt-in de Runtime Async, que sigue siendo preview en este corte.

El proyecto experimental añade, para net11, esta propiedad:

```xml
<!-- Fragmento de proyecto de la variante experimental, no del baseline. -->
<Features>$(Features);runtime-async=on</Features>
```

El opt-out por proyecto usa `UseRuntimeAsync=false`. Ninguna de esas opciones recompila retroactivamente todas las dependencias de una aplicación. Cambiar sólo el host de una DLL convencional y llamarla «opt-in» no probaría un lowering nuevo.

La [matriz específica](#evidencia-1b6ad6b00607) compara cuatro tratamientos compilados por separado: 10 convencional, 11 predeterminado, 11 opt-in preview y 11 opt-out. Se registran las propiedades del ensamblado cargado, atributos y cuerpos IL del proceso hijo, no sólo el nombre de la carpeta.

### Lo que cambió en código y memoria

En CompletedTask se observaron 47 bytes IL en los tratamientos convencionales, frente a 13 en el opt-in. En SuspendedTask, 55 frente a 17. El opt-in no presenta la misma máquina de estados convencional. Son bytes de los cuerpos IL inspeccionados, no tamaño total de código máquina ni del programa.

Una reducción de IL no garantiza una reducción equivalente de tiempo o de memoria total. Los objetos y la planificación que necesita el camino completo también cuentan:

[![Selección de asignaciones de tres workloads async, comparando Default11 y OptIn11Preview](/blog/dotnet-10-vs-dotnet-11/06-runtime-async-allocations.png)](/blog/dotnet-10-vs-dotnet-11/06-runtime-async-allocations.png)

*Figura 6. Selección de tres de los siete workloads de la campaña de 28 jobs: Default11 frente a OptIn11Preview, con runtime11 y C# 15 en ambos. El tratamiento opt-in de la aplicación es preview. Incluye puertas, Tasks y contexto de cada operación, no sólo el `await`. Los cuatro tratamientos completos se conservan en el [BDN original](#evidencia-58433020b8b2) y el [lowering de los hijos](#evidencia-6e072ef31711).*

[Abrir PNG a tamaño completo](/blog/dotnet-10-vs-dotnet-11/06-runtime-async-allocations.png).

La cadena async pasa de 408 a 368 B/op entre Default11 y opt-in. En cambio, la suspensión Task pasa de 184 a 256 y AsyncLocalFlow de 280 a 360. Las medias temporales respectivas fueron 743,54 → 695,17 ns, 408,34 → 483,63 ns y 491,59 → 668,64 ns.

Sus intervalos y advertencias de distribución bimodal están en los [registros](#evidencia-0b839fa40f5b). Un lanzamiento por tratamiento no acredita una mejora temporal estable entre despliegues. Lo que sí se conserva es la diferencia observada de lowering y la contabilidad de esos caminos.

### Un stack vivo no es un stack de excepción

Un **stack trace** muestra una cadena de llamadas. El stack vivo de una operación suspendida o en ejecución y el texto de una excepción responden preguntas distintas.

En el diagnóstico convencional aparecen marcos de builders entre métodos async. En el opt-in se observan métodos de la aplicación consecutivos, como `InnerLiveAsync`, `OuterLiveAsync` y `Main`, seguidos por infraestructura de continuaciones. Las excepciones conservaron el origen `ThrowAfterYieldAsync` en ambos.

Eso no certifica todos los depuradores. Las aplicaciones también se capturaron con dotnet-trace y sus trazas pudieron leerse y simbolizarse, pero no se han validado todos los profilers, dumps o comportamientos de stepping.

La conclusión práctica es separar migraciones: probar .NET 11 predeterminado no obliga a activar Runtime Async globalmente. Antes de adoptar el opt-in hay que conocer los patrones dominantes del servicio, su consumo y sus herramientas de diagnóstico. Una novedad puede cambiar realmente el mecanismo sin ganar en todos los caminos.

Las esperas y su estado no son toda la aplicación. Pasamos ahora al trabajo que hacemos sobre los datos, empezando por las estructuras y consultas que elegimos en nuestro propio código.

**Para contrastar este capítulo:** [Kernels async](#evidencia-b75210290e49) · [Matriz de tratamientos](#evidencia-1b6ad6b00607) · [Registros](#evidencia-0b839fa40f5b) · [Matriz de trazabilidad](#evidencia-0f1a77641be5).

**Navegación:** [Anterior: 7. GC y memoria](#gc) · [Índice](#indice) · [Siguiente: 9. Colecciones y LINQ](#colecciones).

---

**PARTE III — RENDIMIENTO DEL CÓDIGO QUE ESCRIBIMOS**

<a id="colecciones"></a>
## 9. Colecciones y LINQ: elegir qué trabajo hacemos

Una colección guarda varios elementos: pedidos, identificadores, líneas de un archivo. Elegir su estructura afecta al coste de recorrerla, buscar y modificarla. Antes de preguntar qué runtime la ejecuta más rápido, conviene saber qué operación estamos pidiendo.

### Array, List y Dictionary no resuelven exactamente lo mismo

Un **array** tiene una longitud fijada al crearlo y permite acceder a sus elementos por índice. Una **List<T>** mantiene una secuencia que puede crecer; cuando necesita más capacidad puede reservar otro almacenamiento y copiar elementos.

Un **Dictionary<TKey,TValue>** organiza valores por clave mediante hashing. Es útil cuando queremos localizar un dato por identificador sin recorrer todos. Sus costes dependen de claves, comparador, capacidad, colisiones y operación; no es una promesa de coste constante absoluto bajo cualquier entrada.

`FrozenDictionary` prepara una estructura orientada a consultas cuando el conjunto ya no va a cambiar. Puede interesar en catálogos estables y lecturas frecuentes. Prepararla también cuesta: si ese trabajo se excluye de un benchmark de búsqueda, no debemos interpretar su resultado como el coste de construir y usar el catálogo una sola vez.

Este ejemplo autónomo enseña la diferencia entre recorrer y buscar:

```csharp
// Ejemplo autónomo: colecciones (C# 14, net10.0)
using System;
using System.Collections.Generic;
using System.Linq;

int[] importes = [10, 20, 30, 40];
List<int> lista = [.. importes];
lista.Add(50);
Dictionary<int, string> clientes = new() { [7] = "Ana", [9] = "Luis" };
Console.WriteLine(lista.Sum());
Console.WriteLine(clientes[7]);
Console.WriteLine(importes.Where(x => x >= 30).Sum());
```

La salida es `150`, `Ana` y `70`. La lista añade un elemento, el diccionario consulta una clave y LINQ filtra antes de sumar. No son alternativas equivalentes para un único problema; cada línea utiliza un contrato distinto.

### LINQ: expresar una transformación no implica materializarla ya

**LINQ** permite describir operaciones sobre secuencias: filtrar con `Where`, transformar con `Select`, agrupar, unir y agregar.

En LINQ sobre `IEnumerable<T>`, muchas operaciones tienen ejecución diferida: describen cómo se recorrerán los datos cuando se consuman. `ToArray` o `ToList` materializan una colección; `Sum` consume para obtener un valor. Enumerar dos veces una consulta puede volver a realizar trabajo.

La implementación puede especializar caminos para arrays, listas, iteradores o tipos concretos. También puede cambiar la posibilidad de integrar código. Son mecanismos que orientan la lectura según el [método común](#metodo-lectura); aquí no se reconstruyó cada biblioteca con una única modificación.

### Lo que mide nuestra selección

La [suite de colecciones](#evidencia-0ee69ae7579f) usa valores `i % 1024`, consulta claves preparadas y comprueba sumas y cardinalidades. El filtro selecciona pares y la transformación multiplica por tres. Join relaciona 10.000 elementos de la izquierda con 1024 claves únicas de la derecha.

| Operación, entrada principal | .NET 10, µs | .NET 11, µs | Cambio de tiempo | B/op 10 → 11 |
|---|---:|---:|---:|---:|
| Recorrido ArrayFor, 10.000 elementos | 4,647 | 4,767 | +2,57% | 0 → 0 |
| FrozenDictionary, consultas preparadas | 10,036 | 10,980 | +9,41% | 0 → 0 |
| Materialize, filtro y transformación a array | 9,809 | 8,363 | −14,74% | 20.129 → 20.129 |
| Join, claves descritas arriba | 141,235 | 130,359 | −7,70% | 123.208 → 119.616 |

Fuente: [originales principales BDN](#evidencia-71d6e094d75a) y [pares procesados](#evidencia-df8b1b3c3ee3). Observaciones utilizadas, 10/11: 15/15, 15/15, 15/12 y 14/12 respectivamente. Son resultados exploratorios del host compartido.

No hay un «LINQ ha mejorado un 15%». Materializar mejora en esta campaña y conserva sus bytes asignados; FrozenDictionary consulta más despacio. Ambos resultados pueden coexistir porque hacen trabajos distintos.

El barrido de tamaños añade contexto: ArrayFor con 100, 10.000 y un millón de elementos mostró cambios de −1,30%, +0,44% y +0,48%, sin asignaciones. Es otra campaña, no una sustitución de la fila inicial. La conclusión razonable es que este recorrido no muestra una ventaja grande y consistente atribuible a la versión. [Barrido y originales](#evidencia-af1cc789ce98).

### FullJoin: una API nueva con un problema concreto

Una unión interna conserva parejas con coincidencia. Una **unión externa completa**, full outer join, también conserva elementos de cualquiera de los lados que no tienen pareja. Sirve, por ejemplo, para reconciliar dos inventarios: coincidentes, sólo locales y sólo remotos.

.NET 11 incorpora un `Enumerable.FullJoin` que devuelve parejas. El control no se conforma con una entrada donde todo coincide una vez: incluye duplicados, diferencias de mayúsculas, ausencias y claves nulas.

Este programa autónomo reproduce sus datos principales y reduce la comprobación a dos salidas explicativas:

```csharp
// Ejemplo autónomo: full-join (C# 15, net11.0)
using System;
using System.Linq;

Row[] izquierda = [
    new("L1", "a"), new("L2", "A"), new("L2", "A"),
    new("L3", "left"), new("LN", null)
];
Row[] derecha = [
    new("R1", "a"), new("R2", "a"), new("R3", "right"), new("RN", null)
];
var parejas = izquierda.FullJoin(
    derecha, x => x.Key, x => x.Key, StringComparer.OrdinalIgnoreCase).ToArray();
Console.WriteLine(parejas.Length);
Console.WriteLine(parejas.Count(p => p.Item1 is not null && p.Item2 is not null));

public sealed record Row(string Id, string? Key);
```

La salida es `10` y `6`. Tres elementos de la izquierda coinciden con dos de la derecha: **tres por dos, seis parejas**, no una coincidencia deduplicada. Quedan cuatro filas sin pareja; las dos claves nulas no se emparejan entre sí.

El [probe original](#evidencia-84abffd79e6c) compara un multiconjunto ordenado contra una implementación de referencia, no contra un `Distinct` que borraría duplicados. El [probe de tuple Join](#evidencia-1176d2ac9bae) es otro contrato de unión examinado.

Estos controles prueban comportamiento de APIs nuevas. **No tienen tiempos ni asignaciones medidos.** No afirmamos que FullJoin sea más rápido que cualquier implementación anterior, ni que el operador de memoria garantice la traducción equivalente de cualquier proveedor EF.

El contrato de una colección determina qué recorremos y qué materializamos. Al trabajar con texto aparece una decisión parecida: cuándo necesitamos otra copia y cuándo basta una vista.

**Para contrastar este capítulo:** [Suite de colecciones](#evidencia-0ee69ae7579f) · [Comparaciones principales](#evidencia-df8b1b3c3ee3) · [Probe FullJoin](#evidencia-84abffd79e6c) · [Matriz de trazabilidad](#evidencia-0f1a77641be5).

**Navegación:** [Anterior: 8. Async/await](#async) · [Índice](#indice) · [Siguiente: 10. Strings y Span](#strings-span).
<a id="strings-span"></a>
## 10. Strings, Span y buffers: copiar también cuesta

Una cadena parece un dato sencillo hasta que la construimos o analizamos millones de veces. Concatenar partes, convertir números, buscar separadores o cambiar codificaciones implica trabajo y, en ocasiones, nuevas asignaciones.

### String: un texto que no se modifica por dentro

Un `string` es inmutable: una operación que produce un texto distinto no cambia el contenido del objeto anterior. La representación habitual usa unidades UTF-16. No debemos equiparar siempre `Length`, unidades de almacenamiento y caracteres percibidos: algunos símbolos necesitan más de una unidad y un grafema puede combinar varias.

Esa inmutabilidad simplifica compartir textos, pero una cadena de operaciones puede crear intermediarios. `StringBuilder` permite construir progresivamente un resultado; una interpolación moderna puede utilizar handlers y caminos especializados; `string.Create` permite expresar otras formas de construcción.

No significa que StringBuilder sea obligatorio para cualquier concatenación. Para pocas partes conocidas el compilador y las bibliotecas ya pueden hacer un trabajo adecuado. El algoritmo y el tamaño real de salida siguen importando.

Las cuatro variantes del proyecto producen exactamente:

```text
id=12345;name=alpha;active=True
```

El parámetro Count de esa clase **no convierte estas cuatro variantes en concatenar 10.000 fragmentos**. Construyen esa salida fija. En cambio, parsing, búsqueda, comparación, copia y codificación usan la entrada repetida preparada por Count. Confundir ambas cosas fabricaría una conclusión de escalabilidad que el código no mide.

### Span: mirar una zona sin crear otra cadena

`Span<T>` y `ReadOnlySpan<T>` representan una vista sobre una región de elementos. Una vista no necesita copiar por sí misma el contenido observado. Puede referirse, por ejemplo, a una zona de un array o de un string.

`ReadOnlySpan` impide escribir a través de esa vista; no vuelve inmutable a cualquier propietario mutable. Sus restricciones de uso ayudan a evitar referencias que sobrevivan a la memoria que necesitan. «Es un ref struct» tampoco significa que sus datos estén necesariamente en el stack.

Este ejemplo parsea el número sin crear una subcadena para él:

```csharp
// Ejemplo autónomo: span-parse (C# 14, net10.0)
using System;
using System.Globalization;

string texto = "12345,alpha;";
ReadOnlySpan<char> numero = texto.AsSpan(0, 5);
int valor = int.Parse(numero, CultureInfo.InvariantCulture);
Console.WriteLine(valor);
```

La salida es `12345`. `AsSpan(0, 5)` describe los primeros cinco elementos; el parser acepta esa vista. Es una simplificación fiel a la parte numérica del [TextWorkload real](#evidencia-ce34a0dd57d9).

La suite también usa `Utf8Parser` sobre bytes ya preparados. Eso responde a otra pregunta útil: ¿puedo analizar datos que ya llegan como UTF-8 sin convertir todo antes a UTF-16? Si para usarlo primero codificásemos un string dentro de cada operación, estaríamos añadiendo otro coste.

Los casos de codificación UTF-8, búsqueda positiva, comparación ordinal sin distinguir mayúsculas y copia verifican contenido y longitud. Sus entradas de texto son principalmente ASCII. No representan todos los casos Unicode, idiomas, normalización o comparaciones culturales.

### Qué cambia en .NET 11 y qué ya podíamos hacer

Span, los parsers sobre vistas y los handlers de interpolación no nacen en esta entrega. La comparación principal conserva esas APIs en ambos runtimes. El resultado interesante para una aplicación puede venir primero de eliminar una copia innecesaria en **cualquiera** de las versiones.

Una novedad específica es adaptar memoria existente a APIs que consumen un `Stream`. Antes, una solución sencilla podía crear una copia con `ToArray` y envolverla en `MemoryStream`. .NET 11 ofrece `ReadOnlyMemoryStream`.

Este programa reproduce el control de alias de la investigación:

```csharp
// Ejemplo autónomo: memory-stream (C# 15, net11.0)
using System;
using System.IO;
using System.Linq;

byte[] propietario = [1, 2, 3];
using var copia = new MemoryStream(propietario.ToArray(), writable: false);
using var vista = new ReadOnlyMemoryStream(propietario.AsMemory());
propietario[0] = 99; // Intervención del control, antes de consumir los streams.
Console.WriteLine(copia.ReadByte());
Console.WriteLine(vista.ReadByte());
```

La salida es `1` y `99`. La copia mantiene sus bytes anteriores; el adaptador observa el almacenamiento del propietario. **Es precisamente por eso por lo que la vida y la mutación de ese almacenamiento forman parte del contrato.** En uso concurrente hay que conservarlo válido y no modificarlo mientras otro código lo consume.

El [probe completo](#evidencia-64e36bae106e) compara lecturas, posiciones y límites. El de [ReadOnlySequenceStream](#evidencia-381ddd437902), cuyo namespace es `System.Buffers`, añade segmentos y longitudes de borde. Una secuencia permite representar datos repartidos en varios bloques sin exigir que todo sea un array contiguo.

No copiar el payload al construir el adaptador no es lo mismo que cero allocations: sigue pudiendo existir el objeto stream. Tampoco garantiza que una lectura posterior no copie bytes al destino. Estos probes no incorporan cronómetro; prueban el contrato que permite evitar aquella copia concreta.

La recomendación práctica es mirar el recorrido completo de los datos. Si llegan como bytes, se convierten a string, se recortan y vuelven a codificarse, puede haber más trabajo prescindible ahí que en la diferencia entre dos implementaciones del mismo bucle.

Seguir las copias prepara la siguiente pregunta: qué ocurre cuando esos datos se convierten en un mensaje. JSON añade contratos, formatos y caminos de serialización que conviene medir por separado.

**Para contrastar este capítulo:** [Workloads de texto](#evidencia-ce34a0dd57d9) · [Probe de streams sobre memoria](#evidencia-64e36bae106e) · [Probe de secuencias](#evidencia-381ddd437902) · [Matriz de trazabilidad](#evidencia-0f1a77641be5).

**Navegación:** [Anterior: 9. Colecciones y LINQ](#colecciones) · [Índice](#indice) · [Siguiente: 11. JSON](#json).
<a id="json"></a>
## 11. JSON: traducir objetos tiene un precio

Una API no suele enviar sus objetos .NET directamente por la red. Los convierte a un formato compartido, como JSON: texto estructurado con propiedades, listas, números y otros valores. La operación inversa reconstruye datos a partir del mensaje.

**Serializar** es producir esa representación; **deserializar**, leerla y construir el resultado. El coste incluye recorrer propiedades, formatear valores, escapar texto y gestionar el almacenamiento. Que un objeto sea pequeño en C# no significa que transmitirlo o materializar miles de ellos sea gratis.

Un **DTO**, objeto de transferencia de datos, define la forma que queremos enviar: por ejemplo, identificador y cliente de un pedido. No tiene por qué exponer todas las entidades y relaciones internas de la base de datos.

### Reflection frente a source generation

El serializador necesita conocer el contrato: qué propiedades existen y cómo leerlas o escribirlas. El camino basado en **reflection** obtiene información de tipos durante la ejecución y puede conservar metadata preparada para usos posteriores.

La **source generation** genera información o código durante la construcción del proyecto. Puede reducir trabajo dinámico y ayudar a hacer explícitos los tipos necesarios para trimming o AOT. No elimina la necesidad de escribir los bytes ni de interpretar los valores recibidos.

Este programa autónomo muestra ambos caminos sobre el mismo objeto:

```csharp
// Ejemplo autónomo: json-sourcegen (C# 14, net10.0)
using System;
using System.Text.Json;
using System.Text.Json.Serialization;

var pedido = new Pedido(7, "Ana");
Console.WriteLine(JsonSerializer.Serialize(pedido));
Console.WriteLine(JsonSerializer.Serialize(pedido, PedidoJsonContext.Default.Pedido));

public sealed record Pedido(int Id, string Cliente);
[JsonSerializable(typeof(Pedido))]
public partial class PedidoJsonContext : JsonSerializerContext;
```

Ambas líneas producen `{"Id":7,"Cliente":"Ana"}`. El atributo indica qué contrato debe generar el compilador. Es una demostración reducida; el [benchmark real](#evidencia-ce34a0dd57d9) utiliza un contenedor de pedidos, cliente, dirección y dos líneas por pedido.

Source generation ya estaba disponible en .NET 10. Si una aplicación pasa de reflection en 10 a generación en 11, ha cambiado dos factores; no debemos atribuir toda diferencia al runtime.

### Nuestros datos: tres caminos, no un porcentaje global

| Escenario, 100 pedidos | .NET 10, µs | .NET 11, µs | Cambio de tiempo | B/op 10 → 11 |
|---|---:|---:|---:|---:|
| SerializeReflection | 80,061 | 60,864 | −23,98% | 19.341 → 19.339 |
| SerializeSourceGen | 33,263 | 33,184 | −0,24% | 19.022 → 19.022 |
| DeserializeSourceGen | 193,458 | 173,821 | −10,15% | 96.368 → 96.368 |

Fuente: [BDN principal](#evidencia-71d6e094d75a) y [comparaciones](#evidencia-df8b1b3c3ee3). N utilizado, 10/11: 14/13, 14/14 y 14/14. Los dos caminos de serialización reciben la misma estructura; la preparación del workload queda fuera.

El camino reflection aparece más rápido en 11 en esa campaña. El de generación queda prácticamente igual. No se ha identificado aquí un único cambio interno que explique el 23,98%; tampoco es una comparación de primer uso, porque el calentamiento ya ha preparado metadata.

El barrido adicional de SerializeSourceGen con 10, 1000 y 10.000 pedidos mostró −8,14%, −0,70% y −9,12%. El tamaño importa y la variación entre campañas también: no podemos utilizar la fila de 100 como una ley para todos los payloads. [Resultados por tamaño](#evidencia-af1cc789ce98).

Los escenarios de stream usan `MemoryStream`. Eso incluye el trabajo indicado por su código —uno devuelve `ToArray`, por ejemplo—, no una conexión de red ni una prueba de memoria constante con un cliente lento.

### JSON Lines: varios valores sin construir un array JSON completo

**JSON Lines**, o JSONL, coloca cada valor JSON en una línea. Es útil para flujos de registros y procesamiento incremental. Un salto de línea contenido dentro de un string se escapa; no debe confundirse con el separador entre registros.

.NET 11 permite serializar una secuencia asíncrona con `topLevelValues: true`:

```csharp
// Ejemplo autónomo: json-lines (C# 15, net11.0)
using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

using var destino = new MemoryStream();
await JsonSerializer.SerializeAsyncEnumerable(
    destino, Generar(), topLevelValues: true);
Console.Write(Encoding.UTF8.GetString(destino.ToArray()));

static async IAsyncEnumerable<int> Generar()
{
    await Task.Yield();
    yield return 1;
    yield return 2;
}
```

La salida contiene `1` y `2` en líneas separadas, cada una terminada en LF, no `[1,2]`. El [control original](#evidencia-2512a90fff6c) incluye duplicados, Unicode, un salto dentro de un string y secuencia vacía. También verifica que el modo JSONL permanece compacto y usa LF aunque las opciones soliciten indentación y CRLF.

La consola didáctica acumula el resultado en memoria para mostrarlo; eso no convierte el ejemplo en una demostración de streaming de extremo a extremo. La API permite emitir valores progresivamente, pero el comportamiento final también depende del consumidor, los buffers y el transporte.

### JSON y unions: reconocer qué alternativa contiene un valor

Una union representa un valor elegido entre varios tipos permitidos; la desarrollaremos en C# 15. El [probe JSON](#evidencia-8f7a657cadec) comprueba una `Reading(int, string)` y otra union de `Dog` y `Cat`.

Para objetos, `JsonUnionTypeStructuralClassifier` utiliza la estructura de propiedades para clasificar. Si un objeto no permite distinguir candidato o no tiene candidato válido, el control exige `JsonException`. No se «adivina» silenciosamente un tipo para que el roundtrip pase.

También se comprueba `null` como valor por defecto sin caso activo. Es una decisión de contrato que una aplicación debe contemplar, no sólo una comodidad de sintaxis.

Estas pruebas prueban serialización y errores esperados. No acreditan más throughput que otra representación ni certifican todos los escenarios de source generation, trimming, AOT o unions de F#. Una buena API nueva puede aportar claridad sin necesitar un porcentaje de rendimiento inventado.

Producir el mensaje es sólo una parte del servicio. Cuando llegan varios trabajos a la vez, hay que coordinar quién los ejecuta, dónde esperan y cómo se limita la cola.

**Para contrastar este capítulo:** [Workloads JSON](#evidencia-ce34a0dd57d9) · [Comparaciones principales](#evidencia-df8b1b3c3ee3) · [JSONL](#evidencia-2512a90fff6c) · [Unions JSON](#evidencia-8f7a657cadec) · [Matriz de trazabilidad](#evidencia-0f1a77641be5).

**Navegación:** [Anterior: 10. Strings y Span](#strings-span) · [Índice](#indice) · [Siguiente: 12. Concurrencia](#concurrencia).
<a id="concurrencia"></a>
## 12. Concurrencia, ThreadPool y Channels

Una aplicación puede tener muchas operaciones pendientes a la vez aunque sólo disponga de unos pocos núcleos. **Concurrencia** significa gestionar ese solapamiento; **paralelismo**, ejecutar trabajo simultáneamente. No son lo mismo.

El **ThreadPool** mantiene y coordina hilos reutilizables para ejecutar trabajo. Crear una tarea por cada elemento no crea capacidad ilimitada de CPU. Las colas, las continuaciones y la sincronización también consumen recursos.

Una operación de cálculo pesado puede beneficiarse de repartir trabajo. Una suma minúscula puede tardar más al introducir coordinación que al ejecutarse de forma secuencial. Por eso el número de workers debe leerse junto al tamaño del trabajo.

### Productor, consumidores y backpressure

Un **Channel** conecta quien produce elementos con quien los consume. Sirve para separar ritmos: recibir mensajes y procesarlos, generar trabajo y ejecutarlo o limitar una cola en memoria.

Un canal acotado tiene capacidad máxima. Con `BoundedChannelFullMode.Wait`, el productor espera cuando no cabe más contenido. Esa **backpressure** evita crecer indefinidamente y transmite al origen que el consumidor no puede seguir su ritmo.

No elimina la decisión de qué hacer ante sobrecarga: esperar, rechazar, descartar o persistir tienen semánticas diferentes. Comparar una cola que pierde mensajes con otra que los conserva no sería comparar el mismo servicio.

Este programa autónomo conserva el cuerpo del escenario medido, sin los atributos BDN:

```csharp
// Ejemplo autónomo: channel (C# 14, net10.0)
using System;
using System.Linq;
using System.Threading.Channels;
using System.Threading.Tasks;

Console.WriteLine(await new ConcurrencyWorkload(1000, 2).Channel());

public sealed class ConcurrencyWorkload(int count, int workers)
{
    public async Task<long> Channel()
    {
        var channel = System.Threading.Channels.Channel.CreateBounded<int>(
            new BoundedChannelOptions(256)
            {
                SingleWriter = true,
                SingleReader = workers == 1,
                FullMode = BoundedChannelFullMode.Wait
            });
        var consumers = new Task<long>[workers];
        for (int i = 0; i < workers; i++) consumers[i] = Consume();
        for (int i = 0; i < count; i++)
            await channel.Writer.WriteAsync(i).ConfigureAwait(false);
        channel.Writer.Complete();
        return (await Task.WhenAll(consumers).ConfigureAwait(false)).Sum();

        async Task<long> Consume()
        {
            long sum = 0;
            await foreach (int item in channel.Reader.ReadAllAsync().ConfigureAwait(false))
                sum += item;
            return sum;
        }
    }
}
```

La salida es **499500**, la suma de 0 a 999. Se arrancan los consumidores antes de escribir; después se completa el writer y se espera a todos. El resultado se devuelve al harness, no queda descartado.

Es importante lo que incluye la operación: crear canal y tareas, escribir, consumir, cerrar y esperar. **No es una cola de larga vida ya inicializada midiendo únicamente cada `Read` o `Write`.** [Fuente completa](#evidencia-2f2ab2ee9fca).

### Por qué el caso Channel necesitó una revisión especial

En la campaña inicial el caso de dos consumidores mostraba un tiempo mayor en 11. Después aparecieron dos repeticiones históricas:

- A: 139,581 → 216,635 µs, **+55,20%**.
- B: 140,103 → 277,598 µs, **+98,14%**.

Ambas diferencias existen en sus originales. La pregunta crítica no era si la división estaba bien hecha, sino si el segundo porcentaje representaba un efecto estable o dependía de la ejecución.

El orden histórico fue 11A → 10A → 10B → 11B. La auditoría añadió únicamente controles del caso dudoso, con orden 10C → 11C → 11D → 10D y telemetría del host:

- C: 138,429 → 214,161 µs, **+54,71%**.
- D: 139,659 → 216,192 µs, **+54,80%**.

[![Channel de dos consumidores: repeticiones históricas A y B frente a controles posteriores C y D](/blog/dotnet-10-vs-dotnet-11/07-channel-history-and-control.png)](/blog/dotnet-10-vs-dotnet-11/07-channel-history-and-control.png)

*Figura 7. Medias y Error BDN por ejecución, sin mezclar A/B con C/D. Todos procesan 1000 enteros en canal acotado a 256; el host no es exclusivo. Los controles sostienen el signo adverso local, no un recargo universal del 55% o 98%. Fuente: [orden y originales históricos](#evidencia-4d04be4160f7) y [manifiesto del control](#evidencia-fe64e7167cf6).*

[Abrir PNG a tamaño completo](/blog/dotnet-10-vs-dotnet-11/07-channel-history-and-control.png).

En C, BDN utilizó 12 observaciones de 10 y 15 de 11; Error fue 0,517 y 1,153 µs. En D, 14 y 15 observaciones, con Error 1,346 y 1,320. La separación dentro de esos procesos es clara, pero los intervalos no controlan por sí solos la frecuencia o la temperatura entre procesos.

La telemetría incluye CPU de procesos hijos activos durante piloto, calentamientos y diagnóstico, además de memoria libre. No equivale a medir exclusivamente la carga de fondo. Tampoco demuestra ausencia de paginación o de competencia sobre algún núcleo.

La formulación defendible es: **el escenario vuelve a ser más lento en .NET 11 en este equipo y protocolo; el +98,14% histórico no reaparece como magnitud estable en los controles**. No se ha identificado causalidad exclusiva de un cambio del runtime. Los originales, el orden y los límites permanecen en la [auditoría](#evidencia-0c5cb713ef30) y la [trazabilidad](#evidencia-0f1a77641be5).

### Más consumidores no implica más rendimiento

[![Barrido independiente de Channel con uno, dos, cuatro y ocho consumidores y 1000 elementos](/blog/dotnet-10-vs-dotnet-11/08-channel-workers.png)](/blog/dotnet-10-vs-dotnet-11/08-channel-workers.png)

*Figura 8. Campaña de tamaños/workers separada del control A–D. Los valores son tiempo del lote completo; no latencia de cada mensaje. Ocho workers son consumidores lógicos, no ocho núcleos físicos dedicados. Fuente: [resultados por parámetros](#evidencia-72edf7c1bea8).*

[Abrir PNG a tamaño completo](/blog/dotnet-10-vs-dotnet-11/08-channel-workers.png).

Con un consumidor, 10/11 tardaron 123,771/171,276 µs; con ocho, 662,164/813,539 µs. En este trabajo tan pequeño crecen los costes de coordinación. Los dos y cuatro consumidores también fueron más lentos en 11 en esa campaña, pero sus porcentajes no sustituyen a C/D: pertenecen a otra ejecución.

Hay otro detalle instructivo: con ocho consumidores las asignaciones bajan de 43.511 a 30.798 B/op en 11 y, aun así, el tiempo sube. Menos bytes no garantiza menos espera o menos sincronización.

Los otros caminos tampoco se mueven en bloque. TaskRun pasó de 1,911 a 1,535 µs; ParallelForEach de 555,748 a 574,990; Semaphore de 496,786 a 362,494. Son resultados exploratorios con trabajo ligero y distinto contrato de coordinación, no un ranking para elegir primitivas de una aplicación sin atender a su semántica.

### Qué haría en un servicio real

Primero miraría cuánto trabajo realiza cada elemento y cuánto tiempo pasa esperando. Después, si la cola crece, dónde se acumula y qué límite protege la memoria. Sólo entonces cambiaría consumidores o capacidad.

El endpoint Channel de la API de esta investigación no es una réplica HTTP de este microbenchmark: utiliza un servicio de fondo reutilizado, un consumidor y capacidad 1024. Esa diferencia de vida útil y topología impide llevar su porcentaje a otro escenario como si fuese una propiedad del nombre Channel.

Una regresión local merece investigación y cautela. También merece describirse con suficiente precisión para que otro desarrollador pueda intentar reproducir **ese caso**, en lugar de perseguir un eslogan.

El caso Channel muestra por qué la vida útil y la coordinación forman parte de la operación. Ampliamos ahora la mirada a otras tareas habituales: tipos dinámicos, archivos, criptografía y diagnóstico.

**Para contrastar este capítulo:** [Workload de concurrencia](#evidencia-2f2ab2ee9fca) · [Manifiesto histórico A/B](#evidencia-4d04be4160f7) · [Control C/D](#evidencia-fe64e7167cf6) · [Barrido de workers](#evidencia-72edf7c1bea8) · [Matriz de trazabilidad](#evidencia-0f1a77641be5).

**Navegación:** [Anterior: 11. JSON](#json) · [Índice](#indice) · [Siguiente: 13. Otras superficies](#otras-superficies).
<a id="otras-superficies"></a>
## 13. Reflection, I/O, criptografía y observabilidad

No todas las aplicaciones pasan la mayor parte del tiempo sumando arrays. En un servicio habitual también hay inspección de tipos, archivos, hashing, logs y trazas. Estas pruebas amplían las preguntas, con contratos diferentes para cada una.

### Reflection: descubrir y llamar durante la ejecución

**Reflection** permite inspeccionar tipos, métodos y propiedades a partir de su metadata. Es útil para frameworks, herramientas y código que no conoce todos los tipos al compilar. Una llamada dinámica puede necesitar más preparación que una llamada directa.

Un **delegate** representa una llamada con una firma conocida. Prepararlo una vez y reutilizarlo puede evitar parte de la resolución repetida.

```csharp
// Ejemplo autónomo: reflection (C# 14, net10.0)
using System;

var metodo = typeof(Operaciones).GetMethod(nameof(Operaciones.Sumar))!;
object?[] argumentos = [42, 3];
var sumar = metodo.CreateDelegate<Func<int, int, int>>();
Console.WriteLine(metodo.Invoke(null, argumentos));
Console.WriteLine(sumar(42, 3));

public static class Operaciones
{
    public static int Sumar(int a, int b) => a + b;
}
```

La salida es `45` dos veces. El ejemplo prepara metadata, argumentos y delegate antes de llamar. Esa frontera importa: medir además `GetMethod` o crear el delegate en cada operación respondería otra pregunta.

La [suite de reflection](#evidencia-1231921bcc1b) mantiene esa preparación fuera de la ventana correspondiente. Invoke registró 19,02 → 17,13 ns y 24 B/op; Delegate, 3,39 → 3,06 ns y 0 B/op. No son tiempos de construir un sistema de plugins completo ni de compilar una expresión.

El resultado más práctico no requiere culpar o premiar una versión: cuando se repite una llamada conocida, conservar su representación preparada puede importar más que el delta entre runtimes. Si el destino realmente cambia, no podemos eliminar esa flexibilidad sin cambiar el problema.

### I/O: el sistema operativo también participa

**I/O**, entrada/salida, incluye leer y escribir archivos. `FileStream` y las APIs asíncronas coordinan buffers, llamadas al sistema y finalización.

La [suite](#evidencia-9d3b41746437) utiliza archivos reales, lectura secuencial con buffer de 64 KiB y verificaciones de longitud, contenido y checksum. Las escrituras incluyen crear el stream y finalizarlo según el contrato del método.

Pero tras los calentamientos, el sistema operativo puede servir lecturas desde su caché. No son necesariamente lecturas de disco físico frío. `FlushAsync` tampoco certifica que los bytes hayan llegado de forma durable al medio de almacenamiento frente a un corte eléctrico.

Por eso no trasladamos el tiempo de una lectura local caliente a una base de datos remota, un volumen de red o un disco diferente. El experimento sirve para comparar ese camino de software con la caché declarada, no para calificar universalmente el hardware.

### Criptografía: comparar la misma operación, no bajar garantías

Un **hash** transforma una entrada en una huella de tamaño fijo. No es cifrado reversible. SHA-256 sirve para identificar contenido en muchos protocolos; no debe confundirse con un algoritmo de almacenamiento de contraseñas.

```csharp
// Ejemplo autónomo: sha256 (C# 14, net10.0)
using System;
using System.Security.Cryptography;
using System.Text;

byte[] huella = SHA256.HashData(Encoding.UTF8.GetBytes("abc"));
Console.WriteLine(Convert.ToHexString(huella));
```

La salida es `BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD`, el vector conocido utilizado también como control.

El laboratorio incluye SHA-256, AES-256-CBC con padding PKCS7, comparación fija y generación de Guid. El caso AES crea, configura y dispone el proveedor por operación: no mide exclusivamente cifrar con una instancia ya preparada. Sus clave e IV fijos pertenecen a una fixture reproducible; **no son una receta segura para cifrar mensajes de producción**.

La API nueva `CryptographicOperations.FixedTimeEquals(ReadOnlySpan<byte>, byte)` se contrasta con la misma comparación contra un span de bytes repetidos. El [probe](#evidencia-3f42500b63f7) mueve el desacuerdo al principio, centro y final y contempla longitudes vacías y de borde. Comprueba igualdad y errores lógicos; no pretende demostrar resistencia a canales laterales con un Stopwatch.

Para comparar criptografía, archivos comprimidos o certificados se aplica la regla de [conservar el contrato](#metodo-lectura), incluidas las garantías de autenticación y validación.

### Zstandard: una incorporación útil sin fingir que la hemos cronometrado

La compresión reduce datos mediante una representación reversible. Puede ahorrar transferencia a cambio de CPU, memoria y complejidad. Diferentes formatos no producen necesariamente el mismo tamaño ni ofrecen los mismos intercambios.

El [probe Zstandard](#evidencia-3ed5656e6e02) utiliza los nuevos streams de .NET 11 y controles GZip/Brotli, comprobando que la descompresión recupera los bytes. Incluye texto español, JSON completo y datos pseudoaleatorios deterministas.

Los nombres de niveles de compresión no implican equivalencia numérica entre algoritmos. Los probes sí conservan tamaños y ratios para sus entradas concretas, además de los hashes del roundtrip; **no miden velocidad ni allocations**. Esos tamaños no aíslan un cambio de runtime entre codecs distintos ni justifican un ganador general de compresión.

### Observabilidad: enterarnos de lo que hace el programa también cuesta

Los **logs** registran eventos; las **métricas** agregan medidas; las **trazas** relacionan operaciones para seguir su recorrido. Un span es una operación dentro de una traza, no un `Span<T>` de memoria: comparten palabra, no función.

`ActivitySource` permite emitir operaciones para un consumidor que escuche. Este ejemplo autónomo instala un listener local para que la operación tenga un destino real:

```csharp
// Ejemplo autónomo: activity (C# 14, net10.0)
using System;
using System.Diagnostics;

using var source = new ActivitySource("Blog.Ejemplo");
using var listener = new ActivityListener
{
    ShouldListenTo = s => ReferenceEquals(s, source),
    Sample = (ref ActivityCreationOptions<ActivityContext> _) =>
        ActivitySamplingResult.AllDataAndRecorded,
    ActivityStopped = activity => Console.WriteLine(activity.GetTagItem("order.id"))
};
ActivitySource.AddActivityListener(listener);
using (Activity? activity = source.StartActivity("pedido"))
{
    activity?.SetTag("order.id", 42);
}
```

La salida es `42` al finalizar la actividad. Es una demostración de la BCL, no el SDK de OpenTelemetry usado en la campaña específica.

Los [benchmarks generales](#evidencia-24932a96fd09) separan logging generado, extensiones de logging, Activity y Meter con consumidor activo/inactivo. El logger activo cuenta eventos; no escribe un archivo o envía por red cada línea.

La prueba de **OpenTelemetry 1.21.0** sí utiliza su SDK: `AlwaysOnSampler` y un procesador síncrono acotado que lee el tag esperado y cuenta spans. No es un exporter vacío, pero tampoco un pipeline OTLP real con lotes, red, almacenamiento y reintentos.

En ese escenario, Disabled pasó de 2,779 a 3,502 ns con 0 B/op. Enabled, de 212,793 a 198,688 ns con 520 B/op en ambos runtimes. No son el coste total de observabilidad de una API ni prueba de que una plataforma externa vaya más rápida. [Implementación y protocolo](#evidencia-49a84856569b), [originales](#evidencia-eadf167ea790).

### Perfiles: observar dónde se va el tiempo sin inventar precisión

El proyecto conserva cuatro trazas EventPipe: dos de la API y dos de las aplicaciones async. Añade dos streams de counters de la API, con dotnet-trace y dotnet-counters 10.0.750501. Se realizaron en sesiones instrumentadas separadas de los tiempos limpios.

Un perfil de tiempo muestreado puede incluir espera, y los valores inclusivos de una función y sus descendientes se solapan. No deben sumarse como porcentajes independientes de CPU. Del mismo modo, un contador de pausa expresado en segundos por segundo no son segundos acumulados de toda la sesión.

Por ejemplo, `0,010361 s/1 s` no significa una pausa única de 10,361 segundos. Los perfiles ayudan a formular hipótesis sobre un camino; su relación con el P99 o con un microbenchmark debe leerse con la distinción entre [observación y atribución](#metodo-lectura). [Capturas, comandos y alcance](#evidencia-5998e62b150f).

### También medimos el SDK, sin confundirlo con la aplicación

El comando `dotnet --version` selecciona y muestra un SDK. `dotnet --info` añade información del entorno. No ejecutan nuestro servidor ni representan el coste de una petición.

La campaña inició quince procesos por combinación SDK/comando, después de cuatro calentamientos por combinación. Son 60 procesos medidos. Ambos SDK se seleccionaron por `global.json` utilizando el mismo muxer/host 11: no fueron dos instalaciones completamente aisladas.

[![Tiempos de los comandos version e info con SDK 10 y 11, incluyendo dispersión observada](/blog/dotnet-10-vs-dotnet-11/14-sdk-cli.png)](/blog/dotnet-10-vs-dotnet-11/14-sdk-cli.png)

*Figura 9. Comparación propia del CLI en este host: `--version`, 158,570 → 47,878 ms; `--info`, 315,671 → 78,461 ms. Quince procesos por combinación, sin vaciar caché y con host compartido. No demuestra causalidad exclusiva de Native AOT en el host ni mejora del runtime de una API. Fuente: [campaña CLI](#evidencia-ed06cbb1d49e) y [protocolo diagnóstico](#evidencia-5998e62b150f).*

[Abrir PNG a tamaño completo](/blog/dotnet-10-vs-dotnet-11/14-sdk-cli.png).

Aquí las diferencias son grandes, pero la explicación causal sigue abierta. No hay un snapshot dedicado de entorno para esta campaña ni una intervención que separe host, SDK, caché y servidor de construcción. Podemos mostrar el tiempo observado sin adjudicárselo a una sola novedad anunciada.

Para quien desarrolla a diario, SDK y herramientas también importan. Para quien atiende un servicio de producción, importan otras rutas. Una comparación rigurosa permite hablar de ambas sin hacerlas pasar por la misma medida.

Ya tenemos un mapa de costes pequeños y de herramientas para observarlos. Al reunirlos en un servidor veremos por qué una mejora local no determina por sí sola el comportamiento de una petición completa.

**Para contrastar este capítulo:** [I/O y criptografía](#evidencia-9d3b41746437) · [Diagnósticos](#evidencia-24932a96fd09) · [OpenTelemetry](#evidencia-49a84856569b) · [Perfiles y SDK](#evidencia-5998e62b150f) · [Matriz de trazabilidad](#evidencia-0f1a77641be5).

**Navegación:** [Anterior: 12. Concurrencia](#concurrencia) · [Índice](#indice) · [Siguiente: 14. HTTP](#http).

---

**PARTE IV — APLICACIONES REALES**

<a id="http"></a>
## 14. ASP.NET Core: qué ocurre cuando llegan miles de peticiones

Un microbenchmark puede concentrarse en una llamada. Un servidor tiene que recibir una petición, decidir qué hacer, ejecutar lógica, producir una respuesta y enviarla. Mientras tanto llegan otras peticiones.

**HTTP** define cómo se intercambian esas solicitudes y respuestas. **ASP.NET Core** es el framework web; **Kestrel**, el servidor que utiliza esta aplicación. Un **endpoint** asocia una ruta y un método HTTP con una operación: por ejemplo, GET `/processing`.

### Un endpoint pequeño para entender el recorrido

El siguiente programa es una Minimal API autónoma. Requiere un proyecto con `Microsoft.NET.Sdk.Web`. Conserva el cálculo y la forma de respuesta de `/processing`; omite la configuración e instrumentación del laboratorio y **no produjo las cifras publicadas**.

```csharp
// Ejemplo autónomo web: processing-api (C# 14, net10.0)
using Microsoft.AspNetCore.Builder;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();
app.MapGet("/processing", () => new
{
    count = 10_000,
    checksum = Compute(10_000)
});
app.Run();

static long Compute(int count)
{
    long checksum = 0;
    for (int i = 0; i < count; i++)
        if ((i & 1) == 0) checksum += (long)i * i;
    return checksum;
}
```

La respuesta contiene `count: 10000` y `checksum: 166616670000`. El cast a `long` se hace antes de multiplicar. El servidor recibe la solicitud, ejecuta el bucle, serializa el objeto y devuelve JSON. No se mide sólo la suma.

El [Program.cs real](#evidencia-665e52b5b87a) fija HTTP/1.1, límites, payloads, base de datos y los demás endpoints. Conserva el mismo código y EF Core 10.0.15 en ambos destinos.

### Nueve tipos de trabajo

| Endpoint GET | Trabajo y comprobación principal |
|---|---|
| `/text` | Texto fijo `Hello, runtime!`. |
| `/json/small` | DTO pequeño con id 42, nombre y estado conocidos. |
| `/json/large` | Serialización de 2000 DTO preparados. |
| `/processing` | Suma de cuadrados de los pares entre 0 y 9999. |
| `/async` | Espera real de temporizador de 2 ms, con cancelación. |
| `/storage` | Lee 4096 bytes de un archivo preparado; checksum 505160. |
| `/ef/orders` | Proyección de 20 pedidos con datos de cliente y número de líneas. |
| `/json/complex` | Objeto con propietario, 20 grupos de 100 enteros y tags. |
| `/channel` | Envía el cálculo a una cola de fondo reutilizada y espera su resultado. |

El POST de JSON complejo se verifica funcionalmente, pero no pertenece a esos nueve casos de throughput. Health se utiliza para readiness y para contrastar runtime/configuración, no como otra cifra del ranking.

No hay TLS, autenticación, proxy inverso ni compresión HTTP en esta campaña. Los proveedores de logging están desactivados en ambos lados. La ausencia es parte del experimento, no una recomendación para desplegar una API de producción sin esas capas.

### Cuánta carga y cómo se ordenó

El generador es **k6 2.3.0**. Cada caso calienta el servidor durante cinco segundos y mide después diez segundos, con un nuevo proceso cliente para la fase de medida.

Se utilizan 1, 10, 50 y 100 **usuarios virtuales**, VU. Es un modelo de circuito cerrado: cada VU mantiene una petición en curso y lanza la siguiente al terminar, sin un tiempo de espera humano entre ellas. VU no significa una cantidad garantizada de conexiones TCP distintas.

La selección canónica contiene **144 celdas**: nueve endpoints, cuatro niveles de concurrencia, dos runtimes y dos repeticiones. Sumó **15.287.645 peticiones**, sin errores HTTP ni checks fallidos en esa selección.

La primera campaña se interrumpió con 140 casos conservados. No se convirtió su timeout en un éxito. Se retuvieron las 128 celdas no-Channel y se completó aparte un bloque Channel equilibrado de 16; doce Channel históricos quedan fuera de la selección, pero no se borran. El [manifiesto canónico](#evidencia-2b58aa147724) explica qué se usa y por qué.

En el bloque r0 el orden es 10 → 11; en r1, 11 → 10. Alternarlo ayuda a observar deriva, aunque no convierte el portátil en un laboratorio aislado.

### Throughput: cuántas respuestas completamos

[![Throughput por concurrencia de text y processing, con las dos repeticiones separadas](/blog/dotnet-10-vs-dotnet-11/09-http-throughput.png)](/blog/dotnet-10-vs-dotnet-11/09-http-throughput.png)

*Figura 10. Selección editorial de text y processing: 32 de las 144 celdas canónicas. Cada curva conserva runtime y repetición; no es una media de todos los endpoints. El cliente y el servidor comparten equipo. Fuente: [resúmenes HTTP canónicos](#evidencia-d8f4c3a92139) y [script de carga](#evidencia-5a1a89cb8fab).*

[Abrir PNG a tamaño completo](/blog/dotnet-10-vs-dotnet-11/09-http-throughput.png).

El caso de cálculo a 100 VU es especialmente ilustrativo. En r0, .NET 10 completa unas 21.620 peticiones/s y .NET 11 unas 25.899. En r1, los valores bajan a 15.834 y 13.024 respectivamente: **cambia el signo de la comparación**.

Los checksums son correctos en las cuatro ejecuciones. El problema no es que una versión se haya saltado el bucle. El problema es que la diferencia entre ejecuciones del sistema es suficientemente grande como para invalidar una conclusión simple sobre capacidad.

El JSON complejo también cambia: aproximadamente 5238/3439 peticiones/s para 10/11 en r0 y 4214/5252 en r1. No se debe escoger el bloque favorable a una tesis y ocultar el otro.

### Latencia: cuánto espera cada petición

Throughput cuenta respuestas por unidad de tiempo. **Latencia** mide cuánto tarda una petición. Cuando hay muchas solicitudes en competencia, aumentar la presión puede aumentar la cola y las esperas, aunque la tasa total apenas suba.

[![P95 HTTP de text y processing por concurrencia y repetición independiente](/blog/dotnet-10-vs-dotnet-11/10-http-latency.png)](/blog/dotnet-10-vs-dotnet-11/10-http-latency.png)

*Figura 11. P95 en milisegundos de las mismas 32 celdas seleccionadas. Cada percentil pertenece a una ejecución, no a una agregación de r0 y r1. Menor puede ser mejor si conserva corrección y carga comparable. Fuente: [resúmenes originales seleccionados](#evidencia-d8f4c3a92139).*

[Abrir PNG a tamaño completo](/blog/dotnet-10-vs-dotnet-11/10-http-latency.png).

El P99 de processing a 100 VU pasa de 22,489 a 16,264 ms en r0, pero de 33,712 a 44,497 ms en r1, comparando 10 con 11. La inversión no queda escondida por mirar sólo la media.

El endpoint EF aporta otra observación, sin confundirlo aún con EF Core 11:

| Runtime y repetición, 100 VU | Peticiones/s | P50, ms | P95, ms | P99, ms |
|---|---:|---:|---:|---:|
| 10, r0 | 1713 | 54,191 | 76,418 | 198,723 |
| 11, r0 | 1542 | 53,436 | 120,833 | 285,075 |
| 11, r1 | 1600 | 53,387 | 114,191 | 224,531 |
| 10, r1 | 1766 | 52,778 | 73,157 | 189,423 |

Las medianas se parecen más que las colas de latencia. Ambos bloques presentan un P95/P99 adverso en 11, pero cliente, servidor y SQLite siguen compartiendo recursos. **Los dos servidores usan EF10**, por lo que esta tabla no prueba una regresión de EF11.

### El generador puede convertirse en parte del problema

En JSON complejo, 100 VU, .NET 10 r0, el cliente registró aproximadamente el 68,78% de CPU de toda la máquina y el servidor el 9,53%. El máximo combinado observado alcanzó el 81,10%.

No basta con decir «no llegamos al 100%, luego no hay cuello de botella». Un núcleo puede estar saturado mientras otros no lo están; parsing, validación y generación de carga compiten con el servidor. El cliente no es un observador sin coste.

Los recursos se muestrean cada 200 ms, no de forma continua. Por defecto no se guardó cada punto individual de latencia, para evitar añadir serialización y disco al generador. Se conservan resúmenes y checks, pero no podemos reconstruir después todos los tiempos ni fabricar intervalos bootstrap de muestras ausentes.

[![Captura histórica auténtica de la página HTTP generada a partir de los resultados canónicos](/blog/dotnet-10-vs-dotnet-11/16-http-evidence.png)](/blog/dotnet-10-vs-dotnet-11/16-http-evidence.png)

*Figura 12. Copia sin retoques de una captura real del navegador sobre el panel de resultados. Es el viewport histórico de 1440 × 1000, con varios endpoints y sus dos bloques; no es una captura del terminal ni una página completa. Algunos paneles continúan fuera de la imagen. Origen: [manifiesto histórico](#evidencia-705b372bd60d), panel HTTP; trazabilidad de la copia en [blog-image-manifest.json](#evidencia-a724e25f2ffb).*

[Abrir la captura HTTP a tamaño completo para leer los paneles](/blog/dotnet-10-vs-dotnet-11/16-http-evidence.png).

### Qué podemos hacer con estos millones de peticiones

Permiten inspeccionar contratos, detectar variación, comparar caminos y descubrir que la cola de latencia merece atención. No acreditan una capacidad de producción independiente del generador ni un SLA de semanas.

Para decidir un despliegue, mantendría el mismo protocolo funcional y separaría generador y servidor, con infraestructura controlada y la carga del servicio. Eso es una recomendación de validación para el lector, **no una campaña nueva realizada para este artículo**.

Contar millones de peticiones no compensa un diseño de medida que no permita atribuir su diferencia. En este caso, mostrar las dos repeticiones enseña más que anunciar un único porcentaje.

La API muestra el recorrido completo y los límites del generador. Para entender mejor la parte de datos hay que abrir otra capa: qué corresponde al runtime y qué cambia al actualizar Entity Framework Core.

**Para contrastar este capítulo:** [API real](#evidencia-665e52b5b87a) · [Script de carga](#evidencia-5a1a89cb8fab) · [Selección canónica](#evidencia-2b58aa147724) · [Resúmenes HTTP](#evidencia-d8f4c3a92139) · [Matriz de trazabilidad](#evidencia-0f1a77641be5).

**Navegación:** [Anterior: 13. Otras superficies](#otras-superficies) · [Índice](#indice) · [Siguiente: 15. EF Core](#ef-core).
<a id="ef-core"></a>
## 15. Entity Framework Core 10 frente a 11

Una aplicación suele trabajar con objetos, mientras una base de datos relacional organiza tablas, filas y relaciones. Un **ORM**, *Object-Relational Mapper*, ayuda a conectar esas representaciones. Entity Framework Core, EF Core, es el ORM utilizado aquí.

Eso no elimina SQL ni el motor de base de datos. Una consulta expresada en C# debe traducirse a operaciones que el proveedor y el motor puedan ejecutar. Después, los resultados deben convertirse en valores y objetos del programa.

### Qué cuesta una consulta

Podemos distinguir varias fases: construir o recuperar la representación de la consulta, abrir o utilizar una conexión, enviar SQL, ejecutar en el motor, leer filas y materializar objetos. **Materialización** es esa construcción de resultados en memoria.

`DbContext` coordina una unidad de trabajo. Con tracking, EF conserva información de entidades para identidad y detección de cambios. No es una caché que evite automáticamente todas las consultas SQL.

`AsNoTracking` es apropiado para muchas lecturas que no necesitan actualizar las entidades recuperadas. Pero cambiar tracking puede cambiar identidad, navegación y comportamiento de una aplicación; no es un atajo universal que podamos activar sin revisar el contrato.

Una **proyección** selecciona la forma de salida necesaria, en lugar de traer todo un grafo. Este fragmento es la consulta real del proyecto; requiere `ShopContext`, `OrderDto` y las referencias de [Workload.cs](#evidencia-00fc7b72f30d):

```csharp
// Fragmento real de Queries; no es un programa autónomo.
public static IQueryable<OrderDto> Projection(ShopContext db) =>
    db.Orders.AsNoTracking().Where(o => o.Id <= 20)
        .OrderBy(o => o.Id)
        .Select(o => new OrderDto(
            o.Id, o.Customer.Name, o.TotalCents, o.Lines.Count));
```

`IQueryable` conserva una expresión que el proveedor traduce; no es simplemente un `foreach` sobre todos los pedidos ya cargados. `ToList` o `ToListAsync` consume la consulta y materializa la lista.

`Include` y `ThenInclude`, en cambio, piden entidades relacionadas. Pueden producir un conjunto de filas y un grafo mayores. Comparar ese resultado con un DTO más pequeño no aísla una optimización del ORM: hemos cambiado el trabajo solicitado.

### Separar runtime y paquete

La matriz utiliza tres celdas:

1. **EF10 / runtime10**: referencia.
2. **EF10 / runtime11**: conserva la versión de EF.
3. **EF11 / runtime11**: cambia EF y sus dependencias manteniendo el runtime.

No existe una cuarta celda EF11/runtime10 equivalente: el paquete EF11 requiere net11. Forzar una combinación no soportada no haría más completa la comparación.

Además, la biblioteca nativa SQLite observada es **3.53.3** con EF10 en ambos runtimes y **3.53.4** con EF11. La segunda flecha no cambia sólo archivos del ORM: también proveedor y transitivas. Los lockfiles y `sqlite_version()` registran la versión efectiva, no una suposición.

### Dataset y repeticiones

Se utilizan bases nuevas de 100 y 1000 clientes. Cada cliente tiene cinco pedidos y cada pedido tres líneas. Hay índices y valores deterministas de regiones, nombres e importes. Sembrar la base queda fuera del tiempo de las operaciones.

Hay once workloads: simple, join, groupby, include, no-tracking, compiled, projection, materialization, relations, insert-100 y update-100. La matriz completa ejecutó **18 procesos independientes**, con cinco calentamientos y quince muestras por operación: 198 celdas y 2970 muestras medidas.

Cada operación crea su contexto y conexión con `Pooling=False`. El coste de apertura forma parte del camino. Es diferente de un servicio con pooling caliente y una conexión remota ya utilizada.

Las escrituras de cien elementos verifican el cambio, hacen rollback y comprueban el estado restaurado. Ese trabajo pertenece al escenario y no representa un motor de inserción masiva sin transacción ni comprobaciones.

### Datos que no dibujan una mejora uniforme

[![Resultados EF de consulta simple y proyección para 1000 clientes, con tres procesos independientes por tratamiento](/blog/dotnet-10-vs-dotnet-11/11-ef-core.png)](/blog/dotnet-10-vs-dotnet-11/11-ef-core.png)

*Figura 13. Media de las tres medias de proceso, en ms/op; corchetes y bigotes son mínimo–máximo de esas tres medias, **no un intervalo de confianza**. Cada proceso aporta quince muestras tras calentamiento. Fuente: [independent-runs](#evidencia-0730b27082ed) y [raw por proceso](#evidencia-342dff88bdf2).*

[Abrir PNG a tamaño completo](/blog/dotnet-10-vs-dotnet-11/11-ef-core.png).

La consulta simple pasa de 2,871 ms con EF10/runtime10 a 4,048 con EF10/runtime11 y 2,915 con EF11/runtime11 en esa selección. La proyección, de 3,231 a 2,861 y 2,809 ms. Dos operaciones del mismo entorno no evolucionan igual.

Para Include, las medias de proceso agregadas son 17,488, 16,780 y 17,292 ms; sus rangos, 16,608–19,064, 16,180–17,964 y 16,397–18,127. La variación visible importa más que presentar la tercera cifra decimal como una garantía.

Una **consulta compilada** conserva un delegate de consulta para reducir parte de la preparación repetida; no guarda todas las filas ni evita el trabajo del motor. El escenario compiled registra 2,724, 2,897 y 2,852 ms de media. Tampoco es idéntico a simple: recupera clientes con una consulta compilada y suma en el consumidor, mientras simple agrega en SQL.

El conjunto no sostiene «EF11 acelera todas las consultas». Sí permite localizar caminos candidatos y recordar que traducción, apertura, materialización y motor no pesan lo mismo en cada operación.

### Mirar SQL sin meter el log dentro del cronómetro

Las nueve consultas de origen inspeccionadas mediante `ToQueryString` produjeron el mismo texto entre EF10 y EF11 sobre runtime11 y dataset1000. Se capturaron también comandos ejecutados fuera de la medida.

Eso reduce una explicación posible en esos casos, pero no demuestra que cada comando final, plan del motor o escenario de escritura sea idéntico. La inspección de SQL no estaba activada como un logger costoso dentro de cada muestra.

La memoria registrada es administrada del hilo síncrono de la operación; no incluye toda la memoria nativa SQLite ni otros hilos. Más objetos materializados pueden explicar parte del coste conceptual de una consulta, pero no hemos hecho una descomposición causal de cada delta.

Para una aplicación empresarial, la conclusión es revisar las consultas que usa, el proveedor real y el esquema. Una base SQLite local no certifica SQL Server, PostgreSQL o Cosmos. El [catálogo EF](#evidencia-30f35e655cc7) conserva los once contratos y sus oráculos de resultado.

Runtime, ORM y motor nativo ya están separados. Queda otra decisión que no cambia una consulta, pero sí cómo se entrega y arranca la aplicación: la forma de publicación.

**Para contrastar este capítulo:** [Workload EF](#evidencia-00fc7b72f30d) · [Contratos de aplicaciones](#evidencia-30f35e655cc7) · [Procesos independientes](#evidencia-0730b27082ed) · [Originales EF](#evidencia-342dff88bdf2) · [Matriz de trazabilidad](#evidencia-0f1a77641be5).

**Navegación:** [Anterior: 14. HTTP](#http) · [Índice](#indice) · [Siguiente: 16. Native AOT](#native-aot).
<a id="native-aot"></a>
## 16. Native AOT: compilar antes de ejecutar

Hasta ahora hemos hablado principalmente de generar código máquina durante la ejecución. **AOT**, *Ahead-Of-Time*, adelanta ese trabajo a la construcción de la aplicación.

Con **Native AOT**, publicamos un ejecutable nativo autocontenido sin JIT. Puede interesar cuando importan el arranque, el número de instancias o la distribución. El precio incluye más decisiones en build y restricciones sobre código que pretende descubrir o generar comportamiento dinámicamente.

No es equivalente a «un `.exe`»: una aplicación framework-dependent puede tener un apphost `.exe` que arranca una DLL administrada y utiliza un runtime instalado. La extensión no identifica la estrategia.

### Cuatro formas de publicar

| Modo | Qué lleva la distribución | Qué ocurre con la compilación |
|---|---|---|
| Framework-dependent, FDD | La aplicación; necesita un runtime compatible instalado | Conserva JIT; el tamaño publicado no suma el runtime del host. |
| Self-contained | Aplicación y runtime para un RID | Sigue pudiendo usar JIT; incorporar el runtime no significa compilar todo nativamente. |
| ReadyToRun, R2R | En este experimento, distribución autocontenida con código precompilado e IL | Adelanta parte del trabajo y conserva caminos JIT. |
| Native AOT | Ejecutable nativo autocontenido, con trimming | No usa JIT; hay que resolver requisitos dinámicos y compatibilidad al publicar. |

El **RID**, identificador de runtime como `win-x64`, relaciona sistema y arquitectura. Una publicación para Windows x64 no es automáticamente un binario Linux ni Arm64.

**Trimming** elimina código que el análisis considera innecesario. Si una aplicación descubre tipos mediante nombres o reflexión dinámica, el análisis puede necesitar información explícita o encontrar limitaciones reales. Ignorar warnings no hace que esos caminos funcionen.

Un ejemplo conceptual de cambio de publicación es este comando para el proyecto de consola del laboratorio:

```powershell
# Procedimiento de reproducción; no se ejecuta al leer el artículo.
.dotnet/dotnet.exe publish src/NativeAot/Console/NativeConsole.csproj `
  -c Release -f net11.0 -r win-x64 -p:PublishAot=true
```

Los comandos completos y los proyectos efectivos están en el [catálogo de publicación](#evidencia-47f40c3835b9) y el [runner](#evidencia-814202861e40). No se debe sustituir en silencio un fallo de toolchain AOT por una publicación JIT.

### Mismas aplicaciones, dieciséis tratamientos

La consola calcula y señala readiness mediante un archivo JSON. La API utiliza Minimal API con `CreateSlimBuilder`, health y un POST de cálculo. En todos los modos de la API se usa JSON generado y reflection desactivada de la misma forma: no se optimiza sólo el lado 11.

Son dos aplicaciones, dos runtimes y cuatro modos: **16 publicaciones**. Cada tratamiento se arranca cinco veces, **80 procesos correctos**. La aplicación comprueba su runtime y `RuntimeFeature.IsDynamicCodeSupported`: false en Native AOT, true en los modos con JIT.

Una publicación por tratamiento no son cinco publicaciones independientes. Los cinco procesos corresponden al arranque del mismo artefacto.

### El tamaño que realmente creció

[![Tamaño de los ejecutables Native AOT de consola y API, separando los assets estáticos](/blog/dotnet-10-vs-dotnet-11/12-nativeaot-size.png)](/blog/dotnet-10-vs-dotnet-11/12-nativeaot-size.png)

*Figura 14. Inventario de ejecutable, una publicación por tratamiento, símbolos excluidos. Consola: 2.455.040 → 2.507.264 bytes; API: 10.780.160 → 10.946.560. La API añade por separado un JSON de 53 bytes idéntico en ambos lados. Fuente: [publicaciones originales](#evidencia-7600edfd6c82) y [control de archivos retenidos](#evidencia-ccfdaa91eb0c).*

[Abrir PNG a tamaño completo](/blog/dotnet-10-vs-dotnet-11/12-nativeaot-size.png).

La consola crece **52.224 bytes** y la API **166.400**. No es una consecuencia de más carga del sistema durante el cronómetro: estamos contando bytes de archivos. El control posterior confirmó tamaños de los ejecutables retenidos, no una recompilación determinista de todos los artefactos.

Sabemos cuánto crece; **no sabemos descomponer su causa interna** en código, metadata o decisiones de compilación. No se forzó una ISA idéntica de ILC ni se reconstruyó el runtime con y sin el PR que cambia dispatch. Atribuir el aumento al [PR 130202](https://github.com/dotnet/runtime/pull/130202) sería saltar de una novedad documentada a una causalidad no demostrada.

El tamaño total de API/AOT es 10.780.213 → 10.946.613 bytes porque incorpora aquel asset. Un PDB no está escondido en el aumento. Y una carpeta FDD pequeña no representa el tamaño total de despliegue si requiere un runtime instalado fuera de ella.

### Arrancar antes no implica que 11 mejore siempre a 10

[![Arranque Native AOT de consola y API a partir de cinco procesos por tratamiento](/blog/dotnet-10-vs-dotnet-11/13-nativeaot-startup.png)](/blog/dotnet-10-vs-dotnet-11/13-nativeaot-startup.png)

*Figura 15. Medias y rangos observados de los cinco arranques Native AOT, no IC. La caché del SO no se vació; consola y API tienen señales de disponibilidad distintas. Fuente: [muestras originales](#evidencia-7600edfd6c82).*

[Abrir PNG a tamaño completo](/blog/dotnet-10-vs-dotnet-11/13-nativeaot-startup.png).

Para situar esa observación frente al camino FDD, conviene mirar mediana y rango además de la media:

| Aplicación / modo | Runtime | Media, ms | Mediana, ms | Mínimo–máximo, ms |
|---|---|---:|---:|---:|
| Consola / FDD | 10 | 152,76 | 155,28 | 141,15–161,06 |
| Consola / FDD | 11 | 123,12 | 116,54 | 115,26–134,50 |
| Consola / AOT | 10 | 42,58 | 41,91 | 38,60–48,34 |
| Consola / AOT | 11 | 47,17 | 41,56 | 39,33–72,51 |
| API / FDD | 10 | 471,41 | 449,74 | 445,20–551,31 |
| API / FDD | 11 | 455,86 | 448,63 | 441,43–497,16 |
| API / AOT | 10 | 197,19 | 194,94 | 192,11–207,27 |
| API / AOT | 11 | 197,31 | 192,02 | 190,05–207,55 |

La ventaja de AOT frente al camino FDD es visible en estas aplicaciones. La comparación **AOT11 frente a AOT10** es otra pregunta: las medianas de consola son casi iguales y una muestra de 72,51 ms eleva la media de 11. La API AOT conserva prácticamente su media.

ReadyToRun aporta otra advertencia: API/11 tiene media de 775,88 ms y mediana de 492,48, frente a 488,21/446,55 en 10. La primera muestra de 11 fue 1943,78 ms. No se elimina para mejorar la tabla ni se presenta como una fase JIT identificada: no se instrumentó su causa.

El cronómetro empieza al lanzar el proceso y termina al observar readiness. En la API incluye polling HTTP; en consola, otro protocolo. Son procesos nuevos con caché de SO no vaciada, no arranque de disco frío. Los [dieciséis inventarios completos](#evidencia-72dacfc93ab3) conservan también los otros modos, símbolos y muestras.

### Memoria, publicación y compatibilidad

El working set medio observado de API/AOT fue 24.263.885 bytes en 10 y 24.879.104 en 11; el de API/FDD, 49.340.416 y 51.314.688. Es residencia en el punto definido por el protocolo, no B/op ni el consumo de toda la máquina.

Publicar AOT tardó 7,12/5,79 s en consola y 18,87/15,53 en API, para 10/11. Son observaciones de **una** publicación después de restore y build, con cachés presentes y publicación incremental. No acreditan el tiempo de una compilación limpia ni un flujo completo de CI.

La compatibilidad exige revisar reflexión, serialización, carga dinámica, genéricos, interop y dependencias. Que esta Minimal API funcione no certifica automáticamente MVC, todos los proveedores EF o un sistema de plugins con generación dinámica de código.

Para una herramienta de línea de comandos o una instancia de vida corta, arrancar antes puede ser un beneficio tangible. Para un servicio longevo dominado por base de datos o red, el coste de adaptar dependencias puede pesar más. Native AOT es una forma de construir y distribuir con compromisos concretos, no un sustituto universal del JIT.

La publicación obliga a elegir compromisos de distribución y compatibilidad. El lenguaje plantea otra elección independiente: cómo expresar mejor los contratos del programa sin atribuir a la sintaxis tiempos que no se han medido.

**Para contrastar este capítulo:** [Proyectos Native AOT](#evidencia-47338399560d) · [Runner de publicación](#evidencia-814202861e40) · [Inventario y arranques originales](#evidencia-7600edfd6c82) · [Los dieciséis tratamientos](#evidencia-72dacfc93ab3) · [Matriz de trazabilidad](#evidencia-0f1a77641be5).

**Navegación:** [Anterior: 15. EF Core](#ef-core) · [Índice](#indice) · [Siguiente: 17. C# 14 y 15](#csharp).

---

**PARTE V — NUEVAS POSIBILIDADES Y DECISIONES**

<a id="csharp"></a>
## 17. C# 14 frente a C# 15

Una mejora del runtime puede beneficiar código sin cambiar su sintaxis. Una novedad del lenguaje suele hacer lo contrario: necesitamos escribirla para obtener su expresividad.

Eso no es menos importante. Un contrato más claro puede evitar estados inválidos, duplicación o errores al añadir casos. Pero **más legible no equivale automáticamente a más rápido**. Las muestras de lenguaje de esta investigación comprueban resultados y reglas de compilación, no porcentajes de rendimiento.

Los siguientes pares son programas didácticos completos salvo el par de archivos de biblioteca, identificado como tal. Se basan en [Before14](#evidencia-c09084b853ba), [After15](#evidencia-c0d8e32e6c8e) y las muestras específicas enlazadas. Se separa cada característica para poder leerla sin depender de las demás.

### Unions: expresar «uno de estos tipos»

Un resultado puede ser una de varias alternativas: un pago aceptado o rechazado, un mensaje de varios tipos, una lectura numérica o textual. Antes podíamos representar esa familia mediante una jerarquía de clases.

**Antes, C# 14:**

```csharp
// Ejemplo autónomo: union-antes (C# 14, net10.0)
using System;

Console.WriteLine(Describe(new Cat("Milo")));
Console.WriteLine(Describe(new Dog("Rex")));
Console.WriteLine(Describe(new Bird("Pip")));

static string Describe(Pet pet) => pet switch
{
    Cat cat => "cat:" + cat.Name,
    Dog dog => "dog:" + dog.Name,
    Bird bird => "bird:" + bird.Name,
    _ => throw new ArgumentOutOfRangeException(nameof(pet))
};

public abstract record Pet;
public sealed record Cat(string Name) : Pet;
public sealed record Dog(string Name) : Pet;
public sealed record Bird(string Name) : Pet;
```

La jerarquía funciona, pero `Pet` no expresa por sí sola una familia cerrada al compilador: podría aparecer otro descendiente permitido. El brazo final cubre ese caso.

**Después, C# 15:**

```csharp
// Ejemplo autónomo: union-despues (C# 15, net11.0)
using System;

Console.WriteLine(Describe(new Cat("Milo")));
Console.WriteLine(Describe(new Dog("Rex")));
Console.WriteLine(Describe(new Bird("Pip")));

static string Describe(Pet pet) => pet switch
{
    Cat cat => "cat:" + cat.Name,
    Dog dog => "dog:" + dog.Name,
    Bird bird => "bird:" + bird.Name
};

public union Pet(Cat, Dog, Bird);
public sealed record Cat(string Name);
public sealed record Dog(string Name);
public sealed record Bird(string Name);
```

Ambos producen `cat:Milo`, `dog:Rex` y `bird:Pip`. Los records de la segunda versión no heredan de Pet: la union declara las alternativas permitidas. El compilador puede analizar la exhaustividad del patrón sobre esa familia.

Eso ayuda al evolucionar el código: añadir una alternativa obliga a revisar consumidores que suponían haber cubierto todo. No desaparecen las preguntas de versionado de una API pública. Y la investigación también comprueba el valor por defecto de una union, sin caso activo, mediante su contrato JSON; no asumimos que cualquier `default` represente automáticamente una de nuestras mascotas.

Las muestras originales tratan como error la advertencia de switch no exhaustivo en el caso previsto. El beneficio defendible es el contrato y su comprobación, no que almacenar un Pet reduzca allocations en cualquier diseño.

### `closed`: cerrar una jerarquía sin convertirla en una union

En otros diseños sí queremos herencia, pero queremos controlar quién puede ampliarla directamente.

**Antes:**

```csharp
// Ejemplo autónomo: closed-antes (C# 14, net10.0)
using System;

Console.WriteLine(IsOpen(new Open()));
static bool IsOpen(GateState state) => state switch
{
    Open => true,
    Closed => false,
    _ => throw new ArgumentOutOfRangeException(nameof(state))
};

public abstract record GateState;
public sealed record Open : GateState;
public sealed record Closed : GateState;
```

**Después:**

```csharp
// Ejemplo autónomo: closed-despues (C# 15, net11.0)
using System;

Console.WriteLine(IsOpen(new Open()));
static bool IsOpen(GateState state) => state switch
{
    Open => true,
    Closed => false
};

public closed record GateState;
public sealed record Open : GateState;
public sealed record Closed : GateState;
```

La salida es `True`. `closed` restringe los descendientes directos al ensamblado que define la base y esa declaración es implícitamente abstracta. No significa que cualquier rama posterior de la jerarquía sea transitivamente sellada; en el ejemplo los hijos sí son `sealed`.

La diferencia con una union no es sólo estética: aquí hay una relación de herencia; en la union, una elección entre tipos. Elegir depende del modelo, no de una presunta superioridad universal de rendimiento.

### Argumentos en expresiones de colección: capacidad y comparador explícitos

Una lista puede necesitar capacidad suficiente y un conjunto puede necesitar un comparador concreto. Ocultar esas decisiones al abreviar la inicialización sería perder parte del contrato.

**Antes:**

```csharp
// Ejemplo autónomo: collection-antes (C# 14, net10.0)
using System;
using System.Collections.Generic;

int[] values = [1, 2, 3];
var list = new List<int>(values.Length * 2);
list.AddRange(values);
var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
{
    "Hello", "HELLO", "hello"
};
Console.WriteLine($"{list.Count}:{list.Capacity}:{names.Count}");
```

**Después:**

```csharp
// Ejemplo autónomo: collection-despues (C# 15, net11.0)
using System;
using System.Collections.Generic;

int[] values = [1, 2, 3];
List<int> list = [with(capacity: values.Length * 2), .. values];
HashSet<string> names = [
    with(StringComparer.OrdinalIgnoreCase), "Hello", "HELLO", "hello"
];
Console.WriteLine($"{list.Count}:{list.Capacity}:{names.Count}");
```

La salida sigue siendo `3:6:1`: tres elementos, capacidad seis y un único nombre según el comparador. Los argumentos preservan las decisiones al utilizar una expresión de colección.

Preasignar puede evitar crecimientos, pero ambos ejemplos ya solicitan la misma capacidad. La muestra no mide ni demuestra que la nueva notación supere a la anterior.

### Indexadores de extensión: nueva notación, mismo algoritmo

Los bloques de extensión ya tenían antecedentes en C# 14. La novedad examinada aquí es poder declarar un **indexador de extensión**.

**Antes:**

```csharp
// Ejemplo autónomo: indexer-antes (C# 14, net10.0)
using System;
using System.Collections.Generic;
using System.Linq;

IEnumerable<int> sequence = new[] { 10, 20, 30 };
Console.WriteLine(sequence.ElementAt(2));
```

**Después:**

```csharp
// Ejemplo autónomo: indexer-despues (C# 15, net11.0)
using System;
using System.Collections.Generic;
using System.Linq;

IEnumerable<int> sequence = new[] { 10, 20, 30 };
Console.WriteLine(sequence[2]);

public static class SequenceIndexer
{
    extension(IEnumerable<int> sequence)
    {
        public int this[int index] => sequence.ElementAt(index);
    }
}
```

La salida es `30`. La sintaxis no convierte cualquier `IEnumerable` en un array. El cuerpo sigue usando `ElementAt`: algunos orígenes permiten resolverlo directamente y otros exigen recorrer elementos. Si repetimos índices sobre una secuencia que recorre desde el principio, la notación cómoda puede ocultar un algoritmo costoso.

Por eso la API debe comunicar su complejidad y contrato, no sólo resultar bonita en el punto de llamada.

### Break y continue con etiqueta: salir del bucle correcto

En bucles anidados, `break` afecta normalmente al bucle más cercano. A veces queremos saltar al siguiente elemento del exterior o abandonar toda la búsqueda.

El caso del proyecto descarta una fila cuando aparece un negativo y busca después un `9`. Si la fila es `[-1, 9]`, ese `9` no debe aceptarse: la fila ya se ha descartado.

**Antes, con destinos `goto`:**

```csharp
// Ejemplo autónomo: labels-antes (C# 14, net10.0)
using System;

Console.WriteLine(FindGoal([[-1, 9], [0, 9]]));
Console.WriteLine(FindGoal([[1, 2], [3, 4]]));

static int FindGoal(int[][] rows)
{
    int answer = -1;
    for (int row = 0; row < rows.Length; row++)
    {
        for (int col = 0; col < rows[row].Length; col++)
        {
            if (rows[row][col] < 0) goto NextRow;
            if (rows[row][col] == 9)
            {
                answer = row * 10 + col;
                goto Found;
            }
        }
    NextRow: ;
    }
Found:
    return answer;
}
```

**Después, nombrando el bucle:**

```csharp
// Ejemplo autónomo: labels-despues (C# 15, net11.0)
using System;

Console.WriteLine(FindGoal([[-1, 9], [0, 9]]));
Console.WriteLine(FindGoal([[1, 2], [3, 4]]));

static int FindGoal(int[][] rows)
{
    int answer = -1;
    outer:
    for (int row = 0; row < rows.Length; row++)
    {
        for (int col = 0; col < rows[row].Length; col++)
        {
            if (rows[row][col] < 0) continue outer;
            if (rows[row][col] == 9)
            {
                answer = row * 10 + col;
                break outer;
            }
        }
    }
    return answer;
}
```

Las salidas son `11` y `-1`. El primer valor representa fila 1, columna 1 en esta codificación de la fixture, no un índice general válido para matrices de cualquier anchura. El segundo indica ausencia.

No hemos «optimizado quitando comprobaciones». Hemos expresado el destino de control sobre el propio bucle y conservado el comportamiento del caso positivo y del caso sin coincidencia.

### Métodos estáticos no virtuales en interfaces y targets antiguos

Esta novedad necesita un matiz: **C# no estrena ahora todos los métodos estáticos en interfaces**. El caso investigado relaja una restricción para métodos estáticos no virtuales con cuerpo cuando se construye para targets antiguos.

Antes, una clase auxiliar permite ofrecer la función sin recurrir a esa posibilidad. Archivo de biblioteca completo, equivalente didáctico del helper:

```csharp
// Archivo de biblioteca: helper-antes (C# 14, netstandard2.0)
namespace Comparison.Language
{
    public static class Measurement
    {
        public static double ToMeters(double centimeters) => centimeters / 100;
    }
    public static class MeasurementConsumer
    {
        public static double Convert(double centimeters) => Measurement.ToMeters(centimeters);
    }
}
```

Después, archivo real de [LegacyInterface15/Measurement.cs](#evidencia-3e3eaf845eb4):

```csharp
// Archivo de biblioteca: helper-despues (C# 15, netstandard2.0)
namespace Comparison.Language;

public interface IMeasurement
{
    public static double ToMeters(double centimeters) => centimeters / 100;
}

public static class MeasurementConsumer
{
    public static double Convert(double centimeters) => IMeasurement.ToMeters(centimeters);
}
```

`MeasurementConsumer.Convert(250)` devuelve `2.5` en ambos casos. El proyecto de la segunda versión declara `netstandard2.0` y C# 15. No utiliza dispatch virtual de instancia, miembros `static abstract` ni una implementación por defecto de instancia.

Compilar esa biblioteca y consumirla en los runtimes modernos ejercitados no prueba que se haya arrancado un CLR antiguo. La investigación acredita compilación y consumo; no inventa una ejecución en .NET Framework para ampliar la compatibilidad demostrada.

### Memory safety: preview distinta de C# 15 estable

En código de bajo nivel, un puntero representa una dirección. Desreferenciarlo accede a memoria, con riesgos que no desaparecen por mejorar la sintaxis.

Con el modelo anterior, este ejemplo necesita un contexto `unsafe`:

```csharp
// Ejemplo autónomo: memory-antes (C# 14, net10.0)
// Configuración: AllowUnsafeBlocks=true
using System;

unsafe
{
    int number = 42;
    int* pointer = &number;
    Console.WriteLine(*pointer);
}
```

La preview separa declarar o tomar ciertas direcciones de realizar el acceso que requiere la marca:

```csharp
// Ejemplo autónomo: memory-despues (C# preview, net11.0)
// Configuración: AllowUnsafeBlocks=true; Features=updated-memory-safety-rules
using System;

int number = 42;
int* pointer = &number;
Console.WriteLine(unsafe(*pointer));
```

Ambos imprimen `42`. El segundo requiere `LangVersion=preview`, `AllowUnsafeBlocks=true` y el feature `updated-memory-safety-rules`. No se activa por elegir C# 15 estable, ni mediante una propiedad ficticia `MemorySafetyRules`.

La [muestra completa](#evidencia-c7d37de1a813) añade `fixed`, acceso indexado y una llamada marcada como insegura. No demuestra que cualquier programa con punteros se vuelva seguro. Cambia cómo se hacen explícitas ciertas operaciones; conservar direcciones válidas, vida útil y límites sigue siendo responsabilidad del diseño.

### Qué verificó realmente la matriz de lenguaje

El [resultado histórico main-pinned](#evidencia-e4716719f12b) contiene 22 operaciones con resultado esperado, incluidos tres rechazos de compilación previstos. Un restore fallido no sirve como rechazo de sintaxis: se exigieron errores del compilador.

No son 22 benchmarks. Tampoco se debe convertir el rechazo conjunto de After15 con C# 14 en seis controles negativos independientes de cada característica. La cobertura ejecutada está identificada por operación.

Para un equipo, las novedades más interesantes pueden ser contratos más claros y código más fácil de revisar. Se pueden adoptar después de validar el runtime, sin activar a la vez previews o cambiar toda la representación de datos.

Estas posibilidades no tienen que adoptarse en bloque. El siguiente capítulo convierte la separación entre runtime, paquetes, lenguaje y previews en una secuencia de migración reversible.

**Para contrastar este capítulo:** [Before14](#evidencia-c09084b853ba) · [After15](#evidencia-c0d8e32e6c8e) · [Preview de memoria](#evidencia-c7d37de1a813) · [Matriz histórica de lenguaje](#evidencia-e4716719f12b) · [Matriz de trazabilidad](#evidencia-0f1a77641be5).

**Navegación:** [Anterior: 16. Native AOT](#native-aot) · [Índice](#indice) · [Siguiente: 18. Migración](#migracion).
<a id="migracion"></a>
## 18. Migrar una aplicación sin cambiarlo todo a la vez

La tentación es actualizar SDK, runtime, C#, EF, contenedor y publicación en una sola rama y medir el resultado final. Si falla o empeora algo, habremos cambiado demasiadas variables para saber por dónde empezar.

Una migración pequeña y reversible facilita tanto la ingeniería como la investigación. No exige mantener para siempre dos implementaciones: exige ordenar los cambios para entender sus efectos.

### Paso 1: inventario y referencia funcional

Antes de tocar el TFM, registrar SDK, runtimes, paquetes directos y transitivos, base de datos, SO, arquitectura y forma de despliegue. Guardar el artefacto anterior y su configuración.

Después, identificar contratos que no pueden cambiar: respuestas, datos, orden cuando sea relevante, cancelación, autenticación, errores y procedimientos de recuperación. Un test de «arranca» no cubre una aplicación que guarda dinero o procesa documentos.

El hardware también importa. .NET 11 eleva el mínimo x64 a **v2**, que incluye POPCNT y SSE4.2; no impone AVX2 como mínimo universal. Los binarios R2R x64 de Windows/Linux apuntan a v3, por lo que una máquina v2 soportada puede necesitar más JIT al arrancar. Arm64 y los sistemas operativos tienen matrices propias.

Hay que cotejar edición, arquitectura y actualizaciones soportadas. Que Windows muestre una familia de kernel `10.0` no significa que sea Windows 10, y que una tabla admita alguna edición LTSC no admite todas las ediciones de Windows 10.

### Paso 2: cambiar runtime conservando lenguaje y EF

Este es un archivo completo ilustrativo de proyecto web de partida; no es el csproj usado por el benchmark:

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <RuntimeFrameworkVersion>10.0.15</RuntimeFrameworkVersion>
    <RollForward>Disable</RollForward>
    <LangVersion>14.0</LangVersion>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <RestorePackagesWithLockFile>true</RestorePackagesWithLockFile>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.EntityFrameworkCore.Sqlite" Version="10.0.15" />
  </ItemGroup>
</Project>
```

La primera intervención cambia sólo estos valores del proyecto:

```diff
- <TargetFramework>net10.0</TargetFramework>
- <RuntimeFrameworkVersion>10.0.15</RuntimeFrameworkVersion>
+ <TargetFramework>net11.0</TargetFramework>
+ <RuntimeFrameworkVersion>11.0.0</RuntimeFrameworkVersion>
```

Y la selección de SDK se fija en un `global.json` completo:

```json
{
  "sdk": {
    "version": "11.0.100",
    "rollForward": "disable",
    "allowPrerelease": false
  }
}
```

Mantener C# 14 y EF10 reproduce la separación de factores de nuestra matriz. Hay que revisar también sufijos como `-windows` o `-android`; no sustituir cualquier TFM compuesto por el ejemplo simple.

`global.json` fija SDK, no el runtime que ya está instalado o utiliza producción. El pin y RollForward del ejemplo buscan una referencia exacta. **La política de servicing de producción debe decidirse aparte**, evitando quedar sin parches por copiar una configuración de laboratorio sin criterio.

Un incidente del proyecto ilustra el riesgo: un pin evaluado antes de conocer el TFM y un runtimeconfig incremental obsoleto pedían 10.0.0. Se corrigió el orden en `Directory.Build.targets` y la invalidación de su generación; no se habilitó roll-forward para ocultarlo. La ejecución comprobó después 10.0.15.

### Paso 3: revisar dependencias y actualizar EF por separado

Restaurar inicialmente con el grafo actualizado conscientemente y revisar el lockfile. Después, CI puede exigir `--locked-mode` para detectar deriva. La mera presencia de lockfiles no garantiza que cada proyecto temporal generado por una herramienta esté restaurando en modo locked.

Al pasar a EF11 hay que mirar más que la versión del paquete. Entre los cambios oficiales relevantes:

- SQL Server utiliza compatibilidad predeterminada 160; configurar el nivel real o actualizar el motor, no fingir que soporta funciones inexistentes. La autenticación Entra del nuevo SqlClient puede requerir su paquete de extensiones.
- Cosmos cambia el tratamiento de propiedades no mapeadas y serialización; una escritura puede perder datos que antes se conservaban. Hay cambios de IDs y se retira el I/O síncrono.
- Aplicar migrations cuando no se encuentra ninguna pasa a fallar; hay que corregir la configuración, no silenciarlo. `EnsureCreated` en una fixture nueva no sustituye migrations.
- Revisar referencia explícita a `Microsoft.EntityFrameworkCore.Design`, convenciones de colecciones primitivas y cambios de herramientas.
- Split queries pueden lanzar `DbQueryConcurrencyException` cuando los datos concurrentes no permiten correlacionar resultados; elegir aislamiento y contrato correctos, no descartar información o añadir reintentos sin diseño.
- SQLite exige revisar proveedor, bundles y biblioteca nativa. EF11 y Microsoft.Data.Sqlite11 no tienen exactamente los mismos targets; no asumirlo por compartir número.

Las capacidades como FullJoin traducido, jerarquías complejas o vectores dependen de proveedor y estado de la característica. El soporte de un caso SQLite no certifica SQL Server o Cosmos; las funciones vectoriales experimentales no deben presentarse como contrato estable general.

La [guía de migración](#evidencia-c27572d4a0b1) desarrolla cada incompatibilidad con fuentes oficiales. Son controles documentados para la aplicación del lector, no una declaración de que aquí se hayan ejercitado todos.

### Paso 4: C# 15 y previews como decisiones independientes

Una vez validado el runtime y las dependencias, elegir `LangVersion=15.0` permite adoptar sintaxis estable. No obliga a reescribir todas las jerarquías o colecciones existentes.

Runtime Async preview debe vivir en un tratamiento identificable, comprobando tareas completadas y pendientes, cancelación, contexto, excepciones y herramientas. La preview de memoria tiene otra configuración. No se activan como una casilla genérica de «más rápido».

Los antiguos switches `DOTNET_RuntimeAsync` y `UNSUPPORTED_RuntimeAsync` fueron eliminados; conservarlos en un pipeline puede crear una falsa sensación de control.

### Paso 5: contenedores y despliegue real

Una imagen oficial no sólo contiene el runtime: también una distribución y bibliotecas nativas. El valor por defecto de 10 utiliza Ubuntu Noble y el de 11 Resolute en el catálogo revisado. Cambiar ambos a la vez incorpora libc, ICU u OpenSSL a la comparación.

Para una base Linux común se documentan:

```text
mcr.microsoft.com/dotnet/aspnet:10.0.15-resolute
mcr.microsoft.com/dotnet/aspnet:11.0.0-resolute
```

Son tags consultados, **no imágenes que este laboratorio haya descargado y ejecutado**. En una ejecución nueva hay que resolver y guardar el digest real, arquitectura y variante. No se añade un hash inventado para que el Dockerfile parezca reproducible.

`sdk` sirve para construir; `aspnet`, para hospedar una aplicación web que necesita ese framework; `runtime-deps` puede ser base de un binario autocontenido compatible. AOT necesita también el toolchain correspondiente en construcción. No mezclar sin revisar musl de Alpine con un binario para glibc.

Las variantes reducidas sin shell cambian cómo diagnosticamos. Las necesidades de ICU o zonas horarias pueden exigir otra variante. Para Windows containers hay que revisar imagen y host; la matriz de SO no demuestra por sí sola que exista un tag ASP.NET concreto.

Una publicación self-contained incorpora su runtime: instalar un shared runtime parcheado no sustituye sus archivos. Hay que republicar y desplegar. En IIS también importan Hosting Bundle, permisos y arquitectura; instalar SDK sólo en el agente no actualiza el servidor.

### Paso 6: comprobar seguridad, diagnóstico y rollback

Cambios en validaciones de archivos comprimidos, TLS, certificados, antiforgery o hosting pueden rechazar entradas antes aceptadas. Una actualización no está validada sólo porque responda más peticiones si para lograrlo hemos desactivado protecciones.

En particular, el servidor SslStream cambia la descarga AIA y hay límites en Linux: revisar la cadena de certificados y los clientes, no apagar su validación. Los cambios antiforgery afectan a endpoints con la metadata correspondiente, no a cualquier POST JSON de forma indiscriminada.

Publicar y ejecutar el artefacto final. Revisar warnings de trimming/AOT y probar la reflexión o interop que realmente use. Comprobar símbolos, profiler, dumps, breakpoints y reanudación tras await con las herramientas del equipo.

CI/CD debería registrar las versiones efectivas, restaurar lockfiles, ejecutar corrección y guardar artefactos. Las medidas de velocidad necesitan un entorno apropiado; un runner compartido verde no certifica rendimiento de producción ni otras plataformas.

Por último, conservar rollback de código **y datos**. Volver al ejecutable anterior no restaura una columna eliminada o una propiedad Cosmos perdida. Backup y restauración deben estar diseñados y ensayados cuando corresponda.

El criterio de aceptación es operativo: mismo contrato, datos preservados, artefacto soportado, diagnóstico utilizable y recuperación posible. La velocidad es una parte de esa decisión, no un sustituto de las demás.

La migración establece qué debe mantenerse correcto. Antes de decidir si compensa, volvamos a los hallazgos y a los controles que retiraron algunas conclusiones iniciales.

**Para contrastar este capítulo:** [Guía de migración](#evidencia-c27572d4a0b1) · [Versiones y factores](#evidencia-b33563055168) · [Procedimiento de reproducción](#evidencia-113fa8cfb6cb) · [Matriz de trazabilidad](#evidencia-0f1a77641be5).

**Navegación:** [Anterior: 17. C# 14 y 15](#csharp) · [Índice](#indice) · [Siguiente: 19. Resultados](#resultados).
<a id="resultados"></a>
## 19. Los resultados más instructivos

Después de recorrer las capas, los resultados interesantes ya no son sólo los porcentajes más grandes. Son los que permiten entender una decisión, descartar una explicación demasiado fácil o mejorar la forma de medir.

| Hallazgo | Evidencia defendible | Lectura práctica |
|---|---|---|
| Receptor virtual genérico conocido | Kernel 69 → 3 bytes; 24 → 0 B/op; wrapper y resultado conservados | El JIT puede hacer desaparecer una abstracción cuando conoce suficiente información. No cubre todo polimorfismo. |
| Búsqueda LookAhead | Kernel 102 → 66 bytes; desaparece un check redundante de `i+1` | Seguridad no implica repetir comprobaciones que ya pueden demostrarse. |
| Comparación constante | Kernel 51 → 3 bytes; control dinámico conserva trabajo | Resolver constantes no equivale a comparar todos los textos a velocidad infinita. |
| Colecciones y JSON | Caminos que mejoran, otros próximos y alguno adverso | El tipo de operación y la entrada pesan más que una etiqueta global de biblioteca. |
| Runtime Async opt-in | Menos IL; cadena con menos bytes y otros caminos con más | La preview cambia el mecanismo, no garantiza ganar en cada patrón. |
| Channel | Signo adverso repetido; C/D cerca del 55%, B histórico cerca del 98% | Investigar el caso concreto; no convertir magnitud histórica variable en una tasa universal. |
| HTTP | Contratos correctos y 15,3 millones de peticiones; inversiones entre bloques | Una campaña grande puede seguir limitada por host y generador. |
| EF | Tres tratamientos; proveedores y SQLite identificados | Separar actualizar runtime de actualizar ORM y motor nativo. |
| Native AOT | EXE mayor en 11; arranque AOT favorable frente a FDD en estas apps | Distribución, arranque, memoria y tamaño son dimensiones distintas. |
| SDK CLI | Menor tiempo observado con SDK11 bajo host compartido | Herramientas y aplicación tienen caminos y factores diferentes. |

La primera fila tiene una explicación estructural apoyada por código máquina. La fila HTTP tiene mucho volumen y menos capacidad de atribución. No hay contradicción: **cantidad de datos y fuerza de una conclusión no son lo mismo**.

### Tres mejoras espectaculares que dejaron de sostenerse

El laboratorio repitió once casos anómalos en dos pares A/B, 44 jobs. Channel ya tiene su análisis detallado; los otros diez ayudan a ver qué oculta una primera campaña:

| Operación e input | Cambio inicial de tiempo | Par A | Par B |
|---|---:|---:|---:|
| StringCreate, campos fijos | −70,75% | +9,30% | +15,17% |
| UTF-8 encode, Count 10000 | −61,79% | +0,52% | +11,77% |
| UTF-8 decode, Count 10000 | +26,71% | −1,89% | −5,86% |
| NoInline, Count 10000 | +24,71% | −19,02% | +2,16% |
| WriteAsync, 100000 bytes | −75,65% | +7,56% | +11,99% |
| Gunzip, 100000 bytes | +65,13% | −1,63% | +15,97% |
| Unbrotli, 100000 bytes | +73,54% | +3,92% | +14,66% |
| CompletedTask | +20,56% | +3,55% | +30,34% |
| SHA256, 100000 bytes | +24,09% | +1,00% | +8,52% |
| SHA256 con destino, 100000 bytes | +9,58% | −0,33% | +10,70% |

Fuente: [contraste con la campaña inicial](#evidencia-8fa56c2c2104), [medias, Error, N y memoria de cada par](#evidencia-1dd017ec894b) y [orden de ejecución](#evidencia-4d04be4160f7). Negativo significa menos tiempo.

No se sostiene afirmar que StringCreate mejora un 70%, UTF-8 encode un 62% o WriteAsync un 76%: cambian de signo al repetir. No sabemos atribuirlo a una causa única del host o del código. El resultado correcto es retirar aquellas conclusiones, no borrar sus datos.

Lock no estaba entre los once métodos repetidos. Su anomalía inicial sigue siendo exploratoria; no hereda el control de otro método de concurrencia. CompletedTask y descompresión también conservan magnitudes variables, y el primer delta NoInline no se explica por una instrucción nueva acreditada: los cuerpos nativos generales inspeccionados mantuvieron su tamaño.

La repetición no elimina toda incertidumbre, pero sí evita publicar como mejora estable lo que los propios controles contradicen.

[![Captura auténtica del panel JIT con estadísticas originales y ensamblador de ConstantUnequal](/blog/dotnet-10-vs-dotnet-11/15-jit-evidence.png)](/blog/dotnet-10-vs-dotnet-11/15-jit-evidence.png)

*Figura 16. Captura histórica real del navegador, sin retoques: muestra estadísticas de dos kernels constantes y fragmentos propios de ConstantUnequal. No es un terminal recreado ni un benchmark nuevo. Origen: [manifiesto histórico](#evidencia-705b372bd60d), panel JIT; hashes y destino de la copia en [manifiesto editorial](#evidencia-a724e25f2ffb).*

[Abrir la captura JIT a tamaño completo para leer tabla e instrucciones](/blog/dotnet-10-vs-dotnet-11/15-jit-evidence.png).

También hay resultados negativos valiosos. Que un cuerpo nativo no cambie, que una mejora no se mantenga o que una API nueva sólo tenga control funcional nos evita contar una historia causal que los archivos no sostienen.

La investigación no ha aislado qué commit interno causa cada porcentaje. La distinción entre mecanismo documentado y causa aislada se recoge en el [método de lectura](#metodo-lectura).

Ordenar la evidencia permite distinguir mecanismos claros de resultados variables. Con ese criterio podemos responder la pregunta práctica sin exigir un ganador universal.

**Para contrastar este capítulo:** [Contraste de anomalías con la campaña inicial](#evidencia-8fa56c2c2104) · [Comparaciones A/B](#evidencia-1dd017ec894b) · [Orden histórico](#evidencia-4d04be4160f7) · [Matriz de trazabilidad](#evidencia-0f1a77641be5).

**Navegación:** [Anterior: 18. Migración](#migracion) · [Índice](#indice) · [Siguiente: 20. Decisión](#decision).
<a id="decision"></a>
## 20. ¿Merece la pena actualizar?

La respuesta depende del problema que deba resolver la aplicación, del coste de validar y del estado de sus dependencias. Una versión no se elige por el promedio de una colección de operaciones que quizá no utilizamos.

| Situación | Decisión razonable a partir de esta investigación |
|---|---|
| Aplicación pequeña | Actualizar puede aportar mantenimiento y APIs, pero el usuario quizá no perciba diferencias de microsegundos. Si inicia muy a menudo, estudiar su arranque real. |
| API empresarial | Empezar por compatibilidad y datos. Pasar por EF10/runtime11 antes de EF11 ayuda a separar factores; validar SQL, autenticación y observabilidad. |
| Servicio con muchas peticiones | Medir carga representativa con generador independiente, errores y colas de latencia. No dimensionar a partir de nuestro loopback compartido. |
| Procesamiento intensivo | Identificar métodos calientes y entradas. Inspeccionar código generado cuando una optimización concreta pueda importar; no suponer SIMD más ancho por el número de versión. |
| Sistema sensible a memoria | Separar asignaciones, retención, memoria nativa y pausas. Un ahorro local puede coexistir con un proceso mayor o con otros caminos que asignan más. |
| Proyecto que prioriza estabilidad | .NET10 parcheado sigue siendo una base válida. Comprobar fechas reales y dependencias; aquí LTS no implica más años restantes que 11. |
| Proyecto para experimentar | .NET11 permite explorar APIs y C#15; mantener Runtime Async y memory safety preview como tratamientos explícitos y reversibles. |

En una aplicación limitada por una consulta remota de larga duración, ahorrar unos nanosegundos en una llamada auxiliar puede tener una contribución mínima. En un bucle muy frecuente, evitar millones de objetos temporales sí puede ser relevante. Para saber en cuál estamos necesitamos un perfil de la aplicación, no sólo reconocer un nombre en una tabla.

También hay razones para actualizar que no caben en un cronómetro: soporte de plataforma, correcciones, contratos más expresivos o una dependencia que requiere el nuevo destino. Y hay razones para esperar: toolchain, certificación, CPU, proveedor o coste de adaptación todavía no resuelto.

La decisión no necesita que una versión gane todas las filas. Necesita que el conjunto de beneficios y riesgos tenga sentido para el servicio que mantenemos. Cerremos recuperando qué hemos aprendido de la pregunta con la que empezamos.

**Para contrastar este capítulo:** [Guía de migración](#evidencia-c27572d4a0b1) · [Limitaciones documentadas](#evidencia-a95975256127) · [Hallazgos del artículo](#resultados) · [Matriz de trazabilidad](#evidencia-0f1a77641be5).

**Navegación:** [Anterior: 19. Resultados](#resultados) · [Índice](#indice) · [Siguiente: 21. Conclusión](#conclusion).
<a id="conclusion"></a>
## 21. Conclusión: qué hemos aprendido al medir

Volvamos a la pregunta inicial: ¿puede una aplicación ser más rápida sin cambiar una línea de su lógica?

Puede. El experimento del método virtual genérico lo muestra con una cadena de evidencia especialmente clara: mismo cuerpo IL inspeccionado, argumento y resultado vivos, distinta resolución nativa y un objeto que deja de materializarse. El cambio importante no es sólo que una barra sea menor; podemos explicar qué trabajo ya no hace falta.

Channels, Runtime Async, EF, HTTP y Native AOT obligan a distinguir escenarios y dimensiones. Al volver sobre ellos, las reglas del [método de lectura](#metodo-lectura) permiten separar una decisión fundamentada de una recomendación universal.

Medir bien también consiste en conservar lo incómodo: una muestra lenta, un bloque que invierte el resultado, un intento fallido o un commit histórico que no permite reconstruir todo. No debilita la investigación decirlo. Hace posible que otra persona sepa qué puede comprobar y qué tendría que estudiar de nuevo.

La utilidad de .NET 11 no depende de declarar obsoleto .NET 10. Depende de entender qué cambia en las capas que utiliza nuestra aplicación y validarlo con su contrato, sus datos y su entorno.

El resultado de esta investigación es un mapa para hacer esas preguntas con más precisión. La respuesta final para producción tiene que salir de la aplicación que vamos a desplegar.

La conclusión sólo resulta útil si puedes contrastar su recorrido. El siguiente capítulo reúne los puntos de entrada al código, los originales y el procedimiento de reproducción.

**Para contrastar este capítulo:** [Investigación técnica](#evidencia-b82e4d8fdba1) · [Auditoría crítica](#evidencia-0c5cb713ef30) · [Decisión por aplicación](#decision) · [Matriz de trazabilidad](#evidencia-0f1a77641be5).

**Navegación:** [Anterior: 20. Decisión](#decision) · [Índice](#indice) · [Siguiente: 22. Reproducción](#reproduccion).
<a id="reproduccion"></a>
## 22. Código fuente y reproducción

El código y las evidencias acompañan a este artículo en el repositorio local. **Todavía no se presenta una URL pública de GitHub**, porque no existe una dirección confirmada que podamos enlazar.

Para orientarse:

| Quiero contrastar… | Punto de entrada |
|---|---|
| Las conclusiones y sus límites | [Artículo técnico](dotnet-10-vs-dotnet-11.md), [auditoría](../docs/final-audit.md) y [trazabilidad](../docs/traceability.md). |
| Los 88 métodos generales | [Fuentes de Benchmarks](../src/Benchmarks/) y [runner](../src/BenchmarkRunner/). |
| IL y código máquina | [JitProbes](../src/JitProbes/) y [ensamblador original](../results/raw/jit-pr/main/results/). |
| Runtime Async | [Código recompilado por tratamiento](../src/RuntimeAsyncBenchmarks/) y [protocolo](../docs/experiments-runtime-async.md). |
| Lenguaje y APIs nuevas | [LanguageSamples](../src/LanguageSamples/) y [Net11Features](../src/Net11Features/). |
| API y EF | [WebApi](../src/WebApi/), [EF compartido](../src/EfCore/Shared/) y [experimentos de aplicaciones](../docs/experiments-apps.md). |
| Publicación y arranque | [NativeAot](../src/NativeAot/) y [resultados por tratamiento](../results/raw/aot/main/results.json). |
| Datos y entorno | [Originales](../results/raw/), [metadatos](../results/metadata/) y [derivados](../results/processed/). |
| Imágenes de esta versión | [Galería](blog-assets/index.html) y [manifiesto con procedencia y hashes](blog-image-manifest.json). |


<details id="evidencias-investigacion" class="study-evidence-catalogue">
<summary>Catálogo de rutas de código y evidencias · publicación pendiente</summary>

<p>Estas rutas pertenecen al repositorio de investigación; no son enlaces a archivos alojados en este blog. Puedes copiar la ruta para localizarla cuando el repositorio esté publicado y autorizado. Su publicación integral sigue pendiente de revisión de privacidad. No se adjuntan contenidos de archivos, logs ni trazas.</p>
<dl class="study-evidence-paths">
<div id="evidencia-b33563055168" class="study-evidence-row" tabindex="-1">
<dt><code>README.md</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización. Fragmento original: <code>#versiones-y-separación-de-factores</code>.</dd>
</div>
<div id="evidencia-138c99b46a30" class="study-evidence-row" tabindex="-1">
<dt><code>article/blog-assets/index.html</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-bd3afe8b5286" class="study-evidence-row" tabindex="-1">
<dt><code>article/blog-editorial-report.md</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-a724e25f2ffb" class="study-evidence-row" tabindex="-1">
<dt><code>article/blog-image-manifest.json</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-b82e4d8fdba1" class="study-evidence-row" tabindex="-1">
<dt><code>article/dotnet-10-vs-dotnet-11.md</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-26daa4cd5a62" class="study-evidence-row" tabindex="-1">
<dt><code>article/references.md</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-47f40c3835b9" class="study-evidence-row" tabindex="-1">
<dt><code>docs/experiments-aot-language.md</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-30f35e655cc7" class="study-evidence-row" tabindex="-1">
<dt><code>docs/experiments-apps.md</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-5998e62b150f" class="study-evidence-row" tabindex="-1">
<dt><code>docs/experiments-diagnostics.md</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-66ac6b003d1b" class="study-evidence-row" tabindex="-1">
<dt><code>docs/experiments-gc.md</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-49a84856569b" class="study-evidence-row" tabindex="-1">
<dt><code>docs/experiments-opentelemetry.md</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-1b6ad6b00607" class="study-evidence-row" tabindex="-1">
<dt><code>docs/experiments-runtime-async.md</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-0c5cb713ef30" class="study-evidence-row" tabindex="-1">
<dt><code>docs/final-audit.md</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-a95975256127" class="study-evidence-row" tabindex="-1">
<dt><code>docs/limitations.md</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-0abaf28a964f" class="study-evidence-row" tabindex="-1">
<dt><code>docs/methodology.md</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-c27572d4a0b1" class="study-evidence-row" tabindex="-1">
<dt><code>docs/migration-guide.md</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-113fa8cfb6cb" class="study-evidence-row" tabindex="-1">
<dt><code>docs/reproduction.md</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-d3284b7c09ce" class="study-evidence-row" tabindex="-1">
<dt><code>docs/research.md</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-0f1a77641be5" class="study-evidence-row" tabindex="-1">
<dt><code>docs/traceability.md</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-2e3a949af1d4" class="study-evidence-row" tabindex="-1">
<dt><code>results/metadata/</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-eae7c22ee92c" class="study-evidence-row" tabindex="-1">
<dt><code>results/metadata/micro-full-20261112/environment.json</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-2b58aa147724" class="study-evidence-row" tabindex="-1">
<dt><code>results/metadata/web-canonical-selection.json</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-7af0f987adad" class="study-evidence-row" tabindex="-1">
<dt><code>results/processed/</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-1dd017ec894b" class="study-evidence-row" tabindex="-1">
<dt><code>results/processed/anomalies/comparisons.json</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-8fa56c2c2104" class="study-evidence-row" tabindex="-1">
<dt><code>results/processed/anomalies/initial-contrast.json</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-72dacfc93ab3" class="study-evidence-row" tabindex="-1">
<dt><code>results/processed/aot-summary.json</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-ccfdaa91eb0c" class="study-evidence-row" tabindex="-1">
<dt><code>results/processed/critical-controls/aot-files.json</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-4240917cf8c0" class="study-evidence-row" tabindex="-1">
<dt><code>results/processed/dependency-audit.json</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-0730b27082ed" class="study-evidence-row" tabindex="-1">
<dt><code>results/processed/ef/independent-runs.json</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-b389f565c315" class="study-evidence-row" tabindex="-1">
<dt><code>results/processed/jit-pr/micro-records.json</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-df8b1b3c3ee3" class="study-evidence-row" tabindex="-1">
<dt><code>results/processed/micro-comparisons.json</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-0b839fa40f5b" class="study-evidence-row" tabindex="-1">
<dt><code>results/processed/runtime-async/records.json</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-c5f6f42177bc" class="study-evidence-row" tabindex="-1">
<dt><code>results/processed/servergc/micro-records.json</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-af1cc789ce98" class="study-evidence-row" tabindex="-1">
<dt><code>results/processed/sizes/micro-comparisons.json</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-72edf7c1bea8" class="study-evidence-row" tabindex="-1">
<dt><code>results/processed/sizes/micro-records.json</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-d8f4c3a92139" class="study-evidence-row" tabindex="-1">
<dt><code>results/processed/web-main-summary.json</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-24208bfe2b21" class="study-evidence-row" tabindex="-1">
<dt><code>results/raw/</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-4d04be4160f7" class="study-evidence-row" tabindex="-1">
<dt><code>results/raw/anomalies/anomalies-20261112/manifest.json</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-7600edfd6c82" class="study-evidence-row" tabindex="-1">
<dt><code>results/raw/aot/main/results.json</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-fe64e7167cf6" class="study-evidence-row" tabindex="-1">
<dt><code>results/raw/audit-channel/audit-channel-20261112-v2/manifest.json</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-342dff88bdf2" class="study-evidence-row" tabindex="-1">
<dt><code>results/raw/ef/main/</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-eb1002fa9057" class="study-evidence-row" tabindex="-1">
<dt><code>results/raw/gc/main/</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-4dda7b72f5af" class="study-evidence-row" tabindex="-1">
<dt><code>results/raw/jit-general-20261112/micro/results/NetComparison.Benchmarks.JitBenchmarks-asm.md</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-18e9feab7b9d" class="study-evidence-row" tabindex="-1">
<dt><code>results/raw/jit-pr/main/results/</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-30c35e8cd5bc" class="study-evidence-row" tabindex="-1">
<dt><code>results/raw/jit-pr/main/results/BenchmarkRun-joined-2026-11-12-16-17-31-asm.md</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-29f7b27309c9" class="study-evidence-row" tabindex="-1">
<dt><code>results/raw/jit-pr/main/results/BenchmarkRun-joined-2026-11-12-16-17-31-report-full.json</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-e4716719f12b" class="study-evidence-row" tabindex="-1">
<dt><code>results/raw/language/main-pinned/results.json</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-71d6e094d75a" class="study-evidence-row" tabindex="-1">
<dt><code>results/raw/micro-full-20261112/micro/results/</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-eadf167ea790" class="study-evidence-row" tabindex="-1">
<dt><code>results/raw/opentelemetry/main/</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-58433020b8b2" class="study-evidence-row" tabindex="-1">
<dt><code>results/raw/runtime-async/main/bdn/results/NetComparison.RuntimeAsync.AsyncBenchmarks-report-full.json</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-6e072ef31711" class="study-evidence-row" tabindex="-1">
<dt><code>results/raw/runtime-async/main/diagnostic-index.json</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-ed06cbb1d49e" class="study-evidence-row" tabindex="-1">
<dt><code>results/raw/sdk/main/</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-705b372bd60d" class="study-evidence-row" tabindex="-1">
<dt><code>screenshots/manifest.json</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-814202861e40" class="study-evidence-row" tabindex="-1">
<dt><code>scripts/run/publish.ps1</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-5a1a89cb8fab" class="study-evidence-row" tabindex="-1">
<dt><code>scripts/run/web-load.js</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-189c05fb0888" class="study-evidence-row" tabindex="-1">
<dt><code>src/BenchmarkRunner/</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-c6ada5d0c815" class="study-evidence-row" tabindex="-1">
<dt><code>src/Benchmarks/</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-2f2ab2ee9fca" class="study-evidence-row" tabindex="-1">
<dt><code>src/Benchmarks/AsyncAndConcurrencyBenchmarks.cs</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-0ee69ae7579f" class="study-evidence-row" tabindex="-1">
<dt><code>src/Benchmarks/CollectionsBenchmarks.cs</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-24932a96fd09" class="study-evidence-row" tabindex="-1">
<dt><code>src/Benchmarks/DiagnosticsBenchmarks.cs</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-9d3b41746437" class="study-evidence-row" tabindex="-1">
<dt><code>src/Benchmarks/IoAndCryptoBenchmarks.cs</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-1231921bcc1b" class="study-evidence-row" tabindex="-1">
<dt><code>src/Benchmarks/MemoryJitReflectionBenchmarks.cs</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-ce34a0dd57d9" class="study-evidence-row" tabindex="-1">
<dt><code>src/Benchmarks/TextAndJsonBenchmarks.cs</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-7002b4de1a6f" class="study-evidence-row" tabindex="-1">
<dt><code>src/EfCore/Shared/</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-00fc7b72f30d" class="study-evidence-row" tabindex="-1">
<dt><code>src/EfCore/Shared/Workload.cs</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-f006efa4101c" class="study-evidence-row" tabindex="-1">
<dt><code>src/JitProbes/</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-1014f76afffd" class="study-evidence-row" tabindex="-1">
<dt><code>src/JitProbes/Program.cs</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-801e11250a0f" class="study-evidence-row" tabindex="-1">
<dt><code>src/LanguageSamples/</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-c0d8e32e6c8e" class="study-evidence-row" tabindex="-1">
<dt><code>src/LanguageSamples/After15/Program.cs</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-c09084b853ba" class="study-evidence-row" tabindex="-1">
<dt><code>src/LanguageSamples/Before14/Program.cs</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-3e3eaf845eb4" class="study-evidence-row" tabindex="-1">
<dt><code>src/LanguageSamples/LegacyInterface15/Measurement.cs</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-c7d37de1a813" class="study-evidence-row" tabindex="-1">
<dt><code>src/LanguageSamples/MemorySafetyPreview/Program.cs</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-a529ae37cfa4" class="study-evidence-row" tabindex="-1">
<dt><code>src/LanguageSamples/Shared/AsyncBehavior.cs</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-47338399560d" class="study-evidence-row" tabindex="-1">
<dt><code>src/NativeAot/</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-c1469587a92e" class="study-evidence-row" tabindex="-1">
<dt><code>src/Net11Features/</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-3f42500b63f7" class="study-evidence-row" tabindex="-1">
<dt><code>src/Net11Features/Cases/Crypto.cs</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-84abffd79e6c" class="study-evidence-row" tabindex="-1">
<dt><code>src/Net11Features/Cases/FullJoin.cs</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-2512a90fff6c" class="study-evidence-row" tabindex="-1">
<dt><code>src/Net11Features/Cases/JsonLines.cs</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-8f7a657cadec" class="study-evidence-row" tabindex="-1">
<dt><code>src/Net11Features/Cases/JsonUnion.cs</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-64e36bae106e" class="study-evidence-row" tabindex="-1">
<dt><code>src/Net11Features/Cases/MemoryStreams.cs</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-381ddd437902" class="study-evidence-row" tabindex="-1">
<dt><code>src/Net11Features/Cases/SequenceStreams.cs</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-1176d2ac9bae" class="study-evidence-row" tabindex="-1">
<dt><code>src/Net11Features/Cases/TupleJoin.cs</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-3ed5656e6e02" class="study-evidence-row" tabindex="-1">
<dt><code>src/Net11Features/Cases/Zstandard.cs</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-215f5262460a" class="study-evidence-row" tabindex="-1">
<dt><code>src/RuntimeAsyncBenchmarks/</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-49fbbda8a5e0" class="study-evidence-row" tabindex="-1">
<dt><code>src/RuntimeAsyncBenchmarks/AsyncBenchmarks.cs</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-b75210290e49" class="study-evidence-row" tabindex="-1">
<dt><code>src/RuntimeAsyncBenchmarks/Shared/AsyncWorkloads.cs</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-97ea9fad1b13" class="study-evidence-row" tabindex="-1">
<dt><code>src/WebApi/</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
<div id="evidencia-665e52b5b87a" class="study-evidence-row" tabindex="-1">
<dt><code>src/WebApi/Program.cs</code></dt>
<dd>Publicación pendiente de revisión de privacidad y autorización.</dd>
</div>
</dl>

</details>

### Antes de reproducir, proteger los originales

Utilizar una **copia de trabajo separada y desechable**. Elegir un RunId nuevo no basta: la instalación y algunos analizadores reescriben metadatos compartidos o derivados. No ejecutar esas herramientas encima del checkout que queremos preservar como evidencia histórica.

El procedimiento ejercitado históricamente es Windows x64 con PowerShell 5.1; Node 20 o posterior para las herramientas de imágenes. Linux, macOS, Arm64 y contenedores no tienen resultados locales en esta investigación.

La preparación documentada, desde la raíz de esa copia, empieza así:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup/inspect.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup/install-sdks.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup/install-k6.ps1
.dotnet/dotnet.exe --info
.dotnet/dotnet.exe --list-sdks
.dotnet/dotnet.exe --list-runtimes
```

Los SDK se descargan en `.dotnet/` y el instalador contrasta hashes oficiales. Las herramientas no requieren modificar instalaciones globales. NuGet se configura con fuentes explícitas, sin copiar credenciales personales.

La primera ejecución útil es de corrección, no de velocidad:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run/verify.ps1 `
  -Locked -RunId blog-repro-correctness
```

Después, la [guía completa de reproducción](#evidencia-113fa8cfb6cb) contiene los comandos de cada campaña, requisitos de Native AOT, herramientas diagnósticas y conservación de resultados. Los nombres de ejemplo deben sustituirse por identificadores nuevos, sin sobrescribir campañas existentes.

**No se ha repetido toda esa preparación desde un clon limpio para esta edición final.** El [informe editorial de la versión anterior](#evidencia-bd3afe8b5286) describe las comprobaciones históricas de sus ejemplos y Markdown, no una validación recién ejecutada de este archivo. La distinción entre comprobación documental y campaña de rendimiento sigue el [método de lectura](#metodo-lectura).

### Qué registrar en una ejecución nueva

Guardar versión efectiva de SDK y runtime, lockfiles, RID, GC, tiering/PGO, flags preview, parámetros, orden, entorno y salida original. Registrar commit **y estado del árbol** antes de ejecutar, conservando la fuente si hay cambios sin commit.

Si el tiempo sorprende, comprobar primero el resultado y la configuración. Luego inspeccionar dispersión y repetir sólo con una pregunta concreta. No cambiar simultáneamente carga, código y paquetes para intentar acercarse a la cifra publicada.

En algunas campañas de este repositorio la fuente histórica no se puede reconstruir por completo desde un commit conservado. La versión actual y los hashes permiten revisar mucho, pero no rellenan ese hueco. Reproducir el protocolo ahora es valioso; no equivale a viajar atrás y demostrar qué bytes faltaban.

Los originales también incluyen identificadores del entorno y trazas binarias. La revisión de privacidad pendiente de su publicación integral no desaparece porque las imágenes editoriales estén seleccionadas. No se ha publicado el blog ni el repositorio como parte de esta entrega.

Para recorrer esas fuentes sin perderte entre siglas, el glosario conserva el significado que tienen aquí. Después quedan las referencias oficiales y documentales para ampliar cada capa.

**Para contrastar este capítulo:** [Guía de reproducción](#evidencia-113fa8cfb6cb) · [Mapa del proyecto](#evidencia-b33563055168) · [Originales](#evidencia-24208bfe2b21) · [Metadatos](#evidencia-2e3a949af1d4) · [Matriz de trazabilidad](#evidencia-0f1a77641be5).

**Navegación:** [Anterior: 21. Conclusión](#conclusion) · [Índice](#indice) · [Siguiente: 23. Glosario](#glosario).
<a id="glosario"></a>
## 23. Glosario

Este capítulo sirve como punto de consulta cuando una sigla interrumpe el hilo. Las definiciones recuperan el sentido utilizado en los experimentos; para entender el mecanismo, vuelve al capítulo correspondiente. Así puedes retomar la lectura sin sustituir una explicación por una abreviatura.

| Término | Significado en este artículo |
|---|---|
| Allocation / asignación | Reserva de memoria administrada para datos de la operación; no equivale a memoria residente. |
| API | Interfaz con la que un programa ofrece operaciones a otros; aquí también se estudia una API HTTP. |
| AOT | Compilación antes de ejecutar; Native AOT produce el ejecutable nativo sin JIT de estos tratamientos. |
| Assembly / ensamblado | Unidad .NET con código y metadata; habitualmente un archivo DLL. |
| Async / await | Modelo y sintaxis para componer operaciones pendientes sin bloquear necesariamente un hilo durante la espera. |
| AsyncLocal | Valor ambiente asociado al flujo lógico asíncrono, no simplemente a un hilo físico. |
| Backpressure | Mecanismo que hace esperar o limita al productor cuando el consumidor no puede seguir su ritmo. |
| BCL | Bibliotecas fundamentales de .NET: colecciones, texto, tareas, archivos y otras APIs. |
| Benchmark | Experimento de rendimiento con operación y condiciones definidas. |
| Bounds check | Comprobación que evita acceder fuera del rango permitido de una colección o vista. |
| B/op | Bytes administrados asignados por operación bajo el diagnóstico correspondiente. |
| Channel | Cola con APIs de lectura/escritura para coordinar productores y consumidores. |
| Closed | Restricción de C#15 sobre los descendientes directos de un tipo dentro de su ensamblado. |
| Constant folding | Sustituir una operación por un resultado que el compilador puede determinar. |
| CoreCLR | Runtime usado por las aplicaciones de esta investigación. |
| DCE | Dead code elimination: eliminar código sin efecto observable; puede invalidar un benchmark mal construido. |
| Delegate | Representación invocable de un método con una firma determinada. |
| Desvirtualización | Resolver una llamada virtual hacia una implementación que el compilador puede conocer o proteger mediante un guard. |
| DTO | Objeto con la forma de datos que queremos transportar o proyectar. |
| EF Core / ORM | Biblioteca de mapeo entre objetos y datos relacionales, con traducción de consultas y materialización. |
| ExecutionContext | Infraestructura que propaga estado ambiente de ejecución, distinto del contexto de sincronización. |
| FDD | Framework-dependent deployment: publicación que necesita un runtime instalado fuera del artefacto. |
| GC | Garbage Collector: recupera memoria administrada de objetos que dejan de ser alcanzables. |
| Generación | Agrupación de objetos que permite al GC tratar de forma distinta supervivencia y coste de recolección. |
| Genérico | Código parametrizado por tipos, como `List<T>` o `Echo<T>`. |
| Hash | Huella calculada a partir de contenido; no es cifrado reversible. |
| Heap | Espacio de memoria donde el runtime gestiona muchos objetos; no todo su contenido tiene la misma vida. |
| IL | Instrucciones intermedias que genera el compilador de C# antes del código máquina del camino JIT. |
| ILC | Compilador utilizado en Native AOT para producir código nativo durante publicación. |
| Inlining | Integrar el cuerpo de un método en su llamador para evitar una frontera y habilitar más optimizaciones. |
| ISA | Conjunto de instrucciones y capacidades de una arquitectura de CPU. |
| JIT | Compilador que transforma IL en código máquina durante la ejecución. |
| JSON / JSONL | Formato estructurado de datos; JSONL coloca valores JSON separados por líneas. |
| Kernel | Núcleo pequeño de una operación bajo estudio; aquí no significa núcleo del sistema operativo. |
| Latencia | Tiempo que tarda una operación o petición en completarse. |
| LINQ | Operadores para consultar y transformar secuencias o expresiones consultables. |
| LOH | Large Object Heap: zona de tratamiento de objetos grandes del heap administrado. |
| Lowering | Transformación del código a una representación más cercana a su ejecución, como la máquina de estados async convencional. |
| Materialización | Construcción de objetos o colecciones a partir de los resultados de una consulta. |
| Metadata | Descripción de tipos, miembros y otros elementos de un ensamblado. |
| P50 / P95 / P99 | Percentiles de latencia; describen umbrales de una distribución de una ejecución. |
| PGO | Optimización guiada por perfiles; Dynamic PGO utiliza información recogida durante la ejecución. |
| Pool | Almacén de recursos reutilizables; reduce ciertas creaciones a cambio de retención y reglas de propiedad. |
| R2R | ReadyToRun: precompilación parcial que conserva IL y posibles caminos JIT. |
| Reflection | Inspección y uso dinámico de tipos y miembros mediante metadata. |
| RID | Identificador de plataforma de publicación, como `win-x64`. |
| Runtime | Entorno de ejecución con servicios como carga, excepciones, GC y JIT cuando corresponde. |
| SDK | Herramientas para construir, restaurar y publicar, incluido el compilador. |
| SIMD | Una instrucción opera sobre varios datos; no requiere crear varios hilos. |
| Source generation | Generar código o contratos durante build para reducir o explicitar trabajo dinámico. |
| Span de memoria | Vista de elementos de `Span<T>`/`ReadOnlySpan<T>`, distinta de un span de trazas. |
| Span de trazas | Operación instrumentada dentro de una traza distribuida. |
| Stack | Pila de ejecución y marcos de llamadas; no una regla que ubique todos los tipos valor en un único sitio. |
| Task / ValueTask | Representaciones de finalización y resultado, con contratos y costes distintos. |
| TFM | Target framework: destino y conjunto de APIs del proyecto, como `net11.0`. |
| ThreadPool | Infraestructura que reutiliza y coordina hilos para trabajo del proceso. |
| Throughput | Trabajo completado por unidad de tiempo, por ejemplo peticiones por segundo. |
| Tiered compilation | Generación de niveles de código con distinto equilibrio entre coste de compilación y optimización. |
| Tracking | Información que EF conserva sobre entidades para identidad y detección de cambios. |
| Trimming | Eliminación de código considerado innecesario durante publicación, sujeta a límites del análisis. |
| Union | Valor representado por una de varias alternativas de tipos declaradas. |
| VU | Usuario virtual del generador; no equivale a persona real ni a una conexión TCP garantizada. |
| Working set | Páginas residentes del proceso en el momento observado; no allocations acumuladas. |

Las definiciones ayudan a volver al cuerpo con el vocabulario situado. Las referencias siguientes permiten contrastar los contratos oficiales y distinguirlos de nuestros resultados locales.

**Para contrastar este capítulo:** [Fundamentos y componentes](#que-es-dotnet) · [Unidades y estadística](#metodologia) · [Mapa de código y evidencias](#reproduccion) · [Matriz de trazabilidad](#evidencia-0f1a77641be5).

**Navegación:** [Anterior: 22. Reproducción](#reproduccion) · [Índice](#indice) · [Siguiente: 24. Referencias](#referencias).
<a id="referencias"></a>
## 24. Referencias

Las cifras del artículo proceden del repositorio, no de sustituir nuestras medidas por números de Microsoft. Las fuentes oficiales sirven para contrastar contratos, versiones y mecanismos. Su estado se revisa con el corte de noviembre de 2026; un enlace a `main` puede evolucionar.

### Versiones, soporte y compatibilidad

- [.NET: introducción y componentes](https://learn.microsoft.com/dotnet/core/introduction).
- [Anuncio de .NET 11](https://devblogs.microsoft.com/dotnet/announcing-dotnet-11/).
- [Política de soporte de .NET](https://dotnet.microsoft.com/platform/support/policy/dotnet-core).
- [Índice oficial de releases](https://builds.dotnet.microsoft.com/dotnet/release-metadata/releases-index.json).
- [Novedades del runtime en .NET 11](https://learn.microsoft.com/dotnet/core/whats-new/dotnet-11/runtime).
- [Cambios de compatibilidad de .NET 11](https://learn.microsoft.com/dotnet/core/compatibility/11).
- [Release notes y plataformas de .NET 11](https://github.com/dotnet/core/tree/main/release-notes/11.0).
- [Imágenes oficiales de contenedor](https://github.com/dotnet/dotnet-docker).

### Compilación, lenguaje y memoria

- [Documentación de diseño del JIT](https://github.com/dotnet/runtime/tree/main/docs/design/coreclr/jit).
- [PR 122023: patrón GVM no compartido estudiado](https://github.com/dotnet/runtime/pull/122023).
- [PR 124242: redundancia en el patrón LookAhead](https://github.com/dotnet/runtime/pull/124242).
- [PR 121985: SequenceEqual y value numbering](https://github.com/dotnet/runtime/pull/121985).
- [PR 130202: dispatch y Native AOT, sin atribución causal de nuestro tamaño](https://github.com/dotnet/runtime/pull/130202).
- [Novedades de C# 15](https://learn.microsoft.com/dotnet/csharp/whats-new/csharp-15).
- [Fundamentos del Garbage Collector](https://learn.microsoft.com/dotnet/standard/garbage-collection/fundamentals).
- [Configuración del GC](https://learn.microsoft.com/dotnet/core/runtime-config/garbage-collector).
- [Documentación de programación async](https://learn.microsoft.com/dotnet/csharp/asynchronous-programming/).
- [Runtime Async: configuración, stacks y alcance](https://learn.microsoft.com/dotnet/core/whats-new/dotnet-11/runtime#runtime-async).

### Bibliotecas, aplicaciones y herramientas

- [System.Text.Json](https://learn.microsoft.com/dotnet/standard/serialization/system-text-json/overview).
- [Channels](https://learn.microsoft.com/dotnet/core/extensions/channels).
- [Entity Framework Core](https://learn.microsoft.com/ef/core/).
- [Cambios de EF Core 11](https://learn.microsoft.com/ef/core/what-is-new/ef-core-11.0/whatsnew).
- [Incompatibilidades de EF Core 11](https://learn.microsoft.com/ef/core/what-is-new/ef-core-11.0/breaking-changes).
- [Native AOT](https://learn.microsoft.com/dotnet/core/deploying/native-aot/).
- [BenchmarkDotNet](https://benchmarkdotnet.org/).
- [Documentación de k6](https://grafana.com/docs/k6/latest/).
- [OpenTelemetry .NET](https://opentelemetry.io/docs/languages/dotnet/).

### Investigación que acompaña al artículo

- [README y mapa del proyecto](#evidencia-b33563055168).
- [Artículo técnico original, sin sobrescribir](#evidencia-b82e4d8fdba1).
- [Metodología](#evidencia-0abaf28a964f), [investigación y discrepancias de fuentes](#evidencia-d3284b7c09ce) y [referencias anotadas](#evidencia-26daa4cd5a62).
- [Auditoría crítica](#evidencia-0c5cb713ef30), [matriz de trazabilidad](#evidencia-0f1a77641be5) y [limitaciones](#evidencia-a95975256127).
- [Reproducción](#evidencia-113fa8cfb6cb) y [migración](#evidencia-c27572d4a0b1).
- [Informe editorial de la versión anterior](#evidencia-bd3afe8b5286) y [procedencia de las imágenes reutilizadas](#evidencia-a724e25f2ffb).

Las referencias cierran el recorrido documental. Puedes volver al resumen para recuperar las decisiones o usar el índice para profundizar en un experimento concreto.

**Para contrastar este capítulo:** [Referencias anotadas](#evidencia-26daa4cd5a62) · [Investigación y discrepancias de fuentes](#evidencia-d3284b7c09ce) · [Metodología completa](#evidencia-0abaf28a964f) · [Matriz de trazabilidad](#evidencia-0f1a77641be5).

**Navegación:** [Anterior: 23. Glosario](#glosario) · [Índice](#indice) · [Siguiente: Volver al resumen](#resumen-ejecutivo).
