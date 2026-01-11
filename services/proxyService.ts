const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'https://gemini-proxy-572556903588.us-central1.run.app';

export const generateContent = async (request: any): Promise<any> => {
  const response = await fetch(`${PROXY_URL}/v1/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: request.model,
      prompt: request.contents,
      systemInstruction: request.config?.systemInstruction,
      responseMimeType: request.config?.responseMimeType,
      responseSchema: request.config?.responseSchema,
    }),
  });

  if (!response.ok) throw new Error(`Proxy failed: ${response.status}`);
  const data = await response.json();
  return { text: data.text || data.content || '' };
};
