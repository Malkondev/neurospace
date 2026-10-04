/* =========================================================
   NEUROSPACE - SCRIPT PRINCIPAL DE LÓGICA E INTERATIVIDADE
   ========================================================= */

// --- Estado Global da Aplicação ---
let memoriaCurtoPrazo = [];
let modoFocoAtivo = false;
let bionicAtivo = false;
let conteudoOriginal = "";
let analogiaFiltroAtual = 'todos';
let analogiaSelecionada = null;
let constelacaoEstado = null;

// Variáveis do Gerador de Ondas Binaurais
let audioCtx = null;
let oscLeft = null;
let oscRight = null;
let gainNode = null;
let isPlayingBinaural = false;

// Variáveis do Temporizador Ultradiano
let timerInterval = null;
let tempoRestante = 25 * 60;
let breathInterval = null;

// Pense-Alto — Web Speech API nativa
let reconhecimentoVoz = null;
let penseAltoAtivo = false;
let penseAltoBaseHTML = '';
let penseAltoFinalizado = '';

// Constelação — física 2D / massa cognitiva
let constelacaoResizeObserver = null;

/* ---------------------------------------------------------
   1. INICIALIZAÇÃO DA APLICAÇÃO
   --------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
    // Restaura tema salvo pelo utilizador
    const temaSalvo = localStorage.getItem('tema');
    const toggleTemaElem = document.getElementById('toggle-tema');
    
    if (temaSalvo === 'claro') {
        document.body.classList.add('modo-claro');
        if (toggleTemaElem) toggleTemaElem.checked = true;
    }

    localStorage.setItem('neuroSessoes', String(Number(localStorage.getItem('neuroSessoes') || 0) + 1));

    // Inicializa notas da Sinapse Rápida
    inicializarSinapse();
    inicializarPenseAlto();

    // Carrega a página inicial por padrão
    const botaoInicio = document.querySelector('[data-page="inicio"]');
    carregarPagina('inicio', botaoInicio);
    requestAnimationFrame(sincronizarSynapseDot);
});

document.addEventListener('click', e => { const b=e.target.closest('button'); if(!b || b.disabled) return; b.classList.remove('neuro-click'); void b.offsetWidth; b.classList.add('neuro-click'); });

/* ---------------------------------------------------------
   2. ALTERNADOR DE TEMA (ESCURO / CLARO)
   --------------------------------------------------------- */
function toggleTema() {
    const toggle = document.getElementById('toggle-tema');
    const eModoClaro = toggle ? toggle.checked : document.body.classList.contains('modo-claro');
    
    if (eModoClaro) {
        document.body.classList.add('modo-claro');
        localStorage.setItem('tema', 'claro');
    } else {
        document.body.classList.remove('modo-claro');
        localStorage.setItem('tema', 'escuro');
    }
}

function sincronizarSynapseDot() {
    const container = document.querySelector('.nav-buttons-container');
    const ativo = container?.querySelector('.nav-btn.ativo');
    const dot = document.getElementById('synapse-dot');

    if (!container || !ativo || !dot) return;

    const containerRect = container.getBoundingClientRect();
    const ativoRect = ativo.getBoundingClientRect();
    const centro = ativoRect.top - containerRect.top + (ativoRect.height / 2);

    dot.style.top = `${centro}px`;
}

window.addEventListener('resize', sincronizarSynapseDot);

/* ---------------------------------------------------------
   3. NAVEGAÇÃO E CARREGAMENTO DE PÁGINAS
   --------------------------------------------------------- */
async function carregarPagina(nomeArquivo, elementoBotao) {
    // Atualiza botão ativo na sidebar
    const botoes = document.querySelectorAll('.nav-btn');
    botoes.forEach(btn => btn.classList.remove('ativo'));

    if (elementoBotao) {
        elementoBotao.classList.add('ativo');
        
        // Mantém o ponto neon exatamente alinhado ao botão ativo.
        requestAnimationFrame(sincronizarSynapseDot);

        // Regista a página na memória de curto prazo.
        const pageId = elementoBotao.getAttribute('data-page') || nomeArquivo;
        atualizarMemoria(pageId);
    }

    const container = document.getElementById('app-content');
    if (!container) return;

    // A leitura biônica pertence ao conteúdo anterior; o Modo Foco pode
    // permanecer ativo enquanto você navega pelos subtemas.
    if (bionicAtivo) resetBionic();

    try {
        const resposta = await fetch(`${nomeArquivo}.html`);
        if (!resposta.ok) throw new Error(`Erro ao carregar: ${nomeArquivo}`);
        
        const html = await resposta.text();
        container.innerHTML = html;

        if (nomeArquivo === 'analogias') {
            requestAnimationFrame(renderizarAnalogias);
        }
        if (nomeArquivo === 'painel') {
            requestAnimationFrame(inicializarPainel);
        }
        if (nomeArquivo === 'constelacao') {
            requestAnimationFrame(inicializarConstelacao);
        }
        if (nomeArquivo === 'personalidades') {
            requestAnimationFrame(() => filtrarPersonalidades(''));
        }
        if (nomeArquivo === 'obras') {
            requestAnimationFrame(() => filtrarBiblioteca('obras-search', 'obra-card', 'obras-empty'));
        }
        if (nomeArquivo === 'esbocos') {
            requestAnimationFrame(() => filtrarBiblioteca('esbocos-search', 'esboco-card', 'esbocos-empty'));
        }

        if (nomeArquivo === 'neurofisiologia') {
            requestAnimationFrame(() => {
                if (typeof window.neurofisiologiaInicializar === 'function') {
                    window.neurofisiologiaInicializar();
                }
            });
        }
        
        // Reinicia animação Fade-In
        container.classList.remove('fade-in');
        void container.offsetWidth; 
        container.classList.add('fade-in');

    } catch (erro) {
        console.warn(`Página "${nomeArquivo}.html" não encontrada. Exibindo estado padrão.`, erro);
        container.innerHTML = `
            <div style="padding: 40px; text-align: center; color: var(--text-muted);">
                <h2 style="color: var(--text-main); margin-bottom: 10px;">✦ Módulo em Construção</h2>
                <p>O ficheiro <strong>${nomeArquivo}.html</strong> ainda não foi associado ao sistema.</p>
            </div>
        `;
    }
}

/* ---------------------------------------------------------
   4. MAPA DE ANALOGIAS — DADOS EDITÁVEIS
   --------------------------------------------------------- */
