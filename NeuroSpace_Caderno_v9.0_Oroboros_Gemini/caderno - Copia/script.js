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
function inicializarConstelacao(){
    const canvas=document.getElementById('constelacao-canvas');
    if(!canvas)return;
    const ctx=canvas.getContext('2d');
    if(!ctx)return;
    const wrap=canvas.parentElement;
    let W=0,H=0,dpr=1;
    const resize=()=>{
        const rect=wrap.getBoundingClientRect();
        W=Math.max(1,rect.width); H=Math.max(1,rect.height); dpr=Math.min(window.devicePixelRatio||1,2);
        canvas.width=Math.floor(W*dpr); canvas.height=Math.floor(H*dpr); canvas.style.width=W+'px'; canvas.style.height=H+'px';
        ctx.setTransform(dpr,0,0,dpr,0,0);
    };
    resize();

    const views=JSON.parse(localStorage.getItem('neuroNodeViews')||'{}');
    const tagsDoNo=n=>Array.isArray(n.tags)?n.tags:(n.tags?String(n.tags).split(',').map(x=>x.trim()).filter(Boolean):[]);
    const massaDoNo=n=>{
        const texto=(n.descricao||n.conteudo||'').length + String(n.titulo||'').length;
        const conexoes=obterConexoesDoNo(n.id).length;
        const visualizacoes=Number(views[n.id]||0);
        return 1 + Math.min(10,texto/180) + conexoes*1.6 + Math.min(8,visualizacoes*.7);
    };
    const nodes=ANALOGIAS_NODES.map((n,i)=>{
        const massa=massaDoNo(n);
        return {n,massa,r:Math.min(18,4+Math.sqrt(massa)*1.8),x:W*(.12+((n.x??(15+(i*17)%70))/100)*.76),y:H*(.12+((n.y??(20+(i*29)%60))/100)*.76),vx:0,vy:0,fx:null,fy:null,drag:false};
    });
    const nodeById=id=>nodes.find(p=>p.n.id===id);
    const tagGroups=new Map();
    nodes.forEach(p=>tagsDoNo(p.n).forEach(tag=>{if(!tagGroups.has(tag))tagGroups.set(tag,[]);tagGroups.get(tag).push(p);}));
    let offset={x:0,y:0},pan=false,last={x:0,y:0},hover=null,dragNode=null;
    const bounds=()=>({minX:-W*.35,maxX:W*.35,minY:-H*.35,maxY:H*.35});
    const findNode=(x,y)=>{
        const lx=x-offset.x,ly=y-offset.y;
        return nodes.slice().sort((a,b)=>b.r-a.r).find(p=>Math.hypot(p.x-lx,p.y-ly)<p.r+12);
    };
    const aumentarVisualizacao=n=>{views[n.id]=Number(views[n.id]||0)+1;localStorage.setItem('neuroNodeViews',JSON.stringify(views));};

    function fisica(){
        // Repulsão geral + atração suave por tags + gravidade das conexões.
        for(let i=0;i<nodes.length;i++){
            const a=nodes[i];
            if(a.drag)continue;
            a.vx*=.92; a.vy*=.92;
            // centro suave
            a.vx+=(W*.5-a.x)*0.00035; a.vy+=(H*.5-a.y)*0.00035;
            for(let j=i+1;j<nodes.length;j++){
                const b=nodes[j]; if(b.drag)continue;
                let dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy)||1;
                const minDist=a.r+b.r+42;
                if(dist<minDist){const f=(minDist-dist)/minDist*.055; const nx=dx/dist,ny=dy/dist;a.vx-=nx*f;a.vy-=ny*f;b.vx+=nx*f;b.vy+=ny*f;}
            }
            const tags=tagsDoNo(a.n);
            tags.forEach(tag=>{
                const group=tagGroups.get(tag)||[]; if(group.length<2)return;
                let cx=0,cy=0,count=0; group.forEach(g=>{if(g!==a){cx+=g.x;cy+=g.y;count++;}}); if(!count)return;
                cx/=count;cy/=count;a.vx+=(cx-a.x)*0.00055;a.vy+=(cy-a.y)*0.00055;
            });
        }
        ANALOGIAS_CONNECTIONS.forEach(c=>{
            const a=nodeById(c.de),b=nodeById(c.para);if(!a||!b)return;
            const dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy)||1;
            const target=100+Math.min(70,(a.massa+b.massa)*4);
            const force=(dist-target)*0.00065;
            const nx=dx/dist,ny=dy/dist;
            if(!a.drag){a.vx+=nx*force*(1+b.massa*.12);a.vy+=ny*force*(1+b.massa*.12);}
            if(!b.drag){b.vx-=nx*force*(1+a.massa*.12);b.vy-=ny*force*(1+a.massa*.12);}
        });
        // Massa forte cria uma órbita suave para conexões menores ao redor dela.
        nodes.forEach(a=>{
            const linked=obterConexoesDoNo(a.n.id).map(c=>nodeById(c.outro)).filter(Boolean);
            linked.forEach(b=>{
                if(a.massa<=b.massa*1.45 || b.drag)return;
                const dx=a.x-b.x,dy=a.y-b.y,dist=Math.hypot(dx,dy)||1;
                const tangentX=-dy/dist,tangentY=dx/dist;
                const grav=Math.min(.035,a.massa*.0012)/Math.max(1,dist/100);
                b.vx+=dx/dist*grav+tangentX*grav*.42;b.vy+=dy/dist*grav+tangentY*grav*.42;
            });
        });
        const lim=bounds();
        nodes.forEach(p=>{p.vx=Math.max(-1.2,Math.min(1.2,p.vx));p.vy=Math.max(-1.2,Math.min(1.2,p.vy));p.x+=p.vx;p.y+=p.vy;p.x=Math.max(20,Math.min(W-20,p.x));p.y=Math.max(20,Math.min(H-20,p.y));});
    }
    function draw(t){
        ctx.clearRect(0,0,W,H);
        const grad=ctx.createRadialGradient(W*.5,H*.45,10,W*.5,H*.45,Math.max(W,H)*.65);grad.addColorStop(0,'rgba(59,130,246,.08)');grad.addColorStop(1,'rgba(2,6,23,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
        fisica(); ctx.save();ctx.translate(offset.x,offset.y);
        ANALOGIAS_CONNECTIONS.forEach(c=>{const a=nodeById(c.de),b=nodeById(c.para);if(!a||!b)return;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle='rgba(96,165,250,.18)';ctx.lineWidth=Math.min(3,0.7+(a.massa+b.massa)*.045);ctx.stroke();});
        nodes.forEach(p=>{const active=hover===p;const pulse=1+Math.sin(t*.002+p.massa)*.035;const rr=(p.r+(active?3:0))*pulse;ctx.beginPath();ctx.arc(p.x,p.y,rr,0,Math.PI*2);ctx.fillStyle=active?'#bfdbfe':'#60a5fa';ctx.shadowBlur=active?28:10+p.massa*1.2;ctx.shadowColor='#60a5fa';ctx.fill();ctx.shadowBlur=0;if(active||p.massa>8){ctx.fillStyle='#f8fafc';ctx.font='700 11px Inter';ctx.fillText(p.n.titulo,p.x+rr+7,p.y-rr-3);}});
        ctx.restore(); requestAnimationFrame(draw);
    }
    canvas.onpointerdown=e=>{const r=canvas.getBoundingClientRect();const x=e.clientX-r.left,y=e.clientY-r.top;const n=findNode(x,y);if(n){dragNode=n;n.drag=true;n.fx=n.x;n.fy=n.y;aumentarVisualizacao(n.n);}else{pan=true;}last={x:e.clientX,y:e.clientY};canvas.classList.add('dragging');canvas.setPointerCapture?.(e.pointerId);};
    canvas.onpointermove=e=>{const r=canvas.getBoundingClientRect();const x=e.clientX-r.left,y=e.clientY-r.top;if(dragNode){dragNode.x=x-offset.x;dragNode.y=y-offset.y;dragNode.vx=0;dragNode.vy=0;return;}if(pan){offset.x+=e.clientX-last.x;offset.y+=e.clientY-last.y;last={x:e.clientX,y:e.clientY};return;}hover=findNode(x,y);const tip=document.getElementById('constelacao-tooltip');if(tip&&hover){tip.style.display='block';tip.style.left=Math.min(x+14,W-180)+'px';tip.style.top=Math.min(y+14,H-70)+'px';tip.innerHTML=`<strong>${escHtml(hover.n.titulo)}</strong><span>${tipoAnalogiaLabel(hover.n.tipo)} · massa ${hover.massa.toFixed(1)} · ${obterConexoesDoNo(hover.n.id).length} conexões</span>`;}else if(tip)tip.style.display='none';};
    const release=()=>{if(dragNode){dragNode.drag=false;dragNode.fx=dragNode.fy=null;}pan=false;canvas.classList.remove('dragging');};
    canvas.onpointerup=release;canvas.onpointercancel=release;canvas.onpointerleave=()=>{if(!dragNode&&!pan){hover=null;const tip=document.getElementById('constelacao-tooltip');if(tip)tip.style.display='none';}};
    canvas.onclick=e=>{if(dragNode)return;const r=canvas.getBoundingClientRect();const n=findNode(e.clientX-r.left,e.clientY-r.top);if(n&&n.n.pagina){aumentarVisualizacao(n.n);const b=document.querySelector(`[data-page="${n.n.pagina}"]`);carregarPagina(n.n.pagina,b);}};
    constelacaoEstado={offset,nodes};
    if(constelacaoResizeObserver)constelacaoResizeObserver.disconnect();
    constelacaoResizeObserver=new ResizeObserver(resize);constelacaoResizeObserver.observe(wrap);
    requestAnimationFrame(draw);
}

