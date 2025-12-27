
import { GoogleGenAI, Type } from "@google/genai";
import { AudioSettings } from "../types";

export const analyzeTrackWithAI = async (trackName: string): Promise<Partial<AudioSettings>> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Analyze this vinyl-derived audio track metadata: "${trackName}".
    Provide optimal restoration parameters to:
    1. Minimize hiss and crackle without muffling.
    2. Recover transients for a modern sound.
    3. Revive high-frequency clarity and sub-bass energy if appropriate.
    4. Detect likely noise profile based on title/artist hints (e.g., live vs studio).
    
    Return the response as a JSON object matching this exact structure:
    {
      "hissSuppression": 0-100,
      "crackleSuppression": 0-100,
      "clickSensitivity": 0-100,
      "transientRecovery": 0-100,
      "bassBoost": -5 to 8,
      "midGain": -2 to 2,
      "airGain": 0 to 12,
      "warmth": 0 to 45,
      "aiInsight": "A short 1-sentence technical observation about this track's profile"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    return JSON.parse(response.text.trim());
  } catch (error) {
    console.error("AI Analysis failed:", error);
    return {
      hissSuppression: 20,
      crackleSuppression: 15,
      transientRecovery: 30,
      bassBoost: 2,
      airGain: 4,
      aiInsight: "Standard vinyl restoration profile applied."
    };
  }
};
