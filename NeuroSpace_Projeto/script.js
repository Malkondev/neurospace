function carregarPagina(pagina, elementoBotao = null) {
    // Busca o arquivo HTML correspondente
    fetch(pagina + '.html')
        .then(response => {
            if (!response.ok) throw new Error('Página não encontrada');
            return response.text();
        })
        .then(html => {
            // Insere o HTML na área principal
            document.getElementById('conteudo-principal').innerHTML = html;
            
            // Atualiza o botão ativo no menu lateral, se um botão foi clicado
            if (elementoBotao) {
                document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('ativo'));
                elementoBotao.classList.add('ativo');
            }
        })
        .catch(error => {
            console.error('Erro ao carregar página:', error);
            document.getElementById('conteudo-principal').innerHTML = `
                <div class="empty-state">
                    <div class="icon">🚧</div>
                    <h3>Página em Construção</h3>
                    <p>O arquivo <strong>${pagina}.html</strong> ainda não foi criado ou ocorreu um erro.</p>
                </div>
            `;
        });
}

// Carrega a página inicial automaticamente
window.onload = () => carregarPagina('inicio');
