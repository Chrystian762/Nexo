/*
 * Relatorio: Vendas por Periodo
 * Agrupa os pedidos (nao cancelados) por dia, semana ou mes conforme o filtro.
 */
(function () {
    'use strict';
    var Nexo = window.Nexo, Rel = window.Rel, fmt = Nexo.fmt, esc = Nexo.esc;
    var $ = function (id) { return document.getElementById(id); };
    var ctx, filtros, tabela;

    var ROTULO_AGRUP = { dia: 'Diário', semana: 'Semanal', mes: 'Mensal' };

    function iniciar() {
        ctx = Rel.contexto();
        filtros = Rel.filtros($('rel-filtros'), {
            periodoPadrao: '30d',
            extras: [
                { id: 'agrup', rotulo: 'Agrupamento', opcoes: [['auto', 'Automático'], ['dia', 'Diário'], ['semana', 'Semanal'], ['mes', 'Mensal']] },
                { id: 'status', rotulo: 'Status do pedido', opcoes: [['', 'Todos (exceto cancelados)'], ['Novo', 'Novo'], ['Em separação', 'Em separação'], ['Enviado', 'Enviado'], ['Entregue', 'Entregue'], ['Cancelado', 'Somente cancelados']] },
                { id: 'vendedor', rotulo: 'Vendedor', opcoes: [['', 'Todos os vendedores']].concat(Rel.vendedores(ctx).map(function (n) { return [n, n]; })) }
            ],
            aoMudar: render
        });

        tabela = Rel.tabela($('rel-tabela'), {
            titulo: 'Vendas por período',
            ordem: { chave: 'ini', dir: 'desc' },
            vazio: 'Nenhum pedido encontrado no período e filtros selecionados.',
            colunas: [
                { chave: 'ini', titulo: 'Período', alinhar: 'left', render: function (l) { return '<span class="font-medium text-gray-900">' + esc(l.periodo) + '</span>'; }, csv: function (l) { return l.periodo; } },
                { chave: 'pedidos', titulo: 'Pedidos', alinhar: 'center', total: 'soma', formatar: fmt.numero },
                { chave: 'itens', titulo: 'Produtos vendidos', alinhar: 'center', total: 'soma', formatar: function (v) { return fmt.numero(v) + ' un.'; } },
                { chave: 'ticket', titulo: 'Ticket médio', alinhar: 'right', formatar: fmt.moeda, total: function (ls) { var p = Rel.somar(ls, function (l) { return l.pedidos; }); return p ? Rel.somar(ls, function (l) { return l.faturamento; }) / p : 0; } },
                { chave: 'faturamento', titulo: 'Faturamento (R$)', alinhar: 'right', total: 'soma', formatar: fmt.moeda, render: function (l) { return '<span class="font-bold text-gray-900">' + fmt.moeda(l.faturamento) + '</span>'; } }
            ]
        });

        Rel.ligarBotoes({ nome: 'vendas-por-periodo', tabelas: { vendas: function () { return tabela; } } });
        render(filtros.ler());
    }

    function somaItens(p) { return Rel.somar(p.itens || [], function (i) { return i.quantidade; }); }

    /* Faturamento por balde de tempo, no mesmo formato de agrupamento */
    function totaisPorBalde(ini, fim, agrup, listaPedidos) {
        var s = Rel.serie(ini, fim, agrup);
        var linhas = s.buckets.map(function (b) { return { ini: b.ini, periodo: b.rotuloLongo, rotulo: b.rotulo, pedidos: 0, itens: 0, faturamento: 0, ticket: 0 }; });
        listaPedidos.forEach(function (p) {
            var i = s.indiceDe(Rel.data.diaLocal(p.data));
            if (i < 0) return;
            linhas[i].pedidos++;
            linhas[i].itens += somaItens(p);
            linhas[i].faturamento += Rel.totalPedido(p);
        });
        linhas.forEach(function (l) { l.ticket = l.pedidos ? l.faturamento / l.pedidos : 0; });
        return linhas;
    }

    function render(f) {
        var per = f.periodo;
        var fil = { status: f.v.status, vendedor: f.v.vendedor };
        var agrup = f.v.agrup === 'auto' ? Rel.agrupamentoAuto(per.dias) : f.v.agrup;

        var atual = Rel.pedidos(ctx, per.inicio, per.fimEfetivo, fil);
        var anterior = Rel.pedidos(ctx, per.anterior.inicio, per.anterior.fim, fil);
        var linhas = totaisPorBalde(per.inicio, per.fimEfetivo, agrup, atual);
        var linhasAnt = totaisPorBalde(per.anterior.inicio, per.anterior.fim, agrup, anterior);

        var fat = Rel.somar(atual, Rel.totalPedido);
        var fatAnt = Rel.somar(anterior, Rel.totalPedido);
        var diasCorridos = Rel.data.diasEntre(per.inicio, per.fimEfetivo) + 1;

        Rel.cabecalho({ subtitulo: 'Faturamento gerado entre ' + fmt.data(per.inicio) + ' e ' + fmt.data(per.fim), filtros: f.descricao });
        Rel.kpis($('rel-kpis'), [
            { titulo: 'Total faturado', valor: fmt.moeda(fat), cor: 'roxo', variacao: { atual: fat, anterior: fatAnt } },
            { titulo: 'Total de pedidos', valor: fmt.numero(atual.length), sub: 'Média de ' + (atual.length / diasCorridos).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' pedidos/dia' },
            { titulo: 'Ticket médio', valor: fmt.moeda(atual.length ? fat / atual.length : 0), variacao: { atual: atual.length ? fat / atual.length : 0, anterior: anterior.length ? fatAnt / anterior.length : 0 } }
        ], { lateral: true });

        Rel.grafico('vendasChart', {
            tipo: 'line', formato: 'moeda', legenda: true,
            labels: linhas.map(function (l) { return l.rotulo; }),
            datasets: [
                { label: 'Faturamento (' + ROTULO_AGRUP[agrup].toLowerCase() + ')', data: linhas.map(function (l) { return l.faturamento; }), fill: true, borderColor: '#7c3aed' },
                { label: 'Período anterior', data: linhas.map(function (l, i) { return linhasAnt[i] ? linhasAnt[i].faturamento : 0; }), borderColor: '#cbd5e1', borderDash: [6, 4], pointRadius: 0, fill: false }
            ]
        });

        var comVenda = linhas.filter(function (l) { return l.pedidos > 0; });
        $('rel-tabela-titulo').textContent = 'Detalhamento ' + ROTULO_AGRUP[agrup].toLowerCase();
        $('rel-tabela-info').textContent = 'Exibindo ' + comVenda.length + ' registro' + (comVenda.length === 1 ? '' : 's') + ' com vendas';
        tabela.atualizar(comVenda);
    }

    Rel.iniciar(iniciar);
})();
