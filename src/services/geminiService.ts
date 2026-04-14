import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

export const getGeminiResponse = async (prompt: string, context?: string) => {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const systemInstruction = `
    You are an intelligent assistant integrated into a modern dashboard.
    The dashboard provides real-time news, weather, and personal notifications.
    Your goal is to provide helpful insights, summarize news, or answer questions based on the user's dashboard data.
    
    Current Context:
    ${context || "No specific context provided."}
    
    Keep your responses concise, helpful, and professional. Use markdown for formatting.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction,
      },
    });

    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
