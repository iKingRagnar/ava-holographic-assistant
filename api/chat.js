const INWORLD_KEY = process.env.INWORLD_API_KEY;
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, system } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages array required' });
  }

  const systemPrompt =
    system ||
    `Eres AVA, asistente holográfica experta en TI, BI y datos. Español claro y profesional. Respuestas breves (voz: 2–4 oraciones) salvo que pidan detalle. No inventes datos: aclara supuestos. Objetivo: siguiente paso útil para el usuario.`;

  // --- Intentar Ollama primero (gratis, local) ---
  try {
    const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content || '';
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.1:8b',
        prompt: `${systemPrompt}\n\nUsuario: ${lastUserMsg}\nAVA:`,
        stream: false,
        options: { temperature: 0.8, num_predict: 180 }
      })
    });

    if (response.ok) {
      const data = await response.json();
      const text = data.response?.trim();
      if (text) {
        console.log('Ollama response:', text.substring(0, 50));
        return res.json({ message: text, source: 'ollama' });
      }
    }
  } catch (e) {
    console.log('Ollama no disponible, usando Inworld fallback:', e.message);
  }

  // --- Fallback a Inworld LLM Router ---
  if (!INWORLD_KEY) {
    return res.status(503).json({
      message:
        'Configura INWORLD_API_KEY en Vercel (o ejecuta Ollama local con OLLAMA_URL).',
      source: 'none'
    });
  }

  try {
    const response = await fetch('https://api.inworld.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${INWORLD_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'inworld/compare-frontier-models',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        temperature: 0.85,
        max_tokens: 180
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Inworld LLM error:', errorData);
      return res.status(500).json({ message: 'Error de LLM: ' + errorData });
    }

    const data = await response.json();
    const assistantMessage = data.choices?.[0]?.message?.content;

    if (!assistantMessage) {
      return res.status(500).json({ message: 'Sin respuesta de IA' });
    }

    res.json({ message: assistantMessage, source: 'inworld' });

  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ message: 'Error conectando con IA: ' + error.message });
  }
}
