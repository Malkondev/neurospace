import express from "express";
import cors from "cors";
import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const app = express();
const port = Number(process.env.PORT || 8787);
const modelPadrao = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const DAILY_LIMIT = Math.max(1, Number(process.env.OROBOROS_DAILY_LIMIT || 20));
const MINUTE_LIMIT = Math.max(1, Number(process.env.OROBOROS_MINUTE_LIMIT || 3));

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

const historicoChamadas = [];
let chamadasHoje = 0;
let diaAtual = new Date().toISOString().slice(0, 10);

function atualizarDia() {
  const hoje = new Date().toISOString().slice(0, 10);
  if (hoje !== diaAtual) {
    diaAtual = hoje;
    chamadasHoje = 0;
    historicoChamadas.length = 0;
  }
}

function verificarLimite(res) {
  atualizarDia();
  const agora = Date.now();
  while (historicoChamadas.length && agora - historicoChamadas[0] >= 60_000) {
    historicoChamadas.shift();
  }

  if (chamadasHoje >= DAILY_LIMIT) {
    res.setHeader("Retry-After", "86400");
    res.setHeader("X-Oroboros-Daily-Limit", String(DAILY_LIMIT));
    return `Limite diário local do Oroboros atingido (${DAILY_LIMIT} usos). Você poderá usar novamente amanhã.`;
  }

  if (historicoChamadas.length >= MINUTE_LIMIT) {
    const espera = Math.max(1, Math.ceil((60_000 - (agora - historicoChamadas[0])) / 1000));
    res.setHeader("Retry-After", String(espera));
    res.setHeader("X-Oroboros-Minute-Limit", String(MINUTE_LIMIT));
    return `Aguarde ${espera}s antes de usar o Oroboros novamente.`;
  }

  return null;
}

function registrarChamada() {
  atualizarDia();
  chamadasHoje += 1;
  historicoChamadas.push(Date.now());
}

function escaparHtml(texto) {
  return String(texto || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizarHTML(texto) {
  const limpo = String(texto || "")
    .replace(/^```(?:html)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  if (!limpo) return "";

  // Se a IA devolver HTML de verdade, preserva o fragmento.
  if (/<(?:h[1-3]|p|strong|em|u|s|blockquote|ul|ol|li|br|code|pre)\b/i.test(limpo)) {
    return limpo;
  }

  // Fallback: transforma uma resposta textual em HTML sem inventar conteúdo.
  const blocos = limpo
    .split(/\n\s*\n+/)
    .map(bloco => bloco.trim())
    .filter(Boolean);

  const linhas = blocos.length ? blocos : limpo.split(/\n+/).map(l => l.trim()).filter(Boolean);
  return linhas.map(linha => `<p>${escaparHtml(linha)}</p>`).join("\n");
}

app.use(cors({ origin: true }));
app.use(express.json({ limit: "64kb" }));

app.get("/api/oroboros", (_req, res) => {
  atualizarDia();
  res.json({
    name: "Oroboros",
    version: "7.0",
    provider: "Gemini",
    model: modelPadrao,
    status: "online",
    dailyLimit: DAILY_LIMIT,
    dailyUsed: chamadasHoje,
    minuteLimit: MINUTE_LIMIT
  });
});

app.post("/api/oroboros", async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY não configurada no backend. Verifique as variáveis de ambiente." });
    }

    const limite = verificarLimite(res);
    if (limite) return res.status(429).json({ error: limite, dailyUsed: chamadasHoje, dailyLimit: DAILY_LIMIT });

    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!text) return res.status(400).json({ error: "Envie algum texto para o Oroboros." });
    if (text.length > 30000) return res.status(413).json({ error: "O texto é grande demais para uma única organização." });

    registrarChamada();

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: modelPadrao,
      contents: text,
      config: {
        systemInstruction: OROBOROS_INSTRUCTIONS,
        maxOutputTokens: 4000
      }
    });

    const html = normalizarHTML(response.text);
    if (!html) return res.status(502).json({ error: "A IA não retornou conteúdo." });

    res.setHeader("X-Oroboros-Daily-Limit", String(DAILY_LIMIT));
    res.setHeader("X-Oroboros-Daily-Used", String(chamadasHoje));
    res.json({ html, model: modelPadrao, dailyUsed: chamadasHoje, dailyLimit: DAILY_LIMIT });
  } catch (error) {
    console.error("Oroboros/Gemini:", error);
    const message = error?.message || "Falha ao processar o texto com o Oroboros.";
    res.status(500).json({ error: message });
  }
});

app.listen(port, "0.0.0.0", () => console.log(`Oroboros 7.0 + Gemini ativo na porta ${port}`));
