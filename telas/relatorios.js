// Aguarda o documento HTML ser totalmente carregado antes de rodar o script
document.addEventListener("DOMContentLoaded", () => {
    
    // Pega o botão de exportar relatório pelo ID
    const btnExport = document.getElementById("btnExport");

    // Adiciona um evento de clique ao botão de exportar
    if (btnExport) {
        btnExport.addEventListener("click", () => {
            alert("Iniciando download do relatório em PDF...");
            // Aqui no sistema real, você chamaria a função para gerar o arquivo
        });
    }

    // Pega todos os botões dentro da área de ações dos filtros (Aplicar e Limpar)
    const filterButtons = document.querySelectorAll(".filter-actions .btn");

    filterButtons.forEach(button => {
        button.addEventListener("click", (e) => {
            // Verifica se o texto do botão clicado contém a palavra "Aplicar"
            if (e.target.innerText.includes("Aplicar")) {
                alert("Filtros aplicados! Atualizando gráficos...");
            } 
            // Verifica se o texto do botão clicado contém a palavra "Limpar"
            else if (e.target.innerText.includes("Limpar")) {
                alert("Filtros limpos. Retornando à visão padrão.");
            }
        });
    });

    // Pega todos os botões "Ver relatório >" dos cartões menores
    const viewReportButtons = document.querySelectorAll(".btn-outline-small");

    viewReportButtons.forEach(button => {
        button.addEventListener("click", function() {
            // Volta um elemento acima na árvore do HTML (parentElement) e pega o texto do título (h4)
            const reportTitle = this.parentElement.querySelector("h4").innerText;
            
            // Mostra um alerta com o nome do relatório específico que foi clicado
            alert(`Você será redirecionado para o relatório completo de: ${reportTitle}`);
        });
    });
});