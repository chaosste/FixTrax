
import { GoogleGenAI, Type } from "@google/genai";
import { AudioSettings } from "../types";

export const analyzeTrackWithAI = async (trackName: string): Promise<Partial<AudioSettings>> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Analyze this vinyl-derived audio track metadata: "${trackName}".
    Your goal is to provide parameters that make it sound like a modern commercial MP3 (e.g., Serge Santiago - Love is a Feeling style).
    
    Rules for parameters:
    1. Minimize hiss and crackle transparently.
    2. Revive transients and clarity in the high-end.
    3. Ensure balanced sub-bass without mud.
    4. Provide a De-Reverb value if the track likely has room resonance.
    5. Suggest a Stereo Width expansion (100-150) for a wider, modern stage.
    6. Keep warmth conservative (under 30) to avoid digital distortion.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
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
            deReverb: { type: Type.NUMBER, description: "Room reverb suppression (0 to 60)" },
            stereoWidth: { type: Type.NUMBER, description: "Stereo expansion factor (50 to 180)" },
            aiInsight: { type: Type.STRING, description: "A technical observation about why these settings match a modern master" }
          },
          required: [
            "hissSuppression", "crackleSuppression", "clickSensitivity", 
            "transientRecovery", "bassBoost", "midGain", "airGain", 
            "warmth", "deReverb", "stereoWidth", "aiInsight"
          ]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from AI");
    return JSON.parse(text.trim());
  } catch (error) {
    console.error("AI Analysis failed:", error);
    return {
      hissSuppression: 20,
      crackleSuppression: 15,
      transientRecovery: 30,
      bassBoost: 3,
      airGain: 4,
      deReverb: 0,
      stereoWidth: 110,
      warmth: 15,
      aiInsight: "Applied a clean modern-conversion profile as fallback."
    };
  }
};
