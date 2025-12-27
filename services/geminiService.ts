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
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        // Fix: Use responseSchema to ensure predictable JSON structure
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            hissSuppression: { type: Type.NUMBER, description: "Hiss suppression level (0-100)" },
            crackleSuppression: { type: Type.NUMBER, description: "Crackle suppression level (0-100)" },
            clickSensitivity: { type: Type.NUMBER, description: "Click filter sensitivity (0-100)" },
            transientRecovery: { type: Type.NUMBER, description: "Transient recovery level (0-100)" },
            bassBoost: { type: Type.NUMBER, description: "Bass boost gain (-5 to 8 dB)" },
            midGain: { type: Type.NUMBER, description: "Midrange gain (-2 to 2 dB)" },
            airGain: { type: Type.NUMBER, description: "High frequency air gain (0 to 12 dB)" },
            warmth: { type: Type.NUMBER, description: "Saturation warmth amount (0 to 45)" },
            aiInsight: { type: Type.STRING, description: "A technical observation about the track profile" }
          },
          required: [
            "hissSuppression", "crackleSuppression", "clickSensitivity", 
            "transientRecovery", "bassBoost", "midGain", "airGain", 
            "warmth", "aiInsight"
          ]
        }
      }
    });

    // Fix: access response.text directly as a property
    const text = response.text;
    if (!text) throw new Error("Empty response from AI");
    return JSON.parse(text.trim());
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