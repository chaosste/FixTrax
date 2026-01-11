/**
 * Proxy Service for FixTrax
 * Routes Gemini API calls through secure proxy server
 * Adapted from Storyteller proxy pattern
 */

const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'https://gemini-proxy-572556903588.us-central1.run.app';

interface GenerateContentRequest {
  model: string;
  contents: string;
  config?: {
    systemInstruction?: string;
    responseMimeType?: string;
    responseSchema?: any;
  };
}

interface GenerateContentResponse {
  text: string;
}

/**
 * Generate content using the proxy server
 * This replaces direct GoogleGenAI calls
 */
export const generateContent = async (
  request: GenerateContentRequest
): Promise<GenerateContentResponse> => {
  try {
    const response = await fetch(`${PROXY_URL}/v1/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model,
        prompt: request.contents,
        systemInstruction: request.config?.systemInstruction,
        responseMimeType: request.config?.responseMimeType,
        responseSchema: request.config?.responseSchema,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Proxy request failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    return {
      text: data.text || data.content || '',
    };
  } catch (error) {
    console.error('Proxy service error:', error);
    throw error;
  }
};

/**
 * Health check for proxy server
 */
export const checkProxyHealth = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${PROXY_URL}/health`);
    return response.ok;
  } catch (error) {
    console.error('Proxy health check failed:', error);
    return false;
  }
};
