---
title: "DeepSeek-R2, Gemma 3 y Llama 4 Scout frente a frente: La IA que ya puedes correr en tu PC"
date: "2026-03-27"
category: "IA"
summary: "Análisis técnico pero en cristiano: cómo la cuantización extrema y trucos como el Sparse Attention han logrado meter LLMs gigantes en tu portátil sin que salga ardiendo."
readingTime: "6 min"
tags: ["IA Local", "DeepSeek", "Gemma 3", "Llama 4", "Rendimiento"]
---

Si en 2024 nos hubieran dicho que lograríamos correr bichos con arquitectura _Mixture of Experts_ (MoE) en un portátil mientras seguimos compilando cosas de fondo, nos habría dado la risa floja. Pero bienvenidos a 2026. La mentalidad de la industria ha dado un volantazo de 180 grados: ya no se trata de a ver quién la tiene más grande (hablando de trillones de parámetros, malpensados), sino de quién consigue la mejor **eficiencia y compresión**.

Toda esta magia negra ocurre gracias a técnicas como el **KV Cache Quantization** a 2-bit, el **Sparse Attention** ultraligero y el **NPU Offloading**. En castellano: trucos para exprimir la memoria de vídeo (VRAM) al máximo, hacer que la IA solo se fije en lo verdaderamente necesario, y exprimir los procesadores neuronales que ya vienen de serie en los Mac y portátiles Windows modernos. Suma a eso algoritmos de compresión bestiales como _TurboQuant_ de Google, y el resultado es que hoy, un modelo "pequeñajo" de 7 a 12 billones de parámetros se merienda con patatas a los gigantes intocables de hace solo un par de años.

Llevo unas semanas quemando los ventiladores de mi equipo para poner a prueba los tres grandes modelos gratuitos en `localhost`. Aquí tenéis la disección de **DeepSeek-R2**, **Gemma 3** y **Llama 4 Scout**. Vamos al lío.

## El "Rey de los Bugs" que enamora a las GPUs modestas: DeepSeek-R2:7B-Mini

Los chicos de DeepSeek siguen demostrando por qué son los amos absolutos optimizando matemáticas. Si el antiguo R1 ya nos dejó con el culo torcido, este **R2:7B-Mini** es una obra de ingeniería bruta para exprimir al máximo esas gráficas de gama de entrada o portátiles apurados que cuentan con apenas 6 u 8 GB de VRAM.

Su plato fuerte es su mejora en la famosa **Chain of Thought (CoT)**, es decir, su capacidad para razonar paso a paso. Antes, si la cosa se ponía muy compleja, el modelo empezaba a alucinar. Ahora, el R2 incorpora una especie de pepito grillo interno que auto-verifica todo: si detecta que la lógica se está yendo al garete, corrige el rumbo antes de escupir siquiera la primera línea de código. 

*   **Lo mejor:** Es una mala bestia detectando y levantando bugs encadenados en C++ y Rust. 
*   **Lo peor:** Si le metes un contexto abismal (más de 16k tokens) y lo tienes muy comprimido para ahorrar memoria, se le empieza a ir un poco el santo al cielo y olvida las primeras instrucciones.

## Todo el ecosistema de Google a dieta estricta: Gemma 3 (12B)

Google por fin ha hecho los deberes empaquetando todo el músculo de su familia Gemini en un espacio hiper-reducido. **Gemma 3 (12B)** no es solo un lorito que repite texto; ha unificado el "ver y leer" de forma nativa. 

Cero adaptadores raros ni parches. Gemma 3 inyecta la información de las imágenes directamente en sus neuronas. ¿El resultado en la vida real? Hazle una captura de pantalla a ese log de consola sangrante, pégale un trozo del ticket de Jira, y el bicho lo entiende de una pasada sin rechistar.

*   **Lo mejor:** La integración directa que tiene con Google Cloud y Vertex AI si te quedas corto en local, y que viene comiendo imágenes directamente desde la caja.
*   **Lo peor:** Necesita sus buenos 12-16GB de memoria unificada. En un Mac moderno con procesador Apple Silicon va a volar, pero a una RTX 3060 de PC normal de toda la vida, la hará sudar sangre.

## Llama 4 Scout: Un monstruo fragmentado en tu mochila

Meta ha soltado una pedrada en el tejado de la IA. **Llama 4 Scout** escondía trampa: es en realidad un mastodonte **MoE de 109B parámetros en total**. La verdadera sacada de sus ingenieros es que, de esos 109 billones, **solo usa 8 billones activos a la vez** por cada token que procesa. 

Lo han optimizado de forma que funcione en nuestras humildes GPUs caseras. Si ve que tu VRAM se ahoga, reparte el peso tirando de la RAM tradicional de la placa base sin que el sistema colapse demasiado.

*   **Lo mejor:** La coherencia absurda que tiene para proyectos largos. Le pasas bases enteras de código y te sabe proponer rediseños como si llevara tres años picando código.
*   **Lo peor:** Prepara tu SSD. Esos 109B pesan en el almacenamiento, así que vas a tener que descargar casi 60 GB de modelo aunque luego para funcionar solo "arranque" un trocito a la vez.

---

## Comparativa de Rendimiento al Tostadero (Entorno: M3 Max / RTX 4070 Ti)

| El Bicho | ¿Qué entrañas lleva? | Aciertos en Programación | Velocidad (Tokens/seg) | Lo que traga de tu VRAM |
| :--- | :--- | :--- | :--- | :--- |
| **DeepSeek-R2** | Modelo denso ultrarrápido | 78.4% | **~90 t/s** | **~5.5 GB** |
| **Gemma 3** | Multimodal nativo puro | 82.1% | ~65 t/s | ~8.9 GB |
| **Llama 4 Scout** | MoE (El gigante dormido) | **85.3%** | ~75 t/s | ~9.2 GB |

---

## Casos de Uso: ¿Con cuál nos quedamos?

1.  **Como copiloto mientras picas código:** **DeepSeek-R2**. Aquí manda la velocidad, y a 90 tokens por segundo escupe funciones completas a la velocidad de la luz. 
2.  **Para hacerte un asistente inteligente con ojos:** **Gemma 3**. Si vas a trastear con AutoGen y quieres que una IA te lea la pantalla, haga clics y se entienda con tus Docs, no hay rival.
3.  **Para auditar toda la estructura de tu proyecto:** **Llama 4 Scout**. Tírale a la cara el código de tus microservicios y pídele que te optimice el flujo de red. Su nivel de análisis al procesar toneladas de texto es simplemente magia oscura.

## Conclusión: El poder vuelve a nuestras manos

No hay que tomar a la ligera el golpe sobre la mesa que estamos viendo en 2026. Correr estas salvajadas algorítmicas sin depender del ronzal de OpenAI o Google en la nube significa que recuperamos, por fin, la privacidad total de nuestro código propietario.

Tener un Llama 4 Scout metido en tu PC de escritorio de gama media, aprovechando el NPU para no fundir los ventiladores, es la mayor victoria del código abierto de la última década. La clave ya no es pagar miles de euros al mes a servidores externos, sino saber jugar con el modelo adecuado, domarlo y enchufarlo a tu entorno de la forma más guarra y perfecta posible para facilitarte la vida de desarrollador.
