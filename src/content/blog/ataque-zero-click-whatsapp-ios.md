---
title: "El Ataque Invisible: Cómo una simple imagen de WhatsApp podía tomar el control total de tu iPhone"
date: "2026-07-29"
category: "Ciberseguridad"
summary: "Análisis técnico de un ataque de cero clics (zero-click): profundizamos en el desbordamiento de memoria DNG (CVE-2025-43300), cadenas ROP y ejecución remota de código en iOS."
readingTime: "10 min"
tags: ["Ciberseguridad", "iOS", "WhatsApp", "Zero-Click", "CVE", "Buffer Overflow", "ROP"]
---

> *"No necesitas hacer clic en nada. No necesitas abrir el mensaje. Solo recibirlo basta."*

---

## 🎯 El Resumen (para los que tienen prisa)

En agosto de 2025, se descubrió una cadena de ataque **de "cero clics"** (*zero-click*) contra WhatsApp en iOS. Esto significa que **con solo conocer tu número de teléfono**, un atacante podía comprometer el dispositivo **sin que el usuario hiciera nada**: ni abrir el chat, ni descargar la imagen, ni hacer clic en ningún enlace.

La cadena de ataque combinaba **dos vulnerabilidades encadenadas**:

| Vulnerabilidad | Componente | Mecanismo de explotación |
| :--- | :--- | :--- |
| **CVE-2025-55177** | WhatsApp (iOS/Mac) | Sincronización falsa que fuerza la descarga en segundo plano |
| **CVE-2025-43300** | Apple ImageIO (`RawCamera.bundle`) | Desbordamiento de búfer en el *heap* al procesar metadatos DNG |

Ambas fueron parcheadas por WhatsApp y Apple. Sin embargo, analizar la arquitectura de este exploit es fascinante para entender la ingeniería detrás de los ataques modernos en sistemas móviles.

---

## 🧩 Los Fundamentos: ¿Qué es un ataque de "cero clics"?

En la mayoría de vectores de ataque tradicionales (phishing, enlaces maliciosos, troyanos), se requiere la interacción de la víctima. En un ataque de **cero clics** (*zero-click*), la superficie de entrada se activa automáticamente al recibir el paquete de datos en segundo plano.

El flujo de explotación funcionaba como una **cadena de dos eslabones**:

```text
1. Recepción de mensaje de sincronización manipulado (WhatsApp)
                        ↓
2. WhatsApp valida erróneamente el origen y descarga la imagen DNG
                        ↓
3. El demonio de procesamiento de imágenes de iOS indexa la imagen
                        ↓
4. Desbordamiento de memoria (Buffer Overflow) y ejecución de código (RCE)
```

---

## 🔗 El Primer Eslabón: Sincronización de Dispositivos (CVE-2025-55177)

### El fallo de autenticación en la sincronización

WhatsApp permite vincular múltiples dispositivos (WhatsApp Web, escritorio, iPad) compartiendo claves de sesión. Para mantener los chats al día, el sistema intercambia peticiones de sincronización en segundo plano.

La vulnerabilidad residía en que **WhatsApp para iOS no validaba adecuadamente la firma de origen** en las peticiones de sincronización de medios entrantes.

### El vector de descarga forzada

Un atacante podía forjar un mensaje de protocolo indicando:

> *"Este mensaje proviene de tu cliente secundario vinculado. Descarga de inmediato el recurso multimedia de esta URL para pre-procesar su miniatura."*

Al no verificar si la petición provenía realmente de un dispositivo autorizado de la cuenta, WhatsApp **descargaba automáticamente el archivo multimedia** y lo entregaba al subsistema de procesamiento multimedia del sistema operativo.

**Versiones afectadas**:
* WhatsApp para iOS `< 2.25.21.73`
* WhatsApp Business para iOS `< 2.25.21.78`
* WhatsApp para Mac `< 2.25.21.78`

---

## 💥 El Segundo Eslabón: La Imagen que Explota el Sistema (CVE-2025-43300)

