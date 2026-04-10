# PROMPT MAESTRO — AVA HOLOGRÁFICO v3.0 (versión experta complementada)

**Repositorio:** [https://github.com/iKingRagnar/ava-holographic-assistant](https://github.com/iKingRagnar/ava-holographic-assistant)

**Rol esperado del implementador:** senior full-stack + ingeniería VRM/3D web (VTubers, holografía, referencias tipo Razer Project AVA).

**Objetivo:** maximizar sensación de “personaje vivo”: voz hands-free estable, avatar con movimiento creíble (no robótico), pipeline de modelo claro para el usuario, y extras de contexto/TTS sin romper la arquitectura actual (HTML principal + APIs en Vercel).

---

## 0. Lectura obligatoria del estado actual (antes de codificar)

1. Clonar / abrir el repo y leer en este orden:
   - `ava.html` — secciones **STT / wake word** (`initSTT`, `startWakeWord`, `scheduleWakeRestart`, `startListening`, `startListeningDeepgram`, `toggleMic`, `allowDeepgramStt`), **chat** (`processMessage`, `speak`), **Three/VRM** (`ensureVRM`, `loadVRMAvatar`, `animate`, `animateVRM`, blendshapes, `applyRestPose`).
   - `api/chat.js` — enriquecimiento de contexto (clima, citas, hechos, etc.), `AVATAR_PROMPTS`, `SYSTEM_SUFFIX`.
   - `api/stt-deepgram.js` — STT servidor (Deepgram Nova-2).
   - `vercel.json` — rutas `/api/*` y fallback a `ava.html`.

2. **No asumir** que “un solo archivo” significa cero backend: el proyecto **ya** usa Vercel Functions para chat, TTS y STT.

---

## 1. Requisitos de voz hands-free (prioridad P0)

### 1.1 Comportamiento deseado

- Al detectar frases de activación (**“AVA”**, **“aba”**, **“hola ava”**, **“ok ava”**, **“buenas ava”**, etc. — ya hay lógica en `hasWakePhrase` / `stripWakePhrases`) debe entrar en **modo conversación continua** (`voiceConversationActive`).
- Tras cada respuesta hablada de AVA, el sistema debe **volver a escuchar** automáticamente (flujo ya enlazado con `scheduleWakeRestart` y ramas post-TTS; verificar que no queden estados colgados en `LISTENING` / `TALKING`).
- **Salida de conversación** con frases naturales: “para”, “silencio”, “ya basta”, “adiós”, “stop”, “listo”, “chao” — ya hay regex en `processMessage`; ampliar si hace falta sin falsos positivos en mitad de frase.

### 1.2 Compatibilidad multi-navegador (crítico)

| Entorno | Web Speech API (`SpeechRecognition`) | Estrategia |
|--------|--------------------------------------|------------|
| Chrome / Edge (desktop) | Sí (webkit) | Wake local + escucha con Web Speech si está habilitado “preferir navegador”. |
| Firefox | No | **Obligatorio** STT por servidor: `POST /api/stt-deepgram` con audio grabado vía `MediaRecorder` + `getUserMedia`. |
| Android TV / WebView | A veces no / inestable | Misma regla: **fallback transparente** a Deepgram cuando `!window.SpeechRecognition`. |

**Implementación esperada (coherente con el repo):** función tipo `allowDeepgramStt()` — usar Deepgram cuando el usuario permite servidor **o** cuando no existe Web Speech. No bloquear Deepgram solo porque el checkbox diga “preferir navegador” si no hay API local.

### 1.3 “Sin primer touch” y permisos de micrófono

**Restricción real de plataforma (no negociable con el navegador):**

- Muchos navegadores **no** conceden `getUserMedia({ audio })` desde un **timer** al cargar la página sin **gesto del usuario** (click / tap / tecla). En Android TV a veces funciona si el permiso del sistema ya está en **“Permitir siempre”**.
- Objetivo de producto: **como mucho un único** flujo de permiso persistente:
  - Usar `navigator.permissions.query({ name: 'microphone' })` cuando exista para **reflejar** estado (no sustituye el prompt del sistema).
  - **No** llamar a `getUserMedia` en bucle: una petición coherente para wake/listen; reutilizar pistas cuando sea seguro.
- Documentar en UI (texto breve en overlay): *“En algunos dispositivos hace falta un primer toque o ‘Permitir’ una vez; luego queda hands-free.”*

**Conclusión para el prompt:** “100% sin tocar nunca” es **aspiracional**; la implementación debe acercarse al máximo y degradar con un solo gesto si el SO lo exige.

### 1.4 Deepgram

- Variable de entorno en Vercel: **`DEEPGRAM_API_KEY`** (obligatoria para Firefox / sin Web Speech).
- Modelo ya orientado a español en `api/stt-deepgram.js` (`nova-2`, `es-419`); no romper contrato de request/response que consume `ava.html`.

### 1.5 Criterios de aceptación P0

- [ ] Con Web Speech desactivado o ausente: wake por **Deepgram** + conversación continua sin quedar bloqueado en “escribe abajo” si la API responde bien.
- [ ] Tras `speak()` → vuelve a escuchar o a wake según `voiceConversationActive` y `cfg.wakeWord`.
- [ ] Frases de salida cortan conversación y restauran estado **IDLE** + mensaje de estado coherente.
- [ ] Logs de consola explican claramente: SR disponible sí/no, Deepgram ok/fallo.

---

## 2. Animación VRM “ultra natural” (prioridad P1)

### 2.1 Estado actual en el repo (no reinventar la rueda)

- `three-vrm` (~0.6.11) + `animateVRM`: lookAt a objetivo, blendshapes boca/emoción, piernas/brazos con capas de movimiento, `applyRestPose` anti T-pose.
- **Spring Bone** en three-vrm: evaluar si la versión cargada expone actualización de física en el loop; si no, documentar limitación o subir versión compatible con Three del proyecto.

### 2.2 Objetivos de animación (incrementales)

1. **LookAt:** mantener API de `vrm.lookAt` + target; añadir **micro-saccadas** (ruido suave en el target, no solo mouse), y en TV **sin mouse** usar mirada autónoma (frente ± offset senoidal).
2. **Parpadeo:** asimétrico y con intervalos variables (no `sin(t*10)` fijo); usar blendshapes `Blink` / `Blink_L` / `Blink_R` si existen.
3. **Respiración / peso:** oscilación lenta de pecho/cadera (huesos `chest` / `spine` / `hips`) con `lerp` y fases distintas por pierna.
4. **Boca:** sincronización aproximada con energía de audio TTS si hay analizador; si no, variación de visemas A/E/I/O según estado `TALKING`.
5. **IK brazos/manos:** CCD/FABRIK **ligero** (2–3 eslabones) opcional; priorizar **no** romper rendimiento en TV Box. Empezar por poses objetivo interpoladas (manos delante al hablar, etc.).
6. **Transiciones:** si se introducen `AnimationClip` externos, usar **AnimationMixer** + crossfade; si no hay clips, mantener capas procedurales con límites de velocidad angular.
7. **Eliminar T-pose:** seguir reforzando `applyRestPose` al cargar + primer frame estable antes de mostrar.

### 2.3 Criterios de aceptación P1

- [ ] Sin T-pose visible al cargar VRM del usuario (salvo modelo roto en origen).
- [ ] Idle distingible de `LISTENING` / `THINKING` / `TALKING` solo por cuerpo (no solo UI).
- [ ] FPS razonable en 1024×600 portrait en hardware objetivo (medir en DevTools / overlay opcional de FPS en debug).

---

## 3. Pipeline gratuito del .VRM (instrucciones para el usuario final)

### 3.1 Herramientas

- **Blender 4.2+** (gratis): [https://www.blender.org](https://www.blender.org)
- **VRM Add-on for Blender** (gratis): instalar desde preferencias → Add-ons → Community o release oficial del add-on.

### 3.2 Pasos recomendados (resumen)

1. Instalar add-on VRM; reiniciar Blender.
2. **Importar** el `.vrm` del usuario (File → Import → VRM).
3. Revisar **esqueleto**: nombres de huesos compatibles con VRM 0.x/1.x; corregir escalas raras (0.01 vs 1).
4. **Spring bones** (pelo, cola, ropa): en el add-on / panel VRM Spring Bone; ajustar stiffness y drag conservadores para web.
5. **Shape keys / visemas:** comprobar presets estándar (A, I, U, E, O, Blink…).
6. **Exportar** de nuevo como `.vrm` (validar en [VRM validator](https://vrm.dev/) si hay errores).
7. **Opcional Mixamo:** animación FBX → retarget al esqueleto humano compatible; bake a NLA; export solo si el flujo del add-on lo soporta sin romper el rig VRM (si no, mantener animación procedural en web).

### 3.3 Hosting del modelo

- Subir `.vrm` a `public/` del repo o CDN; configurar `cfg-vrm` / lista `VRM_FILES` según el patrón actual del proyecto.

---

## 4. Integración técnica (archivos tocados)

| Área | Archivos típicos |
|------|-------------------|
| Voz / wake / STT | `ava.html` |
| Contexto LLM / extras tiempo real | `api/chat.js` |
| STT servidor | `api/stt-deepgram.js`, env `DEEPGRAM_API_KEY` |
| TTS | `api/tts-*.js` (afinación por avatar índice) |
| Rutas | `vercel.json` |

**Arquitectura:** mantener **un HTML principal** servido como estático; nuevas librerías 3D solo vía CDN ya usado o con justificación (peso en TV Box).

---

## 5. Extras “máxima vida” (prioridad P2–P3)

### 5.1 Contexto en tiempo real (`api/chat.js`)

Ya existen: clima (Open-Meteo), citas (ZenQuotes), datos curiosos, etc. **Añadir sin inflar latencia:**

- **Hora local / día de la semana** (timezone fijo configurable o `Intl.DateTimeFormat` con TZ por env o por usuario).
- **Día festivo** opcional: API pública ligera o tabla estática por país (sin API key si es posible).
- **Frase motivacional random** (solo si el usuario no pidió otro tema; evitar spam en cada mensaje).

Implementación: funciones async ya encadenadas en el handler; **timeouts cortos** y fallback vacío si falla la red.

### 5.2 TTS por avatar

- Ya hay cadena multi-proveedor en cliente; **mapear** `avatarIndex` → voz/preferencia en backend cuando aplique.
- Mantener **límites de longitud** de texto para TTS.

### 5.3 Memoria persistente

- Ya hay campo memoria en config + `localStorage`; el system prompt en `chat.js` ya menciona bloques `[Memoria persistente…]`.
- “Iniciativas pequeñas”: solo con prompts claros y **sin** bucles de llamadas no solicitadas (coste + UX).

---

## 6. Orden de implementación recomendado

1. **P0** — Voz hands-free robusta (Web Speech + Deepgram + flujo continuo + permisos documentados).
2. **P1** — Animación VRM (lookAt autónomo en TV, parpadeo, respiración, boca, anti T-pose).
3. **P2** — Extras de contexto en `chat.js` (hora, festivo opcional, motivación acotada).
4. **P3** — IK avanzado / spring bones finos / clips Mixamo si el presupuesto de tiempo y rendimiento lo permiten.

---

## 7. Entregables al cerrar el trabajo

1. **Lista de cambios** (archivos + comportamiento).
2. **Instrucciones al usuario** para Blender/export VRM (pueden ser las de la §3).
3. **Mensaje de commit sugerido** (ver §8).
4. **URL de despliegue** Vercel tras `vercel deploy` o push a `main` con integración CI.

---

## 8. Mensaje de commit sugerido (plantilla)

```
feat(ava): hands-free STT fallback + VRM animation polish + context hints

- Route wake/listen through Deepgram when Web Speech is unavailable
- Harden continuous voice loop and exit phrases
- Improve VRM idle/lookAt/blink; document Blender VRM pipeline
- Optional time/motivation context in chat API
```

(Ajustar al diff real.)

---

## 9. Pruebas mínimas (matriz)

| Caso | Chrome Windows | Firefox Windows | Chrome Android TV |
|------|----------------|-----------------|-------------------|
| Wake “AVA” | ✓ | ✓ (Deepgram) | ✓ / fallback |
| Conversación 3 turnos | ✓ | ✓ | ✓ |
| Salida por “para” | ✓ | ✓ | ✓ |
| Sin `DEEPGRAM_API_KEY` en Firefox | Mensaje claro | | |

---

## 10. Lo que este documento NO pide hacer

- Sustituir Three.js por otro motor “por filosofía” sin ganancia medible en TV Box.
- Prometer **paridad legal** con assets comerciales de Razer (marcas y personajes son propiedad de terceros).
- Garantizar **cero** interacción física en **todos** los dispositivos: depende del SO y del navegador; la implementación debe minimizar fricción y ser honesta en UI.

---

## 11. Instrucción final para la IA implementadora

1. Analiza el repo según la §0.
2. Implementa y verifica **P0** con logs y pruebas en al menos **Chrome** y **Firefox**.
3. Mejora **P1** de forma incremental; no bloquear el merge por IK perfecto si ya hay ganancia visible en idle/lookAt/boca.
4. Añade extras de **§5** solo si no degradan latencia percibida.
5. Entrega la §7 al dueño del repo.

**Meta:** experiencia “impresionante” y estable, con expectativas alineadas a la web abierta y al hardware real (TV Box, vitrina, mic BT).
