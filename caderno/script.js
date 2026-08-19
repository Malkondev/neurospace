// Função para carregar os arquivos HTML externos dinamicamente
async function carregarPagina(nomeArquivo, elementoBotao) {
    // 1. Atualiza o visual dos botões
    const botoes = document.querySelectorAll('.nav-btn');
    botoes.forEach(btn => btn.classList.remove('ativo'));
    if (elementoBotao) elementoBotao.classList.add('ativo');

    // 2. Busca o arquivo HTML correspondente
    const container = document.getElementById('app-content');
    
    try {
        const resposta = await fetch(`${nomeArquivo}.html`);
        
        if (!resposta.ok) {
            throw new Error(`Erro ao carregar a página: ${nomeArquivo}`);
        }
        
        const html = await resposta.text();
        
        // 3. Injeta o HTML no container principal e refaz a animação
        container.innerHTML = html;
        container.className = ''; // Remove a classe
        void container.offsetWidth; // Força o navegador a recalcular (truque de animação)
        container.className = 'fade-in'; // Adiciona novamente para animar
        
    } catch (erro) {
        console.error(erro);
        container.innerHTML = `
            <div class="empty-state">
                <h2>Ops! Arquivo não encontrado.</h2>
                <p>Certifique-se de que o arquivo <strong>${nomeArquivo}.html</strong> existe na sua pasta e que você está usando o Live Server.</p>
            </div>
        `;
    }
}

// Carrega a página inicial assim que o site abrir
window.onload = () => {
    // Pega o primeiro botão (Início) para deixá-lo ativo ao iniciar
    const botaoInicio = document.querySelector('.nav-btn');
    carregarPagina('inicio', botaoInicio);
};