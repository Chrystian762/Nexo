/*
 * Central de Relatorios (telas/relatorios2.html)
 * Resumo do periodo (faturamento, lucro bruto, pedidos, ticket) com comparacao,
 * mais a grade de relatorios agrupada por area (Vendas, Estoque, Clientes, Financeiro).
 */
(function () {
    'use strict';
    var Nexo = window.Nexo, Rel = window.Rel, fmt = Nexo.fmt, esc = Nexo.esc;
    var $ = function (id) { return document.getElementById(id); };
    var ctx, filtros, tabela;

    function iniciar() {
        ctx = Rel.contexto();
        filtros = Rel.filtros($('rel-filtros'), {
            periodoPadrao: 'mes',
            extras: [
                { id: 'grupo', rotulo: 'Área do relatório', opcoes: [['todas', 'Todas as áreas'], ['vendas', 'Vendas'], ['estoque', 'Estoque'], ['clientes', 'Clientes'], ['financeiro', 'Financeiro']] },
                { id: 'vendedor', rotulo: 'Vendedor (indicadores)', opcoes: [['', 'Todos os vendedores']].concat(Rel.vendedores(ctx).map(function (n) { return [n, n]; })) }
            ],
            aoMudar: render
        });

        tabela = Rel.tabela($('rel-tabela'), {
            titulo: 'Resumo do período',
            total: false, ordem: null,
            colunas: [
                { chave: 'indicador', titulo: 'Indicador', alinhar: 'left', semOrdem: true, render: function (l) { return '<span class="font-medium text-gray-900">' + esc(l.indicador) + '</span>'; }, csv: function (l) { return l.indicador; } },
                { chave: 'atual', titulo: 'Período atual', alinhar: 'right', semOrdem: true, render: function (l) { return '<span class="font-bold text-gray-900">' + esc(l.fmt(l.atual)) + '</span>'; }, csv: function (l) { return l.atual; } },
                { chave: 'anterior', titulo: 'Período anterior', alinhar: 'right', semOrdem: true, render: function (l) { return esc(l.fmt(l.anterior)); }, csv: function (l) { return l.anterior; } },
                { chave: 'variacao', titulo: 'Variação', alinhar: 'right', semOrdem: true, render: function (l) { return l.anterior ? esc((l.variacao > 0 ? '+' : '') + fmt.porcentagem(l.variacao)) : '-'; }, csv: function (l) { return l.anterior ? Math.round(l.variacao * 10) / 10 : ''; } }
            ]
        });

        Rel.ligarBotoes({ nome: 'resumo-relatorios', tabelas: { resumo: function () { return tabela; } } });
        render(filtros.ler());
    }

    function render(f) {
        var per = f.periodo;
        var fil = { vendedor: f.v.vendedor };
        var a = Rel.resumo(ctx, per.inicio, per.fimEfetivo, fil);
        var b = Rel.resumo(ctx, per.anterior.inicio, per.anterior.fim, fil);

        Rel.cabecalho({ subtitulo: 'Indicadores de ' + fmt.data(per.inicio) + ' a ' + fmt.data(per.fim) + ' e acesso a todos os relatórios.', filtros: f.descricao });
        Rel.kpis($('rel-kpis'), [
            { titulo: 'Faturamento', valor: fmt.moeda(a.faturamento), variacao: { atual: a.faturamento, anterior: b.faturamento } },
            { titulo: 'Lucro bruto', valor: fmt.moeda(a.lucroBruto), cor: a.lucroBruto < 0 ? 'vermelho' : 'verde', variacao: { atual: a.lucroBruto, anterior: b.lucroBruto } },
            { titulo: 'Pedidos', valor: fmt.numero(a.pedidos), variacao: { atual: a.pedidos, anterior: b.pedidos } },
            { titulo: 'Ticket médio', valor: fmt.moeda(a.ticket), variacao: { atual: a.ticket, anterior: b.ticket } }
        ]);

        function linha(nome, atual, anterior, formato) {
            return { indicador: nome, atual: atual, anterior: anterior, fmt: formato, variacao: anterior ? (atual - anterior) / Math.abs(anterior) * 100 : 0 };
        }
        tabela.atualizar([
            linha('Faturamento', a.faturamento, b.faturamento, fmt.moeda),
            linha('Custo das mercadorias (CMV)', a.cmv, b.cmv, fmt.moeda),
            linha('Lucro bruto', a.lucroBruto, b.lucroBruto, fmt.moeda),
            linha('Pedidos', a.pedidos, b.pedidos, fmt.numero),
            linha('Itens vendidos', a.itens, b.itens, fmt.numero),
            linha('Ticket médio', a.ticket, b.ticket, fmt.moeda)
        ]);

        /* mostra so os grupos de relatorios escolhidos */
        document.querySelectorAll('[data-grupo]').forEach(function (sec) {
            sec.style.display = (f.v.grupo === 'todas' || f.v.grupo === sec.getAttribute('data-grupo')) ? '' : 'none';
        });
    }

    Rel.iniciar(iniciar);
})();
