/*
 * Relatorio de Estoque
 *  - Posicao atual (quantidade, valor a custo e a preco de venda)
 *  - Curva ABC por valor em estoque (A = ate 80% do valor acumulado, B = ate 95%, C = resto)
 *  - Estoque baixo / sem estoque (estoque <= estoque minimo)
 *  - Giro = saidas no periodo / estoque medio (media entre o saldo no inicio e no fim do periodo)
 *  - Movimentacoes por tipo no periodo
 */
(function () {
    'use strict';
    var Nexo = window.Nexo, Rel = window.Rel, fmt = Nexo.fmt, esc = Nexo.esc;
    var $ = function (id) { return document.getElementById(id); };
    var ctx, filtros, tabPosicao, tabMov;

    function situacao(p) {
        var e = Number(p.estoque) || 0;
        if (e <= 0) return 'Sem estoque';
        if (e <= (Number(p.estoqueMinimo) || 0)) return 'Estoque baixo';
        return 'Normal';
    }

    function iniciar() {
        ctx = Rel.contexto();
        filtros = Rel.filtros($('rel-filtros'), {
            periodoPadrao: '30d',
            extras: [
                { id: 'categoria', rotulo: 'Categoria', opcoes: [['', 'Todas as categorias']].concat(ctx.categorias.map(function (c) { return [c.id, c.nome]; })) },
                { id: 'situacao', rotulo: 'Situação do estoque', opcoes: [['', 'Todas'], ['Normal', 'Normal'], ['Estoque baixo', 'Estoque baixo'], ['Sem estoque', 'Sem estoque']] }
            ],
            aoMudar: render
        });

        tabPosicao = Rel.tabela($('rel-tabela-posicao'), {
            titulo: 'Posição de estoque',
            ordem: { chave: 'valorCusto', dir: 'desc' },
            vazio: 'Nenhum produto encontrado com os filtros selecionados.',
            colunas: [
                { chave: 'nome', titulo: 'Produto', alinhar: 'left', render: function (l) { return '<a href="estoque.html?produto=' + encodeURIComponent(l.id) + '" class="font-bold text-gray-900 hover:text-brand-purple">' + esc(l.nome) + '</a><p class="text-xs text-gray-500">' + esc(l.sku) + (l.inativo ? ' (inativo)' : '') + '</p>'; }, csv: function (l) { return l.nome; } },
                { chave: 'categoria', titulo: 'Categoria', alinhar: 'left' },
                { chave: 'estoque', titulo: 'Estoque', alinhar: 'center', total: 'soma', formatar: fmt.numero },
                { chave: 'minimo', titulo: 'Mínimo', alinhar: 'center', formatar: fmt.numero },
                { chave: 'situacao', titulo: 'Situação', alinhar: 'center', render: function (l) { return Nexo.ui.badgeStatus(l.situacao); } },
                { chave: 'custo', titulo: 'Custo unit.', alinhar: 'right', formatar: fmt.moeda },
                { chave: 'valorCusto', titulo: 'Valor a custo', alinhar: 'right', total: 'soma', formatar: fmt.moeda, render: function (l) { return '<span class="font-bold text-gray-900">' + fmt.moeda(l.valorCusto) + '</span>'; } },
                { chave: 'valorVenda', titulo: 'Valor a venda', alinhar: 'right', total: 'soma', formatar: fmt.moeda },
                { chave: 'classe', titulo: 'Curva ABC', alinhar: 'center', render: function (l) { var cor = l.classe === 'A' ? 'bg-purple-100 text-brand-purple' : (l.classe === 'B' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-600'); return '<span class="inline-block w-7 text-center py-0.5 rounded font-bold text-xs ' + cor + '">' + esc(l.classe) + '</span>'; } },
                { chave: 'saidas', titulo: 'Saídas no período', alinhar: 'center', total: 'soma', formatar: fmt.numero },
                { chave: 'giro', titulo: 'Giro', alinhar: 'center', formatar: function (v) { return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'x'; }, total: function (ls) { var m = Rel.somar(ls, function (l) { return l.estoqueMedio; }); return m ? Rel.somar(ls, function (l) { return l.saidas; }) / m : 0; } }
            ]
        });

        tabMov = Rel.tabela($('rel-tabela-movimentacoes'), {
            titulo: 'Movimentações por tipo',
            ordem: { chave: 'tipo', dir: 'asc' },
            vazio: 'Nenhuma movimentação registrada no período.',
            colunas: [
                { chave: 'tipo', titulo: 'Tipo', alinhar: 'left', render: function (l) { return Nexo.ui.badgeStatus(l.tipo); } },
                { chave: 'quantidadeMov', titulo: 'Movimentações', alinhar: 'center', total: 'soma', formatar: fmt.numero },
                { chave: 'unidades', titulo: 'Unidades movimentadas', alinhar: 'center', total: 'soma', formatar: fmt.numero },
                { chave: 'liquido', titulo: 'Variação líquida no estoque', alinhar: 'right', total: 'soma', formatar: function (v) { return (v > 0 ? '+' : '') + fmt.numero(v) + ' un.'; } }
            ]
        });

        Rel.ligarBotoes({ nome: 'relatorio-de-estoque', tabelas: { posicao: function () { return tabPosicao; }, movimentacoes: function () { return tabMov; } } });
        render(filtros.ler());
    }

    function render(f) {
        var per = f.periodo;
        var ate = per.fimEfetivo;
        var movs = Rel.movimentosPorProduto(ctx);
        var diaAntes = Rel.data.somarDias(per.inicio, -1);

        /* saidas (tipo Saida) por produto no periodo */
        var saidas = {};
        var porTipo = { 'Entrada': { quantidadeMov: 0, unidades: 0, liquido: 0 }, 'Saída': { quantidadeMov: 0, unidades: 0, liquido: 0 }, 'Ajuste': { quantidadeMov: 0, unidades: 0, liquido: 0 } };
        var idsFiltrados = {};

        var linhas = [];
        ctx.produtos.forEach(function (p) {
            if (f.v.categoria && p.categoriaId !== f.v.categoria) return;
            var sit = situacao(p);
            if (f.v.situacao && sit !== f.v.situacao) return;
            idsFiltrados[p.id] = true;
            var e = Number(p.estoque) || 0;
            var medio = (Rel.saldoEm(movs, p, diaAntes) + Rel.saldoEm(movs, p, ate)) / 2;
            linhas.push({
                id: p.id, nome: p.nome, sku: p.sku, inativo: p.status !== 'Ativo',
                categoria: (ctx.cat[p.categoriaId] || {}).nome || 'Sem categoria',
                estoque: e, minimo: Number(p.estoqueMinimo) || 0, situacao: sit,
                custo: Number(p.custo) || 0, valorCusto: e * (Number(p.custo) || 0), valorVenda: e * (Number(p.preco) || 0),
                estoqueMedio: medio, saidas: 0, giro: 0, classe: 'C'
            });
        });
        var porId = {};
        linhas.forEach(function (l) { porId[l.id] = l; });

        ctx.movimentacoes.forEach(function (m) {
            var d = Rel.data.diaLocal(m.data);
            if (d < per.inicio || d > ate || !idsFiltrados[m.produtoId]) return;
            var t = porTipo[m.tipo];
            if (t) {
                t.quantidadeMov++;
                t.unidades += Math.abs(Number(m.quantidade) || 0);
                t.liquido += m.tipo === 'Saída' ? -(Number(m.quantidade) || 0) : (Number(m.quantidade) || 0);
            }
            if (m.tipo === 'Saída' && porId[m.produtoId]) porId[m.produtoId].saidas += Number(m.quantidade) || 0;
        });
        linhas.forEach(function (l) { l.giro = l.estoqueMedio > 0 ? l.saidas / l.estoqueMedio : 0; });

        /* curva ABC pelo valor a custo, dentro do conjunto filtrado */
        var porValor = linhas.slice().sort(function (a, b) { return b.valorCusto - a.valorCusto; });
        var totalValor = Rel.somar(linhas, function (l) { return l.valorCusto; });
        var acumulado = 0;
        porValor.forEach(function (l) {
            var antes = totalValor ? acumulado / totalValor * 100 : 100;
            acumulado += l.valorCusto;
            l.acumulado = totalValor ? acumulado / totalValor * 100 : 0;
            l.classe = l.valorCusto <= 0 ? 'C' : (antes < 80 ? 'A' : (antes < 95 ? 'B' : 'C'));
        });

        var unidades = Rel.somar(linhas, function (l) { return l.estoque; });
        var valorVenda = Rel.somar(linhas, function (l) { return l.valorVenda; });
        var baixos = linhas.filter(function (l) { return l.situacao === 'Estoque baixo'; }).length;
        var zerados = linhas.filter(function (l) { return l.situacao === 'Sem estoque'; }).length;
        var somaMedio = Rel.somar(linhas, function (l) { return l.estoqueMedio; });
        var giroGeral = somaMedio ? Rel.somar(linhas, function (l) { return l.saidas; }) / somaMedio : 0;
        var contA = linhas.filter(function (l) { return l.classe === 'A'; }).length;

        Rel.cabecalho({ subtitulo: 'Posição atual do estoque e movimentações de ' + fmt.data(per.inicio) + ' a ' + fmt.data(per.fim), filtros: f.descricao });
        Rel.kpis($('rel-kpis'), [
            { titulo: 'Unidades em estoque', valor: fmt.numero(unidades), sub: fmt.numero(linhas.length) + ' produtos listados' },
            { titulo: 'Valor em estoque (custo)', valor: fmt.moeda(totalValor), cor: 'roxo', sub: 'A preço de venda: ' + fmt.moeda(valorVenda) },
            { titulo: 'Giro do período', valor: giroGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'x', sub: 'Saídas / estoque médio (' + per.dias + ' dias)' },
            { titulo: 'Estoque baixo', valor: fmt.numero(baixos + zerados), cor: (baixos + zerados) ? 'laranja' : 'verde', sub: fmt.numero(zerados) + ' sem estoque, ' + fmt.numero(baixos) + ' abaixo do mínimo' }
        ]);

        /* grafico 1: Pareto (barras de valor + linha de % acumulado) */
        $('rel-grafico-abc-sub').textContent = contA + ' produto' + (contA === 1 ? '' : 's') + ' classe A concentram cerca de 80% do valor';
        Rel.grafico('abcChart', {
            tipo: 'bar', formato: 'moeda', legenda: true, eixoSecundario: 'percentual',
            labels: porValor.map(function (l) { return l.nome.length > 16 ? l.nome.slice(0, 15) + '…' : l.nome; }),
            datasets: [
                { label: 'Valor a custo', data: porValor.map(function (l) { return l.valorCusto; }), backgroundColor: porValor.map(function (l) { return l.classe === 'A' ? '#7c3aed' : (l.classe === 'B' ? '#a78bfa' : '#ddd6fe'); }), order: 2 },
                { type: 'line', label: '% acumulado', data: porValor.map(function (l) { return Math.round(l.acumulado * 10) / 10; }), yAxisID: 'y1', borderColor: '#f59e0b', pointBorderColor: '#f59e0b', order: 1 }
            ],
            opcoes: { scales: { y1: { min: 0, max: 100 }, x: { ticks: { maxRotation: 60, minRotation: 45 } } } }
        });

        /* grafico 2: movimentacoes por tipo */
        var tipos = ['Entrada', 'Saída', 'Ajuste'];
        Rel.grafico('movChart', {
            tipo: 'doughnut', formato: 'numero',
            labels: tipos.map(function (t) { return t + ' (un.)'; }),
            datasets: [{ data: tipos.map(function (t) { return porTipo[t].unidades; }), backgroundColor: ['#10b981', '#ef4444', '#3b82f6'] }]
        });

        var linhasMov = tipos.map(function (t) { return { tipo: t, quantidadeMov: porTipo[t].quantidadeMov, unidades: porTipo[t].unidades, liquido: porTipo[t].liquido }; })
            .filter(function (l) { return l.quantidadeMov > 0; });

        $('rel-tabela-posicao-info').textContent = linhas.length + ' produto' + (linhas.length === 1 ? '' : 's');
        tabPosicao.atualizar(linhas);
        tabMov.atualizar(linhasMov);
    }

    Rel.iniciar(iniciar);
})();
