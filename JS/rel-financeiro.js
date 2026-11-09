/*
 * Relatorio Financeiro (usa os lancamentos do modulo Financeiro)
 *  - "Previsto" = lancamentos pela data de vencimento dentro do periodo.
 *  - "Realizado" = lancamentos pagos/recebidos pela data de pagamento dentro do periodo.
 *  - Contas em aberto: todos os lancamentos pendentes ou atrasados (nao dependem do periodo).
 */
(function () {
    'use strict';
    var Nexo = window.Nexo, Rel = window.Rel, fmt = Nexo.fmt, esc = Nexo.esc;
    var $ = function (id) { return document.getElementById(id); };
    var ctx, filtros, tabMensal, tabCategorias, tabAberto;

    function iniciar() {
        ctx = Rel.contexto();
        filtros = Rel.filtros($('rel-filtros'), {
            periodos: ['30d', '90d', 'mes', 'mes_passado', 'ano', 'ano_passado', 'personalizado'],
            periodoPadrao: 'ano',
            extras: [
                { id: 'tipo', rotulo: 'Contas em aberto: tipo', opcoes: [['', 'A receber e a pagar'], ['Receita', 'Somente a receber'], ['Despesa', 'Somente a pagar']] },
                { id: 'situacao', rotulo: 'Contas em aberto: situação', opcoes: [['', 'Pendentes e atrasadas'], ['Pendente', 'Somente pendentes'], ['Atrasado', 'Somente atrasadas']] }
            ],
            aoMudar: render
        });

        function corSaldo(v) { return v < 0 ? 'text-red-600' : 'text-green-600'; }
        tabMensal = Rel.tabela($('rel-tabela-mensal'), {
            titulo: 'Receitas x despesas por mês',
            ordem: { chave: 'ini', dir: 'asc' },
            vazio: 'Nenhum lançamento no período selecionado.',
            colunas: [
                { chave: 'ini', titulo: 'Mês', alinhar: 'left', render: function (l) { return '<span class="font-bold text-gray-900">' + esc(l.periodo) + '</span>'; }, csv: function (l) { return l.periodo; } },
                { chave: 'receitaPrev', titulo: 'Receitas previstas', alinhar: 'right', total: 'soma', formatar: fmt.moeda },
                { chave: 'receitaReal', titulo: 'Receitas recebidas', alinhar: 'right', total: 'soma', formatar: fmt.moeda },
                { chave: 'despesaPrev', titulo: 'Despesas previstas', alinhar: 'right', total: 'soma', formatar: fmt.moeda },
                { chave: 'despesaReal', titulo: 'Despesas pagas', alinhar: 'right', total: 'soma', formatar: fmt.moeda },
                { chave: 'saldoPrev', titulo: 'Saldo previsto', alinhar: 'right', total: 'soma', formatar: fmt.moeda, render: function (l) { return '<span class="' + corSaldo(l.saldoPrev) + '">' + fmt.moeda(l.saldoPrev) + '</span>'; } },
                { chave: 'saldoReal', titulo: 'Saldo realizado', alinhar: 'right', total: 'soma', formatar: fmt.moeda, render: function (l) { return '<span class="font-bold ' + corSaldo(l.saldoReal) + '">' + fmt.moeda(l.saldoReal) + '</span>'; } }
            ]
        });

        tabCategorias = Rel.tabela($('rel-tabela-categorias'), {
            titulo: 'Despesas por categoria',
            ordem: { chave: 'valor', dir: 'desc' },
            vazio: 'Nenhuma despesa com vencimento no período.',
            colunas: [
                { chave: 'categoria', titulo: 'Categoria', alinhar: 'left', render: function (l) { return '<span class="font-bold text-gray-900">' + esc(l.categoria) + '</span>'; }, csv: function (l) { return l.categoria; } },
                { chave: 'qtd', titulo: 'Lançamentos', alinhar: 'center', total: 'soma', formatar: fmt.numero },
                { chave: 'valor', titulo: 'Valor total', alinhar: 'right', total: 'soma', formatar: fmt.moeda },
                { chave: 'pago', titulo: 'Pago', alinhar: 'right', total: 'soma', formatar: fmt.moeda },
                { chave: 'aberto', titulo: 'Em aberto', alinhar: 'right', total: 'soma', formatar: fmt.moeda },
                { chave: 'part', titulo: 'Part. (%)', alinhar: 'right', total: 'soma', formatar: function (v) { return fmt.porcentagem(v); } }
            ]
        });

        tabAberto = Rel.tabela($('rel-tabela-aberto'), {
            titulo: 'Contas em aberto',
            ordem: { chave: 'vencimento', dir: 'asc' }, rotuloTotal: 'Saldo (a receber - a pagar)',
            vazio: 'Nenhuma conta em aberto com esses filtros.',
            colunas: [
                { chave: 'tipo', titulo: 'Tipo', alinhar: 'left', render: function (l) { return Nexo.ui.badgeStatus(l.tipo); }, total: 'Saldo (a receber - a pagar)' },
                {
                    chave: 'descricao', titulo: 'Descrição', alinhar: 'left',
                    render: function (l) {
                        var href = l.pedidoId ? 'pedidos.html?id=' + encodeURIComponent(l.pedidoId) : 'financeiro.html';
                        return '<a href="' + href + '" class="font-medium text-gray-900 hover:text-brand-purple">' + esc(l.descricao) + '</a>';
                    },
                    csv: function (l) { return l.descricao; }
                },
                { chave: 'categoria', titulo: 'Categoria', alinhar: 'left' },
                { chave: 'vencimento', titulo: 'Vencimento', alinhar: 'center', formatar: function (v) { return fmt.data(v); } },
                { chave: 'atraso', titulo: 'Dias de atraso', alinhar: 'center', formatar: function (v) { return v > 0 ? v + ' dias' : '-'; }, csv: function (l) { return l.atraso; } },
                { chave: 'situacao', titulo: 'Situação', alinhar: 'center', render: function (l) { return Nexo.ui.badgeStatus(l.situacao); } },
                {
                    chave: 'valorAssinado', titulo: 'Valor', alinhar: 'right', total: 'soma', formatar: fmt.moeda,
                    render: function (l) { return '<span class="font-bold ' + (l.tipo === 'Despesa' ? 'text-red-600' : 'text-green-600') + '">' + fmt.moeda(l.valorAssinado) + '</span>'; }
                }
            ]
        });

        Rel.ligarBotoes({ nome: 'relatorio-financeiro', tabelas: { mensal: function () { return tabMensal; }, categorias: function () { return tabCategorias; }, aberto: function () { return tabAberto; } } });
        render(filtros.ler());
    }

    function ativos() {
        return ctx.lancamentos.filter(function (l) { return l.status !== 'Cancelado'; });
    }

    /* soma por tipo dentro de um intervalo (campo = vencimento ou dataPagamento) */
    function somaPeriodo(tipo, campo, ini, fim) {
        return Rel.somar(ativos().filter(function (l) {
            var d = Rel.data.diaLocal(l[campo]);
            return l.tipo === tipo && d && d >= ini && d <= fim;
        }), function (l) { return l.valor; });
    }

    function render(f) {
        var per = f.periodo;
        var ini = per.inicio, fim = per.fim;

        /* por mes */
        var s = Rel.serie(ini, fim, 'mes');
        var linhas = s.buckets.map(function (b) { return { ini: b.ini, periodo: b.rotuloLongo, rotulo: b.rotulo, receitaPrev: 0, receitaReal: 0, despesaPrev: 0, despesaReal: 0 }; });
        ativos().forEach(function (l) {
            var v = Number(l.valor) || 0;
            var i = s.indiceDe(Rel.data.diaLocal(l.vencimento));
            if (i >= 0) linhas[i][l.tipo === 'Receita' ? 'receitaPrev' : 'despesaPrev'] += v;
            var j = s.indiceDe(Rel.data.diaLocal(l.dataPagamento));
            if (j >= 0) linhas[j][l.tipo === 'Receita' ? 'receitaReal' : 'despesaReal'] += v;
        });
        linhas.forEach(function (l) { l.saldoPrev = l.receitaPrev - l.despesaPrev; l.saldoReal = l.receitaReal - l.despesaReal; });
        linhas = linhas.filter(function (l) { return l.receitaPrev || l.receitaReal || l.despesaPrev || l.despesaReal; });

        var recPrev = Rel.somar(linhas, function (l) { return l.receitaPrev; });
        var desPrev = Rel.somar(linhas, function (l) { return l.despesaPrev; });
        var recReal = Rel.somar(linhas, function (l) { return l.receitaReal; });
        var desReal = Rel.somar(linhas, function (l) { return l.despesaReal; });
        var saldoReal = recReal - desReal;
        var recAnt = somaPeriodo('Receita', 'vencimento', per.anterior.inicio, per.anterior.fim);
        var desAnt = somaPeriodo('Despesa', 'vencimento', per.anterior.inicio, per.anterior.fim);

        /* contas em aberto (posicao atual) */
        var abertas = ativos().filter(function (l) { return !l.dataPagamento; }).map(function (l) {
            var sit = Nexo.consultas.statusLancamento(l);
            var venc = Rel.data.diaLocal(l.vencimento);
            return {
                id: l.id, tipo: l.tipo, descricao: l.descricao, categoria: l.categoria || '-', vencimento: venc, situacao: sit, pedidoId: l.pedidoId || null,
                atraso: sit === 'Atrasado' ? Rel.data.diasEntre(venc, Rel.data.hoje()) : 0,
                valorAssinado: (l.tipo === 'Despesa' ? -1 : 1) * (Number(l.valor) || 0)
            };
        });
        function totalAberto(tipo, sit) {
            return abertas.filter(function (l) { return l.tipo === tipo && (!sit || l.situacao === sit); });
        }
        var receber = totalAberto('Receita'), pagar = totalAberto('Despesa');
        var receberAtr = totalAberto('Receita', 'Atrasado'), pagarAtr = totalAberto('Despesa', 'Atrasado');
        function soma(lista) { return Rel.somar(lista, function (l) { return Math.abs(l.valorAssinado); }); }

        Rel.cabecalho({ subtitulo: 'Receitas, despesas e contas em aberto de ' + fmt.data(ini) + ' a ' + fmt.data(fim), filtros: f.descricao });
        Rel.kpis($('rel-kpis'), [
            { titulo: 'Receitas previstas', valor: fmt.moeda(recPrev), cor: 'verde', variacao: { atual: recPrev, anterior: recAnt } },
            { titulo: 'Despesas previstas', valor: fmt.moeda(desPrev), cor: 'laranja', variacao: { atual: desPrev, anterior: desAnt, inverso: true } },
            { titulo: 'Saldo do período', valor: fmt.moeda(saldoReal), cor: saldoReal < 0 ? 'vermelho' : 'roxo', sub: 'Recebido ' + fmt.moeda(recReal) + ' - pago ' + fmt.moeda(desReal) },
            { titulo: 'A receber em aberto', valor: fmt.moeda(soma(receber)), sub: receberAtr.length ? '<span class="text-red-500 font-semibold">' + receberAtr.length + ' atrasada(s): ' + fmt.moeda(soma(receberAtr)) + '</span>' : 'Nenhuma atrasada' },
            { titulo: 'A pagar em aberto', valor: fmt.moeda(soma(pagar)), sub: pagarAtr.length ? '<span class="text-red-500 font-semibold">' + pagarAtr.length + ' atrasada(s): ' + fmt.moeda(soma(pagarAtr)) + '</span>' : 'Nenhuma atrasada' }
        ]);

        Rel.grafico('fluxoChart', {
            tipo: 'bar', formato: 'moeda', legenda: true,
            labels: linhas.map(function (l) { return l.rotulo; }),
            datasets: [
                { label: 'Receitas previstas', data: linhas.map(function (l) { return l.receitaPrev; }), backgroundColor: '#7c3aed', order: 2 },
                { label: 'Despesas previstas', data: linhas.map(function (l) { return l.despesaPrev; }), backgroundColor: '#f59e0b', order: 2 },
                { type: 'line', label: 'Saldo realizado', data: linhas.map(function (l) { return l.saldoReal; }), borderColor: '#10b981', pointBorderColor: '#10b981', order: 1 }
            ]
        });

        /* despesas por categoria (vencimento no periodo) */
        var cats = {};
        ativos().forEach(function (l) {
            var d = Rel.data.diaLocal(l.vencimento);
            if (l.tipo !== 'Despesa' || d < ini || d > fim) return;
            var k = l.categoria || 'Sem categoria';
            var c = cats[k] || (cats[k] = { categoria: k, qtd: 0, valor: 0, pago: 0, aberto: 0 });
            var v = Number(l.valor) || 0;
            c.qtd++; c.valor += v;
            if (l.dataPagamento) c.pago += v; else c.aberto += v;
        });
        var linhasCat = Object.keys(cats).map(function (k) { return cats[k]; });
        var totalCat = Rel.somar(linhasCat, function (c) { return c.valor; });
        linhasCat.forEach(function (c) { c.part = totalCat ? c.valor / totalCat * 100 : 0; });
        var catsOrd = linhasCat.slice().sort(function (a, b) { return b.valor - a.valor; });
        Rel.grafico('categoriasChart', {
            tipo: 'doughnut', formato: 'moeda',
            labels: catsOrd.map(function (c) { return c.categoria; }),
            datasets: [{ data: catsOrd.map(function (c) { return c.valor; }) }]
        });

        var filtradas = abertas.filter(function (l) { return (!f.v.tipo || l.tipo === f.v.tipo) && (!f.v.situacao || l.situacao === f.v.situacao); });

        $('rel-tabela-mensal-info').textContent = linhas.length + ' ' + (linhas.length === 1 ? 'mês' : 'meses') + ' com lançamentos';
        $('rel-tabela-categorias-info').textContent = linhasCat.length + ' categoria' + (linhasCat.length === 1 ? '' : 's');
        $('rel-tabela-aberto-info').textContent = filtradas.length + ' conta' + (filtradas.length === 1 ? '' : 's') + ' (posição atual)';
        tabMensal.atualizar(linhas);
        tabCategorias.atualizar(linhasCat);
        tabAberto.atualizar(filtradas);
    }

    Rel.iniciar(iniciar);
})();