/*
   COMO ADICIONAR UMA NOVA IDEIA:

   1) Crie um objeto em ANALOGIAS_NODES:
      {
        id: 'meu-pensamento',
        titulo: 'Nome do pensamento',
        tipo: 'esboco', // esboco | obra | personalidade
        descricao: 'Uma descrição curta que aparece ao passar o mouse.',
        x: 50, y: 50,
        pagina: 'esbocos' // opcional: página que deve abrir ao clicar
      }

   2) Ligue esse nó a outro em ANALOGIAS_CONNECTIONS:
      { de: 'meu-pensamento', para: 'outro-pensamento', rotulo: 'ideia em comum' }

   x e y são porcentagens dentro do mapa (0–100).
   Não é necessário mexer no HTML da página Analogias.
*/
const ANALOGIAS_NODES = [];
const ANALOGIAS_CONNECTIONS = [];
function tipoAnalogiaLabel(tipo){return {esboco:'Esboço',obra:'Obra',personalidade:'Personalidade'}[tipo]||'Pensamento';}
function tipoConexaoLabel(tipo){return {analogia:'Analogia',contraste:'Contraste',causa:'Causa',complemento:'Complemento',referencia:'Referência',evolucao:'Evolução'}[tipo]||'Conexão';}
function obterConexoesDoNo(id){return ANALOGIAS_CONNECTIONS.filter(c=>c.de===id||c.para===id).map(c=>({...c,outro:c.de===id?c.para:c.de}));}
function renderizarAnalogias(){
 const mapa=document.getElementById('analogias-network'); if(!mapa)return; mapa.innerHTML='';
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'); svg.classList.add('analogias-svg'); svg.setAttribute('aria-hidden','true'); mapa.appendChild(svg);
 const byId=Object.fromEntries(ANALOGIAS_NODES.map(n=>[n.id,n]));
 ANALOGIAS_CONNECTIONS.forEach((c,i)=>{const a=byId[c.de],b=byId[c.para];if(!a||!b)return;const g=document.createElementNS('http://www.w3.org/2000/svg','g');g.classList.add('analogia-edge-group');g.dataset.de=c.de;g.dataset.para=c.para;
  const dx=b.x-a.x,dy=b.y-a.y,curve=Math.max(7,Math.min(18,Math.abs(dx)*.18+Math.abs(dy)*.08)),cx=(a.x+b.x)/2,cy=(a.y+b.y)/2-(dx>=0?curve:-curve),d=`M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
  const glow=document.createElementNS('http://www.w3.org/2000/svg','path');glow.setAttribute('d',d);glow.classList.add('analogia-edge-glow');
  const line=document.createElementNS('http://www.w3.org/2000/svg','path');line.setAttribute('d',d);line.classList.add('analogia-edge');line.setAttribute('pathLength','100');
  const pulse=document.createElementNS('http://www.w3.org/2000/svg','circle');pulse.classList.add('analogia-edge-pulse');const anim=document.createElementNS('http://www.w3.org/2000/svg','animateMotion');anim.setAttribute('dur',`${3.6+i*.45}s`);anim.setAttribute('repeatCount','indefinite');anim.setAttribute('path',d);anim.setAttribute('rotate','auto');pulse.appendChild(anim);
  const text=document.createElementNS('http://www.w3.org/2000/svg','text');text.classList.add('analogia-edge-label');text.setAttribute('x',cx);text.setAttribute('y',cy);text.setAttribute('text-anchor','middle');text.textContent=c.rotulo||'conexão';
  g.append(glow,line,pulse,text);g.addEventListener('click',()=>selecionarAnalogia(a.id));svg.appendChild(g);
 });
 ANALOGIAS_NODES.forEach(n=>{const node=document.createElement('button');node.type='button';node.className=`analogia-node tipo-${n.tipo||'esboco'}`;node.style.left=n.x+'%';node.style.top=n.y+'%';node.dataset.nodeId=n.id;node.innerHTML=`<span class="analogia-node-tipo">${tipoAnalogiaLabel(n.tipo)}</span><span class="analogia-node-titulo">${n.titulo}</span><span class="analogia-node-desc">${n.descricao||''}</span>`;node.addEventListener('click',()=>selecionarAnalogia(n.id));mapa.appendChild(node);});
 aplicarFiltroAnalogias(); if(analogiaSelecionada) selecionarAnalogia(analogiaSelecionada); }
function selecionarAnalogia(id){analogiaSelecionada=id;const no=ANALOGIAS_NODES.find(n=>n.id===id);if(!no)return;const conexoes=obterConexoesDoNo(id);const ids=new Set([id,...conexoes.map(c=>c.outro)]);document.querySelectorAll('.analogia-node').forEach(el=>{el.classList.toggle('is-selected',el.dataset.nodeId===id);el.classList.toggle('is-connected',ids.has(el.dataset.nodeId)&&el.dataset.nodeId!==id);el.classList.toggle('is-muted',!ids.has(el.dataset.nodeId));});document.querySelectorAll('.analogia-edge-group').forEach(el=>{const active=el.dataset.de===id||el.dataset.para===id;el.classList.toggle('is-selected',active);el.classList.toggle('is-muted',!active);});const detail=document.getElementById('analogia-detail');if(!detail)return;detail.innerHTML=`<div class="detail-kicker">${tipoAnalogiaLabel(no.tipo)}</div><h2 class="detail-title">${no.titulo}</h2><p class="detail-desc">${no.descricao}</p><div class="detail-block"><h4>DNA do pensamento</h4><div class="dna-line"><i></i><span>Origem: ${no.origem||'registro independente'}</span></div><div class="dna-line" style="margin-top:7px"><i></i><span>Registrado: ${no.ano||'—'}</span></div><div class="dna-line" style="margin-top:7px"><i></i><span>${conexoes.length} conexão${conexoes.length===1?'':'ões'} direta${conexoes.length===1?'':'s'}</span></div></div><div class="detail-block"><h4>Conexões</h4>${conexoes.length?conexoes.map(c=>{const outro=ANALOGIAS_NODES.find(n=>n.id===c.outro);return `<button class="connection-chip" onclick="selecionarAnalogia('${c.outro}')">${outro?.titulo||c.outro}<span>${tipoConexaoLabel(c.tipo)}</span></button>`}).join(''):'<p class="detail-desc">Nenhuma conexão registrada.</p>'}</div><div class="detail-block"><button class="primary-action" style="width:100%" onclick="abrirPaginaDoNo('${no.id}')">Abrir pensamento →</button></div>`;}
function abrirPaginaDoNo(id){const no=ANALOGIAS_NODES.find(n=>n.id===id);if(!no?.pagina)return;const btn=document.querySelector(`[data-page="${no.pagina}"]`);carregarPagina(no.pagina,btn);}
function limparSelecaoAnalogia(){analogiaSelecionada=null;document.querySelectorAll('.analogia-node,.analogia-edge-group').forEach(e=>e.classList.remove('is-selected','is-connected','is-muted'));const d=document.getElementById('analogia-detail');if(d)d.innerHTML='<div class="detail-empty"><span>✦</span><strong>Selecione um pensamento</strong><p>Veja o DNA, as conexões diretas e a função desse nó na sua rede.</p></div>';}
function filtrarAnalogias(tipo,botao){analogiaFiltroAtual=tipo;document.querySelectorAll('.mini-control[data-filter]').forEach(b=>b.classList.remove('ativo'));if(botao)botao.classList.add('ativo');aplicarFiltroAnalogias();}
function aplicarFiltroAnalogias(){document.querySelectorAll('.analogia-node').forEach(el=>{const tipo=[...el.classList].find(c=>c.startsWith('tipo-'))?.replace('tipo-','');el.style.display=(analogiaFiltroAtual==='todos'||tipo===analogiaFiltroAtual)?'block':'none';});document.querySelectorAll('.analogia-edge-group').forEach(g=>{if(analogiaFiltroAtual==='todos'){g.style.display='block';return;}const a=ANALOGIAS_NODES.find(n=>n.id===g.dataset.de),b=ANALOGIAS_NODES.find(n=>n.id===g.dataset.para);g.style.display=(a?.tipo===analogiaFiltroAtual||b?.tipo===analogiaFiltroAtual)?'block':'none';});}

/* ---------------------------------------------------------
   5. MEMÓRIA DE NAVEGAÇÃO
   --------------------------------------------------------- */
function atualizarMemoria(pageId) {
    memoriaCurtoPrazo = memoriaCurtoPrazo.filter(p => p !== pageId);
    memoriaCurtoPrazo.unshift(pageId);
    localStorage.setItem('neuroMemoria', JSON.stringify(memoriaCurtoPrazo));

    if (memoriaCurtoPrazo.length > 3) {
        memoriaCurtoPrazo.pop();
    }

    const containerTags = document.getElementById('historico-tags');
    if (!containerTags) return;

    containerTags.innerHTML = '';

    memoriaCurtoPrazo.forEach(page => {
        const tag = document.createElement('button');
        tag.className = 'tag-memoria';
        tag.type = 'button';
        tag.innerHTML = `<span class="retencao-dot retencao-alta"></span>${formatarNomePagina(page)}`;

        tag.onclick = () => {
            const btnOriginal = document.querySelector(`[data-page="${page}"]`);
            carregarPagina(page, btnOriginal);
        };

        containerTags.appendChild(tag);
    });
}

function formatarNomePagina(page) {
    const nomes = {
        inicio: 'Início',
        esbocos: 'Esboços',
        obras: 'Obras',
        analogias: 'Analogias',
        personalidades: 'Personalidades'
    };

    return nomes[page] || page
        .replace(/-/g, ' ')
        .replace(/\b\w/g, letra => letra.toUpperCase());
}

/* ---------------------------------------------------------
   5. SINAPSE RÁPIDA — EDITOR, EXPANSÃO E ARRASTO
   --------------------------------------------------------- */
let sinapseExpandida = false;
let sinapseArrastando = false;
let sinapseDragOffsetX = 0;
let sinapseDragOffsetY = 0;

function toggleSinapseDrawer() {
    const drawer = document.getElementById('sinapse-drawer');
    if (!drawer) return;

    if (drawer.classList.contains('ativa')) {
        if (penseAltoAtivo) pararPenseAlto();
        if (sinapseExpandida) toggleSinapseExpandida(false);
        drawer.classList.remove('ativa');
        document.body.classList.remove('sinapse-aberta');
    } else {
        drawer.classList.add('ativa');
        document.body.classList.add('sinapse-aberta');
        restaurarPosicaoSinapse();
        setTimeout(() => document.getElementById('sinapse-notas')?.focus(), 360);
    }
}

function toggleSinapseExpandida(forcarEstado = null) {
    const drawer = document.getElementById('sinapse-drawer');
    const editor = document.getElementById('sinapse-notas');
    const botao = document.getElementById('btn-expandir-sinapse');
    if (!drawer) return;

    sinapseExpandida = forcarEstado === null ? !sinapseExpandida : forcarEstado;
    drawer.classList.toggle('expandida', sinapseExpandida);
    document.body.classList.toggle('sinapse-expandida', sinapseExpandida);

    if (botao) {
        botao.innerHTML = sinapseExpandida ? '<span aria-hidden="true">⛶</span>' : '<span aria-hidden="true">⛶</span>';
        botao.title = sinapseExpandida
            ? 'Voltar ao tamanho normal — Ctrl + Shift + Enter'
            : 'Tela cheia — Ctrl + Shift + Enter';
        botao.setAttribute('aria-label', sinapseExpandida ? 'Voltar ao tamanho normal' : 'Expandir editor');
    }

    if (editor) {
        requestAnimationFrame(() => editor.focus());
    }
}

function inicializarSinapse() {
    const editor = document.getElementById('sinapse-notas');
    const statusSync = document.getElementById('status-sync');
    if (!editor) return;

    // Migra automaticamente as notas antigas, que eram texto puro.
    const notasHTML = localStorage.getItem('sinapseNotasHTML');
    const notasAntigas = localStorage.getItem('sinapseNotas');

    if (notasHTML) {
        editor.innerHTML = notasHTML;
    } else if (notasAntigas) {
        editor.textContent = notasAntigas;
    }

    editor.addEventListener('input', () => {
        localStorage.setItem('sinapseNotasHTML', editor.innerHTML);
        atualizarContadorSinapse();
        if (statusSync) statusSync.innerText = 'Status: Sincronizado';
    });

    inicializarFerramentasSinapse();
    inicializarArrastoSinapse();
    atualizarContadorSinapse();
}


function atualizarContadorSinapse() {
    const editor = document.getElementById('sinapse-notas');
    const contador = document.getElementById('sinapse-word-count');
    if (!editor || !contador) return;
    const texto = (editor.innerText || '').replace(/\s+/g, ' ').trim();
    const palavras = texto ? texto.split(' ').length : 0;
    contador.textContent = `${palavras} palavra${palavras === 1 ? '' : 's'}`;
}

function inicializarPenseAlto() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const botao = document.getElementById('btn-voz-sinapse');
    if (!SpeechRecognition) {
        if (botao) {
            botao.disabled = true;
            botao.title = 'Pense-Alto não é suportado neste navegador';
            botao.setAttribute('aria-label', 'Pense-Alto indisponível neste navegador');
        }
        return;
    }

    reconhecimentoVoz = new SpeechRecognition();
    reconhecimentoVoz.lang = 'pt-BR';
    reconhecimentoVoz.continuous = true;
    reconhecimentoVoz.interimResults = true;
    reconhecimentoVoz.maxAlternatives = 1;

    reconhecimentoVoz.onstart = () => {
        penseAltoAtivo = true;
        const b = document.getElementById('btn-voz-sinapse');
        if (b) {
            b.classList.add('gravando');
            b.innerHTML = '<span aria-hidden="true">●</span>';
            b.title = 'Pense-Alto ativo — clique para parar';
            b.setAttribute('aria-label', 'Parar Pense-Alto');
        }
        const status = document.getElementById('status-sync');
        if (status) status.textContent = '● Ouvindo...';
    };

    reconhecimentoVoz.onresult = (event) => {
        const editor = document.getElementById('sinapse-notas');
        if (!editor) return;
        let finalTexto = '';
        let interimTexto = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const trecho = event.results[i][0]?.transcript || '';
            if (event.results[i].isFinal) finalTexto += trecho;
            else interimTexto += trecho;
        }
        if (finalTexto) {
            inserirTextoVoz(finalTexto.trim());
        }
        atualizarPreviewVoz(interimTexto.trim());
    };

    reconhecimentoVoz.onerror = (event) => {
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            pararPenseAlto('Permissão de microfone recusada.');
        } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
            pararPenseAlto('Pense-Alto: não foi possível continuar.');
        }
    };

    reconhecimentoVoz.onend = () => {
        if (penseAltoAtivo) {
            // Alguns navegadores encerram sessões contínuas sozinhos; reconecta enquanto o usuário mantém o modo ativo.
            try { reconhecimentoVoz.start(); } catch (_) {}
        }
    };
}

function inserirTextoVoz(texto) {
    const editor = document.getElementById('sinapse-notas');
    if (!editor || !texto) return;
    editor.focus();
    const separador = editor.innerText.trim() ? ' ' : '';
    document.execCommand('insertText', false, separador + texto);
    localStorage.setItem('sinapseNotasHTML', editor.innerHTML);
    atualizarContadorSinapse();
    const status = document.getElementById('status-sync');
    if (status) status.textContent = 'Status: Sincronizado';
}

function atualizarPreviewVoz(interim) {
    const editor = document.getElementById('sinapse-notas');
    if (!editor) return;
    let preview = document.getElementById('pense-alto-preview');
    if (!interim) {
        preview?.remove();
        return;
    }
    if (!preview) {
        preview = document.createElement('span');
        preview.id = 'pense-alto-preview';
        preview.className = 'pense-alto-preview';
        editor.appendChild(preview);
    }
    preview.textContent = (editor.innerText.trim() ? ' ' : '') + interim;
}

function togglePenseAlto() {
    if (!reconhecimentoVoz) {
        const status = document.getElementById('status-sync');
        if (status) status.textContent = 'Pense-Alto não é suportado neste navegador.';
        return;
    }
    if (penseAltoAtivo) {
        pararPenseAlto('Status: Sincronizado');
        return;
    }
    const drawer = document.getElementById('sinapse-drawer');
    if (drawer && !drawer.classList.contains('ativa')) toggleSinapseDrawer();
    try {
        reconhecimentoVoz.start();
    } catch (_) {}
}

function pararPenseAlto(statusTexto = 'Status: Sincronizado') {
    penseAltoAtivo = false;
    try { reconhecimentoVoz?.stop(); } catch (_) {}
    document.getElementById('pense-alto-preview')?.remove();
    const b = document.getElementById('btn-voz-sinapse');
    if (b) {
        b.classList.remove('gravando');
        b.innerHTML = '<span aria-hidden="true">🎙</span>';
        b.title = 'Pense-Alto — transcrição de voz';
        b.setAttribute('aria-label', 'Pense-Alto: iniciar transcrição de voz');
    }
    const status = document.getElementById('status-sync');
    if (status) status.textContent = statusTexto;
}

function executarComandoSinapse(comando, valor = null) {
    const editor = document.getElementById('sinapse-notas');
    if (!editor) return;

    editor.focus();
    try {
        document.execCommand(comando, false, valor);
        localStorage.setItem('sinapseNotasHTML', editor.innerHTML);
        const status = document.getElementById('status-sync');
        if (status) status.innerText = 'Status: Sincronizado';
    } catch (erro) {
        console.warn(`Comando de edição não suportado: ${comando}`, erro);
    }
}

function inicializarFerramentasSinapse() {
    document.querySelectorAll('.sinapse-tool').forEach(botao => {
        botao.addEventListener('mousedown', e => e.preventDefault());
        botao.addEventListener('click', () => {
            executarComandoSinapse(botao.dataset.command);
        });
    });

    const formato = document.getElementById('sinapse-format');
    if (formato) {
        formato.addEventListener('change', () => {
            const valor = formato.value === 'blockquote' ? 'blockquote' : formato.value;
            executarComandoSinapse('formatBlock', valor);
            formato.value = 'p';
        });
    }

    const tamanho = document.getElementById('sinapse-font-size');
    if (tamanho) {
        tamanho.addEventListener('change', () => {
            executarComandoSinapse('fontSize', tamanho.value);
            tamanho.value = '3';
        });
    }
}

function inicializarArrastoSinapse() {
    const drawer = document.getElementById('sinapse-drawer');
    const handle = document.getElementById('sinapse-drag-handle');
    if (!drawer || !handle) return;

    handle.addEventListener('pointerdown', iniciarArrastoSinapse);
    window.addEventListener('pointermove', moverSinapse);
    window.addEventListener('pointerup', terminarArrastoSinapse);
}

function iniciarArrastoSinapse(e) {
    const drawer = document.getElementById('sinapse-drawer');
    if (!drawer || !drawer.classList.contains('ativa') || sinapseExpandida) return;
    if (e.target.closest('button, select, input')) return;

    const rect = drawer.getBoundingClientRect();
    sinapseArrastando = true;
    sinapseDragOffsetX = e.clientX - rect.left;
    sinapseDragOffsetY = e.clientY - rect.top;
    drawer.classList.add('dragging');
    drawer.style.left = `${rect.left}px`;
    drawer.style.top = `${rect.top}px`;
    drawer.style.right = 'auto';
    drawer.style.bottom = 'auto';
    drawer.setPointerCapture?.(e.pointerId);
}

function moverSinapse(e) {
    if (!sinapseArrastando) return;
    const drawer = document.getElementById('sinapse-drawer');
    if (!drawer) return;

    const margem = 10;
    const rect = drawer.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - margem;
    const maxY = window.innerHeight - rect.height - margem;
    const x = Math.min(Math.max(margem, e.clientX - sinapseDragOffsetX), Math.max(margem, maxX));
    const y = Math.min(Math.max(margem, e.clientY - sinapseDragOffsetY), Math.max(margem, maxY));

    drawer.style.left = `${x}px`;
    drawer.style.top = `${y}px`;
}

function terminarArrastoSinapse() {
    if (!sinapseArrastando) return;
    const drawer = document.getElementById('sinapse-drawer');
    sinapseArrastando = false;
    if (!drawer) return;

    drawer.classList.remove('dragging');
    localStorage.setItem('sinapsePosicao', JSON.stringify({
        left: drawer.style.left,
        top: drawer.style.top
    }));
}

function restaurarPosicaoSinapse() {
    const drawer = document.getElementById('sinapse-drawer');
    if (!drawer) return;

    try {
        const posicao = JSON.parse(localStorage.getItem('sinapsePosicao') || 'null');
        if (!posicao?.left || !posicao?.top) return;
        const left = parseFloat(posicao.left);
        const top = parseFloat(posicao.top);
        if (!Number.isFinite(left) || !Number.isFinite(top)) return;

        const margem = 10;
        const rect = drawer.getBoundingClientRect();
        const x = Math.min(Math.max(margem, left), Math.max(margem, window.innerWidth - rect.width - margem));
        const y = Math.min(Math.max(margem, top), Math.max(margem, window.innerHeight - rect.height - margem));
        drawer.style.left = `${x}px`;
        drawer.style.top = `${y}px`;
        drawer.style.right = 'auto';
        drawer.style.bottom = 'auto';
    } catch (_) {
        // Se a posição salva estiver corrompida, a posição padrão é mantida.
    }
}

function limparNotasSinapse() {
    const editor = document.getElementById('sinapse-notas');
    const statusSync = document.getElementById('status-sync');
    if (editor && confirm('Deseja apagar as anotações rápidas?')) {
        editor.innerHTML = '';
        localStorage.removeItem('sinapseNotasHTML');
        localStorage.removeItem('sinapseNotas');
        if (statusSync) statusSync.innerText = 'Status: Limpo';
        editor.focus();
    }
}

// Atalhos da Sinapse: funcionam como nos editores tradicionais.
document.addEventListener('keydown', (e) => {
    const editor = document.getElementById('sinapse-notas');
    const drawer = document.getElementById('sinapse-drawer');
    const dentroDaSinapse = editor && drawer?.classList.contains('ativa') && (e.target === editor || editor.contains(e.target));
    const modificador = e.ctrlKey || e.metaKey;

    if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        toggleSinapseDrawer();
        return;
    }

    if (drawer?.classList.contains('ativa') && e.key === 'Escape') {
        e.preventDefault();
        if (sinapseExpandida) toggleSinapseExpandida(false);
        else toggleSinapseDrawer();
        return;
    }

    if (drawer?.classList.contains('ativa') && modificador && e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        toggleSinapseExpandida();
        return;
    }

    if (!dentroDaSinapse) return;

    const tecla = e.key.toLowerCase();
    const atalhos = {
        'b': 'bold',
        'i': 'italic',
        'u': 'underline',
        'z': 'undo',
        'y': 'redo'
    };

    if (modificador && atalhos[tecla]) {
        e.preventDefault();
        executarComandoSinapse(atalhos[tecla]);
        return;
    }

    if (modificador && e.altKey && ['1','2','3'].includes(e.key)) { e.preventDefault(); executarComandoSinapse('formatBlock', 'h'+e.key); return; }
    if (modificador && e.key === '=' && !e.shiftKey) { e.preventDefault(); executarComandoSinapse('fontSize','4'); return; }
    if (modificador && e.key === '-' && !e.shiftKey) { e.preventDefault(); executarComandoSinapse('fontSize','2'); return; }

    if (modificador && e.shiftKey) {
        const alinhamentos = { l: 'justifyLeft', e: 'justifyCenter', r: 'justifyRight' };
        if (alinhamentos[tecla]) {
            e.preventDefault();
            executarComandoSinapse(alinhamentos[tecla]);
        }
    }
});


/* ---------------------------------------------------------
   5B. PAINEL, EXPERIMENTOS, BIBLIOTECA E CONSTELAÇÃO
   --------------------------------------------------------- */
const PERGUNTAS_DIA=['Se sua percepção muda, quanto daquilo que você chama de realidade permanece igual?','Uma ideia continua sendo sua quando outra pessoa a transforma completamente?','O que diferencia uma lembrança de uma interpretação da lembrança?','Até que ponto conhecer alguém é conhecer a imagem que essa pessoa construiu?','Se você pudesse observar seus próprios pensamentos de fora, o que mudaria?','Uma contradição destrói uma ideia ou pode torná-la mais interessante?'];
function inicializarPainel(){const pergunta=PERGUNTAS_DIA[new Date().getDate()%PERGUNTAS_DIA.length];const q=document.getElementById('pergunta-do-dia');if(q)q.textContent=pergunta;const f=document.getElementById('pergunta-fonte');if(f)f.textContent='Pergunta selecionada para esta sessão.';const stats=[['Pensamentos',ANALOGIAS_NODES.length,'nós registrados'],['Conexões',ANALOGIAS_CONNECTIONS.length,'ligações no mapa'],['Tipos',new Set(ANALOGIAS_NODES.map(n=>n.tipo)).size,'formas de pensamento'],['Sessões',Number(localStorage.getItem('neuroSessoes')||1),'aberturas do NeuroSpace']];const box=document.getElementById('dashboard-stats');if(box)box.innerHTML=stats.map(s=>`<div class="stat-card"><small>${s[0]}</small><strong>${s[1]}</strong><em>${s[2]}</em></div>`).join('');const act=document.getElementById('dashboard-activity');if(act){const hist=JSON.parse(localStorage.getItem('neuroMemoria')||'[]');act.innerHTML=(hist.length?hist:['inicio','analogias','painel']).slice(0,5).map(x=>`<div class="activity-item">✦ <span>Você explorou <b>${x}</b></span></div>`).join('');}const bars=document.getElementById('mini-bars');if(bars)bars.innerHTML=[['Esboços',30],['Obras',45],['Conexões',75],['Personalidades',55]].map(x=>`<div class="mini-bar" style="--h:${x[1]}%"><span>${x[0]}</span></div>`).join('');const timeline=document.getElementById('neuro-timeline');if(timeline)timeline.innerHTML=[['Agora','Sessão atual'],['Rede',`${ANALOGIAS_CONNECTIONS.length} conexões`],['Biblioteca','registros em expansão'],['Próximo','Nova sinapse']].map(x=>`<div class="timeline-node"><b>${x[0]}</b><span>${x[1]}</span></div>`).join('');}
function abrirPerguntaNaSinapse(){toggleSinapseDrawer();const editor=document.getElementById('sinapse-notas');const q=document.getElementById('pergunta-do-dia');if(editor&&q){editor.focus();if(!editor.innerText.trim())editor.innerHTML=`<h2>${q.textContent}</h2><p><br></p>`;}}
function filtrarBiblioteca(inputId, cardClass, emptyId){
 const input=document.getElementById(inputId);
 const termo=String(input?.value||'').toLowerCase().trim();
 const cards=[...document.querySelectorAll('.'+cardClass)];
 let vis=0;
 cards.forEach(card=>{
   const texto=(card.dataset.name||card.textContent||'').toLowerCase();
   const ok=!termo||texto.includes(termo);
   card.style.display=ok?'block':'none';
   if(ok)vis++;
 });
 const count=document.getElementById(inputId+'-count');
 if(count) count.textContent=`${vis} registro${vis===1?'':'s'}`;
 const empty=document.getElementById(emptyId);
 if(empty) empty.hidden=vis!==0;
}

function filtrarPersonalidades(valor){const termo=String(valor||'').toLowerCase().trim();const cards=[...document.querySelectorAll('.personality-card')];let vis=0;cards.forEach(c=>{const ok=c.dataset.name.includes(termo);c.style.display=ok?'block':'none';if(ok)vis++;});const count=document.getElementById('personalidade-count');if(count)count.textContent=`${vis} registro${vis===1?'':'s'}`;const empty=document.getElementById('personalidades-empty');if(empty)empty.hidden=vis!==0;}

/* ---------------------------------------------------------
   6. FERRAMENTAS COGNITIVAS (FOCO E LEITURA BIÔNICA)
   --------------------------------------------------------- */
function toggleFoco() {
    modoFocoAtivo = !modoFocoAtivo;
    document.body.classList.toggle('modo-foco-ativo', modoFocoAtivo);

    const btn = document.getElementById('btn-foco');
    const btnSair = document.getElementById('btn-sair-foco');

    if (btn) btn.classList.toggle('ativo', modoFocoAtivo);
    if (btnSair) btnSair.hidden = !modoFocoAtivo;
}

function resetFoco() {
    modoFocoAtivo = false;
    document.body.classList.remove('modo-foco-ativo');

    const btn = document.getElementById('btn-foco');
    const btnSair = document.getElementById('btn-sair-foco');

    if (btn) btn.classList.remove('ativo');
    if (btnSair) btnSair.hidden = true;
}

function toggleBionic() {
    const content = document.getElementById('app-content');
    const btn = document.getElementById('btn-bionic');
    if (!content) return;

    if (!bionicAtivo) {
        conteudoOriginal = content.innerHTML;
        
        const elementos = content.querySelectorAll('p, li');
        elementos.forEach(el => {
            el.innerHTML = el.innerHTML.replace(/(?![^<]*>)([a-zA-ZÀ-ÿ0-9]+)/g, (match) => {
                if (match.length <= 1) return match;
                let mid = Math.ceil(match.length / 2);
                return `<b style="font-weight: 800; color: var(--primary);">${match.slice(0, mid)}</b>${match.slice(mid)}`;
            });
        });
        
        bionicAtivo = true;
        if (btn) btn.classList.add('ativo');
    } else {
        resetBionic();
    }
}

function resetBionic() {
    const content = document.getElementById('app-content');
    const btn = document.getElementById('btn-bionic');
    
    if (bionicAtivo && content && conteudoOriginal !== "") {
        content.innerHTML = conteudoOriginal;
    }
    bionicAtivo = false;
    if (btn) btn.classList.remove('ativo');
}

/* ---------------------------------------------------------
   7. GERADOR DE ONDAS BINAURAIS (Web Audio API)
   --------------------------------------------------------- */
function toggleBinaural() {
    const btn = document.getElementById('btn-play-binaural');
    const selector = document.getElementById('onda-selector');
    
    if (isPlayingBinaural) {
        if (audioCtx) audioCtx.suspend();
        isPlayingBinaural = false;
        if (btn) {
            btn.innerText = "▶️ Iniciar"; 
            btn.classList.remove('tocando');
        }
        return;
    }

    try {
        if (!audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioContextClass();
            
            oscLeft = audioCtx.createOscillator();
            oscRight = audioCtx.createOscillator();
            
            let pannerLeft = audioCtx.createStereoPanner ? audioCtx.createStereoPanner() : null;
            let pannerRight = audioCtx.createStereoPanner ? audioCtx.createStereoPanner() : null;

            gainNode = audioCtx.createGain();
            gainNode.gain.value = 0.5; // Volume a 50%

            if (pannerLeft && pannerRight) {
                pannerLeft.pan.value = -1; // Ouvido Esquerdo
                pannerRight.pan.value = 1;  // Ouvido Direito
                oscLeft.connect(pannerLeft).connect(gainNode);
                oscRight.connect(pannerRight).connect(gainNode);
            } else {
                oscLeft.connect(gainNode);
                oscRight.connect(gainNode);
            }

            gainNode.connect(audioCtx.destination);
            oscLeft.start(); 
            oscRight.start();
        }

        let baseFreq = 200; 
        let diff = (selector && selector.value === 'beta') ? 20 : 10; // 10Hz Alfa, 20Hz Beta

        oscLeft.frequency.value = baseFreq;
        oscRight.frequency.value = baseFreq + diff;

        audioCtx.resume();
        isPlayingBinaural = true;
        
        if (btn) {
            btn.innerText = "⏸ Parar Frequência"; 
            btn.classList.add('tocando');
        }

    } catch (erro) {
        console.error("O áudio binaural não é suportado neste navegador.", erro);
    }
}

/* ---------------------------------------------------------
   8. TEMPORIZADOR ULTRADIANO & PAUSA GUIADA
   --------------------------------------------------------- */
function iniciarTimer(minutos) {
    if (timerInterval) clearInterval(timerInterval);
    
    tempoRestante = minutos * 60;
    atualizarDisplayTimer();

    timerInterval = setInterval(() => {
        tempoRestante--;
        atualizarDisplayTimer();

        if (tempoRestante <= 0) {
            clearInterval(timerInterval);
            iniciarPausa();
        }
    }, 1000);
}

function atualizarDisplayTimer() {
    const min = Math.floor(tempoRestante / 60);
    const seg = tempoRestante % 60;
    const display = document.getElementById('timer-display');
    if (display) {
        display.innerText = `${min.toString().padStart(2, '0')}:${seg.toString().padStart(2, '0')}`;
    }
}

function iniciarPausa() {
    if (timerInterval) clearInterval(timerInterval);
    
    const display = document.getElementById('timer-display');
    if (display) display.innerText = "PAUSA";

    const modal = document.getElementById('respiracao-modal');
    if (!modal) return;
    
    modal.classList.remove('oculta');
    const circle = document.getElementById('breath-circle');
    const text = document.getElementById('breath-text');
    
    let fase = 0;
    const cicloRespiratorio = () => {
        if (!text || !circle) return;
        
        if (fase === 0) {
            text.innerText = "Inspire (4s)";
            circle.className = "breath-circle expandir";
            fase = 1;
        } else if (fase === 1) {
            text.innerText = "Segure (7s)";
            fase = 2;
        } else {
            text.innerText = "Expire (8s)";
            circle.className = "breath-circle retrair";
            fase = 0;
        }
    };
    
    cicloRespiratorio();
    breathInterval = setInterval(cicloRespiratorio, 4000);
}

function fecharRespiracao() {
    const modal = document.getElementById('respiracao-modal');
    if (modal) modal.classList.add('oculta');
    if (breathInterval) clearInterval(breathInterval);
}

/* ---------------------------------------------------------
   OROBOROS — editor inteligente do NeuroSpace 7.0
   --------------------------------------------------------- */
let oroborosHTMLGerado = '';

function abrirOroboros() {
    const modal = document.getElementById('oroboros-modal');
    if (!modal) return;
    modal.classList.add('aberto');
    modal.setAttribute('aria-hidden', 'false');
    usarTextoDaSinapseNoOroboros();
    setTimeout(() => document.getElementById('oroboros-input')?.focus(), 80);
}

function fecharOroboros() {
    const modal = document.getElementById('oroboros-modal');
    if (!modal) return;
    modal.classList.remove('aberto');
    modal.setAttribute('aria-hidden', 'true');
}

function usarTextoDaSinapseNoOroboros() {
    const editor = document.getElementById('sinapse-notas');
    const input = document.getElementById('oroboros-input');
    if (!editor || !input) return;
    const texto = editor.innerText.trim();
    if (texto) {
        input.value = texto;
        atualizarContadorOroboros();
    }
}

function atualizarContadorOroboros() {
    const input = document.getElementById('oroboros-input');
    const contador = document.getElementById('oroboros-input-count');
    if (!input || !contador) return;
    const total = input.value.trim() ? input.value.trim().split(/\\s+/).length : 0;
    contador.textContent = `${total} ${total === 1 ? 'palavra' : 'palavras'}`;
}

function escaparHtmlOroboros(texto) {
    return String(texto || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function limparHTMLOroboros(html) {
    const permitido = new Set(['H1','H2','H3','P','STRONG','EM','U','S','BLOCKQUOTE','UL','OL','LI','A','BR','CODE','PRE']);
    const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    doc.querySelectorAll('script,style,iframe,object,embed,form,svg,math').forEach(el => el.remove());

    doc.body.querySelectorAll('*').forEach(el => {
        if (!permitido.has(el.tagName)) {
            el.replaceWith(...Array.from(el.childNodes));
            return;
        }
        Array.from(el.attributes).forEach(attr => {
            if (el.tagName === 'A' && attr.name === 'href') {
                const valor = attr.value.trim();
                if (!/^https?:\/\//i.test(valor)) el.removeAttribute('href');
            } else {
                el.removeAttribute(attr.name);
            }
        });
        if (el.tagName === 'A') {
            el.setAttribute('target', '_blank');
            el.setAttribute('rel', 'noopener noreferrer');
        }
    });

    let resultado = doc.body.innerHTML.trim();

    // Se a IA devolver apenas texto, nunca deixamos o resultado como texto puro.
    if (!doc.body.children.length && doc.body.textContent.trim()) {
        const blocos = doc.body.textContent
            .trim()
            .split(/\n\s*\n+/)
            .map(bloco => bloco.trim())
            .filter(Boolean);

        const linhas = blocos.length ? blocos : doc.body.textContent.split(/\n+/).map(l => l.trim()).filter(Boolean);
        resultado = linhas.map(linha => `<p>${escaparHtmlOroboros(linha)}</p>`).join('\n');
    }

    return resultado;
}

function mostrarResultadoOroboros(html) {
    const preview = document.getElementById('oroboros-preview');
    const codigo = document.getElementById('oroboros-code');
    const aplicar = document.getElementById('btn-oroboros-aplicar');
    if (!preview) return;

    oroborosHTMLGerado = limparHTMLOroboros(html);
    preview.innerHTML = oroborosHTMLGerado || '<span class="oroboros-empty">A IA não retornou conteúdo.</span>';

    if (codigo) {
        codigo.textContent = oroborosHTMLGerado || 'Nenhum HTML gerado.';
    }

    if (aplicar) aplicar.disabled = !oroborosHTMLGerado;
    alternarVisualizacaoOroboros('visual');
}

function alternarVisualizacaoOroboros(modo) {
    const visual = document.getElementById('oroboros-preview');
    const codigo = document.getElementById('oroboros-code');
    const btnVisual = document.getElementById('oroboros-tab-visual');
    const btnCodigo = document.getElementById('oroboros-tab-codigo');

    if (!visual || !codigo) return;

    const mostrarCodigo = modo === 'codigo';
    visual.hidden = mostrarCodigo;
    codigo.hidden = !mostrarCodigo;
    btnVisual?.classList.toggle('ativo', !mostrarCodigo);
    btnCodigo?.classList.toggle('ativo', mostrarCodigo);
}

function obterControleLocalOroboros() {
    const limite = Number(window.OROBOROS_CONFIG?.clientDailyLimit || 20);
    const hoje = new Date().toISOString().slice(0, 10);
    let dados = {};
    try { dados = JSON.parse(localStorage.getItem('oroborosUso') || '{}'); } catch (_) {}
    if (dados.data !== hoje) dados = { data: hoje, usos: 0, ultimaChamada: 0 };
    return { ...dados, limite };
}

function salvarControleLocalOroboros(dados) {
    localStorage.setItem('oroborosUso', JSON.stringify(dados));
}

async function executarOroboros() {
    const input = document.getElementById('oroboros-input');
    const status = document.getElementById('oroboros-status');
    const botao = document.getElementById('btn-oroboros-gerar');
    const endpoint = window.OROBOROS_CONFIG?.endpoint;
    if (!input || !status || !botao) return;

    const texto = input.value.trim();
    if (!texto) {
        status.textContent = 'Escreva algo primeiro';
        input.focus();
        return;
    }
    if (!endpoint) {
        status.textContent = 'Endpoint não configurado';
        return;
    }

    const controle = obterControleLocalOroboros();
    const agora = Date.now();
    const cooldown = Number(window.OROBOROS_CONFIG?.clientCooldownMs || 4000);

    if (controle.usos >= controle.limite) {
        status.textContent = `Limite local de ${controle.limite} usos hoje`;
        return;
    }

    if (controle.ultimaChamada && agora - controle.ultimaChamada < cooldown) {
        const espera = Math.ceil((cooldown - (agora - controle.ultimaChamada)) / 1000);
        status.textContent = `Aguarde ${espera}s`;
        return;
    }

    botao.classList.add('loading');
    botao.disabled = true;
    status.textContent = 'Oroboros está organizando…';
    const aplicar = document.getElementById('btn-oroboros-aplicar');
    if (aplicar) aplicar.disabled = true;

    try {
        controle.ultimaChamada = agora;
        salvarControleLocalOroboros(controle);

        const resposta = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: texto })
        });
        const dados = await resposta.json().catch(() => ({}));
        if (!resposta.ok) throw new Error(dados.error || `Erro ${resposta.status}`);
        if (!dados.html) throw new Error('A IA não devolveu HTML válido.');

        controle.usos += 1;
        salvarControleLocalOroboros(controle);
        mostrarResultadoOroboros(dados.html);
        status.textContent = `Pronto para revisar · ${controle.limite - controle.usos} usos locais restantes`;
    } catch (erro) {
        console.error('Oroboros:', erro);
        status.textContent = erro.message || 'Não foi possível conectar';
        const preview = document.getElementById('oroboros-preview');
        if (preview) preview.innerHTML = `<span class="oroboros-empty">Não foi possível conectar ao Oroboros. Verifique o endpoint e se o backend está online.</span>`;
    } finally {
        botao.classList.remove('loading');
        botao.disabled = false;
    }
}

function aplicarOroboros() {
    const editor = document.getElementById('sinapse-notas');
    if (!editor || !oroborosHTMLGerado) return;
    editor.innerHTML = oroborosHTMLGerado;
    localStorage.setItem('sinapseNotasHTML', editor.innerHTML);
    atualizarContadorSinapse();
    const status = document.getElementById('status-sync');
    if (status) status.textContent = 'Status: Sincronizado';
    fecharOroboros();
    editor.focus();
}

document.addEventListener('input', e => {
    if (e.target?.id === 'oroboros-input') atualizarContadorOroboros();
});

document.addEventListener('keydown', e => {
    const modal = document.getElementById('oroboros-modal');
    if (e.key === 'Escape' && modal?.classList.contains('aberto')) fecharOroboros();
});


/* =========================================================
   OROBOROS — ESPAÇO CONVERSACIONAL
   Usa o mesmo backend do editor Oroboros da Sinapse.
   ========================================================= */

let oroborosChatReconhecimento = null;
let oroborosChatOuvindo = false;
let oroborosChatProcessando = false;

function inicializarOroborosChat() {
    const input = document.getElementById('oroboros-chat-input');
    if (!input) return;

    input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 180) + 'px';

        const contador = document.getElementById('oroboros-chat-count');
        if (contador) {
            const palavras = input.value.trim()
                ? input.value.trim().split(/\s+/).length
                : 0;
            contador.textContent = `${palavras} palavra${palavras === 1 ? '' : 's'}`;
        }
    });

    input.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            enviarMensagemOroborosChat();
        }
    });

    inicializarReconhecimentoOroborosChat();
}

function adicionarMensagemOroborosChat(tipo, conteudo, html = false) {
    const chat = document.getElementById('oroboros-chat');
    if (!chat) return;

    const welcome = chat.querySelector('.oroboros-welcome');
    if (welcome) welcome.remove();

    const mensagem = document.createElement('article');
    mensagem.className = `oroboros-message ${tipo}`;

    const bolha = document.createElement('div');
    bolha.className = 'oroboros-message-bubble';

    if (html) {
        bolha.innerHTML = conteudo;
    } else {
        bolha.textContent = conteudo;
    }

    mensagem.appendChild(bolha);
    chat.appendChild(mensagem);

    requestAnimationFrame(() => {
        mensagem.classList.add('visible');
        chat.scrollTo({
            top: chat.scrollHeight,
            behavior: 'smooth'
        });
    });

    return mensagem;
}

function adicionarProcessamentoOroborosChat() {
    const chat = document.getElementById('oroboros-chat');
    if (!chat) return null;

    const mensagem = document.createElement('article');
    mensagem.className = 'oroboros-message ai oroboros-processing-message';

    const bolha = document.createElement('div');
    bolha.className = 'oroboros-message-bubble';

    bolha.innerHTML = `
        <span class="oroboros-processing-label">Organizando</span>
        <span class="oroboros-processing-dots">
            <i></i><i></i><i></i>
        </span>
    `;

    mensagem.appendChild(bolha);
    chat.appendChild(mensagem);

    requestAnimationFrame(() => {
        mensagem.classList.add('visible');
        chat.scrollTo({
            top: chat.scrollHeight,
            behavior: 'smooth'
        });
    });

    return mensagem;
}

function escaparHtmlOroborosChat(texto) {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}

function limparRespostaOroborosChat(html) {
    if (!html) return '';

    let resultado = String(html).trim();

    resultado = resultado
        .replace(/^```html\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

    const permitido = document.createElement('div');
    permitido.innerHTML = resultado;

    permitido.querySelectorAll('script, style, iframe, object, embed, form').forEach(el => {
        el.remove();
    });

    permitido.querySelectorAll('*').forEach(el => {
        [...el.attributes].forEach(attr => {
            if (/^on/i.test(attr.name)) {
                el.removeAttribute(attr.name);
            }

            if (
                (attr.name === 'href' || attr.name === 'src') &&
                /^\s*javascript:/i.test(attr.value)
            ) {
                el.removeAttribute(attr.name);
            }
        });
    });

    return permitido.innerHTML.trim();
}

async function enviarMensagemOroborosChat() {
    if (oroborosChatProcessando) return;

    const input = document.getElementById('oroboros-chat-input');
    const botao = document.getElementById('oroboros-chat-send');

    if (!input || !botao) return;

    const texto = input.value.trim();

    if (!texto) {
        input.focus();
        return;
    }

    const config = window.OROBOROS_CONFIG || {};

    if (!config.endpoint) {
        adicionarMensagemOroborosChat(
            'ai',
            'O endpoint do Oroboros não está configurado.'
        );
        return;
    }

    oroborosChatProcessando = true;
    botao.disabled = true;

    adicionarMensagemOroborosChat('user', texto);

    input.value = '';
    input.style.height = 'auto';

    const contador = document.getElementById('oroboros-chat-count');
    if (contador) contador.textContent = '0 palavras';

    const processamento = adicionarProcessamentoOroborosChat();

    try {
        const resposta = await fetch(config.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: texto,
                model: config.model
            })
        });

        const dados = await resposta.json().catch(() => ({}));

        if (!resposta.ok) {
            throw new Error(
                dados.error ||
                dados.message ||
                `Erro ${resposta.status}`
            );
        }

        const html = limparRespostaOroborosChat(
            dados.html ||
            dados.result ||
            dados.text ||
            ''
        );

        if (!html) {
            throw new Error('O Oroboros não retornou conteúdo.');
        }

        if (processamento) processamento.remove();

        adicionarMensagemOroborosChat('ai', html, true);

    } catch (erro) {
        console.error('Oroboros conversacional:', erro);

        if (processamento) processamento.remove();

        const mensagem = `
            <strong>Não consegui organizar esse pensamento.</strong>
            <div class="oroboros-error-detail">
                ${escaparHtmlOroborosChat(
                    erro.message || 'Verifique se o backend está online.'
                )}
            </div>
        `;

        adicionarMensagemOroborosChat('ai', mensagem, true);

    } finally {
        oroborosChatProcessando = false;
        botao.disabled = false;
        input.focus();
    }
}

