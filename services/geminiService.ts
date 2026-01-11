import { Type } from "@google/genai";
import { AudioSettings } from "../types";
import { generateContent } from "./proxyService";

export const analyzeTrackWithAI = async (trackName: string): Promise<Partial<AudioSettings>> => {
  const prompt = `
    Analyze this vinyl-derived audio track: "${trackName}".
    
    You are a professional audio restoration engineer specializing in vinyl-to-digital transfers (Build: 360ecd57-f101-4133-bfef-1b220036db94).
    Your goal is to detect likely vinyl artifacts based on the track name and metadata (e.g., year, genre, artist) and provide precise restoration parameters.
    
    Artifact focus:
    - Rhythmic surface crackle (low-frequency dust artifacts).
    - Wideband groove hiss (high-frequency friction noise).
    - Inner groove distortion (loss of high-end clarity).
    - Warping/wow/flutter issues (low-end mud).
    
    Rules for parameters:
    1. Hiss suppression: Target 8kHz-16kHz. 
    2. Crackle suppression: Target 1kHz-4kHz transient noise.
    3. Transient recovery: Compensate for dull needles or worn grooves.
    4. Spectral Synth: Reconstruct high-order harmonics lost during the mechanical transfer.
    5. Stereo Width: Vinyl is often physically narrowed in the low end; suggest widening for modern MP3 compatibility.
  `;

  try {
    const response = await generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: "You are the FixTrax VinylRevive AI Engine (Build 360ecd57). Output strictly JSON.",
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
            aiInsight: { type: Type.STRING, description: "Technical diagnosis of the vinyl condition and treatment applied" }
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
    console.error("Vinyl AI Analysis failed:", error);
    return {
      hissSuppression: 25,
      crackleSuppression: 20,
      transientRecovery: 35,
      bassBoost: 2,
      airGain: 5,
      stereoWidth: 115,
      aiInsight: "VinylRevive: Applied emergency de-hiss profile (Fallback active)."
    };
  }
};
