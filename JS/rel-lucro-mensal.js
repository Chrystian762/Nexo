/*
 * Relatorio: Lucro Mensal (DRE simplificada)
 *   Faturamento       = total dos pedidos nao cancelados (inclui frete, ja sem desconto)
 *   CMV               = quantidade x custoUnitario dos itens vendidos
 *   Lucro bruto       = faturamento - CMV
 *   Despesas          = despesas PAGAS no mes (data de pagamento) do financeiro, sem a categoria
 *                       "Compra de mercadorias" (ela ja entra no CMV, evita contar duas vezes)
 *   Lucro liquido     = lucro bruto - despesas
 *   Margem            = lucro liquido / faturamento
 */
(function () {
    'use strict';
    var Nexo = window.Nexo, Rel = window.Rel, fmt = Nexo.fmt, esc = Nexo.esc;
    var $ = function (id) { return document.getElementById(id); };
    var CATEGORIA_COMPRA = 'Compra de mercadorias';
    var ctx, filtros, tabela;

    function iniciar() {
        ctx = Rel.contexto();
        filtros = Rel.filtros($('rel-filtros'), {
            periodos: ['90d', 'mes', 'mes_passado', 'ano', 'ano_passado', 'personalizado'],
            periodoPadrao: 'ano',
            extras: [
                { id: 'visao', rotulo: 'Visão', opcoes: [['mes', 'Mensal'], ['tri', 'Trimestral']] },
                { id: 'metrica', rotulo: 'Métrica do gráfico', opcoes: [['liquido', 'Lucro líquido'], ['fat', 'Faturamento bruto'], ['margem', 'Margem percentual']] }
            ],
            aoMudar: render
        });

        function corValor(v) { return v < 0 ? 'text-red-600' : 'text-gray-900'; }
        tabela = Rel.tabela($('rel-tabela'), {
            titulo: 'Demonstrativo de resultado',
            ordem: { chave: 'ini', dir: 'asc' },
            vazio: 'Sem movimentação no período selecionado.',
            colunas: [
                { chave: 'ini', titulo: 'Período', alinhar: 'left', render: function (l) { return '<span class="font-bold text-gray-900">' + esc(l.periodo) + '</span>'; }, csv: function (l) { return l.periodo; } },
                { chave: 'faturamento', titulo: 'Faturamento', alinhar: 'right', total: 'soma', formatar: fmt.moeda },
                { chave: 'cmv', titulo: 'Custos (CMV)', alinhar: 'right', total: 'soma', formatar: fmt.moeda },
                { chave: 'lucroBruto', titulo: 'Lucro bruto', alinhar: 'right', total: 'soma', formatar: fmt.moeda, render: function (l) { return '<span class="' + corValor(l.lucroBruto) + '">' + fmt.moeda(l.lucroBruto) + '</span>'; } },
                { chave: 'despesas', titulo: 'Despesas pagas', alinhar: 'right', total: 'soma', formatar: fmt.moeda },
                { chave: 'lucroLiquido', titulo: 'Lucro líquido', alinhar: 'right', total: 'soma', formatar: fmt.moeda, render: function (l) { return '<span class="font-bold ' + (l.lucroLiquido < 0 ? 'text-red-600' : 'text-green-600') + '">' + fmt.moeda(l.lucroLiquido) + '</span>'; } },
                {
                    chave: 'margem', titulo: 'Margem', alinhar: 'right', formatar: function (v) { return fmt.porcentagem(v); },
                    total: function (ls) { var f = Rel.somar(ls, function (l) { return l.faturamento; }); return f ? Rel.somar(ls, function (l) { return l.lucroLiquido; }) / f * 100 : 0; },
                    render: function (l) { return '<span class="' + corValor(l.margem) + '">' + fmt.porcentagem(l.margem) + '</span>'; }
                }
            ]
        });

        Rel.ligarBotoes({ nome: 'lucro-mensal', tabelas: { lucro: function () { return tabela; } } });
        render(filtros.ler());
    }

    /* Linhas mensais entre duas datas */
    function linhasMensais(ini, fim) {
        var s = Rel.serie(ini, fim, 'mes');
        var linhas = s.buckets.map(function (b) {
            return { ini: b.ini, chave: b.chave, periodo: b.rotuloLongo, rotulo: b.rotulo, faturamento: 0, cmv: 0, despesas: 0 };
        });
        Rel.pedidos(ctx, ini, fim).forEach(function (p) {
            var i = s.indiceDe(Rel.data.diaLocal(p.data));
            if (i < 0) return;
            linhas[i].faturamento += Rel.totalPedido(p);
            (p.itens || []).forEach(function (it) { linhas[i].cmv += (Number(it.quantidade) || 0) * (Number(it.custoUnitario) || 0); });
        });
        ctx.lancamentos.forEach(function (l) {
            if (l.tipo !== 'Despesa' || l.status === 'Cancelado' || !l.dataPagamento || l.categoria === CATEGORIA_COMPRA) return;
            var i = s.indiceDe(Rel.data.diaLocal(l.dataPagamento));
            if (i >= 0) linhas[i].despesas += Number(l.valor) || 0;
        });
        linhas.forEach(calcular);
        return linhas;
    }

    function calcular(l) {
        l.lucroBruto = l.faturamento - l.cmv;
        l.lucroLiquido = l.lucroBruto - l.despesas;
        l.margem = l.faturamento ? l.lucroLiquido / l.faturamento * 100 : 0;
    }

    /* Junta os meses em trimestres */
    function trimestres(meses) {
        var grupos = {}, ordem = [];
        meses.forEach(function (m) {
            var ano = m.ini.slice(0, 4), tri = Math.floor((Number(m.ini.slice(5, 7)) - 1) / 3) + 1;
            var k = ano + 'T' + tri;
            if (!grupos[k]) { grupos[k] = { ini: m.ini, periodo: tri + 'º trimestre de ' + ano, rotulo: tri + 'º tri/' + ano.slice(2), faturamento: 0, cmv: 0, despesas: 0 }; ordem.push(k); }
            grupos[k].faturamento += m.faturamento; grupos[k].cmv += m.cmv; grupos[k].despesas += m.despesas;
        });
        return ordem.map(function (k) { calcular(grupos[k]); return grupos[k]; });
    }

    function totais(linhas) {
        var t = { faturamento: Rel.somar(linhas, function (l) { return l.faturamento; }), cmv: Rel.somar(linhas, function (l) { return l.cmv; }), despesas: Rel.somar(linhas, function (l) { return l.despesas; }) };
        calcular(t);
        return t;
    }

    function render(f) {
        var per = f.periodo;
        var meses = linhasMensais(per.inicio, per.fimEfetivo);
        /* descarta meses vazios do inicio (antes de o sistema ter movimento) */
        while (meses.length > 1 && !meses[0].faturamento && !meses[0].despesas) meses.shift();
        var linhas = f.v.visao === 'tri' ? trimestres(meses) : meses;

        var t = totais(meses);
        var ant = totais(linhasMensais(per.anterior.inicio, per.anterior.fim));

        Rel.cabecalho({ subtitulo: 'Demonstrativo de resultado de ' + fmt.data(per.inicio) + ' a ' + fmt.data(per.fim), filtros: f.descricao });
        Rel.kpis($('rel-kpis'), [
            { titulo: 'Faturamento total', valor: fmt.moeda(t.faturamento), variacao: { atual: t.faturamento, anterior: ant.faturamento } },
            { titulo: 'Custos / CMV', valor: fmt.moeda(t.cmv), cor: 'laranja', sub: fmt.porcentagem(t.faturamento ? t.cmv / t.faturamento * 100 : 0) + ' do faturamento' },
            { titulo: 'Lucro líquido acumulado', valor: fmt.moeda(t.lucroLiquido), cor: t.lucroLiquido < 0 ? 'vermelho' : 'verde', variacao: { atual: t.lucroLiquido, anterior: ant.lucroLiquido } },
            { titulo: 'Margem de lucro média', valor: fmt.porcentagem(t.margem), cor: t.margem < 0 ? 'vermelho' : 'roxo', sub: 'Despesas pagas no período: ' + fmt.moeda(t.despesas) }
        ]);

        var metrica = f.v.metrica;
        var rotulos = { liquido: 'Lucro líquido', fat: 'Faturamento bruto', margem: 'Margem (%)' };
        var chaves = { liquido: 'lucroLiquido', fat: 'faturamento', margem: 'margem' };
        var valores = linhas.map(function (l) { return l[chaves[metrica]]; });
        $('rel-grafico-sub').textContent = rotulos[metrica] + ' por ' + (f.v.visao === 'tri' ? 'trimestre' : 'mês');
        var ds = { label: rotulos[metrica], data: valores };
        if (metrica === 'liquido') ds.backgroundColor = valores.map(function (v) { return v < 0 ? '#ef4444' : '#7c3aed'; });
        if (metrica === 'margem') { ds.fill = true; }
        Rel.grafico('lucroChart', {
            tipo: metrica === 'margem' ? 'line' : 'bar',
            formato: metrica === 'margem' ? 'percentual' : 'moeda',
            labels: linhas.map(function (l) { return l.rotulo; }),
            datasets: [ds]
        });

        $('rel-tabela-info').textContent = linhas.length + ' ' + (f.v.visao === 'tri' ? (linhas.length === 1 ? 'trimestre' : 'trimestres') : (linhas.length === 1 ? 'mês' : 'meses'));
        tabela.atualizar(linhas);
    }

    Rel.iniciar(iniciar);
})();
