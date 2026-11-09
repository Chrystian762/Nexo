/*
 * NEXO ERP - Tela Início (Dashboard)
 * Todos os números vêm do localStorage (Nexo.db / Nexo.consultas).
 * O filtro de período (Hoje, 7 Dias, 30 Dias, Este mês, Este ano) recalcula os módulos
 * e compara com o período anterior de mesmo tamanho.
 */
(function () {
    'use strict';

    var esc = Nexo.esc;
    var fmt = Nexo.fmt;

    var estado = { periodo: 'hoje', atividadesVisiveis: 6 };
    var grafico = null;

    /* Ícone e cor de cada tipo de atividade */
    var ICONES_ATIVIDADE = {
        pedido: ['fa-cart-shopping', 'bg-blue-50 text-blue-500'],
        alerta: ['fa-triangle-exclamation', 'bg-red-50 text-red-500'],
        cliente: ['fa-user-plus', 'bg-green-50 text-green-500'],
        compra: ['fa-truck-fast', 'bg-orange-50 text-orange-500'],
        estoque: ['fa-box-open', 'bg-purple-50 text-brand-purple'],
        financeiro: ['fa-wallet', 'bg-emerald-50 text-emerald-600'],
        login: ['fa-right-to-bracket', 'bg-gray-100 text-gray-500'],
        seguranca: ['fa-shield-halved', 'bg-gray-100 text-gray-500'],
        empresa: ['fa-building', 'bg-purple-50 text-brand-purple']
    };

    var STATUS_EXIBIDOS = [
        { nome: 'Novo', icone: 'fa-star', cor: 'bg-blue-50 text-blue-600' },
        { nome: 'Em separação', icone: 'fa-box', cor: 'bg-amber-50 text-amber-600' },
        { nome: 'Enviado', icone: 'fa-truck-fast', cor: 'bg-indigo-50 text-indigo-600' },
        { nome: 'Entregue', icone: 'fa-circle-check', cor: 'bg-emerald-50 text-emerald-600' }
    ];

    /* ------------------------------------------------------------------ */
    /* Datas e período                                                     */
    /* ------------------------------------------------------------------ */
    function paraISO(d) {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function somarDias(iso, n) {
        var d = new Date(iso + 'T12:00:00');
        d.setDate(d.getDate() + n);
        return paraISO(d);
    }

    function diferencaDias(a, b) {
        return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
    }

    /* Devolve início/fim do período escolhido e do período anterior de mesmo tamanho */
    function calcularPeriodo(chave) {
        var hoje = fmt.hojeInput();
        var ini = hoje;
        if (chave === '7dias') ini = somarDias(hoje, -6);
        else if (chave === '30dias') ini = somarDias(hoje, -29);
        else if (chave === 'mes') ini = hoje.slice(0, 8) + '01';
        else if (chave === 'ano') ini = hoje.slice(0, 5) + '01-01';
        var dias = diferencaDias(ini, hoje) + 1;
        return { chave: chave, ini: ini, fim: hoje, dias: dias, iniAnt: somarDias(ini, -dias), fimAnt: somarDias(ini, -1) };
    }

    /* ------------------------------------------------------------------ */
    /* Cálculos                                                            */
    /* ------------------------------------------------------------------ */
    function resumir(pedidos) {
        var total = 0, recebido = 0, itens = 0;
        pedidos.forEach(function (p) {
            var t = Number(p.total) || 0;
            total += t;
            if (p.pagamento && p.pagamento.status === 'Pago') recebido += t;
            (p.itens || []).forEach(function (it) { itens += Number(it.quantidade) || 0; });
        });
        return {
            qtd: pedidos.length,
            total: total,
            recebido: recebido,
            aReceber: total - recebido,
            itens: itens,
            ticket: pedidos.length ? total / pedidos.length : 0
        };
    }

    function novosClientes(ini, fim) {
        return Nexo.db.listar('clientes').filter(function (c) {
            var d = fmt.dataInput(c.criadoEm);
            return d >= ini && d <= fim;
        }).length;
    }

    /* Variação percentual (null quando não há base de comparação) */
    function variacao(atual, anterior) {
        if (!anterior) return atual ? null : 0;
        return ((atual - anterior) / anterior) * 100;
    }

    function htmlVariacao(v) {
        if (v === null) return '<span class="text-gray-500">Sem dados no período anterior</span>';
        var cor = v > 0 ? 'text-green-500' : (v < 0 ? 'text-red-500' : 'text-gray-500');
        var icone = v > 0 ? 'fa-arrow-trend-up' : (v < 0 ? 'fa-arrow-trend-down' : 'fa-minus');
        var sinal = v > 0 ? '+' : '';
        return '<span class="' + cor + '"><i class="fa-solid ' + icone + '"></i> ' + sinal + fmt.porcentagem(v) + '</span> <span class="text-gray-400 font-medium">vs. período anterior</span>';
    }

    /* Soma valores por chave e devolve lista ordenada do maior para o menor */
    function agrupar(pedidos, extrair) {
        var mapa = {};
        pedidos.forEach(function (p) {
            extrair(p).forEach(function (par) {
                var m = mapa[par.chave] || (mapa[par.chave] = { chave: par.chave, valor: 0, qtd: 0 });
                m.valor += par.valor;
                m.qtd += par.qtd || 0;
            });
        });
        return Object.keys(mapa).map(function (k) { return mapa[k]; }).sort(function (a, b) { return b.valor - a.valor; });
    }

    /* ------------------------------------------------------------------ */
    /* Desenho dos módulos                                                 */
    /* ------------------------------------------------------------------ */
    function vazio(texto) {
        return '<p class="text-sm text-gray-400 text-center py-6">' + esc(texto) + '</p>';
    }

    function cartaoKpi(rotulo, valor, icone, corIcone, rodape) {
        return '<div class="bg-white p-5 rounded-2xl shadow-sm border border-brand-border flex items-center gap-4">' +
            '<div class="w-12 h-12 rounded-xl ' + corIcone + ' flex items-center justify-center text-xl shrink-0"><i class="fa-solid ' + icone + '"></i></div>' +
            '<div class="min-w-0"><p class="text-xs font-bold text-gray-500 uppercase">' + rotulo + '</p>' +
            '<p class="text-xl 2xl:text-2xl font-extrabold text-gray-900 leading-tight break-words">' + valor + '</p>' +
            '<p class="text-xs font-semibold mt-1">' + rodape + '</p></div></div>';
    }

    function desenharKpis(atual, anterior, per, pendentes) {
        var novos = novosClientes(per.ini, per.fim);
        var novosAnt = novosClientes(per.iniAnt, per.fimAnt);
        document.getElementById('kpis').innerHTML =
            cartaoKpi('Faturamento', fmt.moeda(atual.total), 'fa-money-bill-wave', 'bg-purple-50 text-brand-purple', htmlVariacao(variacao(atual.total, anterior.total))) +
            cartaoKpi('Vendas', fmt.numero(atual.qtd), 'fa-cart-shopping', 'bg-blue-50 text-blue-500', htmlVariacao(variacao(atual.qtd, anterior.qtd))) +
            cartaoKpi('Pedidos Pendentes', fmt.numero(pendentes), 'fa-box', 'bg-orange-50 text-orange-500', '<span class="text-gray-500">Aguardando separação ou envio</span>') +
            cartaoKpi('Novos Clientes', fmt.numero(novos), 'fa-users', 'bg-green-50 text-green-500', htmlVariacao(variacao(novos, novosAnt)));
    }

    function desenharResumoFaturamento(atual, anterior) {
        function caixa(rotulo, valor, cor, extra) {
            return '<div class="rounded-xl bg-gray-50 border border-gray-100 p-3"><p class="text-[11px] font-bold text-gray-500 uppercase">' + rotulo + '</p>' +
                '<p class="text-base md:text-lg font-extrabold ' + cor + ' truncate">' + fmt.moeda(valor) + '</p>' + (extra || '') + '</div>';
        }
        document.getElementById('resumoFaturamento').innerHTML =
            caixa('Faturado', atual.total, 'text-gray-900', '<p class="text-[11px] font-semibold mt-0.5">' + htmlVariacao(variacao(atual.total, anterior.total)) + '</p>') +
            caixa('Recebido', atual.recebido, 'text-emerald-600') +
            caixa('A receber', atual.aReceber, 'text-amber-600');
    }

    /* Gráfico: por hora (Hoje), por dia (7/30 dias e mês) ou por mês (ano) */
    function desenharGrafico(pedidos, per) {
        var rotulos = [], valores = [], i;
        if (per.chave === 'hoje') {
            for (i = 6; i <= 22; i++) { rotulos.push(String(i).padStart(2, '0') + ':00'); valores.push(0); }
            pedidos.forEach(function (p) {
                var h = new Date(p.data).getHours();
                if (h < 6) h = 6;
                if (h > 22) h = 22;
                valores[h - 6] += Number(p.total) || 0;
            });
        } else if (per.chave === 'ano') {
            var mesAtual = Number(per.fim.slice(5, 7));
            var nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
            for (i = 0; i < mesAtual; i++) { rotulos.push(nomes[i]); valores.push(0); }
            pedidos.forEach(function (p) {
                var m = Number(fmt.dataInput(p.data).slice(5, 7)) - 1;
                if (m >= 0 && m < valores.length) valores[m] += Number(p.total) || 0;
            });
        } else {
            var indice = {};
            for (i = 0; i < per.dias; i++) {
                var dia = somarDias(per.ini, i);
                indice[dia] = i;
                rotulos.push(dia.slice(8, 10) + '/' + dia.slice(5, 7));
                valores.push(0);
            }
            pedidos.forEach(function (p) {
                var k = indice[fmt.dataInput(p.data)];
                if (k !== undefined) valores[k] += Number(p.total) || 0;
            });
        }
        valores = valores.map(function (v) { return Math.round(v * 100) / 100; });

        if (grafico) { grafico.destroy(); grafico = null; }
        if (typeof Chart === 'undefined') return;
        var ctx = document.getElementById('revenueChart').getContext('2d');
        var gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(124, 58, 237, 0.4)');
        gradient.addColorStop(1, 'rgba(124, 58, 237, 0.0)');
        grafico = new Chart(ctx, {
            type: 'line',
            data: {
                labels: rotulos,
                datasets: [{
                    label: 'Faturamento (R$)',
                    data: valores,
                    borderColor: '#7c3aed',
                    backgroundColor: gradient,
                    borderWidth: 3,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#7c3aed',
                    pointBorderWidth: 2,
                    pointRadius: valores.length > 40 ? 2 : 4,
                    pointHoverRadius: 6,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#111827',
                        padding: 12,
                        titleFont: { family: 'Inter', size: 13 },
                        bodyFont: { family: 'Inter', size: 14, weight: 'bold' },
                        displayColors: false,
                        callbacks: { label: function (c) { return fmt.moeda(c.parsed.y); } }
                    }
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { family: 'Inter', size: 11 }, color: '#94a3b8' } },
                    x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 11 }, color: '#94a3b8', maxTicksLimit: 12 } }
                }
            }
        });
    }

    function desenharPedidos(periodoPedidosTodos, pedidosValidos, clientes) {
        /* contagem por status (inclui só pedidos do período) */
        var contagem = {};
        periodoPedidosTodos.forEach(function (p) { contagem[p.status] = (contagem[p.status] || 0) + 1; });
        var cancelados = contagem['Cancelado'] || 0;
        document.getElementById('statusPedidos').innerHTML = STATUS_EXIBIDOS.map(function (s) {
            return '<div class="rounded-xl border border-gray-100 p-3 flex items-center gap-3">' +
                '<div class="w-9 h-9 rounded-lg ' + s.cor + ' flex items-center justify-center shrink-0"><i class="fa-solid ' + s.icone + '"></i></div>' +
                '<div><p class="text-xl font-extrabold text-gray-900 leading-tight">' + (contagem[s.nome] || 0) + '</p>' +
                '<p class="text-xs text-gray-500 font-semibold">' + s.nome + '</p></div></div>';
        }).join('');

        var recentes = pedidosValidos.slice().sort(function (a, b) { return a.data < b.data ? 1 : -1; }).slice(0, 6);
        var corpo = recentes.map(function (p) {
            var cli = clientes[p.clienteId] || {};
            return '<tr class="hover:bg-gray-50 transition">' +
                '<td class="px-6 py-3"><a href="pedidos.html?id=' + encodeURIComponent(p.id) + '" class="font-bold text-brand-purple hover:underline">#' + esc(p.numero) + '</a></td>' +
                '<td class="px-6 py-3">' + esc(cli.nome || 'Cliente removido') + '</td>' +
                '<td class="px-6 py-3 text-gray-500">' + fmt.dataHora(p.data) + '</td>' +
                '<td class="px-6 py-3 font-bold">' + fmt.moeda(p.total) + '</td>' +
                '<td class="px-6 py-3 text-center">' + Nexo.ui.badgeStatus(p.status) + '</td></tr>';
        }).join('');
        document.getElementById('tabelaPedidos').innerHTML = recentes.length ?
            '<table class="w-full text-left text-sm whitespace-nowrap"><thead class="text-gray-500 border-b border-gray-100"><tr>' +
            '<th class="px-6 py-3 font-bold">Pedido</th><th class="px-6 py-3 font-bold">Cliente</th><th class="px-6 py-3 font-bold">Data</th>' +
            '<th class="px-6 py-3 font-bold">Total</th><th class="px-6 py-3 font-bold text-center">Status</th></tr></thead>' +
            '<tbody class="divide-y divide-gray-100 text-gray-700 font-medium">' + corpo + '</tbody></table>' +
            '<p class="px-6 py-3 text-xs text-gray-400">Pedidos cancelados no período: ' + cancelados + '</p>' :
            vazio('Nenhum pedido neste período.');
    }

    function linhaRanking(posicao, link, titulo, detalhe, valor) {
        return '<a href="' + link + '" class="flex items-center gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-gray-50 transition">' +
            '<span class="w-6 h-6 rounded-full bg-brand-purpleLight text-brand-purple text-xs font-bold flex items-center justify-center shrink-0">' + posicao + '</span>' +
            '<span class="min-w-0 flex-1"><span class="block text-sm font-semibold text-gray-900 truncate">' + esc(titulo) + '</span>' +
            '<span class="block text-xs text-gray-500">' + esc(detalhe) + '</span></span>' +
            '<span class="text-sm font-bold text-gray-900 shrink-0">' + valor + '</span></a>';
    }

    function desenharClientes(pedidos, per, clientes) {
        var todos = Nexo.db.listar('clientes');
        var ativos = todos.filter(function (c) { return c.status === 'Ativo'; }).length;
        var novos = novosClientes(per.ini, per.fim);
        var top = agrupar(pedidos, function (p) { return [{ chave: p.clienteId, valor: Number(p.total) || 0, qtd: 1 }]; }).slice(0, 5);
        var lista = top.map(function (t, i) {
            var c = clientes[t.chave] || {};
            return linhaRanking(i + 1, 'clientes.html?id=' + encodeURIComponent(t.chave), c.nome || 'Cliente removido', t.qtd + (t.qtd === 1 ? ' pedido' : ' pedidos'), fmt.moeda(t.valor));
        }).join('');
        document.getElementById('modClientes').innerHTML =
            '<div class="grid grid-cols-2 gap-3 mb-4">' +
            '<div class="rounded-xl bg-gray-50 border border-gray-100 p-3"><p class="text-[11px] font-bold text-gray-500 uppercase">Clientes ativos</p><p class="text-xl font-extrabold text-gray-900">' + fmt.numero(ativos) + '</p></div>' +
            '<div class="rounded-xl bg-gray-50 border border-gray-100 p-3"><p class="text-[11px] font-bold text-gray-500 uppercase">Novos no período</p><p class="text-xl font-extrabold text-gray-900">' + fmt.numero(novos) + '</p></div></div>' +
            '<p class="text-xs font-bold text-gray-500 uppercase mb-1">Top 5 clientes por valor</p>' +
            (lista ? '<div class="divide-y divide-gray-50">' + lista + '</div>' : vazio('Nenhuma compra neste período.'));
    }

    function desenharVendas(pedidos, atual) {
        var produtos = Nexo.consultas.mapa('produtos');
        var topProdutos = agrupar(pedidos, function (p) {
            return (p.itens || []).map(function (it) {
                return { chave: it.produtoId, valor: Number(it.quantidade) || 0, qtd: (Number(it.quantidade) || 0) * (Number(it.precoUnitario) || 0) };
            });
        }).slice(0, 5);
        /* em topProdutos, "valor" = unidades vendidas e "qtd" = receita do produto */
        var listaProd = topProdutos.map(function (t, i) {
            var pr = produtos[t.chave] || {};
            return linhaRanking(i + 1, 'produtos.html?id=' + encodeURIComponent(t.chave), pr.nome || 'Produto removido', fmt.moeda(t.qtd), fmt.numero(t.valor) + ' un.');
        }).join('');

        var vendedores = agrupar(pedidos, function (p) { return [{ chave: p.vendedor || 'Sem vendedor', valor: Number(p.total) || 0, qtd: 1 }]; });
        var maior = vendedores.length ? vendedores[0].valor : 0;
        var listaVend = vendedores.map(function (v) {
            var pct = maior ? Math.max(4, Math.round(v.valor / maior * 100)) : 0;
            return '<div class="mb-2"><div class="flex justify-between text-xs mb-1"><span class="font-semibold text-gray-700">' + esc(v.chave) + ' <span class="text-gray-400 font-medium">(' + v.qtd + ')</span></span>' +
                '<span class="font-bold text-gray-900">' + fmt.moeda(v.valor) + '</span></div>' +
                '<div class="h-2 rounded-full bg-gray-100 overflow-hidden"><div class="h-full rounded-full bg-brand-purple" style="width:' + pct + '%"></div></div></div>';
        }).join('');

        document.getElementById('modVendas').innerHTML =
            '<div class="grid grid-cols-2 gap-3 mb-4">' +
            '<div class="rounded-xl bg-gray-50 border border-gray-100 p-3"><p class="text-[11px] font-bold text-gray-500 uppercase">Ticket médio</p><p class="text-xl font-extrabold text-gray-900">' + fmt.moeda(atual.ticket) + '</p></div>' +
            '<div class="rounded-xl bg-gray-50 border border-gray-100 p-3"><p class="text-[11px] font-bold text-gray-500 uppercase">Itens vendidos</p><p class="text-xl font-extrabold text-gray-900">' + fmt.numero(atual.itens) + '</p></div></div>' +
            '<p class="text-xs font-bold text-gray-500 uppercase mb-1">Top 5 produtos mais vendidos</p>' +
            (listaProd ? '<div class="divide-y divide-gray-50 mb-4">' + listaProd + '</div>' : vazio('Nenhuma venda neste período.')) +
            '<p class="text-xs font-bold text-gray-500 uppercase mb-2">Vendas por vendedor</p>' +
            (listaVend || vazio('Sem vendas por vendedor neste período.'));
    }

    function desenharEstoque() {
        var ativos = Nexo.db.listar('produtos').filter(function (p) { return p.status === 'Ativo'; });
        var valorCusto = 0, valorVenda = 0;
        ativos.forEach(function (p) {
            var q = Number(p.estoque) || 0;
            valorCusto += q * (Number(p.custo) || 0);
            valorVenda += q * (Number(p.preco) || 0);
        });
        var baixos = Nexo.consultas.produtosEstoqueBaixo().sort(function (a, b) { return (a.estoque || 0) - (b.estoque || 0); });
        var semEstoque = baixos.filter(function (p) { return (Number(p.estoque) || 0) <= 0; }).length;

        function caixa(rotulo, valor, cor) {
            return '<div class="rounded-xl bg-gray-50 border border-gray-100 p-3"><p class="text-[11px] font-bold text-gray-500 uppercase">' + rotulo + '</p>' +
                '<p class="text-xl font-extrabold ' + cor + '">' + valor + '</p></div>';
        }
        document.getElementById('resumoEstoque').innerHTML =
            caixa('Valor em estoque (custo)', fmt.moeda(valorCusto), 'text-gray-900') +
            caixa('Estoque baixo', fmt.numero(baixos.length - semEstoque) + ' produtos', 'text-amber-600') +
            caixa('Sem estoque', fmt.numero(semEstoque) + ' produtos', 'text-red-600');
        document.getElementById('resumoEstoque').title = 'Valor a preço de venda: ' + fmt.moeda(valorVenda);

        var categorias = Nexo.consultas.mapa('categorias');
        var corpo = baixos.slice(0, 8).map(function (p) {
            var q = Number(p.estoque) || 0;
            var zerado = q <= 0;
            return '<tr class="hover:bg-gray-50 transition">' +
                '<td class="px-6 py-3"><a href="estoque.html?produto=' + encodeURIComponent(p.id) + '" class="text-brand-purple font-semibold hover:underline">' + esc(p.nome) + '</a></td>' +
                '<td class="px-6 py-3">' + esc((categorias[p.categoriaId] || {}).nome || '-') + '</td>' +
                '<td class="px-6 py-3 text-center font-bold ' + (zerado ? 'text-red-600' : 'text-orange-500') + '">' + q + '</td>' +
                '<td class="px-6 py-3 text-center text-gray-500">' + (Number(p.estoqueMinimo) || 0) + '</td>' +
                '<td class="px-6 py-3 text-center">' + Nexo.ui.badgeStatus(zerado ? 'Sem estoque' : 'Estoque baixo') + '</td></tr>';
        }).join('');
        document.getElementById('tabelaEstoque').innerHTML = baixos.length ?
            '<table class="w-full text-left text-sm whitespace-nowrap"><thead class="text-gray-500 border-b border-gray-100"><tr>' +
            '<th class="px-6 py-3 font-bold">Produto</th><th class="px-6 py-3 font-bold">Categoria</th>' +
            '<th class="px-6 py-3 font-bold text-center">Qtd Atual</th><th class="px-6 py-3 font-bold text-center">Qtd Mínima</th>' +
            '<th class="px-6 py-3 font-bold text-center">Status</th></tr></thead>' +
            '<tbody class="divide-y divide-gray-100 text-gray-700 font-medium">' + corpo + '</tbody></table>' +
            (baixos.length > 8 ? '<p class="px-6 py-3 text-xs text-gray-400">Mostrando 8 de ' + baixos.length + ' produtos. <a href="estoque.html" class="text-brand-purple font-semibold hover:underline">Ver todos</a></p>' : '') :
            vazio('Nenhum produto com estoque baixo. Tudo certo por aqui.');
    }

    function desenharAtividades() {
        var todas = Nexo.db.listar('atividades');
        var visiveis = todas.slice(0, estado.atividadesVisiveis);
        document.getElementById('listaAtividades').innerHTML = visiveis.length ? visiveis.map(function (a) {
            var ic = ICONES_ATIVIDADE[a.tipo] || ['fa-circle-info', 'bg-gray-100 text-gray-500'];
            var texto = a.link ?
                '<a href="' + esc(a.link) + '" class="text-sm font-semibold text-gray-900 hover:text-brand-purple hover:underline">' + esc(a.texto) + '</a>' :
                '<p class="text-sm font-semibold text-gray-900">' + esc(a.texto) + '</p>';
            return '<div class="flex gap-4"><div class="w-8 h-8 rounded-full ' + ic[1] + ' flex items-center justify-center shrink-0 mt-1"><i class="fa-solid ' + ic[0] + ' text-xs"></i></div>' +
                '<div class="min-w-0">' + texto +
                '<p class="text-xs text-gray-500">' + esc(a.usuario || 'Sistema') + '</p>' +
                '<p class="text-xs text-gray-400 mt-0.5">' + fmt.relativo(a.data) + '</p></div></div>';
        }).join('') : vazio('Nenhuma atividade registrada ainda.');
        var btn = document.getElementById('btnMaisAtividades');
        btn.classList.toggle('hidden', todas.length <= estado.atividadesVisiveis);
    }

    function desenharNotificacoes() {
        var lista = Nexo.layout.notificacoes();
        var naoLidas = lista.filter(function (n) { return !n.lida; }).length;
        document.getElementById('contaNotificacoes').textContent = naoLidas + ' não lidas de ' + lista.length;
        document.getElementById('listaNotificacoes').innerHTML = lista.length ? lista.slice(0, 8).map(function (n) {
            return '<a href="' + esc(n.link) + '" class="flex items-start gap-3 px-2 py-2.5 rounded-lg hover:bg-gray-50 transition ' + (n.lida ? 'opacity-60' : '') + '">' +
                '<i class="fa-solid ' + esc(n.icone) + ' ' + esc(n.cor) + ' mt-0.5"></i>' +
                '<span class="text-sm text-gray-700 leading-snug">' + esc(n.texto) + '</span></a>';
        }).join('') + (lista.length > 8 ? '<p class="text-xs text-gray-400 px-2 pt-2">Mais ' + (lista.length - 8) + ' notificações no sino do menu.</p>' : '') :
            vazio('Nenhuma notificação no momento.');
    }

    /* ------------------------------------------------------------------ */
    /* Atualização geral conforme o período                                */
    /* ------------------------------------------------------------------ */
    function atualizar() {
        var per = calcularPeriodo(estado.periodo);
        var validos = Nexo.consultas.pedidosNoPeriodo(per.ini, per.fim);
        var comCancelados = Nexo.consultas.pedidosNoPeriodo(per.ini, per.fim, true);
        var validosAnt = Nexo.consultas.pedidosNoPeriodo(per.iniAnt, per.fimAnt);
        var atual = resumir(validos);
        var anterior = resumir(validosAnt);
        var clientes = Nexo.consultas.mapa('clientes');
        var pendentes = Nexo.db.listar('pedidos').filter(function (p) { return p.status === 'Novo' || p.status === 'Em separação'; }).length;

        desenharKpis(atual, anterior, per, pendentes);
        desenharResumoFaturamento(atual, anterior);
        desenharGrafico(validos, per);
        desenharPedidos(comCancelados, validos, clientes);
        desenharClientes(validos, per, clientes);
        desenharVendas(validos, atual);
    }

    function marcarBotao(chave) {
        document.querySelectorAll('#filtroPeriodo button').forEach(function (b) {
            var ativo = b.getAttribute('data-periodo') === chave;
            b.className = ativo ? 'px-4 py-1.5 text-sm font-semibold rounded-md bg-brand-purple text-white shadow' :
                'px-4 py-1.5 text-sm font-semibold rounded-md text-gray-600 hover:bg-gray-50 transition';
        });
    }

    function saudacao(usuario) {
        var h = new Date().getHours();
        var turno = h < 12 ? 'Bom dia' : (h < 18 ? 'Boa tarde' : 'Boa noite');
        document.getElementById('saudacao').textContent = turno + ', ' + String(usuario.nome).split(' ')[0] + '!';
        var data = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        document.getElementById('dataHoje').textContent = data.charAt(0).toUpperCase() + data.slice(1) + '. Visão geral do sistema e indicadores principais.';
    }

    function iniciar(usuario) {
        saudacao(usuario);
        document.getElementById('filtroPeriodo').addEventListener('click', function (e) {
            var b = e.target.closest('button[data-periodo]');
            if (!b) return;
            estado.periodo = b.getAttribute('data-periodo');
            marcarBotao(estado.periodo);
            atualizar();
        });
        document.getElementById('btnMaisAtividades').addEventListener('click', function () {
            estado.atividadesVisiveis += 6;
            desenharAtividades();
        });
        marcarBotao(estado.periodo);
        atualizar();
        desenharAtividades();
        desenharNotificacoes();
        desenharEstoque();
    }

    var usuario = Nexo.layout.montar('inicio');
    if (usuario) iniciar(usuario);
})();
