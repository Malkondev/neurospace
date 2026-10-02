# Oroboros — configuração Gemini

## Modelo

O projeto usa por padrão `gemini-3.5-flash-lite`, modelo GA do Gemini otimizado para baixa latência e baixo custo.

## Variáveis de ambiente

```env
GEMINI_API_KEY=sua_chave
GEMINI_MODEL=gemini-3.5-flash-lite
OROBOROS_DAILY_LIMIT=20
OROBOROS_MINUTE_LIMIT=3
PORT=8787
```

## Proteção local

O backend limita o Oroboros a 20 chamadas por dia e 3 por minuto por processo, por padrão. O frontend também mantém um contador local de 20 usos por dia e um intervalo mínimo de 4 segundos entre chamadas.

Esses limites são uma proteção adicional do projeto e **não substituem** os limites oficiais da conta Gemini.

## Segurança

- Nunca coloque `GEMINI_API_KEY` no JavaScript público.
- Nunca faça commit do `.env`.
- No GitHub, publique apenas `.env.example`.
- Em produção, configure a chave nas variáveis de ambiente do backend.


## Teste de HTML
Oroboros agora possui duas visualizações do resultado:
- **Visual**: mostra o HTML renderizado.
- **HTML**: mostra o código HTML efetivamente gerado.

Mesmo que o modelo devolva texto puro, o sistema converte esse texto em parágrafos HTML como fallback, sem inventar conteúdo.


## Identidade visual
A página inicial e a identificação da interface usam NeuroSpace v9.0.1.
