# Resumen de Sesión - FiestaAPP Interactive Invitation

Este documento contiene un resumen detallado y estructurado de las últimas implementaciones y optimizaciones realizadas en la invitación interactiva de **FiestaAPP**, diseñado para retomar el proyecto sin fricciones.

---

## 🚀 Logros e Implementaciones Recientes

### 1. Optimización del Botón "Cómo llegar" y Transición de Zoom Espacial (3D)
Para resolver la lentitud del clic y la visibilidad de la orbe dorada de carga, se reestructuró el flujo de la transición 3D:
*   **Pre-Resolución de Coordenadas en Background**: Al cargar la invitación, se resuelven las coordenadas de Google Maps en segundo plano (`resolveEventCoordinates()`), almacenándolas en `preResolvedCoords`. Esto elimina la latencia de red al hacer clic en el botón.
*   **Presentación Instantánea de la Transición**: Al hacer clic en "Cómo llegar", el overlay oscuro (`#space-zoom-overlay`) y el spinner se muestran de forma inmediata ($0\text{ ms}$ de retardo).
*   **Orbe de Carga Auto-Sanable (Safe Loader)**:
    *   Se implementó la función con guardado de estado `safeHideLoader()`.
    *   Se configuró un temporizador de seguridad de `800 ms` para forzar la ocultación del cargador dorado si la textura externa de la Tierra (`earth-night.jpg`) tarda demasiado en cargarse o se bloquea.
*   **Globo Visible al Instante**: Se inicializó el material del globo de Three.js con un color emisivo dorado/bronce sutil (`emissive: 0x221a0f`), evitando que se visualice una pantalla completamente negra mientras se descarga la textura.
*   **Halo Atmosférico Dorado**: Se agregó una segunda esfera exterior concéntrica con blending aditivo y renderizado invertido (`THREE.BackSide`) para crear un halo dorado luminoso de atmósfera alrededor de la Tierra, realzando el aspecto espacial de lujo.
*   **Fondo Estrellado de Lujo (Gold Starfield)**: Se eliminaron las partículas rectangulares y pixeladas por defecto. En su lugar, se implementó un sistema de partículas multicapa mediante texturas generadas dinámicamente con gradientes radiales suaves en un Canvas HTML5. El fondo ahora cuenta con 3 capas independientes de estrellas doradas y blancas de diferentes tamaños (0.35, 0.7 y 1.25) con un total de 3000 estrellas esparcidas de forma tridimensional, las cuales rotan sutilmente en grupo con mezcla aditiva y profundidad deshabilitada (`depthWrite: false`), logrando un fondo estelar denso, suave y elegante sin usar imágenes externas.
*   **Baliza/Faro de Ubicación 3D Activo**: Al fijar las coordenadas del evento en el globo, aparece dinámicamente un indicador 3D (un núcleo esférico dorado y un anillo plano coplanar a la superficie) que parpadea y pulsa continuamente, emulando un satélite o radar fijando el objetivo de la fiesta.
*   **Lógica de Mapeo de Vértices de Precisión**: Se corrigió el cálculo de posicionamiento de la baliza. En lugar de fórmulas esféricas genéricas desalineadas de la textura de la Tierra de Three.js, se utilizó la proyección UV exacta del constructor de `SphereGeometry` de Three.js. Esto posiciona el pin exactamente sobre la locación visual en el mapa de textura de noche.
*   **Línea de Tiempo Cinematográfica Continua (GSAP)**:
    *   Se reemplazaron los retardos de `setTimeout` por una única línea de tiempo continua y fluida de GSAP (`gsap.timeline`).
    *   **Giro e Inclinación Iniciales**: El planeta se posiciona inclinado en X (`(lat * Math.PI) / 180` sin inversión de signo para coincidir con la orientación austral de Argentina) y $1.5$ vueltas detrás en Y para iniciar una rotación acelerada que desacelera de manera fluida (`ease: "power2.inOut"`) hasta clavar el objetivo exactamente frente a la cámara en $3.2\text{ s}$.
    *   **Aceleración de Zoom Cenital**: La cámara realiza un primer acercamiento progresivo en Z de `50` a `28` en $2.4\text{ s}$, seguido de un descenso en caída libre en picado (`ease: "power3.in"`) de `28` a `11.2` en $1.8\text{ s}$, atravesando la corteza del planeta hacia el mapa.
    *   **Destello de Coordenadas**: Las luces de las ciudades destellan en intensidad de `1.0` a `2.2` durante el centrado para indicar el bloqueo de coordenadas.
    *   **Desenfoque Progresivo**: La pantalla del canvas se desenfoca gradualmente mediante un filtro CSS `blur` durante los últimos $1.6\text{ s}$ del descenso.
    *   **Explosión Modal de Mapa**: Tras completarse el descenso de la cámara, el mapa interactivo se despliega con una animación elástica de pop-up/explosión utilizando `ease: "back.out(1.6)"` y escalado progresivo sobre `.map-modal-content`.