function inicializarReconhecimentoOroborosChat() {
    const Reconhecimento =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!Reconhecimento) {
        const mic = document.getElementById('oroboros-chat-mic');
        if (mic) {
            mic.disabled = true;
            mic.title = 'Reconhecimento de voz não disponível neste navegador';
        }
        return;
    }

    oroborosChatReconhecimento = new Reconhecimento();

    oroborosChatReconhecimento.lang = 'pt-BR';
    oroborosChatReconhecimento.continuous = true;
    oroborosChatReconhecimento.interimResults = true;

    let textoBase = '';

    oroborosChatReconhecimento.onstart = () => {
        oroborosChatOuvindo = true;

        const botao = document.getElementById('oroboros-chat-mic');
        const status = document.getElementById('oroboros-voice-status');

        if (botao) botao.classList.add('active');
        if (status) {
            status.hidden = false;
            status.textContent = 'Ouvindo...';
        }
    };

    oroborosChatReconhecimento.onresult = event => {
        const input = document.getElementById('oroboros-chat-input');
        if (!input) return;

        let final = '';
        let interim = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const trecho = event.results[i][0].transcript;

            if (event.results[i].isFinal) {
                final += trecho + ' ';
            } else {
                interim += trecho;
            }
        }

        if (final) {
            textoBase += final;
            input.value = textoBase.trim() + ' ';
        }

        const preview = document.getElementById('oroboros-voice-status');

        if (preview && interim) {
            preview.hidden = false;
            preview.textContent = `Ouvindo: ${interim}`;
        }

        input.dispatchEvent(new Event('input'));

        requestAnimationFrame(() => {
            input.scrollTop = input.scrollHeight;
        });
    };

    oroborosChatReconhecimento.onerror = event => {
        console.error('Voz Oroboros:', event.error);

        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            pararOroborosChatVoz();
        }
    };

    oroborosChatReconhecimento.onend = () => {
        if (oroborosChatOuvindo) {
            try {
                oroborosChatReconhecimento.start();
            } catch (_) {}
        }
    };

    window._oroborosChatTextoBase = () => textoBase;
    window._setOroborosChatTextoBase = valor => {
        textoBase = valor || '';
    };
}

