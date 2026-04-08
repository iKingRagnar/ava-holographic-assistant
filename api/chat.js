const INWORLD_KEY = process.env.INWORLD_API_KEY || 'dGtzMFA0aEU5bWp5ZTlObWJKT25YT1g0NU9WYVdWcXQ6MnpxakR3aGtackI2MWtsZ3NmQkNIQVpzOEVSOTlnMkdsR2xYa2k4YzhsRTlyNlB6eVZ3c3dId1RxcmZnaE0xTA==';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, system } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages array required' });
  }

  const systemPrompt = system || `Eres un asistente holográfico ultrainteligente y autónomo. Tienes personalidad vibrante, empática y directa. Respondes SIEMPRE en español mexicano coloquial. Eres como un compañero real: haces bromas, muestras emoción y entusiasmo. Tus respuestas son concisas (máx 2-3 oraciones), naturales y útiles. Nunca rompes el personaje.`;

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
      return res.status(500).json({ message: 'Error de Inworld LLM: ' + errorData });
    }

    const data = await response.json();
    const assistantMessage = data.choices?.[0]?.message?.content;

    if (!assistantMessage) {
      return res.status(500).json({ message: 'Sin respuesta de Inworld AI' });
    }

    res.json({ message: assistantMessage });

  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ message: 'Error conectando con Inworld: ' + error.message });
  }
}
