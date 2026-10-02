import { GoogleGenAI } from "@google/genai";

const INSTRUCTIONS = `Você é Oroboros, o editor cognitivo do NeuroSpace 7.0.
Sua função NÃO é criar pensamentos para o usuário. Sua função é transformar o texto fornecido em HTML semântico, claro e agradável para um caderno de estudos.
Preserve o sentido, a intenção, as dúvidas e a voz do autor.
Não invente fatos, argumentos, exemplos, citações, referências, conclusões ou pensamentos.
Não pesquise nem complemente o texto com conhecimento externo.
Pode corrigir ortografia, pontuação e concordância quando isso não mudar o sentido.
Use apenas h1, h2, h3, p, strong, em, blockquote, ul, ol, li, br, code e pre quando fizer sentido.
Crie títulos somente quando houver uma ideia clara no próprio texto.
Não transforme hipóteses ou opiniões em fatos.
Retorne somente o fragmento HTML, sem markdown, crases, comentários, scripts, estilos inline, iframes ou formulários.`;

function clean(value) {
  return String(value || "").replace(/^```(?:html)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });

  try {
    if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "GEMINI_API_KEY não configurada." });
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    if (!text) return res.status(400).json({ error: "Envie algum texto." });
    if (text.length > 30000) return res.status(413).json({ error: "Texto grande demais." });

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model,
      contents: text,
      config: {
        systemInstruction: INSTRUCTIONS,
        maxOutputTokens: 4000
      }
    });
    const html = clean(response.text);
    return res.status(200).json({ html, model });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error?.message || "Falha ao processar o texto com o Oroboros." });
  }
}
