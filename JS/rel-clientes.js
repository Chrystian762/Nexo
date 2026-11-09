/*
 * Relatorio de Clientes
 *  - Ativo = cadastro ativo e com compra (pedido nao cancelado) nos ultimos 60 dias.
 *    Inativo = qualquer outro caso (cadastro inativo, ou sem compra ha 60 dias ou mais).
 *  - Novos clientes por mes: ultimos 12 meses (nao depende do periodo escolhido).
 *  - Top clientes e vendas por revendedor: usam o periodo escolhido.
 */
(function () {
    'use strict';
    var Nexo = window.Nexo, Rel = window.Rel, fmt = Nexo.fmt, esc = Nexo.esc;
    var $ = function (id) { return document.getElementById(id); };
    var DIAS_INATIVO = 60;
    var ctx, filtros, tabTop, tabSem, tabRev;

    function iniciar() {
        ctx = Rel.contexto();
        filtros = Rel.filtros($('rel-filtros'), {
            periodoPadrao: '90d',
            extras: [
                { id: 'tipo', rotulo: 'Tipo de cliente', opcoes: [['', 'Todos (PF e PJ)'], ['PF', 'Pessoa física'], ['PJ', 'Pessoa jurídica']] },
                { id: 'revendedor', rotulo: 'Revendedor', opcoes: [['', 'Todos'], ['__sem', 'Sem revendedor']].concat(ctx.revendedores.map(function (r) { return [r.id, r.nome]; })) }
            ],
            aoMudar: render
        });

        function linkCliente(l) { return '<a href="clientes.html?id=' + encodeURIComponent(l.id) + '" class="font-bold text-gray-900 hover:text-brand-purple">' + esc(l.nome) + '</a>'; }
        var colUltima = { chave: 'ultimaCompra', titulo: 'Última compra', alinhar: 'center', valor: function (l) { return l.ultimaCompra || ''; }, formatar: function (v) { return v ? fmt.data(v) : 'Nunca comprou'; } };

        tabTop = Rel.tabela($('rel-tabela-top'), {
            titulo: 'Top clientes no período',
            ordem: { chave: 'faturamento', dir: 'desc' }, limite: 15,
            vazio: 'Nenhum cliente comprou no período selecionado.',
            colunas: [
                { chave: 'nome', titulo: 'Cliente', alinhar: 'left', render: linkCliente, csv: function (l) { return l.nome; } },
                { chave: 'tipo', titulo: 'Tipo', alinhar: 'center' },
                { chave: 'cidade', titulo: 'Cidade', alinhar: 'left' },
                { chave: 'pedidos', titulo: 'Pedidos', alinhar: 'center', total: 'soma', formatar: fmt.numero },
                { chave: 'faturamento', titulo: 'Faturamento', alinhar: 'right', total: 'soma', formatar: fmt.moeda, render: function (l) { return '<span class="font-bold text-gray-900">' + fmt.moeda(l.faturamento) + '</span>'; } },
                { chave: 'ticket', titulo: 'Ticket médio', alinhar: 'right', formatar: fmt.moeda, total: function (ls) { var p = Rel.somar(ls, function (l) { return l.pedidos; }); return p ? Rel.somar(ls, function (l) { return l.faturamento; }) / p : 0; } },
                colUltima
            ]
        });

        tabSem = Rel.tabela($('rel-tabela-sem'), {
            titulo: 'Clientes sem compra há ' + DIAS_INATIVO + '+ dias',
            ordem: { chave: 'dias', dir: 'desc' }, total: false,
            vazio: 'Todos os clientes ativos compraram nos últimos ' + DIAS_INATIVO + ' dias.',
            colunas: [
                { chave: 'nome', titulo: 'Cliente', alinhar: 'left', render: linkCliente, csv: function (l) { return l.nome; } },
                { chave: 'tipo', titulo: 'Tipo', alinhar: 'center' },
                { chave: 'cidade', titulo: 'Cidade', alinhar: 'left' },
                { chave: 'telefone', titulo: 'Telefone', alinhar: 'left' },
                colUltima,
                { chave: 'dias', titulo: 'Dias sem comprar', alinhar: 'center', valor: function (l) { return l.dias === null ? 99999 : l.dias; }, render: function (l) { return l.dias === null ? '<span class="text-gray-400">-</span>' : '<span class="inline-block px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-700">' + l.dias + ' dias</span>'; }, csv: function (l) { return l.dias === null ? '' : l.dias; } }
            ]
        });

        tabRev = Rel.tabela($('rel-tabela-revendedor'), {
            titulo: 'Clientes e vendas por revendedor',
            ordem: { chave: 'faturamento', dir: 'desc' },
            vazio: 'Nenhum dado de revendedor para os filtros selecionados.',
            colunas: [
                { chave: 'nome', titulo: 'Revendedor', alinhar: 'left', render: function (l) { return l.id ? '<a href="revendedores.html?id=' + encodeURIComponent(l.id) + '" class="font-bold text-gray-900 hover:text-brand-purple">' + esc(l.nome) + '</a>' : '<span class="font-medium text-gray-500">' + esc(l.nome) + '</span>'; }, csv: function (l) { return l.nome; } },
                { chave: 'clientes', titulo: 'Clientes', alinhar: 'center', total: 'soma', formatar: fmt.numero },
                { chave: 'pedidos', titulo: 'Pedidos no período', alinhar: 'center', total: 'soma', formatar: fmt.numero },
                { chave: 'faturamento', titulo: 'Faturamento', alinhar: 'right', total: 'soma', formatar: fmt.moeda },
                { chave: 'comissao', titulo: 'Comissão estimada', alinhar: 'right', total: 'soma', formatar: fmt.moeda }
            ]
        });

        Rel.ligarBotoes({ nome: 'relatorio-de-clientes', tabelas: { top: function () { return tabTop; }, inativos: function () { return tabSem; }, revendedores: function () { return tabRev; } } });
        render(filtros.ler());
    }

    function render(f) {
        var per = f.periodo;
        var hoje = Rel.data.hoje();

        /* clientes que passam nos filtros de tipo e revendedor */
        var clientes = ctx.clientes.filter(function (c) {
            if (f.v.tipo && c.tipo !== f.v.tipo) return false;
            if (f.v.revendedor === '__sem') return !c.revendedorId;
            if (f.v.revendedor) return c.revendedorId === f.v.revendedor;
            return true;
        });
        var ids = {};
        clientes.forEach(function (c) { ids[c.id] = true; });

        /* compras por cliente (todas as datas, para a ultima compra) e no periodo */
        var ultima = {}, noPeriodo = {};
        var pedidosValidos = ctx.pedidos.filter(function (p) { return p.status !== 'Cancelado' && ids[p.clienteId]; });
        pedidosValidos.forEach(function (p) {
            var d = Rel.data.diaLocal(p.data);
            if (!ultima[p.clienteId] || d > ultima[p.clienteId]) ultima[p.clienteId] = d;
            if (d >= per.inicio && d <= per.fimEfetivo) {
                var g = noPeriodo[p.clienteId] || (noPeriodo[p.clienteId] = { pedidos: 0, faturamento: 0 });
                g.pedidos++; g.faturamento += Rel.totalPedido(p);
            }
        });

        var linhasCli = clientes.map(function (c) {
            var u = ultima[c.id] || null;
            var dias = u ? Rel.data.diasEntre(u, hoje) : null;
            var g = noPeriodo[c.id] || { pedidos: 0, faturamento: 0 };
            return {
                id: c.id, nome: c.nome, tipo: c.tipo, cidade: (c.endereco || {}).cidade || 'Não informada', telefone: c.telefone || '-',
                cadastro: Rel.data.diaLocal(c.criadoEm), statusCadastro: c.status, revendedorId: c.revendedorId,
                ultimaCompra: u, dias: dias, pedidos: g.pedidos, faturamento: g.faturamento,
                ticket: g.pedidos ? g.faturamento / g.pedidos : 0,
                ativo: c.status === 'Ativo' && dias !== null && dias < DIAS_INATIVO
            };
        });

        var ativos = linhasCli.filter(function (l) { return l.ativo; }).length;
        var inativos = linhasCli.length - ativos;
        var novos = linhasCli.filter(function (l) { return l.cadastro >= per.inicio && l.cadastro <= per.fimEfetivo; }).length;
        var novosAnt = linhasCli.filter(function (l) { return l.cadastro >= per.anterior.inicio && l.cadastro <= per.anterior.fim; }).length;
        var comprando = linhasCli.filter(function (l) { return l.pedidos > 0; });
        var fat = Rel.somar(comprando, function (l) { return l.faturamento; });
        var fatAnt = Rel.somar(pedidosValidos.filter(function (p) { var d = Rel.data.diaLocal(p.data); return d >= per.anterior.inicio && d <= per.anterior.fim; }), Rel.totalPedido);

        Rel.cabecalho({ subtitulo: 'Base de clientes e compras de ' + fmt.data(per.inicio) + ' a ' + fmt.data(per.fim), filtros: f.descricao });
        Rel.kpis($('rel-kpis'), [
            { titulo: 'Total de clientes', valor: fmt.numero(linhasCli.length), sub: fmt.numero(linhasCli.filter(function (l) { return l.tipo === 'PF'; }).length) + ' PF e ' + fmt.numero(linhasCli.filter(function (l) { return l.tipo === 'PJ'; }).length) + ' PJ' },
            { titulo: 'Clientes ativos', valor: fmt.numero(ativos), cor: 'verde', sub: fmt.numero(inativos) + ' inativos (sem compra há ' + DIAS_INATIVO + '+ dias)' },
            { titulo: 'Novos no período', valor: fmt.numero(novos), cor: 'roxo', variacao: { atual: novos, anterior: novosAnt } },
            { titulo: 'Faturamento dos clientes', valor: fmt.moeda(fat), variacao: { atual: fat, anterior: fatAnt } }
        ]);

        /* grafico 1: novos clientes nos ultimos 12 meses */
        var mesInicial = Rel.data.somarMeses(hoje, -11);
        var serie = Rel.serie(mesInicial, hoje, 'mes');
        var novosMes = serie.buckets.map(function () { return 0; });
        linhasCli.forEach(function (l) { var i = serie.indiceDe(l.cadastro); if (i >= 0) novosMes[i]++; });
        Rel.grafico('novosChart', { tipo: 'bar', formato: 'numero', labels: serie.buckets.map(function (b) { return b.rotulo; }), datasets: [{ label: 'Novos clientes', data: novosMes }] });

        /* grafico 2: ativos x inativos */
        Rel.grafico('ativosChart', { tipo: 'doughnut', formato: 'numero', labels: ['Ativos', 'Inativos'], datasets: [{ data: [ativos, inativos], backgroundColor: ['#10b981', '#cbd5e1'] }] });

        /* grafico 3: PF x PJ */
        var pf = linhasCli.filter(function (l) { return l.tipo === 'PF'; }).length;
        Rel.grafico('tipoChart', { tipo: 'doughnut', formato: 'numero', labels: ['Pessoa física', 'Pessoa jurídica'], datasets: [{ data: [pf, linhasCli.length - pf], backgroundColor: ['#7c3aed', '#3b82f6'] }] });

        /* grafico 4: distribuicao por cidade */
        var cidades = {};
        linhasCli.forEach(function (l) { cidades[l.cidade] = (cidades[l.cidade] || 0) + 1; });
        var listaCidades = Object.keys(cidades).map(function (k) { return { cidade: k, n: cidades[k] }; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 8);
        Rel.grafico('cidadeChart', { tipo: 'bar', horizontal: true, formato: 'numero', labels: listaCidades.map(function (c) { return c.cidade; }), datasets: [{ label: 'Clientes', data: listaCidades.map(function (c) { return c.n; }) }] });

        /* tabelas */
        var top = linhasCli.filter(function (l) { return l.pedidos > 0; });
        $('rel-tabela-top-info').textContent = top.length + ' cliente' + (top.length === 1 ? '' : 's') + ' com compras no período';
        tabTop.atualizar(top);

        var sem = linhasCli.filter(function (l) { return l.statusCadastro === 'Ativo' && (l.dias === null || l.dias >= DIAS_INATIVO); });
        $('rel-tabela-sem-info').textContent = sem.length + ' cliente' + (sem.length === 1 ? '' : 's') + ' para reativar';
        tabSem.atualizar(sem);

        var grupos = {};
        function grupo(id, nome, comissaoPct) { return grupos[id] || (grupos[id] = { id: id === '__sem' ? null : id, nome: nome, clientes: 0, pedidos: 0, faturamento: 0, comissao: 0, pct: comissaoPct }); }
        linhasCli.forEach(function (l) {
            var r = ctx.rev[l.revendedorId];
            grupo(r ? r.id : '__sem', r ? r.nome : 'Sem revendedor', r ? Number(r.comissao) || 0 : 0).clientes++;
        });
        linhasCli.forEach(function (l) {
            var r = ctx.rev[l.revendedorId];
            var g = grupo(r ? r.id : '__sem', r ? r.nome : 'Sem revendedor', r ? Number(r.comissao) || 0 : 0);
            g.pedidos += l.pedidos; g.faturamento += l.faturamento;
        });
        var linhasRev = Object.keys(grupos).map(function (k) { var g = grupos[k]; g.comissao = g.faturamento * g.pct / 100; return g; });
        $('rel-tabela-revendedor-info').textContent = linhasRev.length + ' grupo' + (linhasRev.length === 1 ? '' : 's');
        tabRev.atualizar(linhasRev);
    }

    Rel.iniciar(iniciar);
})();
