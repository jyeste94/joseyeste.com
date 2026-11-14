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

**Qué cambia dentro de .NET, qué se nota al ejecutar una aplicación y qué encontré al poner las dos versiones a hacer el mismo trabajo.**

[Código y resultados de las pruebas](https://github.com/jyeste94/.NET11vs.NET11) · [Cómo repetirlas](#reproduccion)

<figure class="study-cover">
<a href="/blog/dotnet-10-vs-dotnet-11/cover-dotnet-study.png"><img src="/blog/dotnet-10-vs-dotnet-11/cover-dotnet-study.png" width="1200" height="630" alt="Portada conceptual: .NET 10 y .NET 11 recorren las capas de compilador, runtime y bibliotecas; no representa mediciones" /></a>
<figcaption>Ilustración conceptual original para este artículo. Las capas ayudan a interpretar los resultados; no representan diferencias medidas de rendimiento. <a href="/blog/dotnet-10-vs-dotnet-11/cover-dotnet-study.png">Abrir portada PNG a tamaño completo</a>.</figcaption>
</figure>

<a id="resumen-ejecutivo"></a>
## Antes de entrar en detalle: la respuesta corta

Si has llegado buscando si merece la pena pasar de .NET 10 a .NET 11, mi respuesta es que hay motivos para hacerlo, pero no compraría la actualización con una promesa genérica de velocidad. He comparado las dos versiones con el mismo código en pruebas pequeñas, en una API HTTP, en consultas de base de datos y al publicar aplicaciones. Hay mejoras que se pueden explicar mirando las instrucciones del procesador. También hay resultados que empeoran y otros que cambian de signo al repetir la prueba.

El ejemplo más claro cabe en un método diminuto. Una llamada a través de una clase base, con un método genérico y un objeto recién creado, acaba convertida en devolver el argumento recibido. El JIT, que es el compilador que trabaja mientras se ejecuta el programa, consigue pasar de **69 a 3 bytes de código máquina** y de **24 a 0 bytes de memoria asignada por operación**. El resultado se sigue usando. No desaparece el programa ni se reduce así todo el ejecutable: desaparece trabajo que el compilador ha podido demostrar innecesario en ese caso concreto.

Channels cuenta una historia bastante menos cómoda. La prueba de productor y consumidor vuelve a tardar más en .NET 11 en los controles de este equipo. Sin embargo, el resultado histórico más extremo no se mantiene. Además, la prueba crea el canal y sus tareas en cada operación; no equivale a tener una cola funcionando durante horas en un servicio. Merece investigarse si utilizas ese patrón, no afirmar que cualquier aplicación con Channels va a empeorar lo mismo.

La API acumuló más de 15 millones de peticiones correctas. Es una campaña considerable, pero el cliente que genera la carga y el servidor compartían portátil. Algunas comparaciones se invierten entre bloques. Por eso esas tablas sirven para estudiar endpoints y límites de la prueba, no para calcular cuántas máquinas necesitas en producción. Con EF Core separé actualizar el runtime de actualizar el ORM, la biblioteca que traduce entre objetos y base de datos: son cambios distintos y conviene poder distinguirlos cuando algo mejora o se rompe.

Tampoco todo consiste en tardar menos. Los ejecutables Native AOT de .NET 11 salieron mayores en las dos aplicaciones publicadas. AOT adelanta la compilación a código máquina y puede ayudar al arranque, pero no promete el binario más pequeño. Runtime Async, por su parte, cambia cómo se ejecutan ciertas operaciones asíncronas: hay caminos que asignan menos memoria y otros que asignan más. Activarlo expresamente en la aplicación sigue siendo una opción experimental, separada del comportamiento estable con el que puedes migrar a .NET 11.

Yo empezaría una migración comprobando compatibilidad y corrección, manteniendo al principio el lenguaje y los paquetes. Después vendrían EF, el proveedor de base de datos y los cambios de publicación. Si buscas rendimiento, el paso previo es saber dónde se va el tiempo en tu aplicación. Una consulta remota lenta no se arregla porque otra función ahorre unos nanosegundos. .NET 10 parcheado sigue siendo una opción válida; .NET 11 tiene mejoras y APIs que pueden interesarte sin necesidad de que gane todas las pruebas.

<a id="rutas-lectura"></a>
## Por dónde empezar

El artículo tiene 24 capítulos porque vamos a bajar desde C# hasta las instrucciones de la CPU y volver a subir hasta una API. Puedes seguirlo en orden, o entrar por lo que necesitas:

- **Si .NET te suena, pero no lo conoces por dentro:** empieza por [qué estamos comparando](#introduccion), [las piezas de .NET](#que-es-dotnet) y [cómo se leen las medidas](#metodologia). El [glosario](#glosario) está para consultar una sigla sin perder el hilo.
- **Si estás preparando una migración:** ve a [los pasos de actualización](#migracion) y [la decisión según la aplicación](#decision). En [versiones](#versiones) tienes los destinos y el soporte que se comparan aquí.
- **Si te interesan las tripas del runtime:** empieza por el [JIT](#jit), sigue con [el método de 69 a 3 bytes](#gvm), [memoria](#gc) y [async](#async). El caso [Channel](#concurrencia) y [las repeticiones](#resultados) muestran dónde los tiempos no bastan para explicar lo que pasa.
- **Si lo tuyo son las APIs:** [HTTP](#http), [EF Core](#ef-core) y [Native AOT](#native-aot) son el recorrido más directo. [JSON](#json) y [observabilidad](#otras-superficies) completan la parte de serializar y diagnosticar.

Las tablas y el código se desplazan lateralmente si no caben en el móvil. Puedes pulsar cualquier gráfico para ampliarlo; debajo está también el enlace al PNG original, que funciona sin JavaScript.

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

Tienes una aplicación funcionando, sale otra versión de .NET y llega la duda de siempre: ¿merece la pena actualizar? Cambias el destino del proyecto, vuelves a compilar y la lógica sigue siendo la misma. La consulta busca los mismos datos y la API devuelve la misma respuesta. Aun así, por debajo puede haber cambiado bastante más de lo que parece.

El procesador podría ejecutar menos instrucciones. Una biblioteca podría ahorrarse un recorrido. También podrías encontrarte con más memoria asignada, un ejecutable mayor o una mejora tan localizada que el usuario no llegue a notarla. Y si una prueba pequeña da un resultado espectacular, queda comprobar qué estaba midiendo antes de celebrarlo.

Para ponerle cifras a esa duda, **he comparado .NET 10 y .NET 11 intentando conservar el trabajo que realiza cada operación**. Me interesa saber cuánto cambia, pero también poder explicar qué ha pasado. Un porcentaje sin saber qué hemos hecho para obtenerlo sirve de poco cuando toca decidir sobre una aplicación de verdad.

El proyecto incluye **101 métodos distintos de BenchmarkDotNet**, una herramienta para ejecutar pruebas pequeñas y repetibles de rendimiento, los llamados *benchmarks*. A eso se suma una API HTTP con más de 15 millones de peticiones. Si no trabajas con estos términos, una API es la interfaz por la que un programa ofrece operaciones a otros: pedir un dato, enviar un pedido o solicitar un cálculo, por ejemplo. También hay consultas con Entity Framework Core, aplicaciones publicadas de distintas formas y ejemplos de C# 14 y C# 15.

Ahí conviven operaciones de unos nanosegundos con otras que incluyen una base de datos, una petición HTTP o el arranque de todo un proceso. No voy a meterlas en una media y declarar un ganador. El [método de lectura](#metodo-lectura) explica cómo comparar esas cifras sin mezclar preguntas distintas.

Empezaremos por lo que escribimos en C# y bajaremos hasta las instrucciones que recibe la CPU. Desde ahí iremos a los objetos que ocupan memoria, las operaciones que esperan una respuesta y las bibliotecas que procesan nuestros datos. Después podremos ver cuánto de todo eso se traslada a un servidor o a un despliegue. Una optimización que elimina una llamada tiene interés; saber si esa llamada pesa en tu aplicación tiene todavía más.

No hace falta que domines .NET para seguirlo. Los primeros ejemplos explican las piezas desde cero. Si ya trabajas con él, encontrarás el código medido, el ensamblador y los originales enlazados para entrar al detalle. Así podemos hablar de lo que ocurre sin convertir cada párrafo en una lista de términos que hay que conocer de antemano.

He fijado el corte de versiones en el **12 de noviembre de 2026**. La [investigación técnica original](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/article/dotnet-10-vs-dotnet-11.md) conserva las pruebas y la [auditoría crítica](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/docs/final-audit.md) revisa qué permiten afirmar. Aquí desarrollo sus explicaciones, sin añadir benchmarks ni dar por resueltas las dudas que siguen abiertas.

Antes de tocar los números, conviene aclarar una confusión bastante común: actualizar C#, instalar un SDK y cambiar el runtime no son la misma operación.

<a id="que-es-dotnet"></a>
## 2. ¿Qué es realmente .NET?

Decimos «está hecho en .NET» y parece que hablamos de una sola cosa. En realidad, bajo ese nombre juntamos el lenguaje, las herramientas con las que construimos el programa, el entorno que lo ejecuta y las bibliotecas que utiliza. Separarlo ayuda a entender por qué un mismo código puede comportarse de otra manera después de actualizar.

### El lenguaje no es el motor

**C# es el lenguaje con el que damos instrucciones.** Podemos pedir que guarde un dato, sume cantidades, lea un archivo o responda a una petición. Un método agrupa una operación bajo un nombre. Una variable nos permite referirnos a un valor o a una referencia sin repetir su contenido por todo el programa.

Vamos con algo pequeño: sumar tres cantidades. Este programa es autónomo y compatible con C# 14:

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

Imprime `10`. `int[]` declara un array de enteros, `foreach` recorre sus elementos y `Console.WriteLine` escribe el total. Lo utilizo para explicar el funcionamiento; no es la entrada del benchmark de arrays. Los datos y la operación de aquella prueba están en [CollectionsBenchmarks.cs](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/Benchmarks/CollectionsBenchmarks.cs).

La CPU, es decir, el procesador, no ejecuta directamente ese `foreach`. Tampoco entiende nuestros nombres de variables ni los archivos `.cs`. Necesita código máquina para su arquitectura, como x64 o Arm64. Para llegar desde lo que hemos escrito hasta esas instrucciones intervienen las otras piezas de .NET.

### El SDK: las herramientas para construir

El **SDK**, de *Software Development Kit*, reúne las herramientas de desarrollo: el compilador de C#, el sistema de construcción y comandos como `dotnet build` o `dotnet publish`. También permite restaurar los paquetes que necesita el proyecto.

El compilador de C# pertenece a **Roslyn**. Revisa que el programa cumpla las reglas del lenguaje y lo transforma en instrucciones intermedias. Junto a ellas guarda información sobre tipos y métodos, la **metadata**. Piensa en la descripción del contenido del programa, no en los datos de un cliente que llegan en una petición.

Ese código se agrupa en **ensamblados**, normalmente archivos `.dll`. Que veas esa extensión no implica que ya tengas instrucciones nativas listas para el procesador: un ensamblado administrado de .NET puede contener esa representación intermedia.

Aquí aparece la primera separación práctica. Instalar el SDK 11 no hace que todas las aplicaciones del equipo pasen a ejecutarse con el runtime 11. Además, un SDK moderno puede construir proyectos para varios destinos. La herramienta que construye y la versión que ejecuta tienen relación, pero hay que comprobar ambas.

### IL: instrucciones intermedias

**IL** significa *Intermediate Language*. Son instrucciones pensadas para .NET, más próximas a la ejecución que C#, aunque todavía no correspondan al código máquina de una CPU concreta.

El IL permite conservar lo que debe hacer el programa dejando parte de la adaptación a la máquina para después. No hay que imaginarlo como un texto traducido palabra por palabra: utiliza un formato definido, con reglas para tipos, llamadas y excepciones. Gracias a esa separación, una suma puede acabar convertida en instrucciones diferentes en x64 y Arm64, o aprovechar capacidades del procesador donde se ejecuta.

### El runtime: el entorno que hace funcionar el programa

Una vez construido el programa, el **runtime** proporciona los servicios para ejecutarlo. Carga tipos, gestiona excepciones, coordina la memoria y los hilos y, cuando corresponde, transforma el IL en código máquina.

En las aplicaciones de esta comparativa utilizamos **CoreCLR**. Dentro de él están el **JIT**, que compila código durante la ejecución, y el **Garbage Collector**, que recupera memoria administrada que ya no hace falta conservar. No hemos añadido esas funciones escribiendo una sintaxis especial de C#: forman parte del entorno donde corre el programa.

Por eso hablamos de **código administrado**. Participa en esos servicios y en sus reglas. Puede generar instrucciones nativas muy optimizadas; «administrado» no quiere decir que alguien vaya interpretando el C# línea a línea en cada llamada.

### La BCL: las herramientas que usa nuestro propio código

Nos queda una pieza que aparece en casi cualquier aplicación: la **BCL**, *Base Class Library*. Es el conjunto de bibliotecas fundamentales, con tipos y operaciones para cadenas de texto, colecciones, tareas, archivos, compresión, criptografía y mucho más.

Cada vez que llamas a `Console.WriteLine`, a `File.ReadAllText` o a una operación LINQ, utilizas una implementación de biblioteca. Esa implementación puede cambiar entre .NET 10 y .NET 11 aunque tú no hayas cambiado la llamada.

Ya tenemos, por tanto, dos formas de mejorar sin reescribir nuestros archivos C#: que el JIT produzca mejores instrucciones o que la biblioteca haga el trabajo de una manera más eficiente. Incluso pueden combinarse. Si el JIT integra código de la biblioteca en el método que la llama, puede optimizar ambos juntos.

[![Proceso conceptual desde un archivo C# hasta las instrucciones que ejecuta la CPU](/blog/dotnet-10-vs-dotnet-11/01-dotnet-pipeline.png)](/blog/dotnet-10-vs-dotnet-11/01-dotnet-pipeline.png)

*Figura 1. Esquema conceptual, no una captura experimental: C# pasa por el compilador y el IL; en el camino JIT, el runtime produce código máquina para la CPU. El SDK interviene al construir y el runtime al ejecutar. La ruta Native AOT adelanta la compilación nativa y se desarrolla en la sección 16. Fuente: elaboración didáctica a partir de la [metodología](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/docs/methodology.md) y la [documentación de .NET](https://learn.microsoft.com/dotnet/core/introduction).* 

[Abrir PNG a tamaño completo](/blog/dotnet-10-vs-dotnet-11/01-dotnet-pipeline.png).

### ¿Qué estamos cambiando cuando ponemos `net11.0`?

En el proyecto aparece un **target framework**, también llamado TFM. `net10.0` y `net11.0` indican dos destinos .NET y el conjunto de APIs contra el que construimos.

Cambiar ese valor afecta a las referencias, a las bibliotecas disponibles y al código que se puede compilar. La DLL resultante puede ser diferente; no estamos cambiando sólo una etiqueta. Por otro lado, una aplicación construida para 10 tampoco pasa automáticamente a ejecutarse sobre 11 por tenerlo instalado. La selección del runtime y sus reglas de *roll-forward* determinan qué sucede.

En buena parte de las pruebas he mantenido los mismos archivos C#, construido cada destino y comprobado qué runtime utilizaba realmente el proceso. La [metodología](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/docs/methodology.md) recoge esa configuración. Mantener el código fuente ayuda a comparar, pero todavía deja varias piezas capaces de cambiar: compilador, referencias, runtime y paquetes. Por eso necesitamos sus versiones concretas antes de atribuirles una diferencia.

<a id="versiones"></a>
## 3. .NET 10 y .NET 11: qué cambia y qué permanece

Cuando llega una versión nueva, llegan juntas muchas cosas: cambios en bibliotecas, generación de código, herramientas, compatibilidad y lenguaje. El número 11 no nos dice por sí solo cuál de ellas está actuando en un resultado.

Estas son las versiones que se utilizaron en el laboratorio. Prefiero dejarlas aquí antes que hablar de «la última 10» y «la última 11», que dentro de unos meses podrían significar otra cosa:

| Componente | Canal 10 | Canal 11 |
|---|---|---|
| SDK instalado | 10.0.404 | 11.0.100 |
| Runtime `Microsoft.NETCore.App` | 10.0.15 | 11.0.0 |
| Framework web `Microsoft.AspNetCore.App` | 10.0.15 | 11.0.0 |
| Entity Framework Core SQLite | 10.0.15 | 11.0.0, sólo sobre .NET 11 |
| Lenguaje de la suite principal | C# 14 explícito | C# 14 explícito |
| Muestras de novedades de lenguaje | C# 14 | C# 15, con preview de memoria separada |

Fuente: [configuración y lockfiles](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/README.md#versiones-y-separación-de-factores), [dependencias auditadas](https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/processed/dependency-audit.json) y [metadatos oficiales de releases](https://builds.dotnet.microsoft.com/dotnet/release-metadata/releases-index.json).

En la suite principal, **los dos destinos se construyen con el SDK 11 y C# 14 explícito**. Así evitamos comparar a la vez dos versiones del lenguaje, pero el compilador sigue siendo el que incluye ese SDK. Fijar C# 14 no recupera el Roslyn del SDK 10 ni garantiza que todo el IL generado sea idéntico. La comparación específica entre SDKs se hizo aparte y tiene su propio tratamiento más adelante.

### LTS y STS: importa la fecha, no sólo la etiqueta

.NET 11 llegó a disponibilidad general, **GA**, el **10 de noviembre de 2026**. .NET 10 es LTS y cuenta con tres años de soporte desde su salida. .NET 11 es STS y, con la política vigente en este corte, cuenta con dos.

A primera vista parece que quedarse en 10 nos compra un año más. Pero 10 salió antes: **el soporte de ambos canales termina el 14 de noviembre de 2028**. Si estamos decidiendo en noviembre de 2026, hay que mirar el tiempo que queda, no sólo la duración original escrita junto a las siglas.

STS tampoco es una categoría de calidad inferior. Los criterios de calidad y mantenimiento son los mismos; cambia la duración del ciclo. Y mantenerse dentro de soporte exige instalar las actualizaciones correspondientes. Aquí fijo versiones para poder estudiar una comparación concreta, no para recomendar que se congelen los parches de producción. Las fechas y condiciones están en el [anuncio de .NET 11](https://devblogs.microsoft.com/dotnet/announcing-dotnet-11/) y en la [política oficial de soporte](https://dotnet.microsoft.com/platform/support/policy/dotnet-core).

Otra separación útil es la de nuestras pruebas y las de Microsoft. El artículo de rendimiento de Stephen Toub permite localizar mecanismos y los PRs donde se desarrollaron, pero compara **11.0.0-rc.1.26425.128 con 10.0.12**. Una RC es una candidata anterior a la disponibilidad general. Su [configuración original](https://devblogs.microsoft.com/dotnet/performance-improvements-in-net-11/) no es nuestra pareja GA, así que sus tiempos y su ensamblador se citan como resultados externos, sin trasladarlos a este laboratorio ni darlos por garantizados en la versión final.

### Tres clases de novedad que conviene separar

Hay mejoras que puedes recibir al actualizar sin tocar la forma de trabajar del programa. El JIT genera otro código o una biblioteca resuelve de manera distinta una operación ya existente. Son **cambios transparentes** para el código fuente. Si el optimizador reconoce un patrón redundante, puede quitar trabajo; si ese patrón no aparece, aquella optimización concreta no tiene nada que hacer ahí.

Las **APIs o la sintaxis nuevas** requieren una decisión por nuestra parte. Para usar `FullJoin`, una union de C# 15 o un adaptador de memoria hay que escribir código que los utilice. Pueden simplificar una operación, pero que existan no cambia automáticamente todas las aplicaciones anteriores.

Por último están las **opciones de compilación y despliegue**: activar Runtime Async en el código propio, publicar con Native AOT o seleccionar otro modo del GC. Si activamos algo sólo en una variante, estamos comparando dos tratamientos, no únicamente dos números de versión. Conviene saberlo antes de llamar al resultado «la mejora de .NET 11».

En este artículo, el opt-in de **Runtime Async para la aplicación** y las nuevas reglas de **memory safety** siguen siendo **preview**. Pueden estar disponibles sobre un runtime estable sin tener por ello el mismo grado de estabilidad. Además, el código propio y las bibliotecas del runtime no tienen por qué utilizar el mismo comportamiento predeterminado. Volveremos a esa diferencia al abrir el ejemplo async.

### ¿Y lo que no cabe en un benchmark?

Puedes ganar tiempo en un bucle y perder la posibilidad de arrancar en una máquina de destino. .NET 11 también trae requisitos de CPU y cambios de comportamiento, de proveedores de datos, de herramientas de diagnóstico y de imágenes de contenedor.

Para decidir una migración habrá que revisar compatibilidad, dependencias y datos, y tener una forma de volver atrás. Los tiempos ayudan a tomar esa decisión, pero primero necesitamos saber en qué condiciones se obtuvieron.

<a id="metodologia"></a>
## 4. Cómo hemos realizado las pruebas

Poner un cronómetro alrededor de una llamada es fácil. Conseguir que las dos llamadas que comparamos estén haciendo lo mismo, en condiciones comparables, ya tiene más trabajo.

La primera ejecución puede tener que compilar un método con el JIT o preparar metadata. Un archivo puede llegar del disco o estar ya en RAM. Una tarea puede esperar a que haya un hilo disponible. El reloj habrá medido correctamente todo eso, pero quizá no sea lo que queríamos comparar. Por eso merece la pena detenerse aquí antes de leer una tabla de nanosegundos.

<a id="metodo-lectura"></a>
### Qué hay que saber antes de mirar los resultados

Para leer las tablas hacen falta cinco cosas: saber qué trabajo se comparó, cómo se repitió, qué cambió entre versiones, qué unidad estamos mirando y hasta dónde llega la comprobación.

1. **Primero, el mismo trabajo.** Ahorrar tiempo sólo sirve si se mantiene el resultado y el contrato de la operación. Crear una estructura en cada llamada, tenerla ya preparada o cambiar de algoritmo son comparaciones distintas de actualizar el runtime. Los ejemplos didácticos ayudan a entenderlo; la operación medida está en los originales enlazados.
2. **Cada cifra pertenece a una campaña.** La versión efectiva, la entrada, la configuración, el entorno, el orden y qué se repitió forman parte de ella. Una iteración no equivale a un proceso nuevo, ni dos campañas se convierten en réplicas intercambiables por usar el mismo método. Tampoco una selección de filas permite calcular «cuánto mejora .NET» en general.
3. **Ver una diferencia no basta para encontrar su causa.** El ensamblador puede enseñarnos trabajo eliminado y un PR explicar una optimización compatible con lo observado. Eso no aísla todo lo que cambió entre versiones. Cuando no hay una intervención que separe las causas, no voy a adjudicar el porcentaje a una de ellas.
4. **Hay varias cosas que medir y varias decisiones que tomar.** Tiempo, throughput, asignaciones, residencia, tamaño y arranque responden preguntas diferentes. Ganar en una no obliga a ganar en las otras. Lo mismo ocurre con adoptar un runtime estable, una versión estable del lenguaje o una opción preview: no vienen en un único paquete de decisiones.
5. **Hay que saber qué acredita cada comprobación.** Un control funcional comprueba comportamiento; uno estático contrasta archivos o cálculos. Ninguno sustituye una prueba de velocidad. Una guía tampoco demuestra haber ejecutado un despliegue, una herramienta o una plataforma, y un hash no recupera unas fuentes históricas que no se conservaron.

Si quieres aplicar un resultado a producción, habrá que llevarlo al contrato, los datos y el entorno de tu aplicación. Este laboratorio permite plantear la pregunta con más precisión; no sustituye esa prueba.

### El ordenador de estas cifras

Las campañas corrieron sobre **Windows 11 Pro x64**, en un Lenovo con **Intel Core i5-1135G7**, cuatro núcleos físicos y ocho procesadores lógicos. El inventario registra **16.952.647.680 bytes de RAM física** y presencia de hipervisor.

Era una máquina compartida, no un servidor dedicado al experimento. No se reservaron núcleos, no se pararon servicios ajenos y no se vació la caché del sistema operativo. Al comenzar la campaña principal, CIM indicaba aproximadamente **376 MiB de memoria libre**. Había poco margen en ese momento; ese dato no nos dice cuánto se paginó ni demuestra que la memoria fuese la causa de una diferencia de rendimiento.

También pueden intervenir el ahorro energético, el turbo, la temperatura y otras aplicaciones. Una lectura de frecuencia instantánea no permite asegurar que la CPU mantuviera esa frecuencia durante toda la campaña. Guardar el entorno nos deja conocer estas condiciones, aunque no elimine sus efectos.

El [snapshot original](https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/metadata/micro-full-20261112/environment.json) conserva esos datos. En el blog he utilizado gráficos y capturas seleccionados sin rutas personales visibles. Los originales de la investigación siguen en el repositorio público enlazado; no se ha incorporado el entorno local ni sus herramientas instaladas.

### Qué hace BenchmarkDotNet por nosotros

**BenchmarkDotNet**, abreviado como BDN en las tablas, construye las pruebas y las ejecuta en procesos separados. Prepara el escenario, realiza calentamientos, calcula cuántas invocaciones necesita y mide varias iteraciones. También detecta ciertos problemas de configuración y guarda resultados detallados, bastante más útiles que una única lectura de cronómetro.

Se utilizó **0.16.0-preview.1**. El intento con 0.15.8 falló al reconocer el runtime 11 con la configuración empleada; no se desactivó el validador para conseguir que apareciera una tabla. La herramienta de medida es preview en ambos lados, mientras que los dos runtimes comparados son GA.

El protocolo habitual pide **seis iteraciones de calentamiento y quince de medida**, con un objetivo de **250 ms por iteración** y **un lanzamiento por job**. Una iteración puede ejecutar muchas veces la misma operación. Un job es un caso con su configuración concreta, no un método de negocio adicional.

Esto explica por qué aparecen más registros que métodos. Los **101 métodos** se reparten en **88 principales, siete de Runtime Async, cinco sondas JIT y uno de OpenTelemetry**. Después hay que combinarlos con runtimes, tamaños de entrada, consumidores y tratamientos. No son 101 aplicaciones completas, ni 101 repeticiones independientes de cada conclusión.

La campaña principal tiene **176 jobs**. El barrido adicional toma **29 métodos** y, al combinar tamaños o workers, produce **134 jobs: 67 pares entre versiones**. Cambiar el tamaño no inventa un algoritmo nuevo. Sus datos se conservan por separado para que un resultado con una entrada pequeña no termine comparado con otro de entrada grande.

En los jobs generales se solicitaron configuraciones comparables de **GC Workstation concurrente**, compilación por niveles y **Dynamic PGO**, que utiliza perfiles recogidos durante la ejecución para orientar optimizaciones. Las variantes Server GC y las campañas de diagnóstico se identifican aparte. Además, se comprueba la versión efectiva del proceso hijo: ver dos runtimes instalados en el equipo no demuestra cuál ha ejecutado la prueba. El protocolo completo está en la [metodología](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/docs/methodology.md).

### Antes de preguntar cuánto tarda, preguntamos si hace lo correcto

Si una búsqueda deja de encontrar lo que debe o una escritura no guarda los mismos datos, su tiempo deja de ser comparable. Antes de medir hay que conservar el comportamiento.

Las pruebas de corrección revisan sumas, bytes, propiedades JSON, cardinalidades, cancelación, excepciones y cambios de estado. El productor y los consumidores deben procesar todos los enteros; descomprimir debe recuperar los bytes de entrada; una escritura EF con rollback debe dejar la base como estaba.

Las aserciones quedan fuera del tiempo cuando no pertenecen al contrato medido. La preparación, en cambio, no se retira por sistema: si la pregunta es cuánto cuesta crear un array, una tarea o un proveedor criptográfico, esa creación tiene que seguir dentro. Lo que necesitamos es definir la operación, no construir la cifra más pequeña posible.

En varias fixtures hay **checksums**, valores de comprobación calculados a partir del resultado. Se contrastan sumas con una referencia independiente para detectar cambios que alteren ese valor. Eso no garantiza identidad de cualquier contenido ni seguridad criptográfica; cuando hacen falta bytes idénticos, se comparan también los bytes.

Además, alguien tiene que utilizar el resultado. Un compilador puede borrar un cálculo si demuestra que no afecta a nada observable. Más abajo veremos un kernel que pasa de 69 a 3 bytes, pero conserva su entrada y su resultado: allí se elimina una forma innecesaria de producirlo, no el trabajo entero por falta de consumidor.

### Unidades para no perdernos entre ceros

| Unidad o métrica | Qué expresa | Cómo leerla |
|---|---|---|
| ms, milisegundo | Una milésima de segundo | Habitual en arranque, HTTP o base de datos. |
| µs, microsegundo | Una millonésima de segundo | Útil para operaciones pequeñas o lotes cortos. |
| ns, nanosegundo | Una milmillonésima de segundo | Escala de sondas muy pequeñas; el contexto experimental importa mucho. |
| B/op | Bytes administrados asignados por operación | No son RAM residente, tamaño de ejecutable ni memoria nativa. |
| Peticiones/s | Respuestas completadas por segundo | Es throughput; mayor puede ser mejor si conserva errores y calidad. |
| P50, P95 y P99 | Umbrales de la distribución de latencias | Aproximadamente el 50%, 95% y 99% de las peticiones de esa ejecución queda por debajo de cada valor. |

Si ves **2 ns**, piensa en el coste de la pequeña operación repetida para estimarlo, no en el tiempo de una petición HTTP completa. Y si ves una buena media HTTP, aún puede haber un grupo de respuestas muy lentas. P95 y P99 ayudan a mirar esa parte que la media esconde.

Los porcentajes también tienen su trampa: **reducir el tiempo un 20% no equivale a aumentar el throughput un 20%**. Una operación hipotética que pasa de 1 ms a 0,8 ms tarda un 20% menos. Sin otro cuello de botella, permitiría pasar de 1000 a 1250 operaciones/s, un 25% más. Es sólo aritmética para interpretar las unidades, no un resultado de estas pruebas.

### La media necesita compañía

En BDN, `Mean` es la media, `Median` es la mediana y `StdDev` mide dispersión. La columna `Error` es la semiamplitud del intervalo de confianza declarado por la herramienta, aquí del **99,9%**. No es otra manera de escribir la desviación estándar ni significa que obtendríamos lo mismo en el 99,9% de los ordenadores.

También hay que recordar qué se repitió. Quince iteraciones dentro de un proceso no son quince despliegues independientes. Los intervalos recogen incertidumbre dentro de ese modelo de medida, no todos los estados posibles de la máquina. Algunas filas tienen menos de quince observaciones porque BDN aplica su política de outliers; los originales conservan tanto las muestras como los avisos.

No utilizo el solapamiento de dos intervalos como si fuera un test estadístico. Si una decisión depende de una diferencia pequeña, hacen falta réplicas independientes y preguntarse si el cambio tiene relevancia práctica, además de mirar el signo de los decimales.

EF y arranque siguen protocolos propios, de modo que sus rangos no se presentan como intervalos BDN. En HTTP, cada percentil pertenece a su ejecución. Hacer la media de dos P99 no recupera el P99 conjunto de todas las peticiones.

### De una cifra a su evidencia

Para poder revisar una cifra, lo ideal es pasar del artículo al código, del código al original y de ahí al entorno y al commit de ejecución. La [matriz de trazabilidad](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/docs/traceability.md) reúne ese recorrido y sus huecos. Algunas campañas empezaron antes del primer commit; otras registraron un árbol con cambios pendientes cuyo estado completo no se conserva. Un hash permite contrastar un archivo disponible, pero no reconstruye una fuente que falta.

La auditoría obtuvo **4042 comprobaciones estáticas correctas** sobre los datos y estructuras conservados. Son contrastes de archivos y cálculos: no 4042 benchmarks nuevos, ni una repetición independiente del laboratorio, ni una prueba de causalidad.

Con esto podemos aprovechar cada prueba para lo que sabe responder. Un microbenchmark permite abrir una operación pequeña. Una API, una consulta EF o una publicación añaden otras condiciones y otros costes. Para empezar a ver esa diferencia, vamos a mirar algo bastante tangible: qué instrucciones produjo el JIT.

---

[Volver al índice](#indice)

**PARTE II — QUÉ OCURRE DENTRO DEL RUNTIME**

<a id="jit"></a>
## 5. JIT: del código intermedio a la CPU

Tenemos un ensamblado con IL, pero el procesador necesita sus propias instrucciones. En la ruta habitual de estas aplicaciones, el encargado de dar ese paso es el **JIT**, *Just-In-Time compiler*.

Cuando un método necesita código nativo, el runtime puede pedirle que lo compile. A partir de ahí, ese código puede reutilizarse: no hay una nueva traducción de cada instrucción C# cada vez que pasamos por ella. El JIT adapta el programa a la máquina donde va a ejecutarse y debe conservar su comportamiento observable.

Si lo imaginas como un traductor, quédate con la adaptación al destino. No está interpretando una frase ambigua y decidiendo qué hemos querido decir. Trabaja sobre un programa con reglas precisas, incluidas las de tipos, errores y efectos que el resto de la aplicación puede observar.

### ¿Por qué no generar siempre todo de antemano?

Compilar mientras arranca o se ejecuta el programa cuesta tiempo. A cambio, permite conocer la máquina real y aprovechar información de lo que sucede durante la ejecución. Un servicio que vive varios días puede amortizar ese coste de una manera muy distinta a una herramienta que se abre muchas veces para hacer un trabajo corto.

Hay varias formas de repartirlo. **ReadyToRun** adelanta parte de la compilación sin renunciar al JIT. **Native AOT** cambia más profundamente cómo compilamos y distribuimos la aplicación. Más adelante compararemos tamaños y arranques; ahora nos interesa entender qué puede ahorrar el JIT dentro de un método.

[![Esquema conceptual de cómo un contexto conocido habilita desvirtualización, inlining y simplificación](/blog/dotnet-10-vs-dotnet-11/02-jit-pipeline.png)](/blog/dotnet-10-vs-dotnet-11/02-jit-pipeline.png)

*Figura 2. Diagrama didáctico de oportunidades de optimización, no una traza ni un orden contractual de fases. Conocer el receptor permite razonar sobre la llamada y el trabajo necesario; el resultado depende del patrón. Fuente: [diseño del JIT de CoreCLR](https://github.com/dotnet/runtime/tree/main/docs/design/coreclr/jit) y [configuración de las sondas](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/JitProbes/Program.cs).*

[Abrir PNG a tamaño completo](/blog/dotnet-10-vs-dotnet-11/02-jit-pipeline.png).

### Compilar rápido al principio, optimizar después

Con **tiered compilation**, o compilación por niveles, el runtime puede empezar con una versión de un método menos costosa de compilar y generar después otra más optimizada si se utiliza con frecuencia. Así no necesita pagar desde el primer momento el mismo esfuerzo por todo el código.

**PGO**, *Profile-Guided Optimization*, usa perfiles de comportamiento para orientar decisiones. En **Dynamic PGO**, esos perfiles se recogen durante la ejecución. Por ejemplo, en un punto donde podrían llegar objetos de distintos tipos, puede observarse cuáles aparecen realmente.

Eso aporta información útil, aunque «este tipo aparece casi siempre» no significa «los demás tipos son imposibles». Una especialización basada en un perfil puede necesitar una comprobación y una ruta alternativa correcta. El caso poco frecuente tiene que seguir funcionando.

Tiering y Dynamic PGO estaban habilitados en los dos runtimes de las campañas generales. Hemos igualado esa configuración, pero no hemos aislado su contribución al resultado. Para ponerle un porcentaje a PGO haría falta otro experimento que lo activase y desactivase de forma controlada; aquí no se hizo.

### Inlining: quitar una frontera para poder ver más

Cuando llamamos a un método, hay que preparar sus argumentos y transferirle el control. El **inlining** permite incorporar su cuerpo en el punto donde se llama, si el compilador considera que compensa.

Supongamos que el método sólo duplica un entero:

```csharp
// Fragmento didáctico: equivalencia, no ensamblador capturado.
static int Doble(int valor) => valor * 2;
```

Si se integra `Doble(entrada)`, el compilador puede trabajar con `entrada * 2` dentro del código que lo rodea. El ahorro no se limita a la llamada. Al desaparecer aquella frontera, quizá se vea una constante, una condición que ya se había comprobado o un objeto que no necesita llegar a existir.

Tampoco conviene integrar todo indiscriminadamente. El código puede crecer, necesitar más registros o perjudicar la caché de instrucciones. El JIT sopesa esos costes. `AggressiveInlining` expresa una preferencia, pero no garantiza que un método se integre en cualquier situación.

En nuestras sondas también aparece `NoInlining`, justo para conservar una frontera. Queremos poder inspeccionar el **kernel**, el pequeño núcleo de la operación que estudiamos, sin que se mezcle dentro de todo el código de medida o *harness*. Aquí «kernel» no se refiere al núcleo del sistema operativo.

### Métodos virtuales: elegir una implementación

Una aplicación puede trabajar con un contrato común y dejar que varios tipos lo implementen: proveedores distintos, estrategias o transformaciones intercambiables. Un método **virtual** permite esa elección. El código que llama conoce la base, aunque no siempre sepa qué implementación concreta recibirá.

La flexibilidad tiene un posible coste. Hay que resolver a qué método dirigirse y, mientras el destino siga abierto, el compilador tiene menos información para integrar su cuerpo y simplificarlo.

La **desvirtualización** resuelve ese destino cuando hay información suficiente. A veces existe una certeza: acabamos de construir un objeto de un tipo concreto. Otras veces se crea un camino especializado con una comprobación que lo protege. Conviene distinguir ambas, porque la segunda tiene que conservar una salida para los otros tipos.

A esto se pueden añadir los **genéricos**. En `Echo<T>`, `T` es un parámetro de tipo: puede ser un entero, un texto u otro tipo. No todos reciben el mismo tratamiento interno. La prueba de 69 a 3 bytes utiliza un método virtual genérico **no compartido, especializado aquí para `int`**. Ese detalle delimita el caso; no estamos abarcando de golpe todas las combinaciones de genéricos y polimorfismo.

### Bounds checks: seguridad que a veces puede demostrarse sin repetir

Al leer `array[i]`, el índice debe señalar un elemento válido. Si queda fuera, el programa tiene que producir el error correspondiente, no acceder sin más a otra parte de memoria. El **bounds check** comprueba ese límite.

Hay ocasiones en las que el compilador ya puede demostrar que el acceso es válido. Repetir entonces la comprobación añade trabajo sin aportar otra garantía. Se puede conservar la seguridad haciendo menos comprobaciones durante la ejecución.

Este programa autónomo utiliza el cuerpo de búsqueda de la sonda y añade una envoltura de consola para probarlo:

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

Imprime `True` y `False`. En `"x%FF"` hay dos caracteres después de `%`; en `"%F"` el patrón queda cortado y no se deben leer posiciones inexistentes.

La condición sobre `i+2` protege esa lectura adelantada. Con los rangos adecuados, demostrar que cabe `i+2` también permite razonar sobre `i+1`. Conservamos la búsqueda y su salida temprana al encontrar la coincidencia. No estamos ganando tiempo por comparar un bucle que recorre todo con otro que deja de buscar antes.

En el ensamblador local, **LookAhead pasó de 102 a 66 bytes de kernel**. Antes de leer `i+1`, .NET 10 generó este fragmento:

```assembly
; Fragmento real del kernel .NET 10; no es el método completo.
lea       r10d,[rdx+1]
cmp       r10d,ecx
jae       short 0000000000002840
lea       r10d,[rdx+1]
cmp       word ptr [rax+r10*2],46
```

En el punto correspondiente de .NET 11 quedó así:

```assembly
lea       r10d,[rdx+1]
cmp       word ptr [rax+r10*2],46
```

Aunque no leas ensamblador habitualmente, se ve qué ha desaparecido. `lea` calcula aquí la expresión del índice, `cmp` compara y `jae` realiza un salto condicionado. La segunda versión evita la comparación redundante y su camino de error antes de esa lectura. **La protección de `i+2` sigue en el método**; no han desaparecido todos los controles de límites.

El [PR 124242](https://github.com/dotnet/runtime/pull/124242) explica la optimización de este patrón. Los bytes anteriores, sin embargo, proceden de [las sondas propias](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/JitProbes/Program.cs) y del [ensamblador original de esta campaña](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/raw/jit-pr/main/results/BenchmarkRun-joined-2026-11-12-16-17-31-asm.md), no de copiar el ejemplo de código máquina del PR.

### Resolver una pregunta conocida antes de ejecutarla

Si podemos saber el resultado de una expresión de antemano, no hace falta calcularlo cada vez. A esa simplificación se la llama **constant folding**.

La sonda ConstantUnequal obtiene mediante getters dos cadenas constantes diferentes: `"abcdef"` y `"bcdefg"`. Una vez integrados los caminos relevantes, .NET 11 deja este kernel:

```assembly
xor       eax,eax
ret
```

`xor eax,eax` pone a cero el registro de retorno, que aquí significa `false`. `ret` devuelve el control a quien llamó. En total son **3 bytes**, frente a los **51 bytes** del kernel de .NET 10 que se inspeccionó.

El [PR 121985](https://github.com/dotnet/runtime/pull/121985) trata la optimización de `SequenceEqual` mediante **value numbering**, una técnica que permite reconocer valores y equivalencias dentro del programa. Lo que se aprovecha aquí es que las entradas son conocidas. Si los textos se construyen durante la ejecución, hay que compararlos: la sonda DynamicEqual conserva ese trabajo efectivo.

¿Entonces el benchmark constante tarda cero? Sigue existiendo la llamada `NoInlining`. Sus medias fueron **2,489 ns en 10 y 2,034 ns en 11**, con [Error y muestras conservados](https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/processed/jit-pr/micro-records.json). Es el coste de lo que queda de ese camino, no una medida del ancho de banda con el que podríamos comparar dos documentos.

### SIMD: varias operaciones dentro de una instrucción

Otra forma de ahorrar trabajo es operar con varios datos a la vez. **SIMD** utiliza instrucciones del procesador para hacerlo, por ejemplo al sumar bloques de enteros o procesar buffers. No crea varios hilos; el paralelismo está en los datos tratados por la instrucción.

La sonda SIMD general usa vectores explícitos. En los dos runtimes aparece `vpaddd ymm6,ymm6,[rax+rcx*4+10]` y se avanza de ocho enteros en ocho: son instrucciones vectoriales de **256 bits**. Que el proceso tenga disponible una capacidad AVX512 no obliga a que ese `Vector<int>` utilice 512 bits.

El kernel se redujo de **181 a 173 bytes**. En otros controles no cambió el tamaño: **SpanLoop, 57; ConcreteDispatch, 54; BoundsLoop, 70; InterfaceDispatch, 95 bytes**. El camino rápido por tipo de InterfaceDispatch ya estaba en las dos versiones. Si sólo mirásemos la presencia de ese camino en 11, podríamos atribuirle una novedad que el código de 10 también tenía.

La [captura general de seis métodos](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/raw/jit-general-20261112/micro/results/NetComparison.Benchmarks.JitBenchmarks-asm.md) permite observar las instrucciones. No es un experimento de autovectorización ni demuestra que todos los bucles vayan a mejorar. Tener menos instrucciones puede ayudar, pero su tamaño y el tiempo que tardan son medidas diferentes.

El ahorro será útil si aparece en una parte que ejecutamos lo suficiente. Podemos ver juntas varias de estas piezas —tipo conocido, integración del método y trabajo eliminado— en un ejemplo mucho más pequeño de lo que su C# sugiere.

<a id="gvm"></a>
## 6. El experimento de 69 a 3 bytes

Vamos a crear un objeto, guardarlo en una variable de una base abstracta y llamar a un método genérico que devuelve exactamente lo que recibe. En C# hemos pedido una creación y una llamada. Pero si el compilador ve qué objeto es y qué hace ese método, ¿necesita realizar todos esos pasos?

Este programa permite seguir el caso completo. Conserva los tipos y el cuerpo del kernel de la investigación y añade una llamada de consola fuera de él. Puedes leerlo como un programa autónomo, pero **no es el ejecutable BenchmarkDotNet con el que se obtuvieron los tiempos**.

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

La consola muestra `42`. `EchoBase` define el contrato y `Echoer` lo implementa. El parámetro de tipo `<T>` permite devolver el mismo tipo que hemos recibido. En `GenericVirtual`, el objeto se crea allí mismo: no llega desde un proveedor desconocido ni se elige una implementación distinta en función de la entrada.

Fíjate en esa diferencia entre lo que declara la variable y lo que sabemos de su contenido. Se llama `receiver` y está declarada como `EchoBase`, pero acaba de recibir un `new Echoer()`. El compilador puede conocer el tipo concreto. Si consigue resolver `Echo<int>` e integrar el cuerpo, verá que devuelve `input` y que el objeto no añade ningún efecto observable. Entonces puede simplificar bastante más que una llamada.

### Qué conservaba el camino de .NET 10

En el código nativo inspeccionado de .NET 10, el kernel ocupa **69 bytes**. Sigue creando el objeto, resuelve el método genérico y termina haciendo una llamada indirecta con `call rax`. Contar únicamente «una llamada virtual» en el código fuente se queda corto para describir ese camino: también hay trabajo de creación y resolución.

.NET 11 genera estas dos instrucciones:

```assembly
mov       eax,ecx
ret
```

En este contexto x64, el entero de entrada llega en `ecx`; el resultado debe salir en `eax`. `mov` copia el argumento al registro de retorno y `ret` vuelve al llamador. Eso es todo lo que queda dentro del kernel. **No devuelve un `42` escrito en el código máquina: devuelve el valor que le pasen.**

[![Comparación didáctica del código C# del receptor conocido y los caminos nativos observados en las dos versiones](/blog/dotnet-10-vs-dotnet-11/03-gvm-code.png)](/blog/dotnet-10-vs-dotnet-11/03-gvm-code.png)

*Figura 3. Transcripción didáctica basada en código y ensamblador reales, no una captura de terminal. Los tamaños 69 y 3 corresponden al kernel GenericVirtual; el wrapper BDN conserva 19 bytes en ambos runtimes. Fuente: [PrJitKernels y PrJitConstants](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/JitProbes/Program.cs) y [asm local](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/raw/jit-pr/main/results/BenchmarkRun-joined-2026-11-12-16-17-31-asm.md).*

[Abrir PNG a tamaño completo](/blog/dotnet-10-vs-dotnet-11/03-gvm-code.png).

### ¿Se ha perdido el trabajo o se ha demostrado que sobraba?

Un benchmark puede dar una cifra magnífica por el motivo equivocado. Si calcula algo cuyo resultado nadie utiliza, el compilador puede eliminarlo y dejar de medir aquello que queríamos estudiar.

Por eso aquí hay que abrir también el código de medida. El wrapper real tiene un campo `input`, llama al kernel `NoInlining` y devuelve lo que este produzca:

```csharp
// Fragmento real de PrJitConstants; pertenece a la clase del benchmark.
private int input = 42;
[Benchmark]
public int NonSharedGenericVirtual() => PrJitKernels.GenericVirtual(input);
```

El ensamblador de ese wrapper carga el campo y conserva la llamada en ambas versiones. **Ocupa 19 bytes en las dos**. `NoInlining` mantiene el kernel separado para inspeccionarlo; no impide que se optimice lo que ocurre dentro. Los controles funcionales comprueban entradas `int.MinValue`, `-1`, `0`, `42` e `int.MaxValue`.

Así se mantiene observable la operación: entra un valor y sale ese valor. Lo que ya no necesita existir es el objeto intermedio. No escapa del método, nadie observa su identidad y su implementación sólo devuelve el argumento. Eliminar su materialización conserva el comportamiento, a diferencia de borrar un cálculo porque no tenía consumidor.

### Los bytes de código y los bytes asignados cuentan cosas distintas

Hay dos cifras llamativas y conviene darles su unidad. **69 → 3 bytes** es la reducción del código máquina del kernel. **24 → 0 B/op** es la memoria administrada asignada por cada operación. Ninguna de ellas es el tamaño del ejecutable completo.

Aunque `Echoer` no tenga campos de negocio, materializar un objeto requiere estructura y alineación del runtime. En el camino de 10 se observaron esos 24 bytes asignados. En el de 11 ya no se materializa el objeto y desaparece esa asignación. No es que un asignador nuevo fabrique gratis el mismo objeto: en este camino se ha evitado crearlo.

[![Resultados del kernel virtual genérico, con tiempos y asignaciones separados por unidades](/blog/dotnet-10-vs-dotnet-11/04-gvm-measurements.png)](/blog/dotnet-10-vs-dotnet-11/04-gvm-measurements.png)

*Figura 4. Resultado propio del patrón de receptor conocido. Media de 10,578 a 2,298 ns; Error BDN de 1,415 y 0,017 ns, con 15 y 13 observaciones utilizadas; 24 a 0 B/op. Tiempo y asignación se indican como métricas distintas. Es una campaña con diagnóstico de ensamblador, no una aceleración prometida para toda la aplicación. Fuente: [BDN original](https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/raw/jit-pr/main/results/BenchmarkRun-joined-2026-11-12-16-17-31-report-full.json).*

[Abrir PNG a tamaño completo](/blog/dotnet-10-vs-dotnet-11/04-gvm-measurements.png).

### Qué permite concluir y qué no

Podemos seguir **este patrón concreto**, con receptor conocido y método genérico no compartido, desde el código hasta esos cuerpos nativos y sus asignaciones. Además, los **cuatro cuerpos de kernel inspeccionados tenían IL idéntico entre destinos**, y se conservaron sus hashes. El cambio de instrucciones no procede de haber escrito dos algoritmos distintos en C#.

Eso no hace idénticas toda la metadata ni toda la BCL. Tampoco convierte el [PR 122023](https://github.com/dotnet/runtime/pull/122023) en la única diferencia entre ambos runtimes. El alcance del PR inicial no cubría todos los genéricos compartidos, todos los receptores polimórficos ni Native AOT, y esta prueba tampoco los cubre.

No sacaría de aquí una norma de «elimina todas tus abstracciones» ni otra de «las abstracciones ya no cuestan». El dato útil es qué información ha permitido quitarlas en este caso. Un tipo conocido y una implementación pequeña dejan al compilador ver el resultado; una llamada abierta a implementaciones arbitrarias puede seguir necesitando resolver y ejecutar todo ese camino.

Al evitar el objeto también evitamos memoria que, de otro modo, habría que gestionar. Para entender cuánto supone eso en una aplicación necesitamos distinguir la memoria que se asigna de la que sigue viva y de la que el proceso conserva.

<a id="gc"></a>
## 7. Garbage Collector: memoria que se reserva, vive y se libera

Una respuesta JSON, un array, una tarea o un objeto que representa una consulta necesitan espacio. Si los creamos una y otra vez, la gestión de ese espacio acaba formando parte del coste del programa, aunque no la veamos en la línea de C# que estamos leyendo.

Una **allocation**, o asignación, reserva memoria para un dato. No significa simplemente dar otro valor a una variable. Tampoco quiere decir que, al dejar de usar ese dato, la memoria vuelva inmediatamente al sistema operativo.

### Stack y heap sin una regla falsa

El **stack**, o pila, está ligado a los marcos de ejecución de las llamadas: contiene información para continuar, argumentos y temporales según el código generado. En el **heap administrado**, el runtime gestiona muchos de los objetos que pueden seguir existiendo después de que termine una llamada.

La regla rápida «los tipos valor van al stack y las clases al heap» crea más confusiones de las que aclara. Un valor puede estar dentro de un objeto, un dato puede mantenerse en registros y una creación que vemos en C# puede desaparecer al compilar, como en el kernel anterior. La ubicación efectiva depende del uso y de cómo se haya generado el código.

El **Garbage Collector**, GC, recupera memoria de objetos que ya no son alcanzables desde las referencias que el programa conserva. No tenemos que escribir un `free` por cada objeto administrado. Eso nos quita trabajo manual, pero no hace gratis crear millones de objetos.

Además, recuperar memoria y liberar un recurso a tiempo son problemas distintos. Un archivo, una conexión o un identificador nativo pueden requerir `Dispose` y una construcción `using`. Esperar a que el GC resuelva todo no sustituye ese contrato de liberación.

### Qué son las generaciones

Muchos programas crean montones de objetos que duran poco. El GC aprovecha ese comportamiento y organiza el heap administrado en generaciones, en lugar de revisar siempre todo con el mismo esfuerzo.

Los objetos nuevos suelen comenzar en la **generación 0**. Si sobreviven, pueden promocionar a generaciones posteriores. En la **generación 2** encontramos objetos más longevos; recogerla forma parte de las colecciones más amplias. El funcionamiento concreto depende del modo y de las circunstancias, pero esa separación permite tratar de forma diferente lo que acaba de nacer y lo que lleva tiempo vivo.

Una **pausa de GC** detiene trabajo administrado durante alguna fase de la colección. Parte del trabajo puede hacerse concurrentemente, aunque «concurrente» no equivale a «sin pausas». También hay consumo de CPU y efectos sobre cachés y memoria residente que no se resumen en el tiempo de pausa.

**Workstation GC** y **Server GC** toman decisiones distintas sobre los heaps y el trabajo de recolección. Server puede utilizar el paralelismo y los recursos de otra manera. No basta con que la aplicación sea un servidor para dar por hecho que será mejor en cualquier máquina, especialmente si comparte recursos con otros procesos.

### El LOH y los huecos que quedan entre objetos

Los objetos grandes tienen su zona, el **Large Object Heap**, o **LOH**. Su umbral habitual por defecto está alrededor de **85.000 bytes de tamaño del objeto**. Los buffers de **128.000 bytes** utilizados en el control entran claramente en ese grupo.

Piensa en una estantería donde retiras algunas cajas y dejas otras. Puedes sumar bastante espacio libre y, aun así, tenerlo repartido en huecos que no encajan con lo que quieres colocar. Compactar reorganiza el contenido para reunir espacio. Es una ayuda para visualizar la fragmentación, no una descripción de todos los algoritmos del GC ni una afirmación de que cada colección compacte todas las zonas.

En el control preparé deliberadamente esos huecos: se retienen buffers alternos, se solicita una colección sin compactación LOH y después una compactación explícita. Se ejecutaron **cuatro procesos**, uno por combinación de los dos runtimes y los modos Workstation/Server. El modo efectivo se comprobó en cada proceso hijo.

[![Fragmentación LOH antes y después de una compactación solicitada en los cuatro tratamientos](/blog/dotnet-10-vs-dotnet-11/05-gc-fragmentation.png)](/blog/dotnet-10-vs-dotnet-11/05-gc-fragmentation.png)

*Figura 5. Intervención artificial, un proceso por tratamiento. Los huecos observados, alrededor de 8,1 millones de bytes, se reducen a unos 4,4–4,6 miles tras la compactación explícita. No es un ranking de pausas ni una recomendación de forzar GC por petición. Fuente: [protocolo](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/docs/experiments-gc.md) y [resultados originales](https://github.com/jyeste94/.NET11vs.NET11/tree/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/raw/gc/main/).*

[Abrir PNG a tamaño completo](/blog/dotnet-10-vs-dotnet-11/05-gc-fragmentation.png).

La ventana de presión crea y escribe **2000 buffers**, mantiene **64 vivos** y registra **256.048.000 bytes asignados** en cada tratamiento. Después de compactar se mantienen los checksums. Ganar espacio contiguo no serviría si al mover los datos cambiase su contenido.

El gráfico enseña el estado que hemos provocado con esa intervención; no dice que una API real vaya a acumular los mismos huecos. Tampoco basta un proceso por celda para clasificar estadísticamente las pausas. Se guardaron por separado `GCMemoryInfo` de la última colección y el delta acumulado de `GC.GetTotalPauseDuration`, porque uno describe información de una colección y el otro suma pausas durante una ventana.

Al poner junto a ellas el tiempo transcurrido se ve por qué no debemos intercambiarlos:

| Tratamiento, un proceso | Pausa acumulada de la ventana, ms | Tiempo transcurrido de la ventana, ms |
|---|---:|---:|
| 10 / Workstation | 2,059 | 81,607 |
| 10 / Server | 10,428 | 212,964 |
| 11 / Workstation | 2,792 | 66,359 |
| 11 / Server | 16,158 | 191,879 |

Los [resultados por tratamiento](https://github.com/jyeste94/.NET11vs.NET11/tree/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/raw/gc/main/) conservan las medidas originales. La ventana incluye el trabajo de generar la presión, además de sus pausas. Con una ejecución por celda, la tabla describe este control; no permite elegir un modo de GC para cualquier servicio ni afirmar una regresión general de pausas.

### Reutilizar un buffer no es lo mismo que cambiar de runtime

Si una operación necesita buffers continuamente, puede convenir reutilizarlos. **`ArrayPool<T>`** permite alquilar un array y devolverlo para que vuelva a usarse. A cambio hay una obligación importante: después de devolverlo, ya no podemos seguir utilizándolo como si fuera nuestro.

El tamaño físico que entrega el pool puede ser mayor que el solicitado. Este programa autónomo pide tres elementos y trabaja sólo con esos tres elementos lógicos:

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

Imprime `6`. El `finally` devuelve el array aunque falle el trabajo. `clearArray: true` pide limpiarlo, algo que puede importar para no conservar datos anteriores, pero también cuesta tiempo: la limpieza puede recorrer el tamaño físico alquilado, no sólo nuestros tres bytes lógicos.

En la prueba de **100.000 bytes**, Allocate registró **100.059 B/op en ambos runtimes**. ArrayPool registró **21/20 B/op** y ArrayPoolClear **21/21**. El pool ya estaba caliente. Ese byte de diferencia entre versiones no justifica hablar de una mejora relevante, y las cifras pequeñas tampoco garantizan que un pool nunca tenga que asignar memoria.

Aquí el ahorro grande viene de **reutilizar en lugar de crear**, algo que ya podíamos hacer en .NET 10. Reducir asignaciones también puede significar conservar más memoria preparada para otro uso. Cambiar el diseño de la operación y actualizar a 11 no son el mismo cambio.

El código de las [operaciones de memoria](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/Benchmarks/MemoryJitReflectionBenchmarks.cs) permite revisar qué se crea y qué se reutiliza. Los [seis jobs Server GC](https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/processed/servergc/micro-records.json) se conservan separados: mezclar campañas nos impediría distinguir un efecto del modo de GC de otro asociado al momento del host.

### Cuatro cifras de memoria que no conviene intercambiar

Si todas las columnas se llaman «memoria», es fácil acabar comparando cosas distintas. **B/op** cuenta bytes administrados asignados por operación bajo el diagnóstico utilizado. El **heap** describe memoria gestionada por el GC. El **working set** son páginas residentes del proceso. Y **private bytes** mide memoria privada comprometida, otra magnitud diferente.

Una aplicación puede bajar sus B/op sin bajar inmediatamente el working set. Quizá conserve buffers para reutilizarlos, utilice memoria nativa en SQLite o mantenga páginas disponibles para uso interno. Dividir el working set entre el número de peticiones no lo convierte en asignaciones por petición.

Por eso empezaría por el problema que queremos resolver. Si creamos demasiados objetos, miraremos las asignaciones y los B/op. Si preocupan las pausas, necesitaremos telemetría de GC. Si rozamos el límite de un proceso o de un contenedor, habrá que observar las medidas correspondientes. Una sola cifra no cubre las tres preguntas.

Parte de ese estado en memoria puede existir porque una operación aún no ha terminado. Cuando esperamos una respuesta sin bloquear un hilo, algo tiene que recordar cómo continuar.

<a id="async"></a>
## 8. Async/await: esperar sin ocupar un hilo innecesariamente

Un servidor pide un dato a una base de datos y tiene que esperar la respuesta. Durante esa espera puede no estar calculando nada. Si deja un hilo bloqueado hasta que termine, ese hilo no podrá atender otro trabajo mientras tanto.

La programación **asíncrona** permite representar la operación pendiente y continuar cuando haya resultado. No acelera el disco ni la red. Lo que cambia es cómo organizamos la espera y qué recursos mantenemos ocupados. Tampoco implica, por sí sola, que todo se ejecute a la vez en varios hilos.

### Task no es sinónimo de hilo

Una **`Task<T>`** representa la finalización y el resultado de una operación. Puede estar pendiente o haber terminado con un valor, con una cancelación o con un error. No necesita tener un hilo dedicado esperando a que se complete.

Cuando llegamos a `await`, se comprueba el estado de la operación. Si ya ha terminado, el método puede continuar sin suspenderse por esa espera. Si sigue pendiente, se registra cómo continuar y se devuelve el control al llamador. Al completarse la operación, la continuación podrá ejecutarse según las reglas de contexto y planificación que correspondan.

Podemos observarlo sin depender de cuánto tarde Internet. Basta con una puerta que inicialmente esté cerrada:

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

Primero imprime `False`: el cálculo todavía no ha terminado. `SetResult(41)` abre la puerta con el valor 41 y el método pendiente suma uno. Por eso la segunda salida es `42`.

La consola explica la idea del caso suspendido, pero los tiempos proceden de otro programa. El [kernel medido](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/RuntimeAsyncBenchmarks/Shared/AsyncWorkloads.cs) y su [wrapper real](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/RuntimeAsyncBenchmarks/AsyncBenchmarks.cs) definen las fronteras y la configuración del benchmark.

`RunContinuationsAsynchronously` evita que las continuaciones correspondientes se ejecuten síncronamente dentro de la llamada que completa la puerta. No establece un orden temporal global entre hilos ni elimina el coste de programar y ejecutar esas continuaciones.

### La máquina de estados que no escribimos a mano

Para retomar un método suspendido hay que recordar por dónde iba y qué valores necesitará al volver. Con la transformación convencional, Roslyn genera una **máquina de estados**: el estado y el código para entrar, suspender, reanudar y propagar el resultado o el error. Al inspeccionarla suele aparecer un método llamado `MoveNext`.

Eso es parte del trabajo que nos ahorra la sintaxis `async`/`await`. Podemos escribir el flujo de forma legible sin programar a mano toda la coordinación, aunque la infraestructura siga existiendo por debajo.

Conviene separar también dos llamadas frecuentes. **`Task.WhenAll`** combina la finalización de varias tareas; no obliga a que sus operaciones se ejecuten en paralelo ni elimina sus arrays y resultados. **`Task.Run`** programa trabajo en el ThreadPool. Utilizarlo es una decisión distinta de esperar una API que ya ofrece una operación asíncrona.

### ValueTask: una alternativa con un contrato más exigente

**`ValueTask<T>`** puede representar directamente un resultado ya disponible sin crear siempre una `Task<T>` separada para ese resultado. Si queda pendiente, puede apoyarse en otra representación.

Eso tiene interés en una API que completa de forma síncrona muchas veces y donde las asignaciones pesan. Pero sustituir todos los `Task` por `ValueTask` a ciegas puede añadir costes de composición o conversión. Su consumo también exige cuidado: no se debe reutilizar repetidamente ni en paralelo salvo que el contrato lo permita.

Para comparar estos caminos necesitamos saber si hubo una suspensión real. Un `MemoryStream` no obliga por sí mismo a esperar I/O pendiente. Y con `Task.Delay(1)` podemos acabar midiendo principalmente el temporizador del sistema. Por eso, en la campaña de Runtime Async, la puerta empieza incompleta y sólo se libera después de registrar la espera. Los casos completados inmediatamente se tratan aparte.

### Qué viaja con una operación: ExecutionContext y AsyncLocal

Además del resultado, una petición puede necesitar conservar un identificador de correlación u otro estado lógico. **ExecutionContext** forma parte de la infraestructura que propaga ese estado ambiente por la ejecución asíncrona. **`AsyncLocal<T>`** permite asociar un valor a ese flujo lógico.

No funciona como una simple variable global del proceso ni como un dato que pertenezca siempre al mismo hilo físico. La continuación puede ejecutarse en otro hilo y seguir viendo el valor de su contexto.

Aquí suele confundirse el papel de `ConfigureAwait(false)`. Indica que esa continuación no necesita regresar al contexto de sincronización capturado. **No suprime ExecutionContext ni borra AsyncLocal.** Y guardar un objeto mutable dentro de AsyncLocal tampoco provoca que se haga una copia profunda del objeto.

El [comportamiento compartido del proyecto](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/LanguageSamples/Shared/AsyncBehavior.cs) comprueba el flujo de contexto, el aislamiento del estado del padre, la cancelación y las excepciones. Se contrastan valores y transiciones concretas, más allá de comprobar que el programa no se haya caído.

### Qué introduce Runtime Async

Con **Runtime Async**, parte del soporte de suspensión y reanudación pasa al runtime y al JIT, en lugar de depender de la misma transformación convencional en máquina de estados que emite C#. Eso cambia el código generado y puede cambiar también lo que vemos al inspeccionar un stack vivo.

En este punto hay dos decisiones que no conviene juntar:

1. **Ejecutar sobre .NET 11 estable.** Según la documentación, las bibliotecas del runtime ya utilizan el modelo.
2. **Compilar nuestro propio código con el opt-in de Runtime Async.** Ese tratamiento de la aplicación sigue siendo **preview** en el corte del artículo.

En la variante experimental para net11 se añade esta propiedad al proyecto:

```xml
<!-- Fragmento de proyecto de la variante experimental, no del baseline. -->
<Features>$(Features);runtime-async=on</Features>
```

El opt-out por proyecto utiliza `UseRuntimeAsync=false`. Estas opciones actúan sobre la compilación correspondiente, no recompilan retrospectivamente todas las dependencias. Si tomásemos una DLL convencional y sólo cambiásemos el host donde corre, no habríamos demostrado una transformación nueva del compilador, el llamado *lowering*.

La [matriz de Runtime Async](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/docs/experiments-runtime-async.md) compara **cuatro tratamientos compilados por separado**: 10 convencional, 11 predeterminado, 11 opt-in preview y 11 opt-out. Para distinguirlos se registran las propiedades del ensamblado realmente cargado, sus atributos y los cuerpos IL del proceso hijo. El nombre de una carpeta no basta para saber qué código ha ejecutado.

### Lo que cambió en código y memoria

En **CompletedTask**, los tratamientos convencionales tenían **47 bytes IL**, frente a **13** en el opt-in. En **SuspendedTask** eran **55 frente a 17**. El código opt-in ya no presenta la misma máquina de estados convencional. Estamos contando los cuerpos IL inspeccionados, no todo el código máquina ni el tamaño del programa.

¿Ese IL más corto implica que gastaremos menos o terminaremos antes? El camino completo sigue teniendo objetos y trabajo de planificación. La siguiente figura permite verlo sin mezclar longitud de código con asignaciones:

[![Selección de asignaciones de tres workloads async, comparando Default11 y OptIn11Preview](/blog/dotnet-10-vs-dotnet-11/06-runtime-async-allocations.png)](/blog/dotnet-10-vs-dotnet-11/06-runtime-async-allocations.png)

*Figura 6. Selección de tres de los siete workloads de la campaña de 28 jobs: Default11 frente a OptIn11Preview, con runtime11 y C# 15 en ambos. El tratamiento opt-in de la aplicación es preview. Incluye puertas, Tasks y contexto de cada operación, no sólo el `await`. Los cuatro tratamientos completos se conservan en el [BDN original](https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/raw/runtime-async/main/bdn/results/NetComparison.RuntimeAsync.AsyncBenchmarks-report-full.json) y el [lowering de los hijos](https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/raw/runtime-async/main/diagnostic-index.json).*

[Abrir PNG a tamaño completo](/blog/dotnet-10-vs-dotnet-11/06-runtime-async-allocations.png).

Entre **Default11 y opt-in**, la cadena async baja de **408 a 368 B/op**. En cambio, SuspendedTask sube de **184 a 256 B/op** y AsyncLocalFlow de **280 a 360 B/op**. Son los caminos completos de esas operaciones, incluidas las puertas, Tasks y el contexto que utiliza cada una; no el precio aislado de escribir `await`.

En ese mismo orden, las medias temporales fueron **743,54 → 695,17 ns**, **408,34 → 483,63 ns** y **491,59 → 668,64 ns**. Los [registros de la campaña](https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/processed/runtime-async/records.json) conservan sus intervalos y avisos de distribución bimodal. Con un lanzamiento por tratamiento, no daría esas diferencias por mejoras o empeoramientos temporales estables entre despliegues. Sí podemos observar la transformación del código y la contabilidad de estos caminos, que ya muestra por qué menos IL no garantiza menos memoria o menos tiempo.

### Un stack vivo no es un stack de excepción

Un **stack trace** muestra una cadena de llamadas. Pero consultar el stack de una operación viva, suspendida o en ejecución, no responde a la misma pregunta que leer el texto de una excepción.

En el diagnóstico convencional se ven marcos de builders entre los métodos async. En el opt-in aparecen seguidos métodos de la aplicación como `InnerLiveAsync`, `OuterLiveAsync` y `Main`, y después la infraestructura de continuaciones. Las excepciones mantuvieron el origen `ThrowAfterYieldAsync` en ambos tratamientos.

También se capturaron las aplicaciones con **dotnet-trace**, y sus trazas se pudieron leer y simbolizar. Eso acredita esas capturas, no el funcionamiento de todos los depuradores: aquí no se han validado todos los profilers, los dumps ni las formas de hacer stepping.

Yo separaría las dos adopciones. Puedes probar **.NET 11 predeterminado** sin activar Runtime Async globalmente para tu código. Para decidir sobre el opt-in preview, miraría qué patrones dominan en el servicio, qué consumen y cómo se diagnostican. Hemos visto un cambio real en la forma de ejecutar async, pero sus efectos dependen del camino que haga la aplicación.

Con las esperas y el estado que conservan ya situados, queda abrir el trabajo que hacemos sobre los datos: qué estructuras elegimos y cómo las recorremos o consultamos.

---

[Volver al índice](#indice)

**PARTE III — RENDIMIENTO DEL CÓDIGO QUE ESCRIBIMOS**

<a id="colecciones"></a>
## 9. Colecciones y LINQ: elegir qué trabajo hacemos

Podemos coordinar muy bien nuestras tareas asíncronas y seguir gastando tiempo en recorrer los mismos pedidos tres veces. O en buscar un cliente revisando una lista entera cuando ya conocemos su identificador. Ahí entra una decisión bastante cotidiana: dónde guardamos los datos y qué hacemos con ellos antes de devolver el resultado.

### Guardar una secuencia y buscar por clave son trabajos distintos

Un **array** tiene la longitud fijada al crearlo. Si sabemos la posición, accedemos al elemento por índice. Una **List<T>** también mantiene una secuencia, pero permite añadir elementos: cuando se queda sin capacidad, puede tener que reservar otro almacenamiento y copiar lo que ya tenía. Esa comodidad tiene un coste que depende de cómo crezca la lista.

Si lo que necesitamos es localizar un cliente por su identificador, un **Dictionary<TKey,TValue>** organiza los valores por clave mediante hashing, sin obligarnos a recorrerlos todos para cada consulta. Eso no convierte cualquier búsqueda en un coste constante garantizado: influyen las claves, el comparador, la capacidad, las colisiones y la operación concreta.

`FrozenDictionary` da otro paso cuando el contenido ya no va a cambiar. Piensa en un catálogo que preparas una vez y consultas muchas veces. Puede compensar dedicar trabajo a construir una estructura orientada a esas lecturas. Pero ese trabajo de preparación no desaparece: un benchmark que sólo cronometra las búsquedas deja fuera la construcción. Si tu aplicación crea el catálogo, lo consulta una vez y lo tira, necesitas contar ambas cosas.

Con unas pocas líneas se ve por qué no pondría estas estructuras a competir sin explicar antes para qué las quiero:

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

Sale `150`, `Ana` y `70`. En la primera suma entra el `50` que añadimos a la lista. Después buscamos una clave del diccionario. Y al final recorremos el array, descartamos los importes menores que 30 y sumamos los restantes. Cada línea pide una cosa distinta; cambiar el nombre de la colección no basta para hacerlas equivalentes.

### Una consulta LINQ todavía puede estar esperando a que la recorras

**LINQ** nos deja expresar filtros con `Where`, transformaciones con `Select`, agrupaciones, uniones y agregaciones sin escribir a mano cada bucle. Ahora bien, describir una consulta no siempre ejecuta el trabajo en ese momento.

Sobre `IEnumerable<T>`, muchas de esas operaciones tienen **ejecución diferida**. Preparan el recorrido que se hará cuando alguien consuma la secuencia. `Sum` la consume para obtener un valor; `ToArray` y `ToList` la materializan en otra colección. Si enumeras dos veces la misma consulta, puedes estar repitiendo el filtro y la transformación, no leyendo un resultado que se hubiera guardado automáticamente.

También cuenta qué hay debajo de ese `IEnumerable<T>`. La biblioteca puede tomar caminos especializados para arrays, listas, iteradores o determinados tipos, y cambiar las oportunidades de integrar código. Eso ayuda a entender por qué dos expresiones parecidas pueden comportarse de forma diferente. Para atribuir un porcentaje a uno de esos mecanismos habría que aislarlo; aquí no reconstruí cada biblioteca cambiando una sola pieza.

### Qué pasa al recorrer, materializar y unir nuestros datos

La [suite de colecciones](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/Benchmarks/CollectionsBenchmarks.cs) prepara valores `i % 1024` y claves de consulta conocidas. El filtro se queda con los pares y la transformación multiplica por tres; después se comprueban sumas y cardinalidades para que el resultado tenga que ser correcto. En Join hay 10.000 elementos a la izquierda y 1024 claves únicas a la derecha.

| Operación, entrada principal | .NET 10, µs | .NET 11, µs | Cambio de tiempo | B/op 10 → 11 |
|---|---:|---:|---:|---:|
| Recorrido ArrayFor, 10.000 elementos | 4,647 | 4,767 | +2,57% | 0 → 0 |
| FrozenDictionary, consultas preparadas | 10,036 | 10,980 | +9,41% | 0 → 0 |
| Materialize, filtro y transformación a array | 9,809 | 8,363 | −14,74% | 20.129 → 20.129 |
| Join, claves descritas arriba | 141,235 | 130,359 | −7,70% | 123.208 → 119.616 |

Las cifras salen de los [originales principales de BDN](https://github.com/jyeste94/.NET11vs.NET11/tree/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/raw/micro-full-20261112/micro/results/) y sus [pares procesados](https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/processed/micro-comparisons.json). Para las cuatro filas se utilizaron, respectivamente, 15/15, 15/15, 15/12 y 14/12 observaciones de .NET 10/11. Es una campaña exploratoria en el host compartido.

La materialización tarda menos en 11, aunque asigna los mismos bytes. Las consultas a FrozenDictionary tardan más. No hay contradicción: filtrar y construir un array no hace el mismo trabajo que consultar claves en una estructura ya preparada. Por eso no convertiría la tercera fila en «LINQ ha mejorado un 15%».

El [barrido de tamaños, con sus originales](https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/processed/sizes/micro-comparisons.json), permite mirar algo más que esa entrada de 10.000. ArrayFor mostró −1,30%, +0,44% y +0,48% con 100, 10.000 y un millón de elementos, siempre sin asignaciones. Es otra campaña, de ahí que su punto de 10.000 no coincida con la tabla. Lo que no aparece es una ventaja grande y consistente de versión para ese recorrido tan sencillo.

### FullJoin: cuando también necesitas los que no coinciden

Supón que reconcilias dos inventarios. Quieres saber qué productos coinciden, cuáles sólo están en el inventario local y cuáles sólo en el remoto. Una unión interna conserva las parejas que coinciden y deja fuera el resto. Una **unión externa completa**, o full outer join, conserva también los elementos de ambos lados que se han quedado sin pareja.

.NET 11 incorpora `Enumerable.FullJoin`, que devuelve parejas. Para comprobar su comportamiento no basta con darle dos listas donde cada clave aparece una vez y todo encaja. El control incluye duplicados, diferencias de mayúsculas, ausencias y claves nulas. Este programa usa sus datos principales y muestra dos resultados fáciles de seguir:

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

Imprime `10` y `6`. Con el comparador elegido, los tres elementos de la izquierda con `a` o `A` coinciden con los dos de la derecha: **tres por dos, seis parejas**. Las dos apariciones idénticas de `L2` siguen contando. Además quedan cuatro filas sin pareja; las claves nulas de ambos lados no se emparejan entre sí.

El [probe de FullJoin](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/Net11Features/Cases/FullJoin.cs) compara un multiconjunto ordenado con una implementación de referencia. Usar un `Distinct` para comprobarlo habría borrado justo los duplicados que queremos conservar. El [probe de tuple Join](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/Net11Features/Cases/TupleJoin.cs) comprueba otro contrato de unión.

Estas pruebas responden a «¿qué devuelve la API?». No tienen tiempos ni asignaciones medidos, así que no permiten decir que FullJoin gane a cualquier implementación anterior. Y son operadores sobre secuencias en memoria: que funcionen aquí tampoco garantiza una traducción equivalente en cualquier proveedor de EF.

Recorrer menos veces y materializar sólo cuando hace falta son decisiones que podemos tomar antes de cambiar de runtime. Con el texto ocurre algo muy parecido: a veces necesitamos otro resultado; otras, nos basta con leer una parte del que ya tenemos.

<a id="strings-span"></a>
## 10. Strings, Span y buffers: copiar también cuesta

Llega una línea con un identificador, un nombre y un separador. Parece poca cosa: cortas el identificador, lo conviertes a número y sigues. Repite esa operación millones de veces y ya merece la pena mirar cuántas cadenas intermedias estás creando. Lo mismo sucede al montar respuestas, buscar texto o cambiar de codificación.

### Qué estamos construyendo cuando construimos un string

Un `string` es **inmutable**: si una operación produce otro texto, no modifica por dentro el objeto anterior. Compartirlo resulta más sencillo por eso, pero encadenar operaciones puede ir dejando resultados intermedios que también hay que almacenar.

Su representación habitual utiliza unidades UTF-16. Aquí hay una distinción que conviene tener presente: `Length` cuenta esas unidades, no necesariamente lo que una persona percibe como caracteres. Algunos símbolos necesitan más de una unidad, y un grafema puede combinar varias. Buscar posiciones y recortar texto requiere saber qué unidad estamos manejando.

Para construir progresivamente un resultado tenemos `StringBuilder`. Una interpolación moderna puede apoyarse en handlers y caminos especializados, y `string.Create` permite expresar otras formas de construcción. Ninguna de esas opciones hace que el algoritmo o la longitud final dejen de importar. Tampoco usaría StringBuilder por obligación para unir unas pocas partes conocidas: el compilador y las bibliotecas ya pueden resolver bien ese caso.

En el proyecto hay cuatro variantes de construcción, y todas producen esta salida exacta:

```text
id=12345;name=alpha;active=True
```

Ojo con el parámetro `Count` de esa clase. **Las cuatro variantes construyen ese texto fijo; no concatenan 10.000 fragmentos porque Count valga 10.000.** La entrada repetida preparada con Count sí se usa en parsing, búsqueda, comparación, copia y codificación. Mezclar los dos grupos llevaría a explicar una escalabilidad que esas cuatro construcciones no están midiendo.

### Leer una parte sin fabricar una subcadena

`Span<T>` y `ReadOnlySpan<T>` son vistas sobre una región de elementos. En vez de pedir otro objeto con una copia del contenido, podemos describir qué zona queremos mirar. Esa zona puede pertenecer a un array o a un string, por ejemplo.

`ReadOnlySpan` no permite escribir a través de esa vista. Eso no vuelve inmutable al dueño de la memoria si ese dueño sí admite cambios. Y que estos tipos sean `ref struct` no significa que los datos estén necesariamente en el stack: sus restricciones de uso sirven para que la vista no sobreviva a la memoria de la que depende, no para cambiar dónde vive cualquier almacenamiento al que apunte.

Para convertir los cinco primeros elementos del texto a un número podemos pasar directamente la vista al parser:

```csharp
// Ejemplo autónomo: span-parse (C# 14, net10.0)
using System;
using System.Globalization;

string texto = "12345,alpha;";
ReadOnlySpan<char> numero = texto.AsSpan(0, 5);
int valor = int.Parse(numero, CultureInfo.InvariantCulture);
Console.WriteLine(valor);
```

El resultado es `12345`. `AsSpan(0, 5)` describe ese tramo sin crear una subcadena para el número. El ejemplo reduce a unas líneas la parte numérica del [TextWorkload real](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/Benchmarks/TextAndJsonBenchmarks.cs).

La suite también prueba `Utf8Parser` con bytes ya preparados. Si los datos llegan como UTF-8, tiene sentido preguntar si podemos analizarlos sin convertir antes todo a UTF-16. Pero hay que mantener esa condición al leer el resultado: codificar un string dentro de cada operación para después usar Utf8Parser añadiría un trabajo que ese caso no incluye.

Los demás casos comprueban la codificación UTF-8, una búsqueda positiva, la comparación ordinal sin distinguir mayúsculas y la copia, verificando tanto el contenido como la longitud. Las entradas son principalmente ASCII. Sirven para esas operaciones y esos datos, no para cubrir todos los idiomas, la normalización Unicode o las comparaciones culturales.

### Adaptar memoria a un Stream sin copiar antes el payload

Span, los parsers que aceptan vistas y los handlers de interpolación ya existían antes de .NET 11. La comparación principal los utiliza en ambos runtimes. Si tu programa está haciendo una copia que no necesita, quitarla puede ser útil en cualquiera de las dos versiones.

Donde sí hay una incorporación específica es en la adaptación de memoria a APIs que reciben un `Stream`. Una solución sencilla era llamar a `ToArray` y envolver la copia en un `MemoryStream`. .NET 11 ofrece `ReadOnlyMemoryStream` para trabajar sobre memoria existente. La diferencia se ve mejor tocando deliberadamente al propietario antes de leer:

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

Sale `1` y después `99`. El primer stream conserva los bytes que copiamos; el segundo ve el almacenamiento original, que hemos modificado. Evitar aquella copia también nos obliga a cuidar la vida y la mutación de ese almacenamiento. Si otro código lo está consumiendo de forma concurrente, debemos mantenerlo válido y no cambiarlo mientras lo usa.

El [probe de streams sobre memoria](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/Net11Features/Cases/MemoryStreams.cs) comprueba lecturas, posiciones y límites. Cuando los datos están repartidos en bloques entra otra pieza: [ReadOnlySequenceStream](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/Net11Features/Cases/SequenceStreams.cs), del namespace `System.Buffers`. Su control añade segmentos y longitudes de borde. Una secuencia permite representar esos bloques sin juntarlos obligatoriamente en un único array contiguo.

Hasta ahí llega lo comprobado: estos probes no llevan cronómetro. Evitar la copia del payload al construir el adaptador tampoco significa «cero allocations», porque puede seguir existiendo el objeto stream. Ni significa que una lectura posterior no copie bytes hacia su destino.

A mí me interesa seguir el dato de principio a fin: si llega como bytes, lo convertimos a string, recortamos varias partes y acabamos codificándolo otra vez, hay varias decisiones que revisar antes de discutir unas décimas en el mismo bucle. Cuando ese dato acaba en un mensaje JSON, además de mover memoria tendremos que decidir qué representación enviamos y cómo la construimos.

<a id="json"></a>
## 11. JSON: traducir objetos tiene un precio

Tu aplicación tiene un pedido en memoria, pero el cliente que espera la respuesta no recibe un objeto .NET. Necesita un formato que pueda entender. **JSON** cumple ese papel con propiedades, listas, números y otros valores representados como texto estructurado.

**Serializar** es producir esa representación; **deserializar** es leerla y construir el resultado. En medio hay que recorrer propiedades, formatear valores, escapar texto y conseguir almacenamiento. Un objeto que parece pequeño en C# puede multiplicar ese trabajo cuando devolvemos miles de registros.

Para decidir qué sale de la aplicación usamos un **DTO**, un objeto de transferencia de datos. Puede contener sólo el identificador y el cliente de un pedido, por ejemplo. No tiene por qué arrastrar todas las entidades y relaciones que manejamos dentro de la base de datos. Elegir ese contenido ya condiciona cuánto habrá que serializar.

### Cómo sabe el serializador qué propiedades tiene un pedido

El serializador necesita un contrato: las propiedades disponibles y la forma de leerlas o escribirlas. Con **reflection**, obtiene información de los tipos durante la ejecución y puede guardar metadata preparada para reutilizarla.

La **source generation** adelanta parte de esa preparación a la construcción del proyecto, generando información o código. Puede reducir trabajo dinámico y dejar explícitos los tipos necesarios para trimming o AOT. Los bytes de la respuesta siguen teniendo que escribirse, y los valores recibidos siguen teniendo que interpretarse.

Estas dos llamadas serializan el mismo pedido, una por cada camino:

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

Ambas imprimen `{"Id":7,"Cliente":"Ana"}`. El atributo indica qué contrato debe generar el compilador. El [benchmark de JSON](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/Benchmarks/TextAndJsonBenchmarks.cs) utiliza algo más completo: un contenedor de pedidos con cliente, dirección y dos líneas por pedido.

Source generation ya estaba disponible en .NET 10. Si aprovechamos una migración para pasar de reflection a generación, estupendo, pero habremos cambiado dos factores. Para saber qué aporta la versión hay que comparar el mismo camino en ambos lados.

### La diferencia depende de por dónde pasa el mensaje

| Escenario, 100 pedidos | .NET 10, µs | .NET 11, µs | Cambio de tiempo | B/op 10 → 11 |
|---|---:|---:|---:|---:|
| SerializeReflection | 80,061 | 60,864 | −23,98% | 19.341 → 19.339 |
| SerializeSourceGen | 33,263 | 33,184 | −0,24% | 19.022 → 19.022 |
| DeserializeSourceGen | 193,458 | 173,821 | −10,15% | 96.368 → 96.368 |

En los [originales de BDN](https://github.com/jyeste94/.NET11vs.NET11/tree/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/raw/micro-full-20261112/micro/results/) y las [comparaciones procesadas](https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/processed/micro-comparisons.json) están las muestras: se utilizaron 14/13, 14/14 y 14/14 observaciones de 10/11 para esas filas. Los dos casos de serialización reciben la misma estructura y dejan fuera la preparación del workload.

Aquí reflection baja de tiempo de forma apreciable, mientras que la serialización con generación queda prácticamente igual. No he aislado un único cambio interno que explique el 23,98%. Además, los calentamientos ya han preparado metadata: ese porcentaje no cuenta qué le sucede a la primera petición que usa por primera vez un tipo.

¿Y si cambiamos el número de pedidos? En el [barrido adicional de SerializeSourceGen](https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/processed/sizes/micro-comparisons.json), con 10, 1000 y 10.000 pedidos aparecieron −8,14%, −0,70% y −9,12%. Cambia el tamaño y también es otra campaña. La fila de 100 pedidos ayuda a entender ese caso; no nos da un porcentaje válido para cualquier respuesta JSON.

Hay también escenarios de stream, pero trabajan con `MemoryStream`. Uno devuelve `ToArray`, por ejemplo, y ese trabajo forma parte de lo medido por su código. No estamos poniendo al otro extremo una conexión de red ni un cliente lento para comprobar memoria constante bajo esa presión.

### JSON Lines: entregar registros sin envolverlos en un array

Para enviar registros de forma incremental puede interesar **JSON Lines**, o JSONL: cada línea contiene un valor JSON. Así no hace falta representar toda la secuencia como un único array JSON. Un salto de línea dentro de un string se escapa; no debe convertirse en una separación accidental entre registros.

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

Se escriben `1` y `2` en líneas separadas, cada una terminada en LF. No sale `[1,2]`. El [control de JSONL](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/Net11Features/Cases/JsonLines.cs) lo comprueba también con duplicados, Unicode, un salto dentro de un string y una secuencia vacía. Incluso solicitando indentación y CRLF en las opciones, verifica que este modo sigue siendo compacto y utiliza LF.

En la consola del ejemplo guardamos todo en memoria para poder mostrarlo. Por tanto, ese programa no demuestra streaming de extremo a extremo. La API permite ir emitiendo valores; que el destinatario los reciba y procese progresivamente dependerá también de sus buffers, del transporte y del consumidor.

### Cuando el valor puede tener más de un tipo

Una **union** representa un valor elegido entre varios tipos permitidos; volveremos a ella al hablar de C# 15. Al serializarla necesitamos reconocer qué alternativa contiene. El [probe de JSON y unions](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/Net11Features/Cases/JsonUnion.cs) comprueba una `Reading(int, string)` y otra union formada por `Dog` y `Cat`.

Para objetos, `JsonUnionTypeStructuralClassifier` usa la estructura de propiedades para clasificar el valor. Eso plantea una pregunta práctica: ¿qué ocurre si las propiedades no permiten distinguir un candidato, o si no hay ninguno válido? El control exige `JsonException`. Elegir un tipo a ojo sólo para conseguir un roundtrip ocultaría un problema del mensaje.

También se comprueba `null` como valor por defecto sin caso activo. Si nuestra aplicación recibe ese estado, tiene que saber tratarlo; la sintaxis de la union no resuelve por nosotros qué significa en el servicio.

Los probes cubren serialización y errores esperados. No incluyen una comparación de throughput, ni comprueban todos los escenarios de source generation, trimming, AOT o unions de F#. Aquí lo útil de la novedad está en el contrato que permite expresar y comprobar, sin necesidad de asignarle una mejora de velocidad que no hemos medido.

Al producir mensajes uno detrás de otro podemos acabar generándolos más deprisa de lo que otro componente los procesa. En ese punto el coste ya no está sólo en construir cada resultado: también está en cuánto trabajo dejamos esperando y cómo lo repartimos.

<a id="concurrencia"></a>
## 12. Concurrencia, ThreadPool y Channels

Recibir varios trabajos a la vez no nos da más núcleos. Una aplicación puede mantener muchas operaciones pendientes y avanzar con ellas de forma solapada: eso es **concurrencia**. Si además ejecuta trabajo simultáneamente, hablamos de **paralelismo**. Separar las dos cosas evita esperar que cualquier `Task` convierta una operación en algo más rápido.

El **ThreadPool** mantiene y coordina hilos reutilizables para ejecutar trabajo. Crear una tarea por elemento no añade capacidad ilimitada de CPU: también introduce colas, continuaciones y sincronización. Repartir un cálculo pesado puede compensar. Repartir una suma minúscula puede costar más que hacerla seguida. El número de workers, por sí solo, dice poco sin conocer cuánto trabajo recibe cada uno.

### Qué ocurre cuando el productor corre más que el consumidor

Un **Channel** conecta a quien produce elementos con quien los consume. Podemos recibir mensajes por un lado y procesarlos por otro, o generar trabajos y dejar que varios consumidores los recojan. Separar esos ritmos resulta útil, pero hace falta decidir cuánto contenido puede quedarse esperando en memoria.

Un canal acotado impone una capacidad máxima. Con `BoundedChannelFullMode.Wait`, el productor espera cuando no cabe más. Esa **backpressure** lleva el límite hacia el origen: si el consumidor no da abasto, el productor no puede seguir llenando indefinidamente esa cola.

Esperar es una decisión, no la única posible. Rechazar, descartar o persistir tienen consecuencias distintas. Una cola que pierde mensajes puede aparentar más rendimiento que otra que los conserva, pero ya no está prestando el mismo servicio.

Este programa mantiene el cuerpo del escenario medido y quita sólo los atributos de BDN:

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

Devuelve **499500**, la suma de 0 a 999. Primero arrancan los consumidores, luego se escriben los elementos, se completa el writer y se espera a todos. La suma vuelve al harness; no estamos descartando el resultado de los consumidores.

Fíjate en dónde empieza y termina el método de la [suite de concurrencia](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/Benchmarks/AsyncAndConcurrencyBenchmarks.cs): cada operación crea el canal y las tareas, escribe, consume, cierra y espera. **No reutiliza una cola de larga vida para cronometrar sólo cada `Read` o `Write`.** La creación y la coordinación forman parte del trabajo que estamos comparando.

### El resultado de Channel que hubo que mirar con más cuidado

El caso de dos consumidores ya tardaba más en .NET 11 en la campaña inicial. En las dos repeticiones históricas quedaron estas diferencias:

- A: 139,581 → 216,635 µs, **+55,20%**.
- B: 140,103 → 277,598 µs, **+98,14%**.

Los dos porcentajes salen de sus originales. Pero entre «el cálculo es correcto» y «migrar cuesta un 98%» hay una distancia importante. Para ver si aquella magnitud reaparecía, la auditoría añadió controles únicamente de este caso, cambiando el orden de las versiones y registrando telemetría del host.

El orden histórico había sido 11A → 10A → 10B → 11B. Los controles siguieron 10C → 11C → 11D → 10D y dieron:

- C: 138,429 → 214,161 µs, **+54,71%**.
- D: 139,659 → 216,192 µs, **+54,80%**.

[![Channel de dos consumidores: repeticiones históricas A y B frente a controles posteriores C y D](/blog/dotnet-10-vs-dotnet-11/07-channel-history-and-control.png)](/blog/dotnet-10-vs-dotnet-11/07-channel-history-and-control.png)

*Figura 7. Medias y Error BDN por ejecución, sin mezclar A/B con C/D. Todos procesan 1000 enteros en canal acotado a 256; el host no es exclusivo. Los controles sostienen el signo adverso local, no un recargo universal del 55% o 98%. Fuente: [orden y originales históricos](https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/raw/anomalies/anomalies-20261112/manifest.json) y [manifiesto del control](https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/raw/audit-channel/audit-channel-20261112-v2/manifest.json).*

[Abrir PNG a tamaño completo](/blog/dotnet-10-vs-dotnet-11/07-channel-history-and-control.png).

BDN utilizó en C 12 observaciones de .NET 10 y 15 de .NET 11, con Error de 0,517 y 1,153 µs. En D fueron 14 y 15 observaciones, con Error de 1,346 y 1,320. Dentro de esos procesos la separación es clara. Los intervalos, sin embargo, no mantienen iguales la frecuencia o la temperatura cuando pasamos de un proceso al otro.

La telemetría tampoco permite declarar al equipo libre de interferencias. Incluye CPU de los procesos hijos activos durante piloto, calentamientos y diagnóstico, además de memoria libre; no mide exclusivamente la carga de fondo. Y no demuestra que no hubiera paginación o competencia en algún núcleo.

Con esos datos, lo que sí diría es que **este escenario vuelve a ser más lento en .NET 11 en este equipo y protocolo, mientras que el +98,14% histórico no reaparece como magnitud estable en los controles**. No hay una causa exclusiva identificada en un cambio del runtime. La [auditoría](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/docs/final-audit.md) y la [trazabilidad del caso](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/docs/traceability.md) conservan el orden, los originales y lo que queda sin aislar. Esa precisión permite intentar reproducir el problema sin convertirlo en una afirmación sobre cualquier uso de Channels.

### Añadir consumidores también añade coordinación

[![Barrido independiente de Channel con uno, dos, cuatro y ocho consumidores y 1000 elementos](/blog/dotnet-10-vs-dotnet-11/08-channel-workers.png)](/blog/dotnet-10-vs-dotnet-11/08-channel-workers.png)

*Figura 8. Campaña de tamaños/workers separada del control A–D. Los valores son tiempo del lote completo; no latencia de cada mensaje. Ocho workers son consumidores lógicos, no ocho núcleos físicos dedicados. Fuente: [resultados por parámetros](https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/processed/sizes/micro-records.json).*

[Abrir PNG a tamaño completo](/blog/dotnet-10-vs-dotnet-11/08-channel-workers.png).

El barrido con 1000 elementos permite ver cuánto pesa repartir un trabajo tan pequeño. Con un consumidor, .NET 10/11 tardaron 123,771/171,276 µs; con ocho, 662,164/813,539 µs. Ocho consumidores lógicos no hacen ocho veces más barata la suma: al aumentar el reparto crecen los costes de coordinación.

Los casos de dos y cuatro consumidores también tardaron más en 11 en esa campaña. Sus porcentajes pertenecen a otra ejecución, por lo que no sustituyen los controles C/D. Y hay una combinación que merece atención: con ocho consumidores, las asignaciones bajan de 43.511 a 30.798 B/op en 11, pero el tiempo sube. Reducir bytes asignados no garantiza reducir esperas ni sincronización.

Tampoco se mueve toda la suite en la misma dirección. TaskRun pasó de 1,911 a 1,535 µs; ParallelForEach, de 555,748 a 574,990; Semaphore, de 496,786 a 362,494. Cada camino coordina un trabajo ligero con un contrato distinto. No elegiría la primitiva de una aplicación ordenando esos tiempos de menor a mayor sin mirar antes qué hace cada una.

En un servicio miraría primero cuánto calcula y cuánto espera cada elemento. Si la cola crece, interesa saber dónde se acumula y qué límite está protegiendo la memoria, antes de subir capacidad o consumidores. De hecho, el endpoint Channel de la API de este proyecto usa un servicio de fondo reutilizado, un consumidor y capacidad 1024. Esa vida útil y esa topología son distintas de crear canal y tareas por cada lote del microbenchmark. Compartir el nombre Channel no los convierte en la misma operación.

Una diferencia local así merece cautela al migrar y un caso bien descrito para investigarla. También deja una lección bastante aprovechable para el resto del código: preparar y destruir recursos en cada llamada no cuesta lo mismo que reutilizarlos. Lo veremos tanto en una llamada dinámica como al escribir un archivo o registrar una traza.

<a id="otras-superficies"></a>
## 13. Reflection, I/O, criptografía y observabilidad

Un servicio no vive sólo de recorrer colecciones y serializar respuestas. También descubre tipos, lee archivos, calcula huellas y registra lo que está haciendo. Algunas de esas tareas se repiten en cada petición; otras preparan algo que se reutilizará después. He separado esas fronteras porque juntar todo bajo «rendimiento de .NET» escondería trabajos bastante diferentes.

### Reflection: resolver una llamada y repetirla no cuestan lo mismo

**Reflection** permite inspeccionar tipos, métodos y propiedades a partir de su metadata durante la ejecución. Es una herramienta útil para frameworks y código que no conoce todos los tipos al compilar. Esa flexibilidad puede exigir más preparación que una llamada directa.

Un **delegate**, en cambio, representa una llamada con una firma conocida. Si podemos prepararlo una vez y conservarlo, evitamos parte de la resolución repetida. En este ejemplo las dos vías terminan sumando exactamente los mismos números:

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

Imprime `45` dos veces. Antes de llamar ya hemos localizado el método, preparado los argumentos y creado el delegate. Si metemos `GetMethod` o la creación del delegate dentro de cada operación, estaremos midiendo otra cosa.

La [suite de reflection](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/Benchmarks/MemoryJitReflectionBenchmarks.cs) deja esa preparación fuera de la ventana correspondiente. Invoke registró 19,02 → 17,13 ns y 24 B/op; Delegate, 3,39 → 3,06 ns y 0 B/op. Son llamadas ya preparadas, no el tiempo de construir un sistema de plugins ni de compilar una expresión.

Si repetimos una llamada cuyo destino conocemos, conservar la representación preparada puede pesar más que la diferencia entre versiones. Pero si el destino cambia de verdad, quitar esa flexibilidad para ganar la comparación ya sería cambiar el problema de la aplicación.

### Al leer un archivo también estamos hablando con el sistema operativo

**I/O**, entrada/salida, incluye las lecturas y escrituras de archivos. `FileStream` y las APIs asíncronas gestionan buffers, llamadas al sistema y finalización; el runtime no trabaja solo.

La [suite de I/O y criptografía](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/Benchmarks/IoAndCryptoBenchmarks.cs) usa archivos reales y lectura secuencial con buffer de 64 KiB. Comprueba longitud, contenido y checksum. En las escrituras entran la creación del stream y su finalización según el contrato de cada método, no únicamente copiar a una instancia que ya estaba abierta.

Después de los calentamientos, el sistema operativo puede servir las lecturas desde su caché. Aunque el archivo sea real, eso no obliga a que cada lectura vaya al disco físico frío. Tampoco una llamada a `FlushAsync` certifica por sí sola que los bytes hayan llegado de forma durable al medio y sobrevivan a un corte eléctrico.

Por eso usaría el resultado para comparar ese recorrido de software bajo la condición de caché declarada. No para predecir lo que tardará una base de datos remota, un volumen de red o el mismo archivo en otro disco. Son piezas del recorrido de los datos que aquí no estamos sustituyendo ni aislando.

### Criptografía: hacer menos no siempre permite comparar mejor

Un **hash** convierte una entrada en una huella de tamaño fijo. No es un cifrado que podamos deshacer para recuperar el original. SHA-256 se utiliza para identificar contenido en muchos protocolos; eso no lo convierte en un algoritmo apropiado para almacenar contraseñas.

Podemos comprobar un resultado conocido con una entrada de tres letras:

```csharp
// Ejemplo autónomo: sha256 (C# 14, net10.0)
using System;
using System.Security.Cryptography;
using System.Text;

byte[] huella = SHA256.HashData(Encoding.UTF8.GetBytes("abc"));
Console.WriteLine(Convert.ToHexString(huella));
```

Sale `BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD`. Es el vector conocido que también se usa como control en el laboratorio.

La selección incluye SHA-256, AES-256-CBC con padding PKCS7, comparación fija y generación de Guid. En AES se crea, configura y dispone el proveedor en cada operación. El tiempo no corresponde sólo a cifrar con una instancia previamente preparada. La clave y el IV fijos facilitan una fixture reproducible; **no son instrucciones seguras para cifrar mensajes de producción**.

La nueva sobrecarga `CryptographicOperations.FixedTimeEquals(ReadOnlySpan<byte>, byte)` se contrasta con la misma comparación contra un span de bytes repetidos. El [probe criptográfico](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/Net11Features/Cases/Crypto.cs) coloca el desacuerdo al principio, en el centro y al final, e incluye longitudes vacías y de borde. Así comprueba igualdad y errores lógicos. No pretende demostrar resistencia a canales laterales por haber puesto un Stopwatch alrededor de las llamadas.

En estas comparaciones hay un límite que no negociaría: conservar las garantías. Si quitamos autenticación o validación para acelerar una ruta criptográfica o de certificados, ya no estamos comparando el mismo contrato. La misma precaución se aplica al cambiar el tratamiento de archivos comprimidos.

### Zstandard: comprobar el resultado antes de hablar de velocidad

Comprimir permite representar los datos de forma reversible usando menos espacio, a cambio de CPU, memoria y complejidad. El intercambio varía según el formato y la entrada: dos algoritmos no tienen por qué producir el mismo tamaño ni ofrecer las mismas opciones.

El [probe de Zstandard](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/Net11Features/Cases/Zstandard.cs) utiliza los nuevos streams de .NET 11 junto con controles GZip y Brotli. Les da texto español, JSON completo y datos pseudoaleatorios deterministas, y comprueba que al descomprimir recuperamos los bytes originales.

Se guardan tamaños, ratios y hashes del roundtrip para esas entradas. No hay mediciones de velocidad ni allocations. Tampoco los nombres de los niveles significan que un nivel numérico de un algoritmo equivalga al de otro. Podemos hablar de los tamaños obtenidos; de ahí no sale un ganador general de compresión ni una mejora aislada del runtime al enfrentar codecs diferentes.

### Registrar lo que hace el programa también hace trabajo

Los **logs** guardan eventos, las **métricas** agregan medidas y las **trazas** relacionan operaciones para seguir su recorrido. Dentro de una traza, un span representa una operación. No tiene la función del `Span<T>` de memoria, aunque coincidan en la palabra.

Con `ActivitySource` podemos emitir esas operaciones para un consumidor que escuche. Este ejemplo instala un listener local para que la actividad tenga realmente a quién llegar:

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

Al terminar la actividad imprime `42`. El programa demuestra el mecanismo de la BCL; no instala el SDK de OpenTelemetry de la campaña específica.

Los [benchmarks generales de diagnóstico](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/Benchmarks/DiagnosticsBenchmarks.cs) separan logging generado, extensiones de logging, Activity y Meter, con consumidor activo e inactivo. En el logging activo se cuentan eventos. No se escribe cada línea a un archivo ni se envía por red, así que esos destinos no forman parte de su coste.

La campaña de **OpenTelemetry 1.21.0** sí utiliza el SDK, con `AlwaysOnSampler` y un procesador síncrono acotado que lee el tag esperado y cuenta spans. Hay consumo real de esos datos; no es un exporter vacío. Pero tampoco hay un pipeline OTLP completo con lotes, red, almacenamiento y reintentos.

En ese recorrido, Disabled pasó de 2,779 a 3,502 ns con 0 B/op. Enabled pasó de 212,793 a 198,688 ns, con 520 B/op en ambos runtimes. La [implementación y el protocolo](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/docs/experiments-opentelemetry.md) detallan qué se activa, y los [originales de la campaña](https://github.com/jyeste94/.NET11vs.NET11/tree/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/raw/opentelemetry/main/) conservan las medidas. Esos nanosegundos no representan toda la observabilidad de una API, ni dicen que una plataforma externa vaya a procesar más deprisa nuestras trazas.

### Grabar un perfil es otra sesión, no el tiempo limpio de la prueba

Para observar el programa se conservaron cuatro trazas EventPipe: dos de la API y dos de las aplicaciones async. Hay además dos streams de counters de la API. Se capturaron con dotnet-trace y dotnet-counters 10.0.750501 en sesiones instrumentadas, separadas de las que dieron los tiempos limpios.

Conviene detenerse en las unidades antes de interpretar esas capturas. Un perfil de tiempo muestreado puede incluir espera; no todo lo que aparece en él es CPU ocupada. Además, los valores inclusivos de una función ya contienen el tiempo de sus descendientes. Sumarlos como si fueran porcentajes independientes contaría parte del recorrido más de una vez.

Con los counters ocurre algo parecido: una pausa expresada en segundos por segundo no es un acumulado de toda la sesión. `0,010361 s/1 s` no significa que haya ocurrido una única pausa de 10,361 segundos. El [documento de capturas, comandos y alcance](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/docs/experiments-diagnostics.md) permite situar cada dato. Los perfiles ayudan a proponer dónde investigar; relacionarlos con el P99 o con un microbenchmark sigue requiriendo separar [lo observado de lo que atribuimos a una causa](#metodo-lectura).

### El SDK también se usa a diario, aunque no atienda peticiones

No todo el tiempo que nos interesa como desarrolladores está dentro del servidor. `dotnet --version` selecciona un SDK y muestra su versión; `dotnet --info` añade información del entorno. Es útil comparar esas herramientas, siempre que no hagamos pasar su arranque por el coste de una petición de nuestra aplicación.

En esta campaña se iniciaron quince procesos por combinación de SDK y comando, después de cuatro calentamientos por combinación: **60 procesos medidos**. La selección de SDK se hizo mediante `global.json`, usando en ambos casos el mismo muxer/host 11. No eran dos instalaciones completamente aisladas.

[![Tiempos de los comandos version e info con SDK 10 y 11, incluyendo dispersión observada](/blog/dotnet-10-vs-dotnet-11/14-sdk-cli.png)](/blog/dotnet-10-vs-dotnet-11/14-sdk-cli.png)

*Figura 9. Comparación propia del CLI en este host: `--version`, 158,570 → 47,878 ms; `--info`, 315,671 → 78,461 ms. Quince procesos por combinación, sin vaciar caché y con host compartido. No demuestra causalidad exclusiva de Native AOT en el host ni mejora del runtime de una API. Fuente: [campaña CLI](https://github.com/jyeste94/.NET11vs.NET11/tree/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/raw/sdk/main/) y [protocolo diagnóstico](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/docs/experiments-diagnostics.md).*

[Abrir PNG a tamaño completo](/blog/dotnet-10-vs-dotnet-11/14-sdk-cli.png).

Las diferencias de tiempo son grandes. Lo que no tenemos es una intervención que separe host, SDK, caché y servidor de construcción, ni un snapshot de entorno dedicado a esta campaña. Atribuir toda la bajada a Native AOT en el host, o a cualquier otra novedad anunciada, iría más allá de lo observado.

Me parece útil conservar ambas perspectivas: cuánto tarda una herramienta que ejecutamos durante el desarrollo y cuánto cuesta el código que atenderá al usuario. No tienen por qué mejorar juntas. Y cuando reunimos colecciones, JSON, coordinación y diagnóstico en un servidor HTTP, sus porcentajes tampoco se suman: cada petición recorre una combinación concreta de esas piezas y de sus esperas.

---

[Volver al índice](#indice)

**PARTE IV — APLICACIONES REALES**

<a id="http"></a>
## 14. ASP.NET Core: qué ocurre cuando llegan miles de peticiones

Hasta aquí hemos podido acercarnos mucho al código: una llamada, un bucle, una asignación. Ahora toca alejarse un poco. Si ese cálculo vive detrás de una API, antes de devolver el resultado hay que recibir la solicitud, encontrar la operación, ejecutarla y preparar la respuesta. Y mientras hacemos todo eso, siguen llegando peticiones.

Para situarnos: **HTTP** es el protocolo con el que cliente y servidor intercambian solicitudes y respuestas. **ASP.NET Core** pone las piezas del framework web y **Kestrel** es el servidor que usa esta aplicación. Un **endpoint** une una ruta y un método HTTP con el código que debe atenderlos. GET `/processing`, por ejemplo, acaba ejecutando un cálculo.

### Un endpoint pequeño para entender el recorrido

Podemos ver ese recorrido sin cargar de golpe toda la configuración del laboratorio. Este programa es una Minimal API autónoma y necesita un proyecto con `Microsoft.NET.Sdk.Web`. Mantiene el cálculo y la respuesta de `/processing`, pero deja fuera configuración e instrumentación: **las cifras publicadas no salen de este ejemplo**.

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

Al pedir esa ruta recibimos `count: 10000` y `checksum: 166616670000`. Fíjate en el cast: pasamos a `long` antes de multiplicar. El bucle forma parte del trabajo, pero también lo forman recibir la petición, serializar el objeto y devolver el JSON. Si aquí cambia el tiempo total, no podemos adjudicárselo sin más a la suma de cuadrados.

En el [Program.cs utilizado en las pruebas](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/WebApi/Program.cs) están HTTP/1.1, los límites, los payloads, la base de datos y el resto de rutas. El código es el mismo para los dos destinos, incluido EF Core 10.0.15.

### Nueve tipos de trabajo

No todas las peticiones le piden lo mismo al servidor. Responder texto preparado apenas se parece a consultar pedidos o esperar a que termine una operación asíncrona. Por eso la carga se reparte entre estas nueve rutas:

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

También se comprueba que funcione el POST de JSON complejo, aunque no entra en estos nueve casos de throughput. Health sirve para saber cuándo está listo el servidor y verificar runtime y configuración; contarlo como otro competidor del ranking mezclaría propósitos distintos.

Conviene tener presente qué estamos dejando fuera: no hay TLS, autenticación, proxy inverso ni compresión HTTP. Además, ambos servidores llevan desactivados los proveedores de logging. Así se ha definido esta prueba; una API de producción tiene otras necesidades y no debería perder esas capas por imitar el benchmark.

### Cuánta carga y cómo se ordenó

La carga la genera **k6 2.3.0**. Para cada caso hay cinco segundos de calentamiento y diez segundos de medida. La fase medida empieza con un proceso cliente nuevo.

Se prueban 1, 10, 50 y 100 **usuarios virtuales**, o VU. Aquí un usuario virtual no se comporta como alguien que lee una pantalla y se toma un café: mantiene una petición en curso y, en cuanto termina, lanza otra. Es un circuito cerrado, sin pausa humana entre solicitudes. Tampoco hay que traducir VU directamente a conexiones TCP distintas; esa cifra no garantiza cuántas habrá.

El conjunto que he tomado para comparar reúne **144 celdas**: nueve endpoints × cuatro concurrencias × dos runtimes × dos repeticiones. Entre todas suman **15.287.645 peticiones**, sin errores HTTP ni checks fallidos dentro de esa selección.

Llegar a ese conjunto requirió separar lo que se había completado de lo que no. La primera campaña se interrumpió y dejó 140 casos conservados; su timeout sigue siendo un timeout. De ella se aprovechan las 128 celdas no-Channel y se añade un bloque Channel equilibrado de 16. Quedan fuera doce Channel históricos, que no se han borrado. El [manifiesto de selección](https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/metadata/web-canonical-selection.json) permite ver exactamente qué entra y el motivo.

El orden también cambia: r0 ejecuta 10 → 11 y r1 ejecuta 11 → 10. Así podemos detectar si los resultados se mueven entre bloques. Eso ayuda, pero seguimos trabajando en un portátil, no en una máquina aislada de todo lo demás.

### Throughput: cuántas respuestas completamos

[![Throughput por concurrencia de text y processing, con las dos repeticiones separadas](/blog/dotnet-10-vs-dotnet-11/09-http-throughput.png)](/blog/dotnet-10-vs-dotnet-11/09-http-throughput.png)

*Figura 10. Selección editorial de text y processing: 32 de las 144 celdas canónicas. Cada curva conserva runtime y repetición; no es una media de todos los endpoints. El cliente y el servidor comparten equipo. Fuente: [resúmenes HTTP canónicos](https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/processed/web-main-summary.json) y [script de carga](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/scripts/run/web-load.js).*

[Abrir PNG a tamaño completo](/blog/dotnet-10-vs-dotnet-11/09-http-throughput.png).

Mira `/processing` con 100 VU. En r0, .NET 10 termina unas 21.620 peticiones/s y .NET 11 llega a unas 25.899. Hasta ahí sería fácil escribir un titular favorable a 11. Pero en r1 salen 15.834 y 13.024, respectivamente. **La versión que queda por delante cambia al repetir.**

Los cuatro checksums son correctos: no hay un servidor ganando porque se haya ahorrado el cálculo. Lo que cambia tanto es la ejecución del conjunto. Con esa diferencia entre bloques, quedarse con uno de ellos para anunciar capacidad sería engañoso.

El JSON complejo repite el problema. En r0 tenemos aproximadamente 5238/3439 peticiones/s para 10/11; en r1, 4214/5252. Los dos bloques están ahí, y elegir sólo el que encaja con lo que queramos contar no arreglaría la comparación.

### Latencia: cuánto espera cada petición

Además de cuántas respuestas caben en un segundo, al usuario le importa cuánto tarda la suya. Eso es la **latencia**. Puedes añadir más solicitudes y hacer crecer la cola de espera sin conseguir que el servidor complete muchas más por segundo. Mirar únicamente throughput dejaría fuera ese coste.

[![P95 HTTP de text y processing por concurrencia y repetición independiente](/blog/dotnet-10-vs-dotnet-11/10-http-latency.png)](/blog/dotnet-10-vs-dotnet-11/10-http-latency.png)

*Figura 11. P95 en milisegundos de las mismas 32 celdas seleccionadas. Cada percentil pertenece a una ejecución, no a una agregación de r0 y r1. Menor puede ser mejor si conserva corrección y carga comparable. Fuente: [resúmenes originales seleccionados](https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/processed/web-main-summary.json).*

[Abrir PNG a tamaño completo](/blog/dotnet-10-vs-dotnet-11/10-http-latency.png).

Si bajamos al P99 de processing con 100 VU, de 10 a 11 pasamos de 22,489 a 16,264 ms en r0. En r1 vamos de 33,712 a 44,497 ms. La inversión también aparece en la cola de latencia; no es algo que sólo ocurra al comparar medias.

La ruta que consulta pedidos deja otro resultado interesante. Hay que leerlo como una comparación de runtimes, porque todavía no hemos cambiado la versión de Entity Framework:

| Runtime y repetición, 100 VU | Peticiones/s | P50, ms | P95, ms | P99, ms |
|---|---:|---:|---:|---:|
| 10, r0 | 1713 | 54,191 | 76,418 | 198,723 |
| 11, r0 | 1542 | 53,436 | 120,833 | 285,075 |
| 11, r1 | 1600 | 53,387 | 114,191 | 224,531 |
| 10, r1 | 1766 | 52,778 | 73,157 | 189,423 |

Las medianas están bastante más cerca que los P95 y P99. En ambos bloques las colas salen peor en 11. Es una señal que merece mirar, con cliente, servidor y SQLite disputándose los recursos del mismo equipo. Pero **los dos servidores llevan EF10**: atribuirle esta tabla a EF11 sería culpar a un paquete que ni siquiera participa.

### El generador puede convertirse en parte del problema

Solemos mirar la CPU del servidor y olvidarnos de quién está mandando las peticiones. Aquí sería un error. Con JSON complejo, 100 VU y .NET 10 r0, el cliente registra aproximadamente el 68,78% de CPU de toda la máquina; el servidor, el 9,53%. El máximo combinado observado alcanza el 81,10%.

¿Queda margen porque no aparece un 100%? No necesariamente. Puedes agotar un núcleo sin ocupar todos los demás. Además de enviar tráfico, el cliente tiene que generar carga, parsear y validar respuestas. Todo eso cuesta recursos que, en este montaje, también necesita el servidor.

La observación de recursos se hace cada 200 ms. Por tanto, no vemos de forma continua todo lo que pasa entre muestras. Tampoco se guardó por defecto cada latencia individual: hacerlo habría añadido serialización y escrituras a disco al generador. Tenemos resúmenes y checks, pero no los tiempos de todas las peticiones. A partir de ahí no se pueden reconstruir las muestras que faltan ni calcular intervalos bootstrap como si se hubiesen conservado.

[![Captura histórica auténtica de la página HTTP generada a partir de los resultados canónicos](/blog/dotnet-10-vs-dotnet-11/16-http-evidence.png)](/blog/dotnet-10-vs-dotnet-11/16-http-evidence.png)

*Figura 12. Copia sin retoques de una captura real del navegador sobre el panel de resultados. Es el viewport histórico de 1440 × 1000, con varios endpoints y sus dos bloques; no es una captura del terminal ni una página completa. Algunos paneles continúan fuera de la imagen. Origen: [manifiesto histórico](https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/screenshots/manifest.json), panel HTTP; trazabilidad de la copia en [blog-image-manifest.json](https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/article/blog-image-manifest.json).*

[Abrir la captura HTTP a tamaño completo para leer los paneles](/blog/dotnet-10-vs-dotnet-11/16-http-evidence.png).

### Qué podemos hacer con estos millones de peticiones

No tiraría estos resultados porque no permitan proclamar un ganador. Sirven para comprobar contratos, comparar recorridos y detectar variación. También enseñan dónde conviene prestar atención: en pedidos, por ejemplo, la mediana no cuenta lo mismo que la cola. Lo que no dan es una capacidad de producción separada del generador, y mucho menos un SLA sostenido durante semanas.

Si tuviera que decidir un despliegue a partir de aquí, conservaría las comprobaciones funcionales y pondría el generador en otra máquina. Después usaría infraestructura controlada y una carga que se pareciese a la del servicio. Es lo que recomiendo comprobar al lector; **esa campaña adicional no se ha realizado para este artículo**.

Las 15.287.645 peticiones no resuelven por acumulación lo que el montaje no permite atribuir. Por eso prefiero dejar visibles las dos repeticiones antes que convertir una de ellas en un porcentaje de mejora. Y para entender qué ocurre dentro de la consulta de pedidos, necesitamos separar las piezas que HTTP mezcla en una sola respuesta.

<a id="ef-core"></a>
## 15. Entity Framework Core 10 frente a 11

En el código hablamos de clientes y pedidos como objetos. En una base relacional tenemos tablas, filas y relaciones. Un **ORM**, *Object-Relational Mapper*, nos ayuda a trabajar entre ambos mundos; aquí ese papel lo tiene Entity Framework Core, o EF Core.

Pero escribir la consulta en C# no hace desaparecer lo que hay debajo. El proveedor tiene que traducirla a operaciones que entienda el motor, la base debe ejecutarlas y las filas que vuelven tienen que convertirse en resultados utilizables por el programa. Una actualización puede afectar a distintas partes de ese recorrido.

### Qué cuesta una consulta

Piensa en lo que sucede al pedir una lista de pedidos. Hay que construir o recuperar la representación de la consulta, abrir o aprovechar una conexión, enviar SQL, esperar al motor, leer las filas y crear los valores u objetos de salida. A ese último paso lo llamamos **materialización**. El tiempo total incluye bastante más que traducir una expresión.

`DbContext` coordina esa unidad de trabajo. Cuando usamos tracking, conserva información sobre las entidades para mantener su identidad y detectar cambios. Eso no lo convierte en una caché que nos libre automáticamente de volver a consultar la base de datos.

Para muchas lecturas que no van a modificar las entidades, `AsNoTracking` encaja bien. Aun así, quitar tracking puede alterar identidad, navegaciones y comportamiento. Antes de aplicarlo por todas partes hay que comprobar qué espera el código que consume esos resultados.

Otra decisión es cuánto pedimos. Una **proyección** obtiene la forma de salida que necesitamos en vez de cargar un grafo completo de entidades. Esta es la consulta real del proyecto; el fragmento depende de `ShopContext`, `OrderDto` y las referencias de [Workload.cs](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/EfCore/Shared/Workload.cs):

```csharp
// Fragmento real de Queries; no es un programa autónomo.
public static IQueryable<OrderDto> Projection(ShopContext db) =>
    db.Orders.AsNoTracking().Where(o => o.Id <= 20)
        .OrderBy(o => o.Id)
        .Select(o => new OrderDto(
            o.Id, o.Customer.Name, o.TotalCents, o.Lines.Count));
```

Ese `IQueryable` guarda una expresión para que el proveedor la traduzca. No estamos recorriendo con un `foreach` todos los pedidos que ya hubiese en memoria. Al consumirla con `ToList` o `ToListAsync` se ejecuta la consulta y se materializa la lista.

Si en su lugar usamos `Include` y `ThenInclude`, estamos pidiendo entidades relacionadas. Pueden llegar más filas y construirse un grafo mayor. Que un DTO pequeño tarde menos que ese grafo no probaría una mejora interna de EF: antes de medir ya le hemos encargado menos trabajo.

### Separar runtime y paquete

La tabla HTTP anterior mantenía EF10. Aquí sí cambiamos el paquete, pero en otro paso. La matriz tiene tres celdas:

1. **EF10 / runtime10**: el punto de partida.
2. **EF10 / runtime11**: sube el runtime y se mantiene EF.
3. **EF11 / runtime11**: con el runtime ya fijado, suben EF y sus dependencias.

Falta la cuarta combinación por un motivo concreto: EF11 necesita net11. Intentar forzar EF11/runtime10 no nos daría un control equivalente soportado.

Además, hay una pieza nativa que se mueve con el paquete. Con EF10 observamos SQLite **3.53.3** en ambos runtimes; con EF11, **3.53.4**. Así que del segundo al tercer tratamiento cambian ORM, proveedor y transitivas. Los lockfiles y la consulta `sqlite_version()` dejan constancia de lo que se utilizó realmente. No basta con ver el número de EF y dar por supuesto todo lo demás.

### Dataset y repeticiones

Las bases se crean nuevas, con 100 y 1000 clientes. Cada cliente tiene cinco pedidos y cada pedido, tres líneas. Los índices y los valores de regiones, nombres e importes son deterministas. Preparar y sembrar esos datos se hace antes de cronometrar las operaciones.

El trabajo se divide en once casos: simple, join, groupby, include, no-tracking, compiled, projection, materialization, relations, insert-100 y update-100. En total se ejecutaron **18 procesos independientes**. Cada operación tiene cinco calentamientos y quince muestras: la matriz reúne 198 celdas y 2970 muestras medidas.

Hay un detalle que cambia bastante la comparación con un servicio habitual: cada operación crea su contexto y su conexión con `Pooling=False`. Abrirla entra en el tiempo. No estamos midiendo un pool caliente ni una conexión remota que llevase un rato trabajando.

En las escrituras de cien elementos también entra el trabajo de seguridad del escenario: se verifica el cambio, se hace rollback y se comprueba que el estado haya quedado restaurado. Por tanto, insert-100 no equivale a insertar en masa sin transacción ni comprobaciones.

### Datos que no dibujan una mejora uniforme

[![Resultados EF de consulta simple y proyección para 1000 clientes, con tres procesos independientes por tratamiento](/blog/dotnet-10-vs-dotnet-11/11-ef-core.png)](/blog/dotnet-10-vs-dotnet-11/11-ef-core.png)

*Figura 13. Media de las tres medias de proceso, en ms/op; corchetes y bigotes son mínimo–máximo de esas tres medias, **no un intervalo de confianza**. Cada proceso aporta quince muestras tras calentamiento. Fuente: [independent-runs](https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/processed/ef/independent-runs.json) y [raw por proceso](https://github.com/jyeste94/.NET11vs.NET11/tree/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/raw/ef/main/).*

[Abrir PNG a tamaño completo](/blog/dotnet-10-vs-dotnet-11/11-ef-core.png).

En la selección de 1000 clientes, la consulta simple da 2,871 ms con EF10/runtime10, 4,048 con EF10/runtime11 y 2,915 con EF11/runtime11. La proyección sigue otro camino: 3,231, 2,861 y 2,809 ms. Están en el mismo entorno, pero actualizar no empuja todas las operaciones en la misma dirección.

Con Include, las medias agregadas de proceso quedan en 17,488, 16,780 y 17,292 ms. Si añadimos sus rangos —16,608–19,064, 16,180–17,964 y 16,397–18,127— se entiende mejor cuánto se mueven. Esa variación no debería desaparecer detrás de una cifra con tres decimales.

También hay una **consulta compilada**. Conserva un delegate para ahorrar parte de la preparación repetida; no almacena todas las filas ni evita ejecutar en la base. Sus medias son 2,724, 2,897 y 2,852 ms. Y cuidado al ponerla al lado de simple: compiled recupera clientes y suma en el consumidor, mientras simple hace la agregación en SQL. No son dos formas de cronometrar exactamente el mismo trabajo.

Yo usaría estas diferencias para elegir qué consultas revisar en una aplicación. De aquí no sale que EF11 acelere todas: según el caso, pesan de manera distinta la traducción, la apertura de conexión, la materialización y el propio motor.

### Mirar SQL sin meter el log dentro del cronómetro

Una duda razonable es si las consultas están enviando algo distinto a SQLite. Se inspeccionaron nueve consultas de origen con `ToQueryString`, comparando EF10 y EF11 sobre runtime11 y dataset1000: el texto fue el mismo. También se capturaron comandos ejecutados, fuera del tramo medido.

Eso permite acotar una explicación en esas nueve consultas. No permite dar por idénticos todos los comandos finales, los planes del motor o las escrituras. Y la captura se hizo aparte para no convertir un logger costoso en parte de cada muestra.

La medida de memoria tiene una frontera parecida: recoge memoria administrada del hilo síncrono que ejecuta la operación, no toda la memoria nativa de SQLite ni la de otros hilos. Sabemos por qué construir más objetos puede añadir coste, pero no se ha descompuesto causalmente cada diferencia observada.

Si trabajas con una aplicación empresarial, empezaría por sus consultas, su esquema y su proveedor. Los once contratos y las comprobaciones de resultado están en el [catálogo EF](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/docs/experiments-apps.md). Que aquí funcione y se mida sobre SQLite local no certifica lo que vaya a pasar con SQL Server, PostgreSQL o Cosmos.

Ya hemos separado el runtime del ORM y del motor nativo. Todavía podemos mantener esas consultas y cambiar otra cosa que el usuario sí nota al lanzar el programa: cómo se ha publicado la aplicación.

<a id="native-aot"></a>
## 16. Native AOT: compilar antes de ejecutar

El JIT genera código máquina mientras se ejecuta el programa. Con **AOT**, *Ahead-Of-Time*, adelantamos la compilación a la construcción de la aplicación. Esa decisión mueve trabajo de un sitio a otro y también cambia lo que podemos distribuir.

**Native AOT** produce un ejecutable nativo autocontenido que no usa JIT. Puede venir bien para arrancar instancias, lanzar herramientas o distribuir una aplicación. A cambio, el build tiene que resolver más cosas y nos encontramos restricciones si el programa pretende descubrir tipos o generar comportamiento dinámicamente.

No te fíes de la extensión del archivo. Un `.exe` también puede ser el apphost de una aplicación framework-dependent: arranca una DLL administrada y utiliza un runtime instalado. Ver un ejecutable en la carpeta no nos dice si hemos publicado con AOT.

### Cuatro formas de publicar

| Modo | Qué lleva la distribución | Qué ocurre con la compilación |
|---|---|---|
| Framework-dependent, FDD | La aplicación; necesita un runtime compatible instalado | Conserva JIT; el tamaño publicado no suma el runtime del host. |
| Self-contained | Aplicación y runtime para un RID | Sigue pudiendo usar JIT; incorporar el runtime no significa compilar todo nativamente. |
| ReadyToRun, R2R | En este experimento, distribución autocontenida con código precompilado e IL | Adelanta parte del trabajo y conserva caminos JIT. |
| Native AOT | Ejecutable nativo autocontenido, con trimming | No usa JIT; hay que resolver requisitos dinámicos y compatibilidad al publicar. |

En estas publicaciones aparece el **RID**, el identificador que combina sistema y arquitectura; `win-x64` es uno de ellos. Compilar para Windows x64 no produce de paso un binario que podamos ejecutar en Linux o Arm64.

También aparece **trimming**: se elimina código que el análisis considera prescindible. Si tu aplicación busca un tipo por su nombre o usa reflexión dinámica, el análisis puede necesitar información adicional o encontrarse con una limitación real. Dejar de mirar el warning no recupera el código que hace falta.

Para ver dónde se pide el cambio, este comando publica la consola del laboratorio con Native AOT:

```powershell
# Procedimiento de reproducción; no se ejecuta al leer el artículo.
.dotnet/dotnet.exe publish src/NativeAot/Console/NativeConsole.csproj `
  -c Release -f net11.0 -r win-x64 -p:PublishAot=true
```

Los [proyectos de las dos aplicaciones](https://github.com/jyeste94/.NET11vs.NET11/tree/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/NativeAot/), el [catálogo de publicación](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/docs/experiments-aot-language.md) y el [runner](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/scripts/run/publish.ps1) contienen la configuración y los comandos completos. Si falta el toolchain nativo y falla AOT, hay que resolver ese fallo; publicar con JIT a escondidas dejaría de responder a la misma pregunta.

### Mismas aplicaciones, dieciséis tratamientos

La consola hace un cálculo y escribe un JSON para indicar que está lista. La API usa Minimal API con `CreateSlimBuilder`, una ruta health y un POST de cálculo. Todos los modos de la API comparten JSON generado y reflexión desactivada. Esa preparación no se reserva a .NET 11 para darle ventaja.

Al cruzar dos aplicaciones, dos runtimes y cuatro modos salen **16 publicaciones**. Cada artefacto se arranca cinco veces: **80 procesos correctos**. Al ejecutarse, la aplicación verifica su runtime y `RuntimeFeature.IsDynamicCodeSupported`, que vale false con Native AOT y true en los modos con JIT.

Aquí hay dos cantidades distintas que conviene no mezclar. Cada tratamiento se publicó una vez. Sus cinco arranques lanzan ese mismo artefacto; no son cinco publicaciones independientes con las que estimar variación de tamaño o de build.

### El tamaño que realmente creció

[![Tamaño de los ejecutables Native AOT de consola y API, separando los assets estáticos](/blog/dotnet-10-vs-dotnet-11/12-nativeaot-size.png)](/blog/dotnet-10-vs-dotnet-11/12-nativeaot-size.png)

*Figura 14. Inventario de ejecutable, una publicación por tratamiento, símbolos excluidos. Consola: 2.455.040 → 2.507.264 bytes; API: 10.780.160 → 10.946.560. La API añade por separado un JSON de 53 bytes idéntico en ambos lados. Fuente: [publicaciones originales](https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/raw/aot/main/results.json) y [control de archivos retenidos](https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/processed/critical-controls/aot-files.json).*

[Abrir PNG a tamaño completo](/blog/dotnet-10-vs-dotnet-11/12-nativeaot-size.png).

El ejecutable de consola gana **52.224 bytes** y el de la API, **166.400**. Aquí la carga del equipo durante una medida de tiempo no explica la diferencia: son bytes en archivos. El control posterior volvió a comprobar los tamaños de los ejecutables que se conservaron. No fue una recompilación para demostrar que todos los artefactos fueran deterministas.

¿De dónde salen esos bytes adicionales? Sabemos cuánto ocupan, pero **no se ha aislado su reparto interno** entre código, metadata y decisiones del compilador. Tampoco se forzó la misma ISA de ILC ni se reconstruyó el runtime antes y después del cambio de dispatch del [PR 130202](https://github.com/dotnet/runtime/pull/130202). El PR explica una novedad; por sí solo no explica este aumento.

Si contamos la carpeta de API/AOT, los totales son 10.780.213 → 10.946.613 bytes. La diferencia respecto al ejecutable es aquel JSON de 53 bytes, igual en ambos lados; no hay un PDB oculto inflando la comparación. Con FDD hay que hacer otra cuenta: su carpeta no incluye el runtime que necesita encontrar instalado en el host. Que esa carpeta sea pequeña no significa que represente todo el despliegue.

### Arrancar antes no implica que 11 mejore siempre a 10

[![Arranque Native AOT de consola y API a partir de cinco procesos por tratamiento](/blog/dotnet-10-vs-dotnet-11/13-nativeaot-startup.png)](/blog/dotnet-10-vs-dotnet-11/13-nativeaot-startup.png)

*Figura 15. Medias y rangos observados de los cinco arranques Native AOT, no IC. La caché del SO no se vació; consola y API tienen señales de disponibilidad distintas. Fuente: [muestras originales](https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/raw/aot/main/results.json).*

[Abrir PNG a tamaño completo](/blog/dotnet-10-vs-dotnet-11/13-nativeaot-startup.png).

Para saber qué aporta frente a FDD, no me quedaría sólo con la media. La mediana y los extremos ayudan a ver qué está ocurriendo en esos cinco lanzamientos:

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

En estas aplicaciones, AOT arranca antes que FDD. Pero comparar **AOT11 con AOT10** nos lleva a un resultado mucho más parecido: las medianas de consola están casi juntas y una muestra de 72,51 ms sube la media de 11. En la API AOT, la media prácticamente se mantiene.

ReadyToRun deja un ejemplo todavía más claro de por qué mirar las muestras. API/11 tiene media de 775,88 ms y mediana de 492,48; en 10 son 488,21/446,55. La primera muestra de 11 tardó 1943,78 ms. Se conserva, aunque afee la media. Como no se instrumentó su causa, tampoco se puede etiquetar ese tiempo como una fase concreta del JIT.

¿Qué cronometra exactamente un arranque? Desde que se lanza el proceso hasta que se observa readiness. En la API hay polling HTTP; en la consola se usa otro protocolo. Los procesos son nuevos, pero no se vació la caché del SO: no equivale a arrancar desde disco frío. Los [dieciséis inventarios y sus muestras](https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/processed/aot-summary.json) incluyen también los otros modos y los símbolos, para no reducir la comparación a los casos dibujados.

### Memoria, publicación y compatibilidad

La API/AOT registra un working set medio de 24.263.885 bytes en 10 y 24.879.104 en 11. API/FDD queda en 49.340.416 y 51.314.688. Hablamos de memoria residente en el punto que marca el protocolo, no de bytes asignados por operación ni de todo lo que consume el equipo.

También se midió publicar: AOT tardó 7,12/5,79 s en consola y 18,87/15,53 en API para 10/11. Cada dato sale de **una** publicación posterior a restore y build, con cachés presentes y trabajo incremental. No lo usaría para presupuestar una compilación limpia ni el tiempo completo de un pipeline de CI.

Antes de elegir AOT toca revisar reflexión, serialización, carga dinámica, genéricos, interop y dependencias. Esta Minimal API funciona con esa configuración; eso no acredita que funcionen automáticamente MVC, cualquier proveedor EF o un sistema de plugins que genere código dinámico.

Para una herramienta de consola que abrimos y cerramos a menudo, o una instancia de vida corta, reducir el arranque puede compensar de forma muy directa. Si el servicio vive mucho tiempo y espera sobre todo a la base de datos o a la red, quizá pese más adaptar sus dependencias. Ahí es donde tomaría la decisión: en cómo va a usarse y distribuirse la aplicación, no en sustituir el JIT por principio.

Y esa elección se puede mantener aparte de otra muy distinta. Podemos cambiar cómo se publica el programa sin reescribir su sintaxis; del mismo modo, podemos mejorar cómo expresamos sus contratos sin prometer que por eso vaya a correr más.

---

[Volver al índice](#indice)

**PARTE V — NUEVAS POSIBILIDADES Y DECISIONES**

<a id="csharp"></a>
## 17. C# 14 frente a C# 15

Parte de lo que hemos visto puede beneficiar al código que ya tienes sin que cambies una línea. Las novedades del lenguaje funcionan de otra manera: hay que usarlas al escribir para aprovechar lo que permiten expresar.

A mí me interesa especialmente lo que ayudan a dejar claro. Si podemos representar mejor los estados válidos o conseguir que el compilador nos avise al olvidar un caso, hay menos cosas que recordar a mano. Eso tiene valor por sí mismo. **De una sintaxis más clara no sale automáticamente una mejora de rendimiento**: estas muestras comprueban resultados y reglas de compilación, no miden porcentajes de velocidad.

Los pares que siguen son programas didácticos completos, salvo los dos archivos de biblioteca que se indican expresamente. Parten de [Before14](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/LanguageSamples/Before14/Program.cs), [After15](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/LanguageSamples/After15/Program.cs) y las muestras específicas enlazadas. He separado las características para que no haga falta entenderlas todas a la vez.

### Unions: expresar «uno de estos tipos»

Imagina una operación que puede devolver un pago aceptado o uno rechazado. O un mensaje que admite varios tipos, o una lectura numérica o textual. Queremos decir «una de estas alternativas». Con C# 14 podemos organizarlo mediante una jerarquía de clases:

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

Ese último brazo no está de adorno. Aunque aquí sólo hemos escrito tres descendientes, la declaración de `Pet` no le dice al compilador que la familia esté cerrada. Podría haber otro descendiente permitido y necesitamos cubrirlo.

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

Los dos programas imprimen `cat:Milo`, `dog:Rex` y `bird:Pip`. En el segundo, `Cat`, `Dog` y `Bird` ya no heredan de Pet. Es la declaración de la union la que establece qué alternativas acepta; con esa información, el compilador puede analizar si el patrón las cubre.

Eso se agradece cuando el modelo crece: si añadimos una alternativa, toca revisar a los consumidores que daban por cubiertos todos los casos. No nos libra de pensar cómo versionar una API pública. Hay además un estado que no conviene imaginarse resuelto: el valor por defecto de una union puede no tener caso activo. Las pruebas lo comprueban mediante su contrato JSON; no damos por hecho que `default` sea una de las mascotas.

En las muestras originales, la advertencia de switch no exhaustivo se trata como error en el caso previsto. El contrato queda expresado y el compilador avisa si nos dejamos una alternativa sin cubrir.

### `closed`: cerrar una jerarquía sin convertirla en una union

¿Y si sí queremos mantener la herencia? También podemos querer una base con descendientes controlados, sin permitir que otro ensamblado añada directamente los suyos. Es un problema distinto al de agrupar alternativas independientes.

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

La salida sigue siendo `True`. Al declarar `closed`, los descendientes directos se restringen al ensamblado que define la base; la declaración también es implícitamente abstracta. Eso no sella de forma transitiva todas las ramas que pudieran venir después. En este ejemplo los hijos llevan su propio `sealed`.

Aquí seguimos teniendo herencia. Si necesito una base común, mantendría la jerarquía. Si quiero agrupar tipos independientes como alternativas de un resultado, usaría la union: sus tipos no tienen que heredar de ella.

### Argumentos en expresiones de colección: capacidad y comparador explícitos

Abreviar una inicialización está bien mientras no esconda una decisión importante. En una lista puede ser la capacidad reservada; en un conjunto de nombres, el comparador que decide qué cuenta como duplicado.

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

No cambia la salida: `3:6:1`. Tenemos tres elementos, capacidad seis y un solo nombre, porque el comparador ignora mayúsculas y minúsculas. La expresión de colección conserva esas decisiones mediante los argumentos.

Reservar capacidad puede ahorrar crecimientos, pero eso ya lo hacía el código anterior: ambos piden la misma. La novedad es poder expresar esa capacidad y el comparador en la propia expresión de colección.

### Indexadores de extensión: nueva notación, mismo algoritmo

Los bloques de extensión no empiezan con C# 15; ya tenían antecedentes en C# 14. Lo que se examina aquí es añadir un **indexador de extensión**, para poder escribir el acceso con corchetes.

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

Imprime `30` en ambos casos. Lo importante está dentro del indexador: sigue llamando a `ElementAt`. Los corchetes no convierten un `IEnumerable` en un array ni le regalan acceso directo. Según el origen, `ElementAt` puede resolver la posición directamente o necesitar recorrer elementos hasta alcanzarla.

Si hacemos muchos accesos por índice a una secuencia que empieza a recorrer desde el principio cada vez, la comodidad de la llamada puede tapar un algoritmo caro. Quien publique una API así debería dejar clara su complejidad y su contrato, aunque el punto de uso quede más limpio.

### Break y continue con etiqueta: salir del bucle correcto

En un par de bucles anidados, un `break` normal sale del más cercano. Pero hay búsquedas en las que necesitamos abandonar ambos, o descartar lo que queda de la fila actual y pasar a la siguiente del exterior.

La muestra hace justo eso: al encontrar un negativo descarta la fila; en las filas válidas busca un `9`. Por tanto, en `[-1, 9]` no vale aceptar el `9` que viene después. Ya habíamos descartado la fila.

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

Las dos versiones devuelven `11` y `-1`. Ese `11` codifica fila 1, columna 1 según la fórmula de esta fixture; no pretende ser un índice general para matrices de cualquier anchura. `-1` señala que no se ha encontrado coincidencia.

La etiqueta ahora nombra el bucle al que afecta el salto. No hemos ganado nada por eliminar comprobaciones: se mantiene el comportamiento tanto cuando se encuentra el valor como cuando no existe. Lo que cambia es dónde queda expresado el destino del control.

### Métodos estáticos no virtuales en interfaces y targets antiguos

Aquí es fácil exagerar la novedad diciendo que «ahora las interfaces admiten estáticos». C# ya tenía métodos estáticos en interfaces. El cambio que se prueba es más concreto: se relaja una restricción para los **métodos estáticos no virtuales con cuerpo** al compilar para targets antiguos.

Con la opción anterior, podemos ofrecer la función desde una clase auxiliar. Este es un archivo de biblioteca completo, equivalente didáctico del helper:

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

El archivo [LegacyInterface15/Measurement.cs](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/LanguageSamples/LegacyInterface15/Measurement.cs) coloca esa función en la interfaz:

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

Si llamamos a `MeasurementConsumer.Convert(250)`, ambos devuelven `2.5`. La segunda biblioteca declara `netstandard2.0` y C# 15. La llamada es estática y no virtual: no estamos mostrando dispatch virtual de instancia, un miembro `static abstract` ni una implementación por defecto de instancia.

Lo comprobado es que la biblioteca compila y puede consumirse en los runtimes modernos ejercitados. Eso no equivale a haberla ejecutado en un CLR antiguo. No se ha arrancado .NET Framework para esta prueba y no voy a dar por demostrado ese alcance sólo porque el target sea antiguo.

### Memory safety: preview distinta de C# 15 estable

Cuando trabajamos con un puntero, estamos manejando una dirección. Desreferenciarlo significa acceder a esa memoria. El lugar donde escribimos la marca de código inseguro puede cambiar, pero la validez de la dirección no se resuelve con una sintaxis distinta.

Con el modelo anterior, este ejemplo pide un contexto `unsafe`:

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

La preview permite separar declarar o tomar ciertas direcciones del acceso que necesita marcarse expresamente:

```csharp
// Ejemplo autónomo: memory-despues (C# preview, net11.0)
// Configuración: AllowUnsafeBlocks=true; Features=updated-memory-safety-rules
using System;

int number = 42;
int* pointer = &number;
Console.WriteLine(unsafe(*pointer));
```

En ambos veremos `42`. Para compilar el segundo hacen falta `LangVersion=preview`, `AllowUnsafeBlocks=true` y el feature `updated-memory-safety-rules`. Elegir C# 15 estable no lo activa. Tampoco existe aquí una propiedad `MemorySafetyRules` que podamos añadir al proyecto para sustituir esa configuración.

En la [muestra completa de la preview](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/LanguageSamples/MemorySafetyPreview/Program.cs) hay además `fixed`, acceso indexado y una llamada marcada como insegura. Sirve para ver cómo se señalan esas operaciones, no para concluir que cualquier programa con punteros se vuelve seguro. Direcciones válidas, vida útil y límites siguen siendo problemas que el diseño tiene que resolver.

### Qué verificó realmente la matriz de lenguaje

El [resultado histórico main-pinned](https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/raw/language/main-pinned/results.json) guarda 22 operaciones con el resultado esperado. Tres son rechazos de compilación deliberados: para contarlos se exigieron errores del compilador, porque fallar al restaurar paquetes no demuestra que una sintaxis sea inválida.

Esas 22 operaciones no son benchmarks. Y que After15 se rechace en conjunto con C# 14 tampoco nos da seis pruebas negativas independientes, una por característica. La cobertura está registrada por operación, con lo que se ejecutó en cada una.

Me quedo con las novedades que ayudan a revisar mejor el código y expresar sus contratos. No necesitan llegar todas juntas ni mezcladas con previews. Podemos validar primero el runtime y luego elegir dónde aporta algo una union, una jerarquía cerrada o una expresión de colección. Esa separación también es una buena forma de plantear la migración de una aplicación completa.

<a id="migracion"></a>
## 18. Migrar una aplicación sin cambiarlo todo a la vez

Cambiar el TFM parece fácil hasta que en la misma rama entran también otro SDK, C# nuevo, EF11, una imagen distinta y Native AOT. Si después deja de funcionar una consulta o empeora el arranque, ¿cuál de todos esos cambios miramos primero?

Yo prefiero poder responder a esa pregunta sin deshacer la migración a ciegas. Ordenar los cambios y conservar una vuelta atrás ayuda a entender qué ha ocurrido. No significa mantener dos versiones del código para siempre; significa no perder el punto de comparación antes de saber si el siguiente paso funciona.

### Paso 1: inventario y referencia funcional

Empezaría por apuntar qué se está ejecutando hoy: SDK, runtimes, paquetes directos y transitivos, base de datos, SO, arquitectura y forma de despliegue. Y guardaría el artefacto anterior junto con su configuración. Reconstruirlo después esperando que todo siga disponible es una forma bastante mala de preparar una recuperación.

Después pondría por escrito qué tiene que seguir haciendo igual: respuestas, datos, orden cuando importe, cancelación, autenticación, errores y recuperación. Para una aplicación que guarda dinero o procesa documentos, que el proceso arranque sólo resuelve el principio del problema.

Antes de compilar conviene mirar también dónde va a ejecutarse. .NET 11 sube el mínimo x64 a **v2**, que incluye POPCNT y SSE4.2. No exige AVX2 como mínimo universal. Hay otra distinción: los binarios R2R x64 de Windows/Linux apuntan a v3; en una máquina v2 soportada puede hacer falta más JIT durante el arranque. Arm64 y cada sistema operativo tienen sus propias matrices.

Comprobaría edición, arquitectura y actualizaciones soportadas, no sólo el nombre que recordamos del servidor. Una familia de kernel `10.0` no identifica por sí sola Windows 10. Y que se admita alguna edición LTSC de Windows 10 no extiende ese soporte a todas sus ediciones.

### Paso 2: cambiar runtime conservando lenguaje y EF

Este proyecto web completo sirve para enseñar el punto de partida. Es ilustrativo, no el csproj con el que se ejecutó el benchmark:

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

En el primer cambio del proyecto tocaríamos estos valores, dejando quietos lenguaje y EF:

```diff
- <TargetFramework>net10.0</TargetFramework>
- <RuntimeFrameworkVersion>10.0.15</RuntimeFrameworkVersion>
+ <TargetFramework>net11.0</TargetFramework>
+ <RuntimeFrameworkVersion>11.0.0</RuntimeFrameworkVersion>
```

El SDK se selecciona aparte. Este sería el `global.json` completo:

```json
{
  "sdk": {
    "version": "11.0.100",
    "rollForward": "disable",
    "allowPrerelease": false
  }
}
```

Dejar C# 14 y EF10 mantiene la [separación de factores usada en el proyecto](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/README.md#versiones-y-separación-de-factores). Eso sí, si tu TFM lleva `-windows`, `-android` u otro sufijo, hay que revisar el target completo. Copiar `net11.0` encima de cualquier TFM compuesto puede eliminar requisitos que necesitaba la aplicación.

Hay dos selecciones diferentes en estos archivos. `global.json` fija el SDK; no instala ni decide por sí solo el runtime que utilizará producción. El pin y RollForward del ejemplo buscan una referencia exacta para comparar. **La política de servicing de producción se decide aparte**: no tiene sentido quedarse sin parches por copiar una inmovilización pensada para el laboratorio.

En este proyecto hubo un fallo que muestra por qué hay que comprobar la versión efectiva. Un pin se evaluaba antes de conocer el TFM y un runtimeconfig incremental obsoleto acababa pidiendo 10.0.0. Se corrigieron el orden en `Directory.Build.targets` y la invalidación de esa generación. No se activó roll-forward para que el error dejase de verse. La ejecución posterior comprobó 10.0.15.

### Paso 3: revisar dependencias y actualizar EF por separado

Al cambiar el grafo de dependencias, primero haría el restore conscientemente y revisaría el lockfile resultante. Una vez aceptado, CI puede exigir `--locked-mode` y avisar si deriva. Los lockfiles del repositorio no cubren automáticamente todos los proyectos temporales que genere una herramienta; hay que comprobar también cómo restauran esos proyectos.

EF11 merece su propio cambio. Además del número de versión, revisaría estos puntos de las incompatibilidades oficiales:

- **SQL Server:** el nivel de compatibilidad predeterminado pasa a 160. Hay que configurar el nivel que realmente soporta el motor o actualizarlo; declarar uno ficticio no añade funciones. Si usamos autenticación Entra con el nuevo SqlClient, puede hacer falta su paquete de extensiones.
- **Cosmos:** cambia el manejo de propiedades no mapeadas y la serialización. Una escritura puede perder datos que antes se preservaban. También hay cambios de IDs y se retira el I/O síncrono; no lo dejaría para descubrirlo con datos reales.
- **Migrations:** aplicarlas cuando no se encuentra ninguna pasa a fallar. Corregiría su configuración en lugar de ocultar el fallo. Que una fixture nueva funcione con `EnsureCreated` no prueba el recorrido de migrations.
- **Diseño y herramientas:** revisaría la referencia explícita a `Microsoft.EntityFrameworkCore.Design`, las convenciones de colecciones primitivas y los cambios de herramientas que afecten al proyecto.
- **Split queries:** pueden lanzar `DbQueryConcurrencyException` si los cambios concurrentes impiden correlacionar los resultados. La respuesta exige decidir aislamiento y contrato; descartar información o añadir reintentos sin diseño no resuelve esa decisión.
- **SQLite:** toca mirar proveedor, bundles y biblioteca nativa, como ya hemos visto en las pruebas. EF11 y Microsoft.Data.Sqlite11 no comparten exactamente los mismos targets por llevar el mismo número.

Con las capacidades nuevas haría la misma lectura por proveedor. FullJoin traducido, jerarquías complejas o vectores no tienen por qué estar disponibles en todas partes ni con el mismo estado. Un caso SQLite correcto no certifica SQL Server o Cosmos, y unas funciones vectoriales experimentales no son un contrato estable general.

La [guía de migración del proyecto](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/docs/migration-guide.md) enlaza las fuentes oficiales y desarrolla esas incompatibilidades. Son cosas que comprobar en la aplicación que vaya a migrarse, no pruebas de todos esos proveedores realizadas aquí.

### Paso 4: C# 15 y previews como decisiones independientes

Con runtime y dependencias validados, ya podemos elegir `LangVersion=15.0` para usar las novedades estables. No hay que transformar todas las colecciones ni todas las jerarquías para justificar la actualización. Adoptaría cada cambio donde mejore de verdad la expresión del código.

Runtime Async preview iría en un tratamiento separado y reconocible. Ahí comprobaría tareas ya completadas y pendientes, cancelación, contexto, excepciones y herramientas. La preview de memoria necesita su propia configuración. Ninguna de las dos debería entrar como una casilla genérica de «activar más velocidad».

También quitaría del pipeline los switches antiguos `DOTNET_RuntimeAsync` y `UNSUPPORTED_RuntimeAsync`: se eliminaron. Mantenerlos escritos puede hacer creer que controlamos un comportamiento cuando ya no lo estamos seleccionando.

### Paso 5: contenedores y despliegue real

Al cambiar la imagen base podemos estar cambiando más que .NET. Una imagen oficial incorpora una distribución y bibliotecas nativas: en el catálogo revisado, el valor por defecto de 10 usa Ubuntu Noble y el de 11 usa Resolute. Saltar de una a otra también mueve libc, ICU u OpenSSL. Conviene saberlo antes de atribuir cualquier diferencia al runtime.

Para conservar una base Linux común, están documentados estos tags:

```text
mcr.microsoft.com/dotnet/aspnet:10.0.15-resolute
mcr.microsoft.com/dotnet/aspnet:11.0.0-resolute
```

Se consultaron los tags, pero **el laboratorio no descargó ni ejecutó esas imágenes**. Quien haga esa prueba debe resolver y guardar el digest real, la arquitectura y la variante utilizadas. Poner un hash inventado en un Dockerfile no haría reproducible nada.

Elegiría además la familia de imagen según su trabajo. `sdk` es para construir; `aspnet`, para hospedar una aplicación web que necesita ese framework. `runtime-deps` puede servir de base para un binario autocontenido compatible. En el build de AOT también hace falta su toolchain nativo. Y antes de usar Alpine hay que comprobar musl: no se debe tratar como si fuese glibc ni llevar un binario de una a otra sin revisar compatibilidad.

Las variantes reducidas sin shell obligan a diagnosticar de otra manera. ICU y las zonas horarias pueden hacer necesaria otra variante. En Windows containers revisaría juntos imagen y host; una fila soportada en la matriz de SO no demuestra que exista el tag ASP.NET concreto que queremos usar.

También importa cómo se sirve la aplicación fuera de Docker. Si publicamos self-contained, el runtime viaja con ella: parchear el shared runtime del servidor no reemplaza esos archivos. Hay que republicar y desplegar. Si usamos IIS, entran Hosting Bundle, permisos y arquitectura. Instalar un SDK en el agente que compila no actualiza el servidor donde acabará ejecutándose.

### Paso 6: comprobar seguridad, diagnóstico y rollback

Una entrada que antes se aceptaba puede empezar a rechazarse por cambios en validación de archivos comprimidos, TLS, certificados, antiforgery o hosting. No daría por buena una migración porque gane peticiones por segundo después de desactivar las protecciones que molestaban.

Un caso concreto es el cambio en la descarga AIA del servidor SslStream, con límites en Linux. Hay que revisar clientes y cadena de certificados, no apagar su validación. Otro son los cambios de antiforgery: afectan a los endpoints con la metadata correspondiente, no indiscriminadamente a cualquier POST que reciba JSON.

La prueba útil se hace publicando y ejecutando el artefacto final. Si lleva trimming o AOT, revisaría los warnings y ejercitaría la reflexión o el interop que vaya a utilizar. También comprobaría con las herramientas del equipo que siguen siendo útiles los símbolos, el profiler, los dumps, los breakpoints y la reanudación tras await. Poder diagnosticar el fallo forma parte de poder operar la aplicación.

En CI/CD guardaría versiones efectivas y artefactos, restauraría con los lockfiles y ejecutaría las comprobaciones de corrección. El [procedimiento de reproducción](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/docs/reproduction.md) detalla el recorrido del laboratorio. Para medir velocidad hace falta además un entorno adecuado: que el runner compartido termine en verde no certifica el rendimiento de producción, ni prueba lo que sucederá en otras plataformas.

Y antes de desplegar, miraría la vuelta atrás completa. **Rollback de código y rollback de datos no son lo mismo.** Recuperar el ejecutable anterior no devuelve una columna eliminada ni una propiedad de Cosmos que ya se ha perdido. Cuando corresponda, backup y restauración tienen que estar diseñados y ensayados, no simplemente anotados como una posibilidad.

Para mí, la actualización se puede aceptar cuando conserva el contrato y los datos, produce un artefacto soportado, permite diagnosticarlo y deja una recuperación posible. La velocidad entra en esa decisión, pero no sustituye ninguna de esas condiciones. Con ese criterio podemos volver a los resultados y distinguir cuáles ayudan a decidir y qué conclusiones hubo que retirar al revisar sus controles.

<a id="resultados"></a>
## 19. Los resultados más instructivos

Después de mirar métodos, memoria, servidores y ejecutables, sería fácil quedarse con la mejora más grande y dar por terminada la comparación. El problema es que varias de las mejoras más grandes de la primera campaña no aguantaron una repetición. Conviene verlas juntas antes de decidir qué hacer con .NET 11.

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


La fila del método virtual genérico permite seguir el cambio hasta las instrucciones: sabemos qué llamada y qué objeto han dejado de hacer falta. En HTTP hay muchos más datos, pero también dos procesos compitiendo por el mismo equipo. Contar peticiones no resuelve ese problema de atribución. Por eso daría más peso a la explicación de aquel método que a convertir el total de peticiones en una promesa sobre Kestrel.

### Las mejoras que hubo que retirar

Las primeras medidas de StringCreate, UTF-8 encode y WriteAsync eran de las que invitan a sacar una captura y compartirla. Para comprobar si se sostenían, el laboratorio repitió once casos anómalos en dos pares A/B: 44 jobs en total. Channel era uno de ellos; los otros diez quedaron así:

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


Los porcentajes negativos indican menos tiempo. Están conservados el [contraste con la campaña inicial](https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/processed/anomalies/initial-contrast.json), las [medias, Error, N y memoria de cada par](https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/processed/anomalies/comparisons.json) y el [orden de ejecución](https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/raw/anomalies/anomalies-20261112/manifest.json).

StringCreate empezó con un −70,75% y pasó a tardar más en ambos pares. UTF-8 encode y WriteAsync también cambiaron de signo. Con esos archivos delante, no puedo recomendar .NET 11 diciendo que estas operaciones mejoran un 70%, un 62% o un 76%. La conclusión hay que retirarla, aunque el dato inicial siga publicado. Tampoco hay una causa única demostrada que permita echarle la culpa al host o al código.

Otras filas son menos extremas, pero importan. NoInline cambia de signo entre A y B; el tamaño de los cuerpos nativos generales inspeccionados no cambió, así que no tenemos una instrucción nueva que explique aquella primera diferencia. CompletedTask y la descompresión conservan bastante variación. Y Lock ni siquiera estaba entre los once métodos repetidos: su resultado inicial sigue siendo exploratorio, por mucho que otra prueba de concurrencia sí tenga controles.

[![Captura auténtica del panel JIT con estadísticas originales y ensamblador de ConstantUnequal](/blog/dotnet-10-vs-dotnet-11/15-jit-evidence.png)](/blog/dotnet-10-vs-dotnet-11/15-jit-evidence.png)

*Figura 16. Captura histórica real del navegador, sin retoques: muestra estadísticas de dos kernels constantes y fragmentos propios de ConstantUnequal. No es un terminal recreado ni un benchmark nuevo. Origen: [manifiesto histórico](https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/screenshots/manifest.json), panel JIT; hashes y destino de la copia en [manifiesto editorial](https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/article/blog-image-manifest.json).*

[Abrir la captura JIT a tamaño completo para leer tabla e instrucciones](/blog/dotnet-10-vs-dotnet-11/15-jit-evidence.png).

He mantenido también los casos en los que no cambió el código máquina o una API sólo tuvo comprobación funcional. Si los quitara, la selección contaría una historia bastante más vistosa, pero ya no sería la de estas pruebas. Para algunos cambios podemos explicar un mecanismo; para otros sólo tenemos tiempos observados. No se ha identificado un commit interno responsable de cada porcentaje.

<a id="decision"></a>
## 20. ¿Merece la pena actualizar?

Yo no decidiría una migración contando cuántas filas gana cada versión. Empezaría por la aplicación: dónde pasa el tiempo, qué dependencias necesita y cuánto cuesta comprobar que sigue funcionando. A partir de ahí, estas son las decisiones que veo razonables:

| Situación | Decisión razonable a partir de esta investigación |
|---|---|
| Aplicación pequeña | Actualizar puede aportar mantenimiento y APIs, pero el usuario quizá no perciba diferencias de microsegundos. Si inicia muy a menudo, estudiar su arranque real. |
| API empresarial | Empezar por compatibilidad y datos. Pasar por EF10/runtime11 antes de EF11 ayuda a separar factores; validar SQL, autenticación y observabilidad. |
| Servicio con muchas peticiones | Medir carga representativa con generador independiente, errores y colas de latencia. No dimensionar a partir de nuestro loopback compartido. |
| Procesamiento intensivo | Identificar métodos calientes y entradas. Inspeccionar código generado cuando una optimización concreta pueda importar; no suponer SIMD más ancho por el número de versión. |
| Sistema sensible a memoria | Separar asignaciones, retención, memoria nativa y pausas. Un ahorro local puede coexistir con un proceso mayor o con otros caminos que asignan más. |
| Proyecto que prioriza estabilidad | .NET10 parcheado sigue siendo una base válida. Comprobar fechas reales y dependencias; aquí LTS no implica más años restantes que 11. |
| Proyecto para experimentar | .NET11 permite explorar APIs y C#15; mantener Runtime Async y memory safety preview como tratamientos explícitos y reversibles. |


Si una petición espera casi todo su tiempo a una consulta remota, mejorar una función auxiliar unos nanosegundos apenas moverá el resultado. Si el servicio crea millones de objetos temporales en un camino frecuente, eliminar una asignación sí puede merecer atención. Antes de reconocer tu caso en una tabla, necesitas encontrarlo en un perfil de la aplicación.

Hay también motivos para actualizar que no son una barra más corta: una corrección, una plataforma soportada, una API que evita código propio o una dependencia que ya exige el nuevo destino. Y puede tener sentido esperar si el proveedor de base de datos, la toolchain, la CPU de destino o una certificación todavía no encajan. En la [guía de migración](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/docs/migration-guide.md) quedan desarrollados esos pasos; las [limitaciones de las pruebas](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/docs/limitations.md) ayudan a no trasladar una cifra local al servicio sin comprobarla.

<a id="conclusion"></a>
## 21. Conclusión: qué hemos aprendido al medir

¿Puede ir más rápido el mismo código C# al actualizar .NET? Sí. El método virtual genérico es una buena forma de verlo: el argumento sigue entrando, el resultado sigue saliendo y, en medio, el JIT deja de necesitar una asignación y una llamada como las que generaba antes. Es una mejora que podemos explicar, no sólo cronometrar.

Lo que no sale de estas pruebas es una regla del tipo «instala .NET 11 y todo irá mejor». Channel tarda más en el patrón medido. Runtime Async cambia el coste de unas esperas y de otras. EF obliga a distinguir qué paquete y qué motor se han actualizado. Native AOT puede interesarte por el arranque aunque el ejecutable ocupe más. Son decisiones que tomamos al desarrollar, y merecen algo más útil que declarar un ganador.

De toda la comparación me quedo especialmente con las repeticiones que contradicen la primera medida. Obligan a descartar explicaciones cómodas y a volver al código, al trabajo que se está haciendo y al equipo que lo ejecuta. Ahí es donde una comparación de versiones empieza a servir para mantener una aplicación.

Si vas a migrar, empieza por comprobar que funciona. Después perfila, mide y cambia las variables por separado. Y si aparece un porcentaje espectacular, guarda también lo que pasó al repetirlo. La recomendación que haría para mi proyecto debería aguantar esa segunda tabla.

[Volver al índice](#indice)

<a id="reproduccion"></a>
## 22. Código fuente y reproducción

He dejado el [laboratorio completo en GitHub](https://github.com/jyeste94/.NET11vs.NET11/tree/5c8a5419e8330afcd954d87be5547fc1fdf725b5): código, scripts, resultados originales, entorno y documentación. Los enlaces del artículo apuntan al commit [5c8a5419e833](https://github.com/jyeste94/.NET11vs.NET11/commit/5c8a5419e8330afcd954d87be5547fc1fdf725b5), para que una actualización posterior del repositorio no cambie lo que estás consultando. El [README](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/README.md) incluye los requisitos y el clonado.

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


Los HTML enlazados se muestran como código en GitHub. Para abrirlos como paneles, utiliza el servidor local del README. Los PNG sí se pueden consultar directamente, y el índice siguiente permite ir a un archivo sin recorrer todo el repositorio.

<details id="evidencias-investigacion" class="study-evidence-catalogue">
<summary>Índice de archivos: código, resultados y entorno</summary>

<p>Si buscas un archivo concreto, aquí están los enlaces al mismo commit que utiliza el artículo.</p>
<ul class="study-evidence-paths">
<li id="evidencia-138c99b46a30" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/article/blog-assets/index.html"><code>article/blog-assets/index.html</code></a></li>
<li id="evidencia-bd3afe8b5286" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/article/blog-editorial-report.md"><code>article/blog-editorial-report.md</code></a></li>
<li id="evidencia-a724e25f2ffb" class="study-evidence-row" tabindex="-1"><a href="https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/article/blog-image-manifest.json"><code>article/blog-image-manifest.json</code></a></li>
<li id="evidencia-b82e4d8fdba1" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/article/dotnet-10-vs-dotnet-11.md"><code>article/dotnet-10-vs-dotnet-11.md</code></a></li>
<li id="evidencia-26daa4cd5a62" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/article/references.md"><code>article/references.md</code></a></li>
<li id="evidencia-47f40c3835b9" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/docs/experiments-aot-language.md"><code>docs/experiments-aot-language.md</code></a></li>
<li id="evidencia-30f35e655cc7" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/docs/experiments-apps.md"><code>docs/experiments-apps.md</code></a></li>
<li id="evidencia-5998e62b150f" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/docs/experiments-diagnostics.md"><code>docs/experiments-diagnostics.md</code></a></li>
<li id="evidencia-66ac6b003d1b" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/docs/experiments-gc.md"><code>docs/experiments-gc.md</code></a></li>
<li id="evidencia-49a84856569b" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/docs/experiments-opentelemetry.md"><code>docs/experiments-opentelemetry.md</code></a></li>
<li id="evidencia-1b6ad6b00607" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/docs/experiments-runtime-async.md"><code>docs/experiments-runtime-async.md</code></a></li>
<li id="evidencia-0c5cb713ef30" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/docs/final-audit.md"><code>docs/final-audit.md</code></a></li>
<li id="evidencia-a95975256127" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/docs/limitations.md"><code>docs/limitations.md</code></a></li>
<li id="evidencia-0abaf28a964f" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/docs/methodology.md"><code>docs/methodology.md</code></a></li>
<li id="evidencia-c27572d4a0b1" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/docs/migration-guide.md"><code>docs/migration-guide.md</code></a></li>
<li id="evidencia-113fa8cfb6cb" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/docs/reproduction.md"><code>docs/reproduction.md</code></a></li>
<li id="evidencia-d3284b7c09ce" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/docs/research.md"><code>docs/research.md</code></a></li>
<li id="evidencia-0f1a77641be5" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/docs/traceability.md"><code>docs/traceability.md</code></a></li>
<li id="evidencia-b33563055168" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/README.md#versiones-y-separación-de-factores"><code>README.md</code></a></li>
<li id="evidencia-2e3a949af1d4" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/tree/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/metadata/"><code>results/metadata/</code></a></li>
<li id="evidencia-eae7c22ee92c" class="study-evidence-row" tabindex="-1"><a href="https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/metadata/micro-full-20261112/environment.json"><code>results/metadata/micro-full-20261112/environment.json</code></a></li>
<li id="evidencia-2b58aa147724" class="study-evidence-row" tabindex="-1"><a href="https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/metadata/web-canonical-selection.json"><code>results/metadata/web-canonical-selection.json</code></a></li>
<li id="evidencia-7af0f987adad" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/tree/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/processed/"><code>results/processed/</code></a></li>
<li id="evidencia-1dd017ec894b" class="study-evidence-row" tabindex="-1"><a href="https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/processed/anomalies/comparisons.json"><code>results/processed/anomalies/comparisons.json</code></a></li>
<li id="evidencia-8fa56c2c2104" class="study-evidence-row" tabindex="-1"><a href="https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/processed/anomalies/initial-contrast.json"><code>results/processed/anomalies/initial-contrast.json</code></a></li>
<li id="evidencia-72dacfc93ab3" class="study-evidence-row" tabindex="-1"><a href="https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/processed/aot-summary.json"><code>results/processed/aot-summary.json</code></a></li>
<li id="evidencia-ccfdaa91eb0c" class="study-evidence-row" tabindex="-1"><a href="https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/processed/critical-controls/aot-files.json"><code>results/processed/critical-controls/aot-files.json</code></a></li>
<li id="evidencia-4240917cf8c0" class="study-evidence-row" tabindex="-1"><a href="https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/processed/dependency-audit.json"><code>results/processed/dependency-audit.json</code></a></li>
<li id="evidencia-0730b27082ed" class="study-evidence-row" tabindex="-1"><a href="https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/processed/ef/independent-runs.json"><code>results/processed/ef/independent-runs.json</code></a></li>
<li id="evidencia-b389f565c315" class="study-evidence-row" tabindex="-1"><a href="https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/processed/jit-pr/micro-records.json"><code>results/processed/jit-pr/micro-records.json</code></a></li>
<li id="evidencia-df8b1b3c3ee3" class="study-evidence-row" tabindex="-1"><a href="https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/processed/micro-comparisons.json"><code>results/processed/micro-comparisons.json</code></a></li>
<li id="evidencia-0b839fa40f5b" class="study-evidence-row" tabindex="-1"><a href="https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/processed/runtime-async/records.json"><code>results/processed/runtime-async/records.json</code></a></li>
<li id="evidencia-c5f6f42177bc" class="study-evidence-row" tabindex="-1"><a href="https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/processed/servergc/micro-records.json"><code>results/processed/servergc/micro-records.json</code></a></li>
<li id="evidencia-af1cc789ce98" class="study-evidence-row" tabindex="-1"><a href="https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/processed/sizes/micro-comparisons.json"><code>results/processed/sizes/micro-comparisons.json</code></a></li>
<li id="evidencia-72edf7c1bea8" class="study-evidence-row" tabindex="-1"><a href="https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/processed/sizes/micro-records.json"><code>results/processed/sizes/micro-records.json</code></a></li>
<li id="evidencia-d8f4c3a92139" class="study-evidence-row" tabindex="-1"><a href="https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/processed/web-main-summary.json"><code>results/processed/web-main-summary.json</code></a></li>
<li id="evidencia-24208bfe2b21" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/tree/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/raw/"><code>results/raw/</code></a></li>
<li id="evidencia-4d04be4160f7" class="study-evidence-row" tabindex="-1"><a href="https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/raw/anomalies/anomalies-20261112/manifest.json"><code>results/raw/anomalies/anomalies-20261112/manifest.json</code></a></li>
<li id="evidencia-7600edfd6c82" class="study-evidence-row" tabindex="-1"><a href="https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/raw/aot/main/results.json"><code>results/raw/aot/main/results.json</code></a></li>
<li id="evidencia-fe64e7167cf6" class="study-evidence-row" tabindex="-1"><a href="https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/raw/audit-channel/audit-channel-20261112-v2/manifest.json"><code>results/raw/audit-channel/audit-channel-20261112-v2/manifest.json</code></a></li>
<li id="evidencia-342dff88bdf2" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/tree/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/raw/ef/main/"><code>results/raw/ef/main/</code></a></li>
<li id="evidencia-eb1002fa9057" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/tree/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/raw/gc/main/"><code>results/raw/gc/main/</code></a></li>
<li id="evidencia-4dda7b72f5af" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/raw/jit-general-20261112/micro/results/NetComparison.Benchmarks.JitBenchmarks-asm.md"><code>results/raw/jit-general-20261112/micro/results/NetComparison.Benchmarks.JitBenchmarks-asm.md</code></a></li>
<li id="evidencia-18e9feab7b9d" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/tree/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/raw/jit-pr/main/results/"><code>results/raw/jit-pr/main/results/</code></a></li>
<li id="evidencia-30c35e8cd5bc" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/raw/jit-pr/main/results/BenchmarkRun-joined-2026-11-12-16-17-31-asm.md"><code>results/raw/jit-pr/main/results/BenchmarkRun-joined-2026-11-12-16-17-31-asm.md</code></a></li>
<li id="evidencia-29f7b27309c9" class="study-evidence-row" tabindex="-1"><a href="https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/raw/jit-pr/main/results/BenchmarkRun-joined-2026-11-12-16-17-31-report-full.json"><code>results/raw/jit-pr/main/results/BenchmarkRun-joined-2026-11-12-16-17-31-report-full.json</code></a></li>
<li id="evidencia-e4716719f12b" class="study-evidence-row" tabindex="-1"><a href="https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/raw/language/main-pinned/results.json"><code>results/raw/language/main-pinned/results.json</code></a></li>
<li id="evidencia-71d6e094d75a" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/tree/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/raw/micro-full-20261112/micro/results/"><code>results/raw/micro-full-20261112/micro/results/</code></a></li>
<li id="evidencia-eadf167ea790" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/tree/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/raw/opentelemetry/main/"><code>results/raw/opentelemetry/main/</code></a></li>
<li id="evidencia-58433020b8b2" class="study-evidence-row" tabindex="-1"><a href="https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/raw/runtime-async/main/bdn/results/NetComparison.RuntimeAsync.AsyncBenchmarks-report-full.json"><code>results/raw/runtime-async/main/bdn/results/NetComparison.RuntimeAsync.AsyncBenchmarks-report-full.json</code></a></li>
<li id="evidencia-6e072ef31711" class="study-evidence-row" tabindex="-1"><a href="https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/raw/runtime-async/main/diagnostic-index.json"><code>results/raw/runtime-async/main/diagnostic-index.json</code></a></li>
<li id="evidencia-ed06cbb1d49e" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/tree/5c8a5419e8330afcd954d87be5547fc1fdf725b5/results/raw/sdk/main/"><code>results/raw/sdk/main/</code></a></li>
<li id="evidencia-705b372bd60d" class="study-evidence-row" tabindex="-1"><a href="https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/screenshots/manifest.json"><code>screenshots/manifest.json</code></a></li>
<li id="evidencia-814202861e40" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/scripts/run/publish.ps1"><code>scripts/run/publish.ps1</code></a></li>
<li id="evidencia-5a1a89cb8fab" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/scripts/run/web-load.js"><code>scripts/run/web-load.js</code></a></li>
<li id="evidencia-189c05fb0888" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/tree/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/BenchmarkRunner/"><code>src/BenchmarkRunner/</code></a></li>
<li id="evidencia-c6ada5d0c815" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/tree/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/Benchmarks/"><code>src/Benchmarks/</code></a></li>
<li id="evidencia-2f2ab2ee9fca" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/Benchmarks/AsyncAndConcurrencyBenchmarks.cs"><code>src/Benchmarks/AsyncAndConcurrencyBenchmarks.cs</code></a></li>
<li id="evidencia-0ee69ae7579f" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/Benchmarks/CollectionsBenchmarks.cs"><code>src/Benchmarks/CollectionsBenchmarks.cs</code></a></li>
<li id="evidencia-24932a96fd09" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/Benchmarks/DiagnosticsBenchmarks.cs"><code>src/Benchmarks/DiagnosticsBenchmarks.cs</code></a></li>
<li id="evidencia-9d3b41746437" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/Benchmarks/IoAndCryptoBenchmarks.cs"><code>src/Benchmarks/IoAndCryptoBenchmarks.cs</code></a></li>
<li id="evidencia-1231921bcc1b" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/Benchmarks/MemoryJitReflectionBenchmarks.cs"><code>src/Benchmarks/MemoryJitReflectionBenchmarks.cs</code></a></li>
<li id="evidencia-ce34a0dd57d9" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/Benchmarks/TextAndJsonBenchmarks.cs"><code>src/Benchmarks/TextAndJsonBenchmarks.cs</code></a></li>
<li id="evidencia-7002b4de1a6f" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/tree/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/EfCore/Shared/"><code>src/EfCore/Shared/</code></a></li>
<li id="evidencia-00fc7b72f30d" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/EfCore/Shared/Workload.cs"><code>src/EfCore/Shared/Workload.cs</code></a></li>
<li id="evidencia-f006efa4101c" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/tree/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/JitProbes/"><code>src/JitProbes/</code></a></li>
<li id="evidencia-1014f76afffd" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/JitProbes/Program.cs"><code>src/JitProbes/Program.cs</code></a></li>
<li id="evidencia-801e11250a0f" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/tree/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/LanguageSamples/"><code>src/LanguageSamples/</code></a></li>
<li id="evidencia-c0d8e32e6c8e" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/LanguageSamples/After15/Program.cs"><code>src/LanguageSamples/After15/Program.cs</code></a></li>
<li id="evidencia-c09084b853ba" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/LanguageSamples/Before14/Program.cs"><code>src/LanguageSamples/Before14/Program.cs</code></a></li>
<li id="evidencia-3e3eaf845eb4" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/LanguageSamples/LegacyInterface15/Measurement.cs"><code>src/LanguageSamples/LegacyInterface15/Measurement.cs</code></a></li>
<li id="evidencia-c7d37de1a813" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/LanguageSamples/MemorySafetyPreview/Program.cs"><code>src/LanguageSamples/MemorySafetyPreview/Program.cs</code></a></li>
<li id="evidencia-a529ae37cfa4" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/LanguageSamples/Shared/AsyncBehavior.cs"><code>src/LanguageSamples/Shared/AsyncBehavior.cs</code></a></li>
<li id="evidencia-47338399560d" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/tree/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/NativeAot/"><code>src/NativeAot/</code></a></li>
<li id="evidencia-c1469587a92e" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/tree/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/Net11Features/"><code>src/Net11Features/</code></a></li>
<li id="evidencia-3f42500b63f7" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/Net11Features/Cases/Crypto.cs"><code>src/Net11Features/Cases/Crypto.cs</code></a></li>
<li id="evidencia-84abffd79e6c" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/Net11Features/Cases/FullJoin.cs"><code>src/Net11Features/Cases/FullJoin.cs</code></a></li>
<li id="evidencia-2512a90fff6c" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/Net11Features/Cases/JsonLines.cs"><code>src/Net11Features/Cases/JsonLines.cs</code></a></li>
<li id="evidencia-8f7a657cadec" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/Net11Features/Cases/JsonUnion.cs"><code>src/Net11Features/Cases/JsonUnion.cs</code></a></li>
<li id="evidencia-64e36bae106e" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/Net11Features/Cases/MemoryStreams.cs"><code>src/Net11Features/Cases/MemoryStreams.cs</code></a></li>
<li id="evidencia-381ddd437902" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/Net11Features/Cases/SequenceStreams.cs"><code>src/Net11Features/Cases/SequenceStreams.cs</code></a></li>
<li id="evidencia-1176d2ac9bae" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/Net11Features/Cases/TupleJoin.cs"><code>src/Net11Features/Cases/TupleJoin.cs</code></a></li>
<li id="evidencia-3ed5656e6e02" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/Net11Features/Cases/Zstandard.cs"><code>src/Net11Features/Cases/Zstandard.cs</code></a></li>
<li id="evidencia-215f5262460a" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/tree/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/RuntimeAsyncBenchmarks/"><code>src/RuntimeAsyncBenchmarks/</code></a></li>
<li id="evidencia-49fbbda8a5e0" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/RuntimeAsyncBenchmarks/AsyncBenchmarks.cs"><code>src/RuntimeAsyncBenchmarks/AsyncBenchmarks.cs</code></a></li>
<li id="evidencia-b75210290e49" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/RuntimeAsyncBenchmarks/Shared/AsyncWorkloads.cs"><code>src/RuntimeAsyncBenchmarks/Shared/AsyncWorkloads.cs</code></a></li>
<li id="evidencia-97ea9fad1b13" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/tree/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/WebApi/"><code>src/WebApi/</code></a></li>
<li id="evidencia-665e52b5b87a" class="study-evidence-row" tabindex="-1"><a href="https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/src/WebApi/Program.cs"><code>src/WebApi/Program.cs</code></a></li>
</ul>

</details>

### Preparar una copia sin pisar las medidas

Antes de ejecutar nada, clona el proyecto en una carpeta aparte. Algunos instaladores y analizadores reescriben metadatos compartidos; elegir otro RunId no protege esos archivos. No conviene descubrirlo después de ejecutar una prueba encima de los originales que querías consultar.

Los procedimientos del laboratorio se ejercitaron en Windows x64 con PowerShell 5.1. Las herramientas de imágenes requieren Node 20 o posterior. No hay una campaña equivalente aquí para Linux, macOS, Arm64 o contenedores. Desde la raíz de esa copia separada, la preparación empieza así:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup/inspect.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup/install-sdks.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup/install-k6.ps1
.dotnet/dotnet.exe --info
.dotnet/dotnet.exe --list-sdks
.dotnet/dotnet.exe --list-runtimes
```

Los SDK quedan en .dotnet/, sin modificar la instalación global, y el instalador contrasta sus hashes oficiales. NuGet utiliza fuentes explícitas: no hace falta copiar credenciales de la máquina del autor.

Después comprobaría corrección antes de lanzar una campaña larga:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run/verify.ps1 `
  -Locked -RunId blog-repro-correctness
```

La [guía de reproducción](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/docs/reproduction.md) recoge los comandos de las campañas, la toolchain nativa necesaria para AOT y cómo conservar las salidas. Los identificadores de ejemplo son para sustituirlos por otros nuevos, no para sobrescribir ejecuciones existentes. El [workflow de corrección publicado](https://github.com/jyeste94/.NET11vs.NET11/actions/runs/43501898251) terminó correctamente en GitHub; comprueba contratos y compilación, no reproduce todos los benchmarks ni certifica sus tiempos. El [informe editorial anterior](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/article/blog-editorial-report.md) conserva las comprobaciones de sus ejemplos. Esta reescritura no añade otra campaña de rendimiento.

### Qué guardar si lo repites

Además de la salida, guarda SDK y runtime efectivos, lockfiles, RID, modo GC, tiering/PGO, opciones preview, parámetros, orden y entorno. Anota el commit y si el árbol tenía cambios. Si los tenía, conserva también esas fuentes: el SHA por sí solo no las contiene.

Es un límite que afecta a algunas campañas de este laboratorio. No quedó un estado completo de todas las fuentes de ejecución en Git; publicar después los originales y sus hashes permite revisarlos, pero no reconstruir los bytes ausentes. La [auditoría](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/docs/final-audit.md) y la [matriz de trazabilidad](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/docs/traceability.md) explican hasta dónde llega cada cadena. El commit enlazado fija lo publicado, no sustituye aquel estado histórico.

Si un tiempo se sale de lo esperado, comprueba primero el resultado y la configuración. Mira luego la dispersión y repite cambiando sólo lo necesario para resolver esa duda. Cambiar a la vez la carga, el código y los paquetes hasta acercarse a la cifra del artículo no sería reproducir la prueba.

Los originales incluyen identificadores técnicos del equipo, rutas y trazas binarias del laboratorio. Se conservan sin anonimizar, separados de los SDK, cachés y builds locales que no se han subido. Las capturas del artículo son una selección para leer los resultados; los datos completos siguen en el repositorio.

<a id="glosario"></a>
## 23. Glosario

Las siglas y términos del artículo, reunidos para volver a ellos cuando haga falta.

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


<a id="referencias"></a>
## 24. Referencias

Aquí están la documentación oficial, los PRs relacionados con los mecanismos estudiados y los archivos de la investigación. Las cifras comparadas son las del laboratorio. Las fuentes de Microsoft se utilizan para explicar el funcionamiento y comprobar versiones, no para rellenar una medición que no tengamos. El corte de versiones es noviembre de 2026; las páginas que apuntan a main pueden cambiar.

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

- [README y mapa del proyecto](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/README.md#versiones-y-separación-de-factores).
- [Artículo técnico original, sin sobrescribir](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/article/dotnet-10-vs-dotnet-11.md).
- [Metodología](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/docs/methodology.md), [investigación y discrepancias de fuentes](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/docs/research.md) y [referencias anotadas](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/article/references.md).
- [Auditoría crítica](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/docs/final-audit.md), [matriz de trazabilidad](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/docs/traceability.md) y [limitaciones](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/docs/limitations.md).
- [Reproducción](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/docs/reproduction.md) y [migración](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/docs/migration-guide.md).
- [Informe editorial de la versión anterior](https://github.com/jyeste94/.NET11vs.NET11/blob/5c8a5419e8330afcd954d87be5547fc1fdf725b5/article/blog-editorial-report.md) y [procedencia de las imágenes reutilizadas](https://raw.githubusercontent.com/jyeste94/.NET11vs.NET11/5c8a5419e8330afcd954d87be5547fc1fdf725b5/article/blog-image-manifest.json).

[Volver al índice](#indice) · [Leer la respuesta corta](#resumen-ejecutivo)
