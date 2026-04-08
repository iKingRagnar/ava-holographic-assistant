export default async function handler(req, res) {
  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, system } = req.body;

  // Validar que tenemos messages
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages array required' });
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://ava-holographic-assistant.vercel.app',
        'X-Title': 'AVA Holographic Assistant'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: [
          { role: 'system', content: system || 'Eres AVA, una asistente holográfica inteligente.' },
          ...messages
        ],
        temperature: 0.7,
        max_tokens: 150
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenRouter error:', errorData);
      return res.status(500).json({ 
        message: 'Error de OpenRouter: ' + (errorData.error?.message || 'Unknown error')
      });
    }

    const data = await response.json();
    
    const assistantMessage = data.choices?.[0]?.message?.content;
    
    if (!assistantMessage) {
      return res.status(500).json({ message: 'No response from AI' });
    }

    // Responder en formato que AVA espera
    res.json({ message: assistantMessage });

  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ message: 'Error conectando con IA: ' + error.message });
  }
}
