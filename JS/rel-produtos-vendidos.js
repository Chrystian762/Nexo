/*
 * Relatorio: Produtos Mais Vendidos
 * Ranking dos produtos por quantidade ou faturamento, com Top N configuravel.
 */
(function () {
    'use strict';
    var Nexo = window.Nexo, Rel = window.Rel, fmt = Nexo.fmt, esc = Nexo.esc;
    var $ = function (id) { return document.getElementById(id); };
    var ctx, filtros, tabela;

    function iniciar() {
        ctx = Rel.contexto();
        filtros = Rel.filtros($('rel-filtros'), {
            periodoPadrao: '30d',
            extras: [
                { id: 'categoria', rotulo: 'Categoria', opcoes: [['', 'Todas as categorias']].concat(ctx.categorias.map(function (c) { return [c.id, c.nome]; })) },
                { id: 'ordem', rotulo: 'Ordenar por', opcoes: [['unidades', 'Quantidade vendida'], ['faturamento', 'Maior faturamento'], ['lucro', 'Maior lucro bruto']] },
                { id: 'top', rotulo: 'Quantidade no ranking (Top N)', opcoes: [['5', 'Top 5'], ['10', 'Top 10'], ['20', 'Top 20'], ['50', 'Top 50'], ['0', 'Todos']], padrao: '10' }
            ],
            aoMudar: render
        });

        tabela = Rel.tabela($('rel-tabela'), {
            titulo: 'Ranking de produtos',
            ordem: { chave: 'pos', dir: 'asc' },
            vazio: 'Nenhum produto vendido no período e categoria selecionados.',
            colunas: [
                { chave: 'pos', titulo: 'Pos', alinhar: 'center', render: function (l) { return '<span class="font-bold text-brand-purple">' + l.pos + 'º</span>'; }, csv: function (l) { return l.pos; } },
                {
                    chave: 'nome', titulo: 'Produto', alinhar: 'left',
                    render: function (l) {
                        return '<div class="flex items-center gap-3"><div class="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-gray-400 shrink-0"><i class="fa-solid fa-bottle-droplet"></i></div>' +
                            '<a href="produtos.html?id=' + encodeURIComponent(l.chave) + '" class="font-medium text-gray-900 hover:text-brand-purple">' + esc(l.nome) + '</a></div>';
                    },
                    csv: function (l) { return l.nome; }
                },
                { chave: 'categoria', titulo: 'Categoria', alinhar: 'left', valor: function (l) { return l.item.categoria; }, render: function (l) { return '<span class="bg-purple-50 text-brand-purple px-2 py-1 rounded text-xs font-semibold">' + esc(l.item.categoria) + '</span>'; }, csv: function (l) { return l.item.categoria; } },
                { chave: 'unidades', titulo: 'Qtd. vendida', alinhar: 'center', total: 'soma', formatar: fmt.numero, render: function (l) { return '<span class="font-bold text-gray-700">' + fmt.numero(l.unidades) + '</span>'; } },
                { chave: 'precoMedio', titulo: 'Preço médio', alinhar: 'right', valor: function (l) { return l.unidades ? l.faturamento / l.unidades : 0; }, formatar: fmt.moeda },
                { chave: 'faturamento', titulo: 'Faturamento (R$)', alinhar: 'right', total: 'soma', formatar: fmt.moeda, render: function (l) { return '<span class="font-bold text-gray-900">' + fmt.moeda(l.faturamento) + '</span>'; } },
                { chave: 'lucro', titulo: 'Lucro bruto', alinhar: 'right', total: 'soma', formatar: fmt.moeda }
            ]
        });

        Rel.ligarBotoes({ nome: 'produtos-mais-vendidos', tabelas: { ranking: function () { return tabela; } } });
        render(filtros.ler());
    }

    function render(f) {
        var per = f.periodo;
        var fi = { categoriaId: f.v.categoria };
        var itens = Rel.itens(ctx, Rel.pedidos(ctx, per.inicio, per.fimEfetivo), fi);
        var itensAnt = Rel.itens(ctx, Rel.pedidos(ctx, per.anterior.inicio, per.anterior.fim), fi);
        var todos = Rel.agruparItens(itens, 'produtoId');
        var ordem = f.v.ordem;
        todos.sort(function (a, b) { return b[ordem] - a[ordem]; });
        todos.forEach(function (l, i) { l.pos = i + 1; });

        var topN = Number(f.v.top) || 0;
        var ranking = topN ? todos.slice(0, topN) : todos;
        var totalUn = Rel.somar(todos, function (l) { return l.unidades; });
        var totalUnAnt = Rel.somar(itensAnt, function (i) { return i.quantidade; });
        var lider = todos[0];

        Rel.cabecalho({ subtitulo: 'Ranking dos itens com maior saída entre ' + fmt.data(per.inicio) + ' e ' + fmt.data(per.fim), filtros: f.descricao });
        Rel.kpis($('rel-kpis'), [
            { titulo: 'Produto destaque', valor: lider ? lider.nome : '-', cor: 'normal', truncar: true, sub: lider ? '<span class="text-brand-purple font-semibold">' + fmt.numero(lider.unidades) + ' unidades vendidas</span>' : 'Sem vendas no período' },
            { titulo: 'Total de itens vendidos', valor: fmt.numero(totalUn), variacao: { atual: totalUn, anterior: totalUnAnt } }
        ], { lateral: true });

        var rotuloOrdem = { unidades: 'Quantidade', faturamento: 'Faturamento', lucro: 'Lucro bruto' }[ordem];
        var paraGrafico = ranking.slice(0, 10);
        $('rel-grafico-titulo').textContent = 'Top ' + paraGrafico.length + ' produtos (' + rotuloOrdem + ')';
        Rel.grafico('rankingChart', {
            tipo: 'bar', horizontal: true, formato: ordem === 'unidades' ? 'numero' : 'moeda',
            labels: paraGrafico.map(function (l) { return l.nome.length > 28 ? l.nome.slice(0, 27) + '…' : l.nome; }),
            datasets: [{ label: rotuloOrdem, data: paraGrafico.map(function (l) { return l[ordem]; }) }]
        });

        $('rel-tabela-info').textContent = 'Exibindo ' + ranking.length + ' de ' + todos.length + ' produtos';
        tabela.atualizar(ranking);
    }

    Rel.iniciar(iniciar);
})();