### 2. Ocultación del Cronograma (Timeline)
*   **Limpieza de UI**: Se ocultó la sección de itinerario dinámico (`luxury-timeline-section`) configurando `style="display: none;"` en el HTML.
*   **Conservación de Estructura**: Toda la lógica JavaScript de inyección y los selectores DOM permanecen intactos, asegurando la estabilidad del código ante futuras activaciones.

### 3. Personalización y Formateo Dinámico de Datos
*   **Formato de Fecha Premium**: El formateador divide la fecha del evento en dos líneas legibles y estilizadas (Día de la semana completo + Día y mes / Hora).
*   **Encabezados Contextuales**: El subtítulo de bienvenida en el Slide 0 se adapta automáticamente según el título del evento (`¡NOS CASAMOS!` para bodas, `¡MIS 15 AÑOS!` para quinceañeras, o leyendas genéricas de invitación).
*   **División de Dirección**: El texto de dirección se segmenta en título del salón y detalles de calle/localidad para un renderizado limpio en tarjetas.
*   **Efecto de Respiración (Glow Pulsante)**: Agregamos la clase `.btn-glow-breath` a los botones *"Ver detalles del evento"* (Slide 0) y *"Siguiente Paso"* (Slide 1). Su animación realiza una transición suave de brillo exterior dorado (`box-shadow`) que respira elegantemente cada 3 segundos, invitando orgánicamente a los usuarios a navegar al siguiente slide sin interferir con las animaciones nativas de hover o interactividad.
*   **Rediseño de Vestimenta Interactivo (Slide 2)**:
    *   **Remoción de Regalos**: Se eliminó la tarjeta de regalos de este slide (ya que se presentará en la sección del Cofre de Regalos interactivo más adelante).
    *   **Badge Destacado**: Un badge elegante con fondo de cristal templado, bordes dorados e íconos flotantes (`👔 ELEGANTE 👗`) que destaca la categoría de vestimenta dinámica consumida desde la base de datos.
    *   **Tips con Animaciones Divertidas**: Bloques dedicados ("Para Ellos", "Para Ellas", y el "Tip de Oro") con emojis y animaciones que se deslizan lateralmente al pasar el cursor (hover) y que integran rotaciones y rebotes continuos en los emojis (`.emoji-bounce` y `.emoji-spin`).
    *   **Checklist del Invitado Perfecto**: Una lista interactiva de verificación con casillas customizadas en dorado que aplican efectos de tachado y atenuación interactiva al ser marcadas por el usuario.
*   **Levitación y Respiración en Tarjetas de Detalles (Slide 1)**:
    *   **Animación de Levitación Asíncrona (`.card-float-wrapper`)**: Envolvemos las tarjetas de detalles de Slide 1 ("Fecha" y "Lugar") en contenedores que aplican una traslación suave en el eje Y (`translateY(0)` a `translateY(-6px)`), alternando desfases de tiempo (delay) para un balance natural y orgánico en pantalla.
    *   **Glow Respiración en Bordes (`cardGlowBreath`)**: Los bordes dorados y las sombras de las tarjetas respiran lentamente. Al pasar el cursor (hover), la animación se pausa (`animation-play-state: paused`) y resalta con una iluminación dorada sólida, brindando feedback interactivo de forma natural.
*   **Integración de GPS (Google Maps & Waze)**:
    *   **Botones en Modal**: Se agregaron dos botones tipo cápsula elegantemente estilizados en dorado y negro para Google Maps y Waze, ubicados justo debajo del mapa interactivo satelital.
    *   **Redirección Dinámica**: Las URLs se configuran dinámicamente usando las coordenadas reales del evento resueltas por el sistema (por ejemplo, `waze.com/ul?ll=lat,lng&navigate=yes`). En caso de no existir coordenadas personalizadas cargadas, el sistema autogenera enlaces seguros basados en las coordenadas por defecto del salón.
