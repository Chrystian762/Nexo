/*
 * Relatorio: Produtos Sem Saida
 * Produtos ativos, com estoque, sem venda (pedido nao cancelado) ha 60, 90 ou 120+ dias.
 * Produto nunca vendido conta os dias desde o cadastro.
 */
(function () {
    'use strict';
    var Nexo = window.Nexo, Rel = window.Rel, fmt = Nexo.fmt, esc = Nexo.esc;
    var $ = function (id) { return document.getElementById(id); };
    var ctx, filtros, tabela;

    function iniciar() {
        ctx = Rel.contexto();
        filtros = Rel.filtros($('rel-filtros'), {
            semPeriodo: true,
            extras: [
                { id: 'dias', rotulo: 'Tempo sem venda', opcoes: [['30', '30 dias ou mais'], ['60', '60 dias ou mais'], ['90', '90 dias ou mais'], ['120', '120 dias ou mais']], padrao: '60' },
                { id: 'categoria', rotulo: 'Categoria', opcoes: [['', 'Todas as categorias']].concat(ctx.categorias.map(function (c) { return [c.id, c.nome]; })) },
                { id: 'ordem', rotulo: 'Ordenar por', opcoes: [['valorCusto', 'Maior valor imobilizado'], ['dias', 'Mais dias sem venda'], ['estoque', 'Maior quantidade em estoque']] }
            ],
            aoMudar: render
        });

        tabela = Rel.tabela($('rel-tabela'), {
            titulo: 'Produtos sem saída',
            ordem: { chave: 'valorCusto', dir: 'desc' },
            vazio: 'Nenhum produto parado com esses critérios. Bom sinal: o estoque está girando.',
            colunas: [
                {
                    chave: 'nome', titulo: 'Produto', alinhar: 'left',
                    render: function (l) { return '<a href="produtos.html?id=' + encodeURIComponent(l.id) + '" class="font-bold text-gray-900 hover:text-brand-purple">' + esc(l.nome) + '</a><p class="text-xs text-gray-500">' + esc(l.sku) + '</p>'; },
                    csv: function (l) { return l.nome; }
                },
                { chave: 'categoria', titulo: 'Categoria', alinhar: 'left' },
                { chave: 'ultimaVenda', titulo: 'Última venda', alinhar: 'center', valor: function (l) { return l.ultimaVenda || ''; }, formatar: function (v) { return v ? fmt.data(v) : 'Nunca vendido'; } },
                {
                    chave: 'dias', titulo: 'Dias sem venda', alinhar: 'center',
                    render: function (l) {
                        var cor = l.dias >= 120 ? 'bg-red-50 text-red-700' : (l.dias >= 90 ? 'bg-orange-50 text-orange-700' : 'bg-amber-50 text-amber-700');
                        return '<span class="inline-block px-2.5 py-1 rounded-md text-xs font-bold ' + cor + '">' + l.dias + ' dias</span>';
                    },
                    csv: function (l) { return l.dias; }
                },
                { chave: 'estoque', titulo: 'Estoque', alinhar: 'center', total: 'soma', formatar: fmt.numero },
                { chave: 'custo', titulo: 'Custo unit.', alinhar: 'right', formatar: fmt.moeda },
                { chave: 'valorCusto', titulo: 'Valor imobilizado (custo)', alinhar: 'right', total: 'soma', formatar: fmt.moeda, render: function (l) { return '<span class="font-bold text-gray-900">' + fmt.moeda(l.valorCusto) + '</span>'; } },
                { chave: 'valorVenda', titulo: 'Valor a preço de venda', alinhar: 'right', total: 'soma', formatar: fmt.moeda }
            ]
        });

        Rel.ligarBotoes({ nome: 'produtos-sem-saida', tabelas: { parados: function () { return tabela; } } });
        render(filtros.ler());
    }

    function render(f) {
        var hoje = Rel.data.hoje();
        var limite = Number(f.v.dias);

        /* ultima venda de cada produto (pedidos nao cancelados, qualquer data) */
        var ultima = {};
        ctx.pedidos.forEach(function (p) {
            if (p.status === 'Cancelado') return;
            var d = Rel.data.diaLocal(p.data);
            (p.itens || []).forEach(function (it) { if (!ultima[it.produtoId] || d > ultima[it.produtoId]) ultima[it.produtoId] = d; });
        });

        var linhas = [];
        ctx.produtos.forEach(function (p) {
            if (p.status !== 'Ativo') return;
            var estoque = Number(p.estoque) || 0;
            if (estoque <= 0) return;
            if (f.v.categoria && p.categoriaId !== f.v.categoria) return;
            var u = ultima[p.id] || null;
            var base = u || Rel.data.diaLocal(p.criadoEm) || hoje;
            var dias = Rel.data.diasEntre(base, hoje);
            if (dias < limite) return;
            linhas.push({
                id: p.id, nome: p.nome, sku: p.sku, categoria: (ctx.cat[p.categoriaId] || {}).nome || 'Sem categoria',
                ultimaVenda: u, dias: dias, estoque: estoque, custo: Number(p.custo) || 0, preco: Number(p.preco) || 0,
                valorCusto: estoque * (Number(p.custo) || 0), valorVenda: estoque * (Number(p.preco) || 0)
            });
        });

        var valor = Rel.somar(linhas, function (l) { return l.valorCusto; });
        var valorVenda = Rel.somar(linhas, function (l) { return l.valorVenda; });
        var media = linhas.length ? Math.round(Rel.somar(linhas, function (l) { return l.dias; }) / linhas.length) : 0;

        Rel.cabecalho({ subtitulo: 'Produtos ativos com estoque e sem venda há ' + limite + ' dias ou mais', filtros: f.descricao });
        Rel.kpis($('rel-kpis'), [
            { titulo: 'Itens parados', valor: fmt.numero(linhas.length), cor: linhas.length ? 'laranja' : 'verde', sub: linhas.length ? '<i class="fa-solid fa-triangle-exclamation text-amber-500"></i> Requer atenção' : 'Nenhum item parado' },
            { titulo: 'Valor imobilizado', valor: fmt.moeda(valor), cor: 'vermelho', sub: 'A preço de venda: ' + fmt.moeda(valorVenda) },
            { titulo: 'Média de dias parados', valor: media + ' dias', sub: 'Desde a última venda' },
            { titulo: 'Total de unidades', valor: fmt.numero(Rel.somar(linhas, function (l) { return l.estoque; })), sub: 'Em estoque, sem saída' }
        ]);

        var faixas = [
            { nome: limite + ' a 89 dias', min: limite, max: 89 },
            { nome: '90 a 119 dias', min: 90, max: 119 },
            { nome: '120 dias ou mais', min: 120, max: Infinity }
        ].filter(function (fx) { return fx.max >= limite; });
        Rel.grafico('semSaidaChart', {
            tipo: 'doughnut', formato: 'moeda',
            labels: faixas.map(function (fx) { return fx.nome; }),
            datasets: [{ data: faixas.map(function (fx) { return Rel.somar(linhas.filter(function (l) { return l.dias >= fx.min && l.dias <= fx.max; }), function (l) { return l.valorCusto; }); }), backgroundColor: ['#f59e0b', '#f97316', '#ef4444'].slice(3 - faixas.length) }]
        });

        $('rel-tabela-info').textContent = linhas.length + ' produto' + (linhas.length === 1 ? '' : 's');
        tabela.atualizar(linhas);
        tabela.ordenarPor(f.v.ordem, 'desc');
    }

    Rel.iniciar(iniciar);
})();
