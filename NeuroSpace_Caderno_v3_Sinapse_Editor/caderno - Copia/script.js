/* =========================================================
   NEUROSPACE - SCRIPT PRINCIPAL DE LÓGICA E INTERATIVIDADE
   ========================================================= */

// --- Estado Global da Aplicação ---
let memoriaCurtoPrazo = [];
let modoFocoAtivo = false;
let bionicAtivo = false;
let conteudoOriginal = "";

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

    // Inicializa notas da Sinapse Rápida
    inicializarSinapse();

    // Carrega a página inicial por padrão
    const botaoInicio = document.querySelector('[data-page="inicio"]');
    carregarPagina('inicio', botaoInicio);
    requestAnimationFrame(sincronizarSynapseDot);
});

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
   4. MEMÓRIA DE NAVEGAÇÃO
   --------------------------------------------------------- */
function atualizarMemoria(pageId) {
    memoriaCurtoPrazo = memoriaCurtoPrazo.filter(p => p !== pageId);
    memoriaCurtoPrazo.unshift(pageId);

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
        if (statusSync) statusSync.innerText = 'Status: Sincronizado';
    });

    inicializarFerramentasSinapse();
    inicializarArrastoSinapse();
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

    if (modificador && e.shiftKey) {
        const alinhamentos = { l: 'justifyLeft', e: 'justifyCenter', r: 'justifyRight' };
        if (alinhamentos[tecla]) {
            e.preventDefault();
            executarComandoSinapse(alinhamentos[tecla]);
        }
    }
});

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