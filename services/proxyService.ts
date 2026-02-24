const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'https://gemini-proxy-572556903588.us-central1.run.app';
const PROXY_TIMEOUT_MS = Number(import.meta.env.VITE_PROXY_TIMEOUT_MS || 20000);

export const generateContent = async (request: any): Promise<any> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

  try {
    const response = await fetch(`${PROXY_URL}/v1/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: request.model,
        prompt: request.contents,
        systemInstruction: request.config?.systemInstruction,
        responseMimeType: request.config?.responseMimeType,
        responseSchema: request.config?.responseSchema,
      }),
    });

    if (!response.ok) {
      const responseBody = await response.text().catch(() => '');
      throw new Error(`Proxy failed: ${response.status}${responseBody ? ` - ${responseBody}` : ''}`);
    }

    const data = await response.json();
    return { text: data.text || data.content || '' };
  } finally {
    clearTimeout(timeoutId);
  }
};