*   **Transición Suave Libre de Parpadeo (Slide 1 -> Slide 2)**:
    *   **Cierre del Modal**: Se implementó una animación de salida con GSAP para el modal del mapa (`.map-modal-content`) que reduce su opacidad y escala de manera progresiva en `0.35s`, logrando una desaparición fluida e integrada con el resto de la interfaz.
    *   **Cambio Silencioso (Silent Slide Swap)**: Para evitar que el usuario viera de fondo el Slide 1 desvanecerse (lo cual provocaba un pestañeo/flickeo incómodo tras presionar "Continuar"), el sistema ahora desactiva el Slide 1 y activa el Slide 2 de manera silenciosa e instantánea *detrás* del modal. Al completarse la animación de cierre del mapa, se revela directamente el Slide 2 con su animación stagger de entrada.

---

## 📋 Estado del Código y Archivos Modificados

*   **Archivo Principal**: [invitacion.html](file:///Users/sebamaza/Desktop/PROYECTOS%20DEV/QR%20Mesas%20Jano's/public/invitacion.html)
*   **Estilos Relacionados**: [invitacion.css](file:///Users/sebamaza/Desktop/PROYECTOS%20DEV/QR%20Mesas%20Jano's/public/css/invitacion.css)
*   **Tests Automatizados**:
    *   Ejecución exitosa de `npm test`.
    *   Todas las pruebas unitarias y de integración de backend (`tests/server.test.js` y `tests/suggest-song.test.js`) están pasando satisfactoriamente ($100\%$ verdes).

---

## 🎯 Próximos Pasos Recomendados

1.  **Validar Performance en Móviles**: Confirmar que la transición WebGL fluya a $60\text{ fps}$ en dispositivos de gama media/baja.
2.  **Verificación de Texturas**: Monitorear si la CDN externa de Three.js (`unpkg.com`) responde consistentemente, aunque la nueva lógica de fallo seguro previene bloqueos de pantalla.

---

## 🌌 Sesión - Corrección de Animación e Interacción del Cofre Mágico

En esta sesión, resolvimos las desconexiones visuales y de rendimiento en el Cofre Mágico, logrando un flujo sumamente inmersivo y agregando una interacción premium de rotación 3D para la tarjeta informativa.

### 🛠️ Logros e Implementaciones
1. **Flujo de Revelado Inmersivo (Slide Out & Down)**:
   - Al insertarse y girar la llave, se produce el destello de partículas y la tapa del cofre se abre suavemente a 125°.
   - La tarjeta informativa (`#chest-gift-card`) emerge **hacia arriba** (`y: -140px`) del cofre para lucir el desbloqueo.
   - De manera fluida y continua, la tarjeta viaja **hacia abajo** (`y: 250px`) y pasa al plano frontal (`z: 65`), asentándose por debajo del cofre.
   - Simultáneamente, el contenedor padre `#chest-wrapper` se desplaza **hacia arriba** (`y: -40px`) sutilmente, logrando un balance compositivo y llenando el espacio vacío inferior sin solapamientos.
2. **Corrección de Bloqueos en las Animaciones**:
   - Eliminamos `transition: transform 0.1s ease;` de `.chest-lid`. Al interactuar con el motor GSAP, la transición CSS producía retardos y congelaba la animación de apertura de la tapa. Ahora abre de manera instantánea y fluida.
   - El desplazamiento vertical se aplicó al wrapper general en lugar del cofre individual para evitar conflictos con el efecto hover de inclinación 3D de la madera.
3. **Tarjeta 3D Rotable por Arrastre (Swipe / Drag)**:
   - Se implementaron listeners de mouse y táctiles en la tarjeta para habilitar una rotación 3D en base al movimiento horizontal del usuario.
   - Si se arrastra más de `35px` de equivalencia angular, la tarjeta hace un snap-flip en 3D (`.flipped`) para mostrar el reverso con los datos bancarios (CBU, Alias) y botones de copia rápida.
   - Si no se supera el umbral, la tarjeta regresa elásticamente a su cara original.
   - Se deshabilitó el drag en botones interactivos internos para no romper su funcionalidad.
   - Se añadió `touch-action: none` en la tarjeta para evitar scroll vertical involuntario en teléfonos al deslizar.
4. **Indicador de Swipe**:
   - Agregamos la leyenda pulsante animada `↔ Deslizar para girar 🔄` (`.swipe-hint` con `@keyframes pulseHint`) al pie de ambas caras de la tarjeta.

### 📌 Pendientes para Mañana
* **Refinar Detalles Visuales del Cofre**: Seguir puliendo el diseño ornamental y la estética tridimensional del cofre.
* **Optimizar Partículas y Brillos**: Ajustar la iluminación residual de la cerradura y destellos al abrir el cofre.
* **Prueba General de Gestos**: Validar la fluidez del swipe interactivo y el copiado de CBU en pantallas táctiles reales.

---

## 🌌 Sesión de Cierre - Corrección Definitiva del Cofre 3D WebGL (Three.js)

Se solucionó de forma definitiva la desincronización y deformación del cofre tridimensional interactivo en `invitacion.html` mediante las siguientes acciones:

1. **Corrección de Ejes de Coordenadas (Z-up)**:
   - Se validó que el modelo `treasure_chest.glb` utiliza una orientación Z-up. Se cambió el filtro dinámico de vértices en `Object_5` (madera) para procesar el eje **Z** con un umbral de promedio local de `1.8`.
   - Esto separa limpiamente los paneles de la tapa de los de la base sin deformar las mallas.
2. **Sincronización y Bisagra (Hinge Axis - Corrección de Sentido)**:
   - Se corrigió la coordenada `hingeY` de `-1.769` a `1.769` (positivo), ubicando la bisagra en la parte trasera del cofre (ya que el eje Y local positivo corresponde a la parte posterior en el espacio transformado Z-up).
   - Se reparentaron tanto la armadura metálica (`Object_4`) como la madera dividida de la tapa (`Object_5_lid`) al `lidPivot` aplicando la traslación de compensación `(0, -1.769, -1.808)`.
   - Con esta corrección, al aplicar la rotación de apertura de `-Math.PI * 0.7`, la tapa gira hacia arriba y hacia atrás como un cofre real, en lugar de rotar hacia abajo/dentro de la base.
3. **Mapeo de Madera en Dos Caras (DoubleSide)**:
   - Se configuró el material de la madera (`aiStandardSurface1SG`) como `THREE.DoubleSide` (`originalWood.material.side = THREE.DoubleSide`).
   - Al abrir el cofre, el reverso de la tapa de madera es visible y luce su textura correspondiente en lugar de verse transparente/hueco.
4. **Reposicionamiento y Animación de la Llave**:
   - Para resolver el conflicto estético donde la llave plana de 2D se superponía directamente sobre la cerradura 3D pareciendo un error de diseño, cambiamos su estado inicial.
   - Ahora, la llave flota elegantemente en la esquina superior derecha del cofre (`top: -20px`, `left: 155px`) con una inclinación de `-15deg` y un halo dorado que resalta su carácter interactivo y mágico.
   - Al hacer clic, se añadió un giro completo de 360 grados en la línea de tiempo GSAP (`rotation: 360`, `duration: 0.8`) mientras vuela desde su posición de origen hasta centrarse e insertarse perfectamente en el ojo de la cerradura.
5. **Verificación Automatizada**:
   - Capturamos imágenes del nuevo estado de espera con la llave flotando y el estado de apertura final mediante Playwright headless (`chest_closed_floating_key.png` y `chest_opened_final.png`). La transición y animación son impecables.

---

## 🌌 Sesión - Integración del Servicio de Trivia y Corrección de Inicialización

En esta sesión, completamos la integración del servicio de **Trivia** en el Panel de Administración y corregimos errores críticos de inicialización del dashboard.

### 🛠️ Logros e Implementaciones
1. **Mapeo Dinámico del Título del Servicio**:
   - Se corrigió el flujo donde al estar en el panel de personalización de la trivia (`service=trivia`), el título de la cabecera seguía mostrando "Control de Mesas • XV de Mica".
   - Ahora, el sistema reconoce el parámetro `service=trivia` y actualiza la cabecera dinámica a **`Control de Trivia • [Nombre de Cliente]`** y el título de la pestaña a **`Control de Trivia | [Nombre de Cliente]`**.
2. **Corrección de Hoisting e Inicialización (ReferenceError)**:
   - Se resolvió el error `Uncaught ReferenceError: loadTriviaConfig is not defined` en el arranque.
   - Las funciones `loadTriviaConfig`, `startTriviaPolling` y `stopTriviaPolling` se reestructuraron de asignaciones directas (`window.miFuncion = function()`) a declaraciones de función estándar de JavaScript (`function miFuncion() {}`) expuestas a `window` posteriormente. Esto garantiza que las funciones se eleven (**hoisting**) al inicio de la carga del script y estén disponibles inmediatamente.
3. **Solución del Temporal Dead Zone (ReferenceError de Variables)**:
   - Se resolvió el error de referencia `Cannot access 'triviaEventSource' / 'triviaQuestionsData' before initialization`.
   - Como estas variables de estado se declaraban con `let` al final de la carga del script, no podían ser accedidas cuando la inicialización inicial llamaba a `switchTab('trivia')` en las primeras líneas de ejecución.
   - Reubicamos las declaraciones de `triviaQuestionsData` y `triviaEventSource` en el bloque de inicialización superior de `admin.js`, eliminando por completo el TDZ (Temporal Dead Zone).

### 📌 Estado Actual y Próximos Pasos para Mañana
* **Servicio Operativo**: El panel de administración carga la trivia de forma limpia y fluida, sin warnings ni errores de JS en la consola.
* **Sincronización en Vivo**: La conexión de Server-Sent Events (SSE) a `/api/trivia/stream` se establece de manera transparente al abrir la pestaña de Trivia.
* **Siguiente Paso**: Iniciar pruebas del flujo interactivo con la vista del invitado (`public/event.html` -> Trivia) ingresando con un usuario que haya confirmado asistencia en el listado de RSVPs.

---

## 🌌 Sesión - Gestión de Invitados: Filtros por Estado de Confirmación y Exportación a Excel Premium

En esta sesión se optimizó la sección de **Gestión de Invitados** del panel de administración incorporando filtros dinámicos por estado y la exportación final a planillas Excel de calidad profesional.

### 🛠️ Logros e Implementaciones
1. **Filtros por Estado de Confirmación (RSVP)**:
   - Se crearon pestañas de filtro en la tabla de invitados ("Todos", "Confirmados", "Pendientes de Confirmación", "No asistirán") para segmentar la lista instantáneamente.
   - Cada pestaña cuenta con contadores dinámicos que se actualizan en tiempo real calculados a partir de los datos en memoria (`allGuests` y `allRsvps`).
   - Se aplicó diseño Premium de pestañas con bordes dorados activos y hover sutil, coherente con la identidad visual del portal.

2. **Funcionalidad de Exportación a Excel Premium (`ExcelJS`)**:
   - Se implementó el endpoint `/api/admin/export-guests` que genera un archivo `.xlsx` de alta fidelidad.
   - Se incluyeron datos de gran valor para la organización del evento: **Nombre**, **Apellido**, **Mesa**, **Confirmación** (con código de color dinámico: verde claro para confirmados, morado claro para rechazados), **Cant. Acompañantes**, **Nombres de Acompañantes**, **Restricciones Alimenticias**, **Canción Sugerida** y el **Enlace Personalizado de Invitación**.
   - Se aplicó autoajuste dinámico de anchos de columnas para evitar recortes de texto y mantener el formato limpio.
   - Alineación configurada de forma inteligente (alineación izquierda para textos largos, central para nombres, mesas y números).

3. **Consistencia de Datos e Interfaz**:
   - Integración nativa de formato de mesa (`formatTableDisplay`) para homogeneizar las salidas ("Mesa X" o "Sin Mesa").
   - Vinculación del botón **"Exportar Excel"** en la botonera de acciones del listado de invitados.

4. **Verificación**:
   - Todos los test unitarios y de integración continúan pasando al 100%.

### 📌 Próximos Pasos y Estado Actual
- **Estado**: La plataforma se encuentra totalmente estable, robusta y con la lista de invitados sincronizada.
- **Próximos Pasos**: Monitorear el volumen de confirmaciones y proceder con la distribución de enlaces QR y visualización de mesas por parte de los invitados.

---

## 🌌 Sesión - Rediseño del Onboarding Administrativo y Corrección de Anidamiento de Pestañas

En esta sesión se transformó el sistema de bienvenida administrativa de **FiestaAPP** en un **Modal de Onboarding Didáctico** interactivo de 6 slides y se resolvió un fallo crítico de anidamiento HTML que afectaba la personalización de la invitación.

### 🛠️ Logros e Implementaciones
1. **Onboarding didáctico con visuales SVG personalizados**:
   - Diseñamos animaciones SVG personalizadas para cada una de las funcionalidades clave del panel para reemplazar las ilustraciones genéricas:
     * **Localizador de Mesas (QR):** Escáner interactivo con haz de láser verde animado cruzando un código QR mockup.
     * **Invitaciones y Confirmaciones:** Teléfono inteligente mostrando un checklist interactivo de confirmación, calendario flotante y notas musicales flotando.
     * **Muro de Fotos:** Un collage 3D de fotos polaroid flotantes y estrellas resplandecientes sobre un fondo de cristal templado.
     * **Trivia Show:** Un marcador de tiempo radial giratorio interactivo rodeado por un trofeo tridimensional, estrellas de puntaje y burbujas de preguntas flotando.
     * **Slide Final (Despedida):** Un ticket / pase de fiesta VIP con bordes dorados, estrellas brillantes y detalles de acceso rápido, flanqueado por tres insignias flotantes e interactivas (Copa de Éxito, Brindis de Celebración y Check de Éxito en color verde esmeralda).
   - **Corrección de Desbordamientos (Overflow):** Se configuraron los SVGs con `overflow: visible !important` y márgenes seguros para evitar cortes en las estrellas y elementos que vuelan fuera de los límites.
   - **Inyección de Gradientes Globales:** Para evitar la pérdida de color al ocultar diapositivas (`display: none`), se inyectó una definición global e invisible de gradientes lineales dorados al principio del modal.

2. **Solución al Bug de Pestañas e Invitación Rota (Nesting Bug)**:
   - Identificamos que la etiqueta de apertura `<div id="tab-mesas" class="tab-content active">` había sido borrada accidentalmente en `admin.html`.
   - Esto provocaba que el div de cierre de mesas en la línea 154 cerrara la clase principal `.admin-container` antes de tiempo, dejando la pestaña de **Personalizar Invitación** fuera del flujo de diseño principal, lo que rompía el renderizado de estilos en esa pestaña.
   - Al restaurar la etiqueta de apertura del tab de mesas, el anidamiento volvió a la normalidad, resolviendo la superposición del buscador de mesas e invitados y aislando correctamente las vistas.

3. **Highlight interactivo de ayuda en "Enlace de Google Maps del salón"**:
   - Implementamos un badge circular dorado con el signo de pregunta `?` al lado del label del input.
   - Al posicionar el cursor sobre este badge, se despliega un tooltip elegante con fondo traslúcido glassmorphic (`backdrop-filter`), bordes dorados y una lista ordenada con el paso a paso detallado de forma didáctica:
     1. Ingresar a **Google Maps**
     2. Buscar tu salón o ubicación
     3. Click en **"Compartir"**
     4. Pegá acá el enlace generado
   - Añadimos la hoja de estilos en la cabecera del panel para soportar transiciones suaves de opacidad, transformaciones de escala y un puntero de ayuda personalizado (`cursor: help`).

4. **Highlight interactivo de ayuda en "Música de fondo por defecto (MP3 o Spotify)"**:
   - Agregamos un segundo badge de pregunta `?` al lado del label del reproductor de música.
   - Al pasar el cursor, despliega un tooltip informativo detallando las diferencias entre opciones:
     * **Link de Spotify:** Advierte de manera comprensible que solo reproducirá una vista previa de 30 segundos en bucle repetitivo si el invitado permanece leyendo la tarjeta.
     * **Canción Completa (MP3):** Sugiere explícitamente subir un archivo `.mp3` para lograr que el tema suene completo de inicio a fin y sin pausas.

### 📌 Estado de Retorno tras el Descanso
* **Estado:** Totalmente corregido y testeado. El panel de administración aísla perfectamente la personalización de invitaciones, los slides del modal de onboarding se despliegan con calidad visual premium, y los inputs de Google Maps y Música poseen sus respectivas burbujas de ayuda interactiva.
* **Próximas Tareas:** Revisar el flujo de usuario inicial en pantallas de diferentes resoluciones tras el primer ingreso de un evento.
