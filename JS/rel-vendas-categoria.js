/*
 * Relatorio: Vendas por Categoria
 * Receita dos itens vendidos (ja com o desconto do pedido rateado, sem frete) agrupada por categoria.
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
                { id: 'ordem', rotulo: 'Ordenar por', opcoes: [['faturamento', 'Maior faturamento'], ['unidades', 'Maior volume de vendas'], ['nome', 'Nome da categoria']] }
            ],
            aoMudar: render
        });

        tabela = Rel.tabela($('rel-tabela'), {
            titulo: 'Vendas por categoria',
            ordem: { chave: 'faturamento', dir: 'desc' },
            vazio: 'Nenhuma venda encontrada para a categoria e o período selecionados.',
            colunas: [
                { chave: 'nome', titulo: 'Categoria', alinhar: 'left', render: function (l) { return '<span class="font-bold text-gray-900">' + esc(l.nome) + '</span>'; }, csv: function (l) { return l.nome; } },
                { chave: 'unidades', titulo: 'Qtd. unidades', alinhar: 'center', total: 'soma', formatar: fmt.numero },
                { chave: 'faturamento', titulo: 'Faturamento', alinhar: 'right', total: 'soma', formatar: fmt.moeda, render: function (l) { return '<span class="font-bold text-gray-900">' + fmt.moeda(l.faturamento) + '</span>'; } },
                { chave: 'lucro', titulo: 'Lucro bruto', alinhar: 'right', total: 'soma', formatar: fmt.moeda },
                { chave: 'margem', titulo: 'Margem', alinhar: 'right', formatar: function (v) { return fmt.porcentagem(v); }, total: function (ls) { var f = Rel.somar(ls, function (l) { return l.faturamento; }); return f ? Rel.somar(ls, function (l) { return l.lucro; }) / f * 100 : 0; } },
                { chave: 'part', titulo: 'Part. (%)', alinhar: 'right', total: 'soma', formatar: function (v) { return fmt.porcentagem(v); } }
            ]
        });

        Rel.ligarBotoes({ nome: 'vendas-por-categoria', tabelas: { categorias: function () { return tabela; } } });
        render(filtros.ler());
    }

    function render(f) {
        var per = f.periodo;
        var fi = { categoriaId: f.v.categoria };
        var itens = Rel.itens(ctx, Rel.pedidos(ctx, per.inicio, per.fimEfetivo), fi);
        var itensAnt = Rel.itens(ctx, Rel.pedidos(ctx, per.anterior.inicio, per.anterior.fim), fi);
        var linhas = Rel.agruparItens(itens, 'categoria');

        var fat = Rel.somar(linhas, function (l) { return l.faturamento; });
        var fatAnt = Rel.somar(itensAnt, function (i) { return i.receita; });
        var un = Rel.somar(linhas, function (l) { return l.unidades; });
        var unAnt = Rel.somar(itensAnt, function (i) { return i.quantidade; });
        var destaque = linhas.slice().sort(function (a, b) { return b.faturamento - a.faturamento; })[0];

        Rel.cabecalho({ subtitulo: 'Receita por grupo de produtos de ' + fmt.data(per.inicio) + ' a ' + fmt.data(per.fim), filtros: f.descricao });
        Rel.kpis($('rel-kpis'), [
            { titulo: 'Faturamento geral', valor: fmt.moeda(fat), variacao: { atual: fat, anterior: fatAnt } },
            { titulo: 'Categoria destaque', valor: destaque ? destaque.nome : '-', cor: 'roxo', sub: destaque ? fmt.porcentagem(destaque.part) + ' da receita' : 'Sem vendas no período' },
            { titulo: 'Categorias com vendas', valor: fmt.numero(linhas.length), sub: 'De ' + ctx.categorias.length + ' cadastradas' },
            { titulo: 'Unidades vendidas', valor: fmt.numero(un), variacao: { atual: un, anterior: unAnt } }
        ]);

        var porFat = linhas.slice().sort(function (a, b) { return b.faturamento - a.faturamento; });
        Rel.grafico('categoriasChart', {
            tipo: 'doughnut', formato: 'moeda',
            labels: porFat.map(function (l) { return l.nome; }),
            datasets: [{ data: porFat.map(function (l) { return l.faturamento; }) }]
        });

        $('rel-tabela-info').textContent = linhas.length + ' categoria' + (linhas.length === 1 ? '' : 's');
        tabela.atualizar(linhas);
        tabela.ordenarPor(f.v.ordem === 'nome' ? 'nome' : f.v.ordem, f.v.ordem === 'nome' ? 'asc' : 'desc');
    }

    Rel.iniciar(iniciar);
})();