function recentralizarConstelacao(){if(constelacaoEstado)constelacaoEstado.offset.x=constelacaoEstado.offset.y=0;}

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
    return doc.body.innerHTML.trim();
}

function mostrarResultadoOroboros(html) {
    const preview = document.getElementById('oroboros-preview');
    const aplicar = document.getElementById('btn-oroboros-aplicar');
    if (!preview) return;
    oroborosHTMLGerado = limparHTMLOroboros(html);
    preview.innerHTML = oroborosHTMLGerado || '<span class="oroboros-empty">A IA não retornou conteúdo.</span>';
    if (aplicar) aplicar.disabled = !oroborosHTMLGerado;
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

    botao.classList.add('loading');
    botao.disabled = true;
    status.textContent = 'Oroboros está organizando…';
    const aplicar = document.getElementById('btn-oroboros-aplicar');
    if (aplicar) aplicar.disabled = true;

    try {
        const resposta = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: texto, model: window.OROBOROS_CONFIG?.model || 'gpt-5.6-luna' })
        });
        const dados = await resposta.json().catch(() => ({}));
        if (!resposta.ok) throw new Error(dados.error || `Erro ${resposta.status}`);
        if (!dados.html) throw new Error('A IA não devolveu HTML válido.');
        mostrarResultadoOroboros(dados.html);
        status.textContent = 'Pronto para revisar';
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
