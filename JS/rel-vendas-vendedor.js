/*
 * Relatorio: Vendas por Vendedor
 * Usa o campo "vendedor" de cada pedido (nao cancelado). A comissao e uma estimativa de 5%.
 */
(function () {
    'use strict';
    var Nexo = window.Nexo, Rel = window.Rel, fmt = Nexo.fmt, esc = Nexo.esc;
    var $ = function (id) { return document.getElementById(id); };
    var COMISSAO = Rel.COMISSAO_PERCENTUAL;
    var ctx, filtros, tabela;

    function iniciar() {
        ctx = Rel.contexto();
        filtros = Rel.filtros($('rel-filtros'), {
            periodoPadrao: 'mes',
            extras: [
                { id: 'vendedor', rotulo: 'Vendedor', opcoes: [['', 'Toda a equipe']].concat(Rel.vendedores(ctx).map(function (n) { return [n, n]; })) }
            ],
            aoMudar: render
        });

        tabela = Rel.tabela($('rel-tabela'), {
            titulo: 'Desempenho por vendedor',
            ordem: { chave: 'faturamento', dir: 'desc' },
            vazio: 'Nenhuma venda encontrada no período para este filtro.',
            colunas: [
                {
                    chave: 'vendedor', titulo: 'Vendedor', alinhar: 'left',
                    render: function (l) {
                        return '<div class="flex items-center gap-3"><div class="w-8 h-8 rounded-full bg-purple-100 text-brand-purple flex items-center justify-center font-bold text-xs shrink-0">' + Rel.iniciais(l.vendedor) + '</div>' +
                            '<div><p class="font-bold text-gray-900">' + esc(l.vendedor) + '</p><p class="text-xs text-gray-500">Comissão estimada: ' + COMISSAO + '%</p></div></div>';
                    },
                    csv: function (l) { return l.vendedor; }
                },
                { chave: 'pedidos', titulo: 'Pedidos', alinhar: 'center', total: 'soma', formatar: fmt.numero },
                { chave: 'itens', titulo: 'Itens', alinhar: 'center', total: 'soma', formatar: fmt.numero },
                { chave: 'faturamento', titulo: 'Faturamento', alinhar: 'right', total: 'soma', formatar: fmt.moeda, render: function (l) { return '<span class="font-bold text-gray-900">' + fmt.moeda(l.faturamento) + '</span>'; } },
                { chave: 'ticket', titulo: 'Ticket médio', alinhar: 'right', formatar: fmt.moeda, total: function (ls) { var p = Rel.somar(ls, function (l) { return l.pedidos; }); return p ? Rel.somar(ls, function (l) { return l.faturamento; }) / p : 0; } },
                { chave: 'comissao', titulo: 'Comissão (R$)', alinhar: 'right', total: 'soma', formatar: fmt.moeda },
                { chave: 'part', titulo: 'Part. (%)', alinhar: 'right', total: 'soma', formatar: function (v) { return fmt.porcentagem(v); } }
            ]
        });

        Rel.ligarBotoes({ nome: 'vendas-por-vendedor', tabelas: { vendedores: function () { return tabela; } } });
        render(filtros.ler());
    }

    function render(f) {
        var per = f.periodo;
        var fil = { vendedor: f.v.vendedor };
        var peds = Rel.pedidos(ctx, per.inicio, per.fimEfetivo, fil);
        var fatAnt = Rel.resumo(ctx, per.anterior.inicio, per.anterior.fim, fil).faturamento;

        var grupos = {};
        peds.forEach(function (p) {
            var nome = p.vendedor || 'Sem vendedor';
            var g = grupos[nome] || (grupos[nome] = { vendedor: nome, pedidos: 0, itens: 0, faturamento: 0 });
            g.pedidos++;
            g.itens += Rel.somar(p.itens || [], function (i) { return i.quantidade; });
            g.faturamento += Rel.totalPedido(p);
        });
        var linhas = Object.keys(grupos).map(function (k) { return grupos[k]; });
        var fat = Rel.somar(linhas, function (l) { return l.faturamento; });
        linhas.forEach(function (l) {
            l.ticket = l.pedidos ? l.faturamento / l.pedidos : 0;
            l.comissao = l.faturamento * COMISSAO / 100;
            l.part = fat ? l.faturamento / fat * 100 : 0;
        });
        var ordenado = linhas.slice().sort(function (a, b) { return b.faturamento - a.faturamento; });
        var top = ordenado[0];

        Rel.cabecalho({ subtitulo: 'Desempenho da equipe e comissões estimadas de ' + fmt.data(per.inicio) + ' a ' + fmt.data(per.fim), filtros: f.descricao });
        Rel.kpis($('rel-kpis'), [
            { titulo: 'Faturamento da equipe', valor: fmt.moeda(fat), variacao: { atual: fat, anterior: fatAnt } },
            { titulo: 'Total de vendas', valor: fmt.numero(peds.length), sub: 'Pedidos não cancelados' },
            { titulo: 'Top vendedor', valor: top ? top.vendedor : '-', cor: 'roxo', sub: top ? fmt.moeda(top.faturamento) + ' faturados' : 'Sem vendas no período' },
            { titulo: 'Comissões estimadas', valor: fmt.moeda(fat * COMISSAO / 100), cor: 'laranja', sub: 'Estimativa de ' + COMISSAO + '% sobre o faturamento' }
        ]);

        Rel.grafico('vendedoresChart', {
            tipo: 'bar', formato: 'moeda',
            labels: ordenado.map(function (l) { return l.vendedor; }),
            datasets: [{ label: 'Faturamento', data: ordenado.map(function (l) { return l.faturamento; }) }]
        });

        $('rel-tabela-info').textContent = linhas.length + ' vendedor' + (linhas.length === 1 ? '' : 'es') + ' com vendas';
        tabela.atualizar(linhas);
    }

    Rel.iniciar(iniciar);
})();
