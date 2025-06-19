export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not set' });
  }

  // --- Start of OpenAI compatibility logic ---
  // This part makes our function understand requests from SillyTavern's "OpenAI Compatible" mode.
  // We need to transform the request and response to match what OpenAI API expects.

  // 1. Check if the incoming request is in OpenAI format.
  // A simple check is to see if req.body.messages exists.
  if (req.body.messages) {
    // 2. Transform the OpenAI-style request to a Google Gemini-style request.
    const googleReqBody = {
      contents: req.body.messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : msg.role,
        parts: [{ text: msg.content }],
      })),
      // We can also pass generationConfig, safetySettings etc. if needed
      // generationConfig: req.body.generationConfig || {},
    };

    // 3. The real API URL for Google Gemini
    const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;

    try {
      // 4. Send the transformed request to Google
      const geminiResponse = await fetch(geminiApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(googleReqBody),
      });

      const geminiData = await geminiResponse.json();
      
      if(geminiData.error){
          return res.status(500).json(geminiData);
      }

      // 5. Transform the Google Gemini response back to OpenAI format
      const openAiResBody = {
        id: 'chatcmpl-' + Date.now(),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'gemini-pro', // We can pretend to be any model
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: geminiData.candidates[0].content.parts[0].text,
          },
          finish_reason: 'stop',
        }],
        usage: { // Usage data is not provided by Gemini, so we send placeholders
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        },
      };

      // 6. Send the transformed response back to SillyTavern
      return res.status(200).json(openAiResBody);

    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
  // --- End of OpenAI compatibility logic ---

  // Fallback for any other type of request (or if you want to support the old way)
  return res.status(400).json({ error: 'Unsupported request format. This endpoint is for OpenAI compatibility.' });
}
