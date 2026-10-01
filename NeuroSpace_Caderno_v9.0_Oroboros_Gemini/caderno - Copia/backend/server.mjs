import express from "express";
import cors from "cors";
import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const app = express();
const port = Number(process.env.PORT || 8787);
const modelPadrao = process.env.GEMINI_MODEL || "gemini-3.8-flash";

const OROBOROS_INSTRUCTIONS = `Você é Oroboros, o editor cognitivo do NeuroSpace 7.0.

Sua função NÃO é criar pensamentos para o usuário. Sua função é transformar o texto que ele forneceu em HTML semântico, claro e agradável para um caderno de estudos.

REGRAS ABSOLUTAS:
1. Preserve o sentido, a intenção, as dúvidas e a voz do autor.
2. Não invente fatos, argumentos, exemplos, citações, referências, conclusões ou pensamentos que não estejam no texto.
3. Não pesquise e não complemente o conteúdo com conhecimento externo.
4. Você pode corrigir erros evidentes de ortografia, pontuação e concordância quando isso não alterar o sentido.
5. Organize o texto em elementos HTML semânticos: h1, h2, h3, p, strong, em, blockquote, ul, ol, li, br, code e pre quando fizer sentido.
6. Crie títulos apenas quando o próprio texto fornecer uma ideia clara para um título. Se não houver título evidente, não invente um.
7. Não transforme uma opinião ou hipótese do autor em fato.
8. Não acrescente introdução, conclusão ou explicação sobre o que você fez.
9. Retorne SOMENTE o fragmento HTML, sem markdown, sem crases e sem comentários.
10. Não inclua scripts, estilos inline, iframes, formulários ou atributos HTML.

O objetivo é: pensar livremente -> Oroboros organiza -> usuário revisa -> usuário decide aplicar.`;

function limparSaida(texto) {
  return String(texto || "")
    .replace(/^```(?:html)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

app.use(cors({ origin: true }));
app.use(express.json({ limit: "64kb" }));

app.get("/api/oroboros", (_req, res) => {
  res.json({ name: "Oroboros", version: "7.0", provider: "Gemini", model: modelPadrao, status: "online" });
});

app.post("/api/oroboros", async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY não configurada no backend. Verifique seu arquivo .env." });
    }

    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    const requestedModel = typeof req.body?.model === "string" ? req.body.model.trim() : "";
    const model = requestedModel.startsWith("gemini-") ? requestedModel : modelPadrao;

    if (!text) return res.status(400).json({ error: "Envie algum texto para o Oroboros." });
    if (text.length > 30000) return res.status(413).json({ error: "O texto é grande demais para uma única organização." });

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model,
      contents: text,
      config: {
        systemInstruction: OROBOROS_INSTRUCTIONS,
        temperature: 0.2,
        maxOutputTokens: 4000
      }
    });

    const html = limparSaida(response.text);
    if (!html) return res.status(502).json({ error: "A IA não retornou conteúdo." });

    res.json({ html, model });
  } catch (error) {
    console.error("Oroboros/Gemini:", error);
    const message = error?.message || "Falha ao processar o texto com o Oroboros.";
    res.status(500).json({ error: message });
  }
});

app.listen(port, () => console.log(`Oroboros 7.0 + Gemini ativo em http://localhost:${port}`));