function toggleOroborosChatVoz() {
    if (!oroborosChatReconhecimento) {
        inicializarReconhecimentoOroborosChat();
    }

    if (!oroborosChatReconhecimento) return;

    if (oroborosChatOuvindo) {
        pararOroborosChatVoz();
    } else {
        iniciarOroborosChatVoz();
    }
}

function iniciarOroborosChatVoz() {
    if (!oroborosChatReconhecimento) return;

    const input = document.getElementById('oroboros-chat-input');

    if (input) {
        window._setOroborosChatTextoBase(input.value.trim());
    }

    oroborosChatOuvindo = true;

    try {
        oroborosChatReconhecimento.start();
    } catch (_) {}

    const status = document.getElementById('oroboros-voice-status');

    if (status) {
        status.hidden = false;
        status.textContent = 'Ouvindo...';
    }
}

function pararOroborosChatVoz() {
    oroborosChatOuvindo = false;

    if (oroborosChatReconhecimento) {
        try {
            oroborosChatReconhecimento.stop();
        } catch (_) {}
    }

    const botao = document.getElementById('oroboros-chat-mic');
    const status = document.getElementById('oroboros-voice-status');

    if (botao) botao.classList.remove('active');

    if (status) {
        status.hidden = true;
        status.textContent = '';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    inicializarOroborosChat();
});


