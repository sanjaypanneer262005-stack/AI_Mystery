import { GoogleGenAI } from '@google/genai'; import { env } from '../config/env.js';
export class GeminiService {
 private client = env.MOCK_AI ? null : new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
 async json<T>(prompt: string, schema: unknown, fast = false): Promise<T> {
  if (!this.client) throw new Error('Live Gemini is disabled.');
  const model = fast ? env.GEMINI_FAST_MODEL! : env.GEMINI_TEXT_MODEL!;
  const response = await this.client.models.generateContent({ model, contents: prompt, config: { responseMimeType: 'application/json', responseSchema: schema as any, httpOptions: { timeout: 60_000 } } });
  if (!response.text) throw new Error('Gemini returned an empty response.'); return JSON.parse(response.text) as T;
 }
}
export const gemini = new GeminiService();