Una vez descargada la imagen en el almacenamiento local del dispositivo, iOS utiliza el framework **ImageIO** y el paquete **`RawCamera.bundle`** para generar vistas previas y procesar archivos RAW.

### 🕵️‍♂️ La Analogía del Restaurante

Para entender cómo un simple archivo gráfico puede doblegar las defensas de un iPhone, imaginemos el procesamiento de memoria como la gestión de mesas en un restaurante:

1. **La Reserva de Espacio:** El sistema (el camarero) lee los metadatos TIFF y reserva una mesa para 2 comensales (`SamplesPerPixel = 2`).
2. **La Entrada de Datos:** El decodificador lee los datos reales del JPEG (`SOF3`) que resultan ser de solo 1 comensal (`NumComponents = 1`), pero procesa los datos con un formato desalineado.
3. **El Desbordamiento:** El camarero, confundido por la falta de coincidencia, empieza a escribir la información fuera del espacio reservado. Escribe directamente en la mesa de al lado, corrompiendo la reserva de otros clientes.
4. **La Corrupción Calculada:** El atacante ha diseñado la imagen DNG para que esta escritura fuera de límites no sea accidental. Coloca datos especialmente estructurados que sobrescriben una dirección de memoria crítica: **el puntero que le dice al programa qué instrucción ejecutar a continuación**.
5. **La Redirección del Control:** Cuando el programa termina su tarea actual, consulta esa dirección de memoria. Como el atacante la ha modificado, el sistema salta directamente a ejecutar **las instrucciones del atacante** en lugar del código legítimo.

---

### ⚙️ El Proceso Técnico de Explotación (RCE Paso a Paso)

Para comprender la ingeniería detrás de la Ejecución Remota de Código (RCE), este es el proceso paso a paso:

#### 1. La Corrupción de Memoria (Heap Overflow)
El `heap` es la zona de memoria dinámica donde los programas crean y destruyen objetos sobre la marcha. 
* Los metadatos TIFF engañan a `RawCamera.bundle` para que reserve un búfer reducido.
* La rutina de decodificación del stream JPEG lee el marcador comprimido y **escribe más datos de los que caben en el búfer asignado**, desbordando el bloque de memoria contiguo.

#### 2. La Desviación del Flujo de Control (Control Flow Hijacking)
El objetivo no es simplemente provocar un fallo (*crash*), sino tomar el control de la ejecución.
* Al sobrescribir la memoria contigua en el *heap*, el atacante logra modificar **punteros de función** o estructuras de vtable de objetos C++.
* La siguiente vez que el sistema operativo intenta llamar a un método sobre ese objeto corrompido, la CPU salta a la dirección inyectada por el atacante.

#### 3. Evadiendo Protecciones con Cadenas ROP (Return-Oriented Programming)
En iOS moderno existen protecciones estrictas como **W^X** (*Write XOR Execute*) y **PAC** (*Pointer Authentication Codes*), que impiden ejecutar código nuevo inyectado directamente en memoria de datos.

* **¿Qué es ROP?**: En lugar de inyectar código nuevo, el atacante reutiliza fragmentos de código legítimo ejecutable que ya existen en la memoria de iOS (dentro de librerías del sistema como `libsystem_kernel.dylib`). Estos fragmentos se conocen como **gadgets** y finalizan con una instrucción de retorno (`ret`).
* **Encadenamiento**: El atacante construye una pila con las direcciones de estos *gadgets*. Al saltar al primero, este realiza una pequeña instrucción, ejecuta `ret` y salta automáticamente al siguiente gadget. Con esto, el atacante puede realizar operaciones complejas, como reconfigurar los permisos de memoria.

#### 4. Ejecución del Payload Final
Una vez que la cadena ROP ha deshabilitado las restricciones de memoria, el atacante logra ejecutar su *payload* final con los privilegios del proceso afectado:
* **Acceso a datos confidenciales:** Lectura de mensajes, contactos y archivos locales.
* **Persistencia o escalado:** Explotación del kernel para obtener acceso *root*.
* **Monitoreo silencioso:** Activación no autorizada de sensores o servicios.

---

## 🔬 La Precisión de los 2 Bytes