/* =========================================================
   CONSTELAÇÃO — REFORMA VISUAL
   Mantém os dados reais e a Massa Cognitiva.
   ========================================================= */

function inicializarConstelacao() {
    const canvas = document.getElementById('constelacao-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const wrap = canvas.parentElement;

    let W = 0;
    let H = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const views = JSON.parse(localStorage.getItem('neuroNodeViews') || '{}');

    const massaDoNo = n => {
        const texto = `${n.titulo || ''} ${n.descricao || ''}`.trim().length;
        const conexoes = obterConexoesDoNo(n.id).length;
        const visualizacoes = Number(views[n.id] || 0);

        return (
            1 +
            Math.min(10, texto / 180) +
            conexoes * 1.6 +
            Math.min(8, visualizacoes * 0.7)
        );
    };

    let zoom = 1;
    let offset = { x: 0, y: 0 };

    const nodes = ANALOGIAS_NODES.map((n, i) => {
        const massa = massaDoNo(n);

        return {
            n,
            massa,
            r: Math.min(24, 5 + Math.sqrt(massa) * 2.1),
            x: W * (0.18 + ((n.x ?? (15 + (i * 17) % 70)) / 100) * 0.64),
            y: H * (0.18 + ((n.y ?? (20 + (i * 29) % 60)) / 100) * 0.64),
            vx: 0,
            vy: 0,
            drag: false
        };
    });

    const nodeById = id => nodes.find(p => p.n.id === id);

    let hover = null;
    let dragNode = null;
    let pan = false;
    let last = { x: 0, y: 0 };
    let moved = false;

    function resize() {
        const rect = wrap.getBoundingClientRect();

        W = Math.max(320, rect.width);
        H = Math.max(400, rect.height);
        dpr = Math.min(window.devicePixelRatio || 1, 2);

        canvas.width = Math.floor(W * dpr);
        canvas.height = Math.floor(H * dpr);
        canvas.style.width = `${W}px`;
        canvas.style.height = `${H}px`;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function mundoParaTela(x, y) {
        return {
            x: (x - W / 2) * zoom + W / 2 + offset.x,
            y: (y - H / 2) * zoom + H / 2 + offset.y
        };
    }

    function telaParaMundo(x, y) {
        return {
            x: (x - W / 2 - offset.x) / zoom + W / 2,
            y: (y - H / 2 - offset.y) / zoom + H / 2
        };
    }

    function findNode(screenX, screenY) {
        const pos = telaParaMundo(screenX, screenY);

        return nodes
            .slice()
            .sort((a, b) => b.r - a.r)
            .find(p => Math.hypot(p.x - pos.x, p.y - pos.y) < p.r + 15 / zoom);
    }

    function aumentarVisualizacao(n) {
        views[n.id] = Number(views[n.id] || 0) + 1;
        localStorage.setItem('neuroNodeViews', JSON.stringify(views));
    }

    function desenharFundo(t) {
        const grad = ctx.createRadialGradient(
            W * 0.5,
            H * 0.46,
            10,
            W * 0.5,
            H * 0.46,
            Math.max(W, H) * 0.72
        );

        grad.addColorStop(0, 'rgba(30,64,175,.13)');
        grad.addColorStop(0.42, 'rgba(15,23,42,.42)');
        grad.addColorStop(1, '#030712');

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        /* campo de estrelas */
        for (let i = 0; i < 95; i++) {
            const x = (i * 83.17) % W;
            const y = (i * 47.31) % H;
            const pulse = 0.35 + Math.sin(t * 0.0007 + i) * 0.2;

            ctx.beginPath();
            ctx.arc(x, y, i % 7 === 0 ? 1.15 : 0.55, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(147,197,253,${Math.max(.08, pulse)})`;
            ctx.fill();
        }

        /* halo central */
        const halo = ctx.createRadialGradient(
            W / 2,
            H / 2,
            0,
            W / 2,
            H / 2,
            Math.min(W, H) * 0.34
        );

        halo.addColorStop(0, 'rgba(59,130,246,.055)');
        halo.addColorStop(1, 'rgba(59,130,246,0)');

        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, W, H);
    }

    function atualizarFisica() {
        if (!nodes.length) return;

        for (let i = 0; i < nodes.length; i++) {
            const a = nodes[i];

            for (let j = i + 1; j < nodes.length; j++) {
                const b = nodes[j];

                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const dist = Math.max(18, Math.hypot(dx, dy));
                const nx = dx / dist;
                const ny = dy / dist;

                const distanciaIdeal =
                    100 +
                    Math.min(100, (a.massa + b.massa) * 4);

                const forca =
                    (distanciaIdeal - dist) * 0.0009;

                if (!a.drag) {
                    a.vx += nx * forca;
                    a.vy += ny * forca;
                }

                if (!b.drag) {
                    b.vx -= nx * forca;
                    b.vy -= ny * forca;
                }

                /* repulsão */
                if (dist < 170) {
                    const repel =
                        (170 - dist) / 170 * 0.045;

                    if (!a.drag) {
                        a.vx -= nx * repel;
                        a.vy -= ny * repel;
                    }

                    if (!b.drag) {
                        b.vx += nx * repel;
                        b.vy += ny * repel;
                    }
                }
            }
        }

        /* conexões funcionam como fios elásticos */
        ANALOGIAS_CONNECTIONS.forEach(c => {
            const a = nodeById(c.de);
            const b = nodeById(c.para);

            if (!a || !b) return;

            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.max(1, Math.hypot(dx, dy));
            const nx = dx / dist;
            const ny = dy / dist;

            const target =
                90 +
                Math.min(90, (a.massa + b.massa) * 3.5);

            const force = (dist - target) * 0.0015;

            if (!a.drag) {
                a.vx += nx * force * (1 + b.massa * 0.08);
                a.vy += ny * force * (1 + b.massa * 0.08);
            }

            if (!b.drag) {
                b.vx -= nx * force * (1 + a.massa * 0.08);
                b.vy -= ny * force * (1 + a.massa * 0.08);
            }
        });

        nodes.forEach(p => {
            if (p.drag) return;

            p.vx *= 0.985;
            p.vy *= 0.985;

            p.vx = Math.max(-0.75, Math.min(0.75, p.vx));
            p.vy = Math.max(-0.75, Math.min(0.75, p.vy));

            p.x += p.vx;
            p.y += p.vy;

            p.x = Math.max(30, Math.min(W - 30, p.x));
            p.y = Math.max(30, Math.min(H - 30, p.y));
        });
    }

    function desenharConexao(a, b, ativo, t) {
        const A = mundoParaTela(a.x, a.y);
        const B = mundoParaTela(b.x, b.y);

        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const dist = Math.max(1, Math.hypot(dx, dy));

        const nx = -dy / dist;
        const ny = dx / dist;

        const curva =
            Math.min(32, dist * 0.12) *
            Math.sin((a.massa + b.massa) * 0.4);

        const cx = (A.x + B.x) / 2 + nx * curva;
        const cy = (A.y + B.y) / 2 + ny * curva;

        ctx.beginPath();
        ctx.moveTo(A.x, A.y);
        ctx.quadraticCurveTo(cx, cy, B.x, B.y);

        ctx.strokeStyle = ativo
            ? 'rgba(125,211,252,.65)'
            : 'rgba(96,165,250,.18)';

        ctx.lineWidth = ativo
            ? 1.8
            : Math.min(2.4, 0.65 + (a.massa + b.massa) * 0.025);

        ctx.shadowBlur = ativo ? 12 : 4;
        ctx.shadowColor = 'rgba(59,130,246,.65)';
        ctx.stroke();
        ctx.shadowBlur = 0;

        /* pequeno pulso percorrendo a conexão */
        if (ativo) {
            const progress = (t * 0.00008) % 1;

            const px =
                (1 - progress) * (1 - progress) * A.x +
                2 * (1 - progress) * progress * cx +
                progress * progress * B.x;

            const py =
                (1 - progress) * (1 - progress) * A.y +
                2 * (1 - progress) * progress * cy +
                progress * progress * B.y;

            ctx.beginPath();
            ctx.arc(px, py, 2.1, 0, Math.PI * 2);
            ctx.fillStyle = '#bae6fd';
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#60a5fa';
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    }

    function desenharNo(p, t) {
        const pos = mundoParaTela(p.x, p.y);

        const ativo = hover === p;
        const pulsar =
            1 +
            Math.sin(t * 0.0018 + p.massa) * 0.035;

        const raio =
            (p.r + (ativo ? 3 : 0)) *
            pulsar *
            Math.max(0.8, Math.min(1.2, zoom));

        /* aura */
        const aura = ctx.createRadialGradient(
            pos.x,
            pos.y,
            0,
            pos.x,
            pos.y,
            raio * (ativo ? 5 : 3.5)
        );

        aura.addColorStop(
            0,
            ativo
                ? 'rgba(147,197,253,.32)'
                : 'rgba(96,165,250,.16)'
        );
        aura.addColorStop(1, 'rgba(59,130,246,0)');

        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.arc(
            pos.x,
            pos.y,
            raio * (ativo ? 5 : 3.5),
            0,
            Math.PI * 2
        );
        ctx.fill();

        /* quatro pequenos pontos orbitais */
        for (let i = 0; i < 4; i++) {
            const ang =
                t * 0.00025 +
                i * Math.PI / 2 +
                p.massa;

            const ox = pos.x + Math.cos(ang) * raio * 1.75;
            const oy = pos.y + Math.sin(ang) * raio * 1.75;

            ctx.beginPath();
            ctx.arc(ox, oy, ativo ? 1.5 : 0.9, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(147,197,253,.6)';
            ctx.fill();
        }

        /* núcleo */
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, raio, 0, Math.PI * 2);

        const nucleo = ctx.createRadialGradient(
            pos.x - raio * .3,
            pos.y - raio * .3,
            1,
            pos.x,
            pos.y,
            raio
        );

        nucleo.addColorStop(0, '#e0f2fe');
        nucleo.addColorStop(.35, '#93c5fd');
        nucleo.addColorStop(1, '#2563eb');

        ctx.fillStyle = nucleo;
        ctx.shadowBlur = ativo ? 30 : 13 + p.massa;
        ctx.shadowColor = '#3b82f6';
        ctx.fill();
        ctx.shadowBlur = 0;

        /* centro */
        ctx.beginPath();
        ctx.arc(
            pos.x - raio * .28,
            pos.y - raio * .28,
            Math.max(1.2, raio * .22),
            0,
            Math.PI * 2
        );

        ctx.fillStyle = '#f8fafc';
        ctx.fill();

        if (ativo || p.massa > 8) {
            ctx.save();

            ctx.font = '600 11px Inter, sans-serif';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#e0f2fe';
            ctx.shadowBlur = 8;
            ctx.shadowColor = 'rgba(59,130,246,.7)';

            const titulo = p.n.titulo || 'Pensamento';

            ctx.fillText(
                titulo,
                pos.x + raio + 10,
                pos.y - raio - 4
            );

            ctx.restore();
        }
    }

    function desenharVazio() {
        ctx.save();

        ctx.textAlign = 'center';

        ctx.fillStyle = 'rgba(148,163,184,.12)';
        ctx.font = '600 42px Inter, sans-serif';
        ctx.fillText('✦', W / 2, H / 2 - 30);

        ctx.fillStyle = 'rgba(226,232,240,.72)';
        ctx.font = '600 13px Inter, sans-serif';
        ctx.fillText(
            'Sua constelação ainda está vazia',
            W / 2,
            H / 2 + 12
        );

        ctx.fillStyle = 'rgba(148,163,184,.52)';
        ctx.font = '400 10px Inter, sans-serif';
        ctx.fillText(
            'Os pensamentos aparecerão aqui quando forem registrados.',
            W / 2,
            H / 2 + 34
        );

        ctx.restore();
    }

    function render(t = 0) {
        atualizarFisica();

        ctx.clearRect(0, 0, W, H);
        desenharFundo(t);

        if (!nodes.length) {
            desenharVazio();
            requestAnimationFrame(render);
            return;
        }

        ANALOGIAS_CONNECTIONS.forEach(c => {
            const a = nodeById(c.de);
            const b = nodeById(c.para);

            if (!a || !b) return;

            const ativo =
                hover === a ||
                hover === b;

            desenharConexao(a, b, ativo, t);
        });

        nodes
            .slice()
            .sort((a, b) => a.massa - b.massa)
            .forEach(p => desenharNo(p, t));

        requestAnimationFrame(render);
    }

    canvas.onpointerdown = e => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const node = findNode(x, y);

        moved = false;
        last = { x: e.clientX, y: e.clientY };

        if (node) {
            dragNode = node;
            node.drag = true;
            aumentarVisualizacao(node.n);
        } else {
            pan = true;
        }

        canvas.classList.add('dragging');

        try {
            canvas.setPointerCapture(e.pointerId);
        } catch (_) {}
    };

    canvas.onpointermove = e => {
        const rect = canvas.getBoundingClientRect();

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (dragNode) {
            const pos = telaParaMundo(x, y);

            dragNode.x = pos.x;
            dragNode.y = pos.y;
            dragNode.vx = 0;
            dragNode.vy = 0;

            moved = true;
            return;
        }

        if (pan) {
            offset.x += e.clientX - last.x;
            offset.y += e.clientY - last.y;

            last = {
                x: e.clientX,
                y: e.clientY
            };

            moved = true;
            return;
        }

        hover = findNode(x, y);

        const tip = document.getElementById('constelacao-tooltip');

        if (tip && hover) {
            tip.style.display = 'block';

            tip.style.left =
                Math.min(x + 16, W - 190) + 'px';

            tip.style.top =
                Math.min(y + 16, H - 80) + 'px';

            tip.innerHTML = `
                <strong>${escHtml(hover.n.titulo)}</strong>
                <span>
                    ${tipoAnalogiaLabel(hover.n.tipo)}
                    · massa ${hover.massa.toFixed(1)}
                    · ${obterConexoesDoNo(hover.n.id).length}
                    conexões
                </span>
            `;
        } else if (tip) {
            tip.style.display = 'none';
        }
    };

    const release = e => {
        if (dragNode) {
            dragNode.drag = false;
            dragNode = null;
        }

        pan = false;
        canvas.classList.remove('dragging');

        try {
            canvas.releasePointerCapture(e.pointerId);
        } catch (_) {}
    };

    canvas.onpointerup = release;
    canvas.onpointercancel = release;

    canvas.onpointerleave = () => {
        if (!dragNode && !pan) {
            hover = null;

            const tip =
                document.getElementById('constelacao-tooltip');

            if (tip) tip.style.display = 'none';
        }
    };

    canvas.onclick = e => {
        if (moved) return;

        const rect = canvas.getBoundingClientRect();

        const node = findNode(
            e.clientX - rect.left,
            e.clientY - rect.top
        );

        if (!node || !node.n.pagina) return;

        aumentarVisualizacao(node.n);

        const btn =
            document.querySelector(
                `[data-page="${node.n.pagina}"]`
            );

        carregarPagina(node.n.pagina, btn);
    };

    canvas.onwheel = e => {
        e.preventDefault();

        const rect = canvas.getBoundingClientRect();

        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const antes = telaParaMundo(mouseX, mouseY);

        const fator = e.deltaY > 0 ? 0.9 : 1.1;

        zoom = Math.max(
            0.55,
            Math.min(2.4, zoom * fator)
        );

        const depois = telaParaMundo(mouseX, mouseY);

        offset.x += (depois.x - antes.x) * zoom;
        offset.y += (depois.y - antes.y) * zoom;
    };

    constelacaoEstado = {
        offset,
        nodes,
        get zoom() {
            return zoom;
        },
        set zoom(valor) {
            zoom = Math.max(.55, Math.min(2.4, valor));
        }
    };

    resize();

    if (constelacaoResizeObserver) {
        constelacaoResizeObserver.disconnect();
    }

    constelacaoResizeObserver =
        new ResizeObserver(resize);

    constelacaoResizeObserver.observe(wrap);

    requestAnimationFrame(render);
}

function recentralizarConstelacao() {
    if (!constelacaoEstado) return;

    constelacaoEstado.offset.x = 0;
    constelacaoEstado.offset.y = 0;
    constelacaoEstado.zoom = 1;
}


/* =========================================================
   CONSTELAÇÃO — REFORMA VISUAL
   Mantém os dados reais e a Massa Cognitiva.
   ========================================================= */



/* =========================================================
   NEUROFISIOLOGIA 11.0.2
   Fatos biológicos → fichas → pontes → simuladores
   Não cria conteúdo pessoal automaticamente.
   ========================================================= */
(() => {
    const FICHAS_KEY = 'neurospaceNeurofisiologiaFichas';
    const BRIDGES_KEY = 'neurospaceBioCognitiveBridges';

    const fichasPadrao = [
        {
            id: 'potencial-acao',
            mecanismo: 'Potencial de Ação e Despolarização da Membrana',
            estruturas: 'Membrana neuronal, canais de Na⁺ e K⁺, axônio',
            escala: 'Celular / Molecular',
            descricao: 'Processo elétrico pelo qual alterações no potencial de membrana permitem a propagação de um sinal ao longo do neurônio.',
            ponte: ''
        },
        {
            id: 'conducao-saltatoria',
            mecanismo: 'Condução Saltatória',
            estruturas: 'Axônio, bainha de mielina, nódulos de Ranvier',
            escala: 'Celular',
            descricao: 'Forma de propagação do potencial de ação em axônios mielinizados, com regeneração do sinal nos nódulos de Ranvier.',
            ponte: ''
        },
        {
            id: 'ltp',
            mecanismo: 'Potenciação de Longa Duração (LTP)',
            estruturas: 'Sinapses, receptores NMDA e AMPA, neurônio pós-sináptico',
            escala: 'Molecular / Celular / Circuitos',
            descricao: 'Processo de plasticidade sináptica associado ao fortalecimento duradouro da transmissão entre determinados neurônios.',
            ponte: ''
        },
        {
            id: 'transmissao-sinaptica',
            mecanismo: 'Transmissão Sináptica',
            estruturas: 'Terminal pré-sináptico, vesículas, neurotransmissores, receptores pós-sinápticos',
            escala: 'Molecular / Celular',
            descricao: 'Processo de comunicação entre células nervosas por meio da liberação e recepção de sinais químicos ou elétricos.',
            ponte: ''
        }
    ];

    function nfLer(chave, padrao) {
        try {
            const valor = localStorage.getItem(chave);
            return valor ? JSON.parse(valor) : padrao;
        } catch {
            return padrao;
        }
    }

    function nfSalvar(chave, valor) {
        localStorage.setItem(chave, JSON.stringify(valor));
    }

    function nfEscape(texto = '') {
        return String(texto)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function nfObterFichas() {
        const existentes = nfLer(FICHAS_KEY, null);

        if (!existentes) {
            nfSalvar(FICHAS_KEY, fichasPadrao);
            return [...fichasPadrao];
        }

        return existentes;
    }

    function nfObterPontes() {
        return nfLer(BRIDGES_KEY, []);
    }

    function nfInicializar() {
        const pagina = document.querySelector('[data-neurofisiologia]');
        if (!pagina) return;

        nfInicializarAbas(pagina);
        nfRenderizarFichas();
        nfRenderizarPontes();
        nfInicializarAcoes(pagina);
    }

    function nfInicializarAbas(pagina) {
        const tabs = pagina.querySelectorAll('[data-nf-tab]');
        const panels = pagina.querySelectorAll('[data-nf-panel]');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const alvo = tab.dataset.nfTab;

                tabs.forEach(t => t.classList.toggle('ativo', t === tab));

                panels.forEach(panel => {
                    panel.hidden = panel.dataset.nfPanel !== alvo;
                });
            });
        });
    }

    function nfRenderizarFichas() {
        const container = document.getElementById('nf-cards');
        if (!container) return;

        const fichas = nfObterFichas();
        const pontes = nfObterPontes();

        if (!fichas.length) {
            container.innerHTML = `
                <div class="nf-empty">
                    <strong>Nenhuma ficha fisiológica.</strong>
                    <span>Crie seu primeiro registro biológico.</span>
                </div>
            `;
            return;
        }

        container.innerHTML = fichas.map(ficha => {
            const ponte = pontes.find(p => p.fichaId === ficha.id);

            return `
                <article class="nf-card">
                    <div class="nf-card-top">
                        <span class="nf-card-index">FICHA FISIOLÓGICA</span>
                        <span class="nf-scale">${nfEscape(ficha.escala)}</span>
                    </div>

                    <h3>${nfEscape(ficha.mecanismo)}</h3>

                    <div class="nf-field">
                        <small>MECANISMO / PROCESSO</small>
                        <p>${nfEscape(ficha.descricao)}</p>
                    </div>

                    <div class="nf-field">
                        <small>ESTRUTURAS & CIRCUITOS</small>
                        <p>${nfEscape(ficha.estruturas)}</p>
                    </div>

                    <div class="nf-bridge-field">
                        <small>PONTE COGNITIVA</small>
                        <p>${ponte
                            ? nfEscape(ponte.thoughtLabel)
                            : 'Nenhum pensamento ancorado ainda.'}</p>
                    </div>

                    <div class="nf-card-actions">
                        <button class="nf-action" data-nf-open="${nfEscape(ficha.id)}">
                            Ver ficha
                        </button>

                        <button class="nf-action nf-action-primary"
                                data-nf-anchor="${nfEscape(ficha.id)}">
                            Ancorar Pensamento
                        </button>
                    </div>
                </article>
            `;
        }).join('');

        container.querySelectorAll('[data-nf-open]').forEach(btn => {
            btn.addEventListener('click', () => {
                nfAbrirFicha(btn.dataset.nfOpen);
            });
        });

        container.querySelectorAll('[data-nf-anchor]').forEach(btn => {
            btn.addEventListener('click', () => {
                nfAbrirAncoragem(btn.dataset.nfAnchor);
            });
        });
    }

    function nfAbrirFicha(id) {
        const ficha = nfObterFichas().find(f => f.id === id);
        if (!ficha) return;

        const modal = document.getElementById('nf-modal');
        const content = document.getElementById('nf-modal-content');

        if (!modal || !content) return;

        content.innerHTML = `
            <span class="nf-kicker">FICHA FISIOLÓGICA</span>
            <h2>${nfEscape(ficha.mecanismo)}</h2>

            <div class="nf-modal-section">
                <small>MECANISMO / PROCESSO</small>
                <p>${nfEscape(ficha.descricao)}</p>
            </div>

            <div class="nf-modal-section">
                <small>ESTRUTURAS & CIRCUITOS</small>
                <p>${nfEscape(ficha.estruturas)}</p>
            </div>

            <div class="nf-modal-section">
                <small>ESCALA</small>
                <p>${nfEscape(ficha.escala)}</p>
            </div>

            <div class="nf-modal-section">
                <small>PONTE COGNITIVA</small>
                <p>${ficha.ponte
                    ? nfEscape(ficha.ponte)
                    : 'Ainda não registrada.'}</p>
            </div>
        `;

        modal.hidden = false;
    }

    function nfAbrirAncoragem(fichaId) {
        const ficha = nfObterFichas().find(f => f.id === fichaId);
        if (!ficha) return;

        const modal = document.getElementById('nf-modal');
        const content = document.getElementById('nf-modal-content');

        if (!modal || !content) return;

        content.innerHTML = `
            <span class="nf-kicker">PONTE BIO-COGNITIVA</span>
            <h2>${nfEscape(ficha.mecanismo)}</h2>

            <p class="nf-modal-intro">
                Escolha um pensamento existente para relacionar a este mecanismo.
                A relação não altera o conteúdo do pensamento.
            </p>

            <div class="nf-thought-list" id="nf-thought-list">
                <span>Carregando pensamentos...</span>
            </div>
        `;

        modal.hidden = false;

        nfCarregarPensamentosParaAncoragem(fichaId);
    }

    async function nfCarregarPensamentosParaAncoragem(fichaId) {
        const container = document.getElementById('nf-thought-list');
        if (!container) return;

        const fontes = [
            ['percepcao', 'percepcao.html', 'Percepção'],
            ['homem-sem-nome', 'homem-sem-nome.html', 'O homem sem nome e o julgamento dos covardes'],
            ['freud', 'freud.html', 'Sigmund Freud'],
            ['getulio', 'getulio.html', 'Getúlio Vargas']
        ];

        const pensamentos = [];

        for (const [id, arquivo, titulo] of fontes) {
            try {
                const resposta = await fetch(arquivo, { cache: 'no-store' });
                if (!resposta.ok) continue;

                const html = await resposta.text();
                const doc = new DOMParser().parseFromString(html, 'text/html');

                if (doc.querySelector('.pensamento-vazio')) continue;

                pensamentos.push({
                    id,
                    titulo,
                    pagina: arquivo
                });
            } catch {
                // Fonte indisponível: simplesmente não aparece na lista.
            }
        }

        if (!pensamentos.length) {
            container.innerHTML = `
                <div class="nf-empty">
                    Nenhum pensamento com conteúdo disponível para ancoragem.
                </div>
            `;
            return;
        }

        container.innerHTML = pensamentos.map(p => `
            <button class="nf-thought-option"
                    type="button"
                    data-nf-thought="${nfEscape(p.id)}"
                    data-nf-thought-label="${nfEscape(p.titulo)}">
                <strong>${nfEscape(p.titulo)}</strong>
                <span>${nfEscape(p.pagina)}</span>
            </button>
        `).join('');

        container.querySelectorAll('[data-nf-thought]').forEach(btn => {
            btn.addEventListener('click', () => {
                nfCriarPonte(
                    fichaId,
                    btn.dataset.nfThought,
                    btn.dataset.nfThoughtLabel
                );
            });
        });
    }

    function nfCriarPonte(fichaId, thoughtId, thoughtLabel) {
        const pontes = nfObterPontes();

        const novaPonte = {
            id: `${fichaId}__${thoughtId}`,
            fichaId,
            thoughtId,
            thoughtLabel,
            createdAt: Date.now()
        };

        const existentes = pontes.filter(
            ponte => ponte.id !== novaPonte.id
        );

        existentes.push(novaPonte);

        nfSalvar(BRIDGES_KEY, existentes);
        nfRenderizarFichas();
        nfRenderizarPontes();

        const modal = document.getElementById('nf-modal');
        if (modal) modal.hidden = true;
    }

    function nfRenderizarPontes() {
        const container = document.getElementById('nf-bridges');
        if (!container) return;

        const fichas = nfObterFichas();
        const pontes = nfObterPontes();

        if (!pontes.length) {
            container.innerHTML = `
                <div class="nf-empty">
                    <strong>Nenhuma Ponte Bio-Cognitiva.</strong>
                    <span>
                        As relações que você criar entre mecanismos biológicos
                        e pensamentos aparecerão aqui.
                    </span>
                </div>
            `;
            return;
        }

        container.innerHTML = pontes.map(ponte => {
            const ficha = fichas.find(f => f.id === ponte.fichaId);

            if (!ficha) return '';

            return `
                <article class="nf-bridge-card">
                    <div class="nf-bridge-node biological">
                        <small>CONCEITO BIOLÓGICO</small>
                        <strong>${nfEscape(ficha.mecanismo)}</strong>
                    </div>

                    <div class="nf-bridge-line">
                        <span>PONTE BIO-COGNITIVA</span>
                        <i></i>
                    </div>

                    <div class="nf-bridge-node thought">
                        <small>PENSAMENTO PESSOAL</small>
                        <strong>${nfEscape(ponte.thoughtLabel)}</strong>
                    </div>
                </article>
            `;
        }).join('');
    }

    function nfInicializarAcoes(pagina) {
        pagina.addEventListener('click', event => {
            const action = event.target.closest('[data-nf-action]');
            if (!action) return;

            const tipo = action.dataset.nfAction;

            if (tipo === 'nova-ficha') {
                nfAbrirNovaFicha();
            }

            if (tipo === 'fechar') {
                const modal = document.getElementById('nf-modal');
                if (modal) modal.hidden = true;
            }

            if (tipo === 'impulso') {
                nfSimularImpulso();
            }

            if (tipo === 'membrana') {
                nfSimularMembrana();
            }
        });
    }

    function nfAbrirNovaFicha() {
        const modal = document.getElementById('nf-modal');
        const content = document.getElementById('nf-modal-content');

        if (!modal || !content) return;

        content.innerHTML = `
            <span class="nf-kicker">NOVO REGISTRO</span>
            <h2>Nova ficha fisiológica</h2>

            <form id="nf-new-form" class="nf-form">
                <label>
                    <span>Mecanismo / Processo</span>
                    <input name="mecanismo" required placeholder="Ex.: Potencial de ação">
                </label>

                <label>
                    <span>Estruturas & Circuitos</span>
                    <input name="estruturas" required placeholder="Ex.: Axônio, canais Na⁺/K⁺">
                </label>

                <label>
                    <span>Escola / Escala</span>
                    <input name="escala" required placeholder="Celular / Molecular / Circuitos">
                </label>

                <label>
                    <span>Descrição do mecanismo</span>
                    <textarea name="descricao" rows="4" required></textarea>
                </label>

                <button class="nf-action nf-action-primary" type="submit">
                    Criar ficha
                </button>
            </form>
        `;

        modal.hidden = false;

        const form = document.getElementById('nf-new-form');

        form?.addEventListener('submit', event => {
            event.preventDefault();

            const dados = new FormData(form);

            const ficha = {
                id: `ficha-${Date.now()}`,
                mecanismo: dados.get('mecanismo'),
                estruturas: dados.get('estruturas'),
                escala: dados.get('escala'),
                descricao: dados.get('descricao'),
                ponte: ''
            };

            const fichas = nfObterFichas();
            fichas.push(ficha);

            nfSalvar(FICHAS_KEY, fichas);
            nfRenderizarFichas();

            modal.hidden = true;
        });
    }

    function nfSimularImpulso() {
        const nos = document.querySelectorAll('#nf-track i');
        if (!nos.length) return;

        nos.forEach(no => no.classList.remove('disparando'));

        nos.forEach((no, indice) => {
            setTimeout(() => {
                no.classList.add('on');
            }, indice * 150);
        });
    }

    function nfSimularMembrana() {
        const curva = document.getElementById('nf-curve');
        if (!curva) return;

        curva.classList.remove('run');

        void curva.offsetWidth;

        curva.classList.add('run');
    }

    window.neurofisiologiaInicializar = nfInicializar;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', nfInicializar);
    } else {
        nfInicializar();
    }
})();
