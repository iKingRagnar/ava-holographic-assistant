# AVA - Asistente Holográfico de Escritorio

**Raíz del proyecto:** todo el código y `public/*.vrm` viven en la carpeta **`Holograma_AI`** (por ejemplo `C:\Users\ragna\Downloads\Holograma_AI`). Abre esa carpeta en el editor y despliega desde ahí; no mezcles con otros repos.

![AVA](https://img.shields.io/badge/AVA-Holographic%20Assistant-00ff9d?style=for-the-badge&logo=three.js&logoColor=white)

Un asistente virtual holográfico inspirado en **Razer Project AVA**, diseñado para ejecutarse en un Google TV Box conectado a un monitor de 7" IPS en modo portrait, dentro de una vitrina acrílica transparente con efecto holográfico.

## ✨ Características

- 🤖 **Avatar 3D Holográfico** - Modelo 3D animado con Three.js
- 🎙️ **Voz Natural** - Web Speech API para entrada y salida de voz (es-MX)
- 🧠 **IA Conectada** - Integración con OpenRouter/Claude/GPT vía API configurable
- 📱 **Optimizado para TV** - Touch-friendly, botones grandes, sin hover effects
- 🎨 **Efectos Visuales** - Partículas, scan lines, anillo base pulsatil
- 💾 **Configuración Persistente** - localStorage para URL de API y system prompt

## 🛠️ Stack Tecnológico

| Componente | Tecnología |
|------------|------------|
| Frontend | HTML5 + CSS3 + Vanilla JS |
| 3D Engine | Three.js r134 + `@pixiv/three-vrm` 0.6 (VRM en `public/`) |
| Speech Recognition | Web Speech API nativa |
| Speech Synthesis | Web Speech Synthesis API |
| Backend AI | Fetch POST a endpoint configurable |

## 📋 Requisitos de Hardware

- Monitor 7" IPS (1024x600) en modo **PORTRAIT**
- Google TV Box / Android TV con Chrome
- Webcam USB
- Bocina Bluetooth con micrófono
- Vitrina acrílica 12x12x24 cm con fondo negro
- Tira LED RGB en la base (opcional)

## 🚀 Repositorio

**GitHub:** https://github.com/iKingRagnar/ava-holographic-assistant

## 📦 Instalación

### 1. Deploy en Vercel (Frontend + Backend)

El proyecto incluye:
- `ava.html` - Aplicación estática (frontend)
- `api/chat.js` - Endpoint para OpenRouter (backend)

Este es un proyecto estático, puedes deployarlo directamente:

```bash
# El archivo ava.html es completamente estático
# Solo súbelo a Vercel como proyecto Static
```

### 2. Configurar Backend (Opción OpenRouter)

Crea un archivo `api/chat.js` en tu proyecto Vercel:

```javascript
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, system } = req.body;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://tu-dominio.vercel.app',
        'X-Title': 'AVA Assistant'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: [
          { role: 'system', content: system },
          ...messages
        ]
      })
    });

    const data = await response.json();
    res.json({ 
      message: data.choices?.[0]?.message?.content || 'Sin respuesta' 
    });
  } catch (error) {
    res.status(500).json({ message: 'Error conectando con IA' });
  }
}
```

**Variables de entorno en Vercel:**

- `INWORLD_API_KEY` — credencial Basic de Inworld (TTS en `/api/tts` y chat en `/api/chat` si no hay Ollama). Ver `.env.example`.
- Opcional: `OLLAMA_URL` si usas Ollama local como primera opción en el servidor.

```
OPENROUTER_KEY=sk-or-v1-xxxxxxxxxxxxxxxx
```

### 3. Configuración Inicial

1. Abre `ava.html` en Chrome del Google TV Box
2. En el overlay de configuración ingresa:
   - **URL del Endpoint:** `https://tu-proyecto.vercel.app/api/chat`
   - **System Prompt:** Personaliza la personalidad de AVA
3. Click en **"ACTIVAR AVA"**

## 🎮 Controles

| Acción | Método |
|--------|--------|
| Activar micrófono | Tocar botón circular o presionar **ESPACIO** |
| Detener speech | Tocar botón mientras habla |
| Reset configuración | **Ctrl + R** |

## 🎨 Personalización

### Cambiar colores holográficos

Edita las variables CSS en `<style>`:
```css
/* Color principal holográfico */
--holo-color: #00ff9d;  /* Verde */
--holo-blue: #00aaff;   /* Azul */
```

### Usar modelo Ready Player Me

En la función `createAvatar()`, reemplaza la geometría placeholder con:
```javascript
const loader = new THREE.GLTFLoader();
loader.load('https://models.readyplayer.me/YOUR_MODEL.glb', (gltf) => {
    avatar = gltf.scene;
    // Aplicar materiales holográficos
});
```

## 📱 Optimizaciones para TV Box

- ✅ Touch events (no solo mouse)
- ✅ Botones mínimo 80px
- ✅ Sin hover effects
- ✅ Carga rápida desde CDN
- ✅ Sin dependencias npm

## 🖼️ Vista Previa

![AVA Interface](https://via.placeholder.com/600x1024/000000/00ff9d?text=AVA+Holographic+Interface)

## 📄 Licencia

MIT License - Libre para uso personal y comercial.

---

**Hecho con 💚 y Three.js**