Lo más impactante de esta vulnerabilidad es su simplicidad en la capa de entrada: en un archivo DNG legítimo de muestra (extraído de cámaras como la Pentax K-3 Mark III), bastaba con modificar **únicamente dos bytes** mediante edición hexadecimal para activar el fallo:

| Offset Hexadecimal | Valor Original | Valor Modificado | Alteración realizada |
| :--- | :--- | :--- | :--- |
| `0x2FD00` | `0x01` | `0x02` | Elevación del parámetro `SamplesPerPixel` |
| `0x3E40B` | `0x02` | `0x01` | Reducción del marcador `NumComponents` |

---

## 🖥️ Demostración de Concepto (PoC) y Análisis

*Nota: Los scripts expuestos son recreaciones con fines analíticos y de auditoría de parches.*

### 1. Inspección de Inconsistencias en DNG

Mediante un script de análisis en Python, los investigadores verificaban los offsets antes de forzar la mutación del archivo:

```python
# dng_vulnerability_analyzer.py
import struct

def analyze_dng(file_path):
    with open(file_path, "rb") as f:
        content = f.read()
    
    # Lectura de offsets específicos en cabecera TIFF y marcador SOF3
    samples_per_pixel = content[0x2FD00]
    num_components = content[0x3E40B]
    
    print(f"📁 Archivo: {file_path}")
    print(f"  ├── TIFF SamplesPerPixel: {samples_per_pixel} (offset 0x2FD00)")
    print(f"  └── JPEG NumComponents:   {num_components} (offset 0x3E40B)")
    
    if samples_per_pixel != num_components:
        print("⚠️ Inconsistencia detectada. Riesgo de desbordamiento en ImageIO.")

analyze_dng("IMGP0847.DNG")
```

### 2. Generación del Payload de Prueba

```python
# hex_modifier.py
def generate_poc(input_dng, output_dng):
    with open(input_dng, "rb") as f:
        data = bytearray(f.read())

    # Inyección de inconsistencia en los offsets críticos
    data[0x2FD00] = 0x02  # SamplesPerPixel = 2
    data[0x3E40B] = 0x01  # NumComponents = 1

    with open(output_dng, "wb") as f:
        f.write(data)
    
    print(f"✅ PoC generado correctamente en: {output_dng}")

generate_poc("IMGP0847.DNG", "poc_malicious.dng")
```

---

## 🧠 ¿Por qué es tan Peligroso?

El impacto real de esta vulnerabilidad radica en tres factores críticos:

* **Invisible:** El usuario no interactúa. No hay enlaces que pulsar ni botones que aceptar. El procesamiento automático en segundo plano activa la vulnerabilidad.
* **Silencioso:** La aplicación no muestra comportamientos anómalos visibles mientras el proceso explota la memoria en segundo plano.
* **Escalable:** Al no depender del factor humano, las campañas de explotación pueden automatizarse masivamente.

---

## 🛡️ Mitigación y Remediación

Ambas compañías distribuyeron parches de seguridad para corregir la vulnerabilidad en la cadena:

1. **Parche en WhatsApp (CVE-2025-55177):** Incorporación de verificación estricta con firmas criptográficas para cualquier solicitud de sincronización recibida de dispositivos vinculados.
2. **Parche en Apple iOS (CVE-2025-43300):** Actualización en `RawCamera.bundle` dentro de **iOS 18.6.2** para validar que `SamplesPerPixel` coincida exactamente con `NumComponents` antes de reservar memoria.

---

## 📚 Recursos para Profundizar

* **`zero-click-exploit-analysis`:** Proyecto de investigación con paper técnico y análisis de desbordamientos en *heap*.
* **Blog de Quarkslab:** Análisis de ingeniería inversa del parche de Apple para la vulnerabilidad CVE-2025-43300.
* **Presentación DNGerousLINK (39C3):** Ponencia detallada sobre la cadena completa de exploits.
* **Repositorios PoC:** Herramientas y scripts de análisis publicados por la comunidad de ciberseguridad (`hunters-sec`, `PwnToday`).
