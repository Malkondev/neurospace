# Oroboros — NeuroSpace 7.0 + Gemini

Oroboros é o editor cognitivo do NeuroSpace: recebe texto escrito ou transcrito pelo Pense-Alto e devolve HTML semântico para revisão antes de aplicar.

## Testar no VS Code

1. Instale Node.js 18+ (Node.js 20+ é recomendado).
2. Abra este projeto no terminal.
3. Execute `npm install`.
4. Copie `.env.example` para `.env`.
5. Abra `.env` e coloque sua chave do Gemini em `GEMINI_API_KEY`.
6. Não coloque a chave no `script.js`, `oroboros-config.js` ou no GitHub.
7. Execute `npm run start:oroboros`.
8. Abra o NeuroSpace por um servidor local, por exemplo a extensão Live Server do VS Code.
9. O `oroboros-config.js` aponta para `http://localhost:8787/api/oroboros`.

## Variáveis

```env
GEMINI_API_KEY=sua_chave_aqui
GEMINI_MODEL=gemini-3.8-flash
PORT=8787
```

## GitHub Pages

O GitHub Pages hospeda somente o frontend. A chave do Gemini deve permanecer em um backend/serverless seguro. A função `api/oroboros.js` está preparada para um ambiente serverless que disponibilize `GEMINI_API_KEY` como variável de ambiente.

Depois de publicar o backend, altere `oroboros-config.js` para a URL HTTPS do backend. Nunca publique `.env`.

## Comportamento da IA

Oroboros deve preservar a ideia do autor, corrigir somente problemas linguísticos claros, organizar títulos/parágrafos/listas e devolver somente HTML. Ele não deve completar pensamentos, inventar argumentos, pesquisar ou transformar hipóteses em fatos.
