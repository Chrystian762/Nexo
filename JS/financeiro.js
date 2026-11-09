/*
 * NEXO ERP - Tela Financeiro
 * --------------------------------------------------------------
 * Dashboard, contas a receber/pagar, todos os lançamentos e fluxo de caixa.
 * Dados: coleção 'lancamentos' (veja Nexo.ops.baixarLancamento/estornarLancamento).
 *
 * Regra de período usada em toda a tela (data de referência do lançamento):
 *   - lançamento pago      -> data de pagamento
 *   - lançamento em aberto -> vencimento
 */
(function () {
    'use strict';

    var esc = Nexo.esc;
    var fmt = Nexo.fmt;
    var C = Nexo.consultas;

    if (!Nexo.layout.montar('financeiro')) return;

    /* ------------------------------------------------------------------ */
    /* Estado e constantes                                                 */
    /* ------------------------------------------------------------------ */
    var estado = {
        periodo: 'mes',
        ini: '',
        fim: '',
        aba: 'receber',     // receber | pagar | todos | fluxo
        status: '',
        categoria: '',
        busca: '',
        pagina: 1,
        agrupar: 'dia'
    };
    var graficos = { meses: null, categorias: null, fluxo: null };
    var listaAtual = [];    // lista filtrada (usada na exportação)

    var CATEGORIAS_PADRAO = {
        Receita: ['Vendas', 'Serviços', 'Outras receitas'],
        Despesa: ['Compra de mercadorias', 'Aluguel', 'Salários', 'Contas de consumo', 'Impostos', 'Marketing', 'Tecnologia', 'Outras despesas']
    };
    var FORMAS = Nexo.consultas.FORMAS_PAGAMENTO.concat(['Transferência']);
    var CORES_ROSCA = ['#7c3aed', '#a78bfa', '#2563eb', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#64748b', '#14b8a6'];

    /* ------------------------------------------------------------------ */
    /* Utilitários de data (strings YYYY-MM-DD)                            */
    /* ------------------------------------------------------------------ */
    function pad(n) { return String(n).padStart(2, '0'); }
    function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
    function paraData(s) { return new Date(s + 'T12:00:00'); }
    function somarDias(s, n) { var d = paraData(s); d.setDate(d.getDate() + n); return iso(d); }
    function somarMeses(s, n) {
        var d = paraData(s);
        var dia = d.getDate();
        d.setDate(1);
        d.setMonth(d.getMonth() + n);
        var ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        d.setDate(Math.min(dia, ultimo));
        return iso(d);
    }
    function inicioSemana(s) {
        var d = paraData(s);
        d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // segunda-feira
        return iso(d);
    }
    function curto(s) { return pad(paraData(s).getDate()) + '/' + pad(paraData(s).getMonth() + 1); }

    /* Calcula as datas do período escolhido (exceto o personalizado) */
    function calcularPeriodo() {
        var h = new Date(), a = h.getFullYear(), m = h.getMonth(), hoje = fmt.hojeInput();
        switch (estado.periodo) {
            case 'mes': return [iso(new Date(a, m, 1)), iso(new Date(a, m + 1, 0))];
            case 'mesPassado': return [iso(new Date(a, m - 1, 1)), iso(new Date(a, m, 0))];
            case '30': return [C.diasAtras(29), hoje];
            case '90': return [C.diasAtras(89), hoje];
            case 'ano': return [a + '-01-01', a + '-12-31'];
            default: return [estado.ini, estado.fim];
        }
    }

    /* ------------------------------------------------------------------ */
    /* Dados                                                               */
    /* ------------------------------------------------------------------ */
    /* Lançamentos com status calculado e data de referência */
    function carregarLancamentos() {
        return Nexo.db.listar('lancamentos').map(function (l) {
            var st = C.statusLancamento(l);
            return { l: l, st: st, ref: l.dataPagamento ? fmt.dataInput(l.dataPagamento) : fmt.dataInput(l.vencimento) };
        });
    }
    function noPeriodo(x) { return x.ref >= estado.ini && x.ref <= estado.fim; }
    function ehManual(l) { return !l.pedidoId && !l.compraId; }
    function valor(l) { return Number(l.valor) || 0; }
    function somar(lista) { return lista.reduce(function (s, x) { return s + valor(x.l); }, 0); }
    function classeSaldo(v) { return v < 0 ? 'text-red-600' : 'text-emerald-600'; }

    /* ------------------------------------------------------------------ */
    /* Período                                                             */
    /* ------------------------------------------------------------------ */
    function aplicarPeriodo() {
        var r = calcularPeriodo();
        estado.ini = r[0];
        estado.fim = r[1];
        document.getElementById('f-ini').value = estado.ini;
        document.getElementById('f-fim').value = estado.fim;
        var custom = estado.periodo === 'personalizado';
        document.getElementById('bloco-datas').classList.toggle('hidden', !custom);
        document.getElementById('bloco-datas').classList.toggle('grid', custom);
        document.getElementById('txt-periodo').textContent = 'Exibindo de ' + fmt.data(estado.ini) + ' até ' + fmt.data(estado.fim);
    }

    function aoMudarPeriodo() {
        estado.periodo = document.getElementById('f-periodo').value;
        aplicarPeriodo();
        estado.pagina = 1;
        renderizarTudo();
    }

    function aoMudarDatas() {
        var ini = document.getElementById('f-ini').value;
        var fim = document.getElementById('f-fim').value;
        if (!ini || !fim) return;
        if (ini > fim) { Nexo.ui.toast('A data inicial não pode ser maior que a final.', 'aviso'); return; }
        estado.ini = ini;
        estado.fim = fim;
        document.getElementById('txt-periodo').textContent = 'Exibindo de ' + fmt.data(ini) + ' até ' + fmt.data(fim);
        estado.pagina = 1;
        renderizarTudo();
    }

    /* ------------------------------------------------------------------ */
    /* Dashboard                                                           */
    /* ------------------------------------------------------------------ */
    function renderizarKpis(lancs) {
        var recebido = 0, pago = 0, aReceber = 0, aPagar = 0, inad = 0, inadQtd = 0, totalReceitas = 0;
        lancs.forEach(function (x) {
            if (x.st === 'Cancelado' || !noPeriodo(x)) return;
            var v = valor(x.l), rec = x.l.tipo === 'Receita';
            if (rec) totalReceitas += v;
            if (x.st === 'Pago') {
                if (rec) recebido += v; else pago += v;
            } else if (rec) {
                aReceber += v;
                if (x.st === 'Atrasado') { inad += v; inadQtd++; }
            } else {
                aPagar += v;
            }
        });
        var saldo = recebido - pago;
        var pctInad = totalReceitas > 0 ? (inad / totalReceitas) * 100 : 0;

        function card(rotulo, valorTxt, icone, corIcone, corValor, legenda) {
            return '<div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">' +
                '<div class="flex items-center justify-between mb-2"><span class="text-xs font-semibold text-gray-500">' + rotulo + '</span>' +
                '<span class="w-8 h-8 rounded-lg flex items-center justify-center ' + corIcone + '"><i class="fa-solid ' + icone + ' text-sm"></i></span></div>' +
                '<p class="text-base 2xl:text-xl font-extrabold whitespace-nowrap ' + corValor + '">' + valorTxt + '</p>' +
                '<p class="text-xs text-gray-400 mt-1">' + legenda + '</p></div>';
        }
        document.getElementById('kpis').innerHTML =
            card('Receitas recebidas', fmt.moeda(recebido), 'fa-arrow-trend-up', 'bg-emerald-50 text-emerald-600', 'text-gray-900', 'Recebido no período') +
            card('Despesas pagas', fmt.moeda(pago), 'fa-arrow-trend-down', 'bg-red-50 text-red-500', 'text-gray-900', 'Pago no período') +
            card('Saldo / resultado', fmt.moeda(saldo), 'fa-scale-balanced', saldo < 0 ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600', classeSaldo(saldo), 'Recebido menos pago') +
            card('A receber em aberto', fmt.moeda(aReceber), 'fa-hand-holding-dollar', 'bg-blue-50 text-blue-600', 'text-gray-900', 'Pendentes e atrasadas') +
            card('A pagar em aberto', fmt.moeda(aPagar), 'fa-file-invoice-dollar', 'bg-amber-50 text-amber-600', 'text-gray-900', 'Pendentes e atrasadas') +
            card('Inadimplência', fmt.moeda(inad), 'fa-triangle-exclamation', inad > 0 ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-500', inad > 0 ? 'text-red-600' : 'text-gray-900',
                inadQtd + (inadQtd === 1 ? ' receita atrasada' : ' receitas atrasadas') + ' (' + fmt.porcentagem(pctInad) + ')');
    }

    /* Gráfico de barras: últimos 6 meses (realizado pela data de pagamento) */
    function renderizarGraficoMeses(lancs) {
        var h = new Date(), meses = [];
        for (var i = 5; i >= 0; i--) {
            var d = new Date(h.getFullYear(), h.getMonth() - i, 1);
            meses.push({ chave: d.getFullYear() + '-' + pad(d.getMonth() + 1), rotulo: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', ''), rec: 0, des: 0 });
        }
        lancs.forEach(function (x) {
            if (x.st !== 'Pago') return;
            var chave = fmt.dataInput(x.l.dataPagamento).slice(0, 7);
            meses.forEach(function (m) {
                if (m.chave !== chave) return;
                if (x.l.tipo === 'Receita') m.rec += valor(x.l); else m.des += valor(x.l);
            });
        });
        if (graficos.meses) graficos.meses.destroy();
        if (typeof Chart === 'undefined') return;
        graficos.meses = new Chart(document.getElementById('grafico-meses'), {
            type: 'bar',
            data: {
                labels: meses.map(function (m) { return m.rotulo; }),
                datasets: [
                    { label: 'Receitas', data: meses.map(function (m) { return m.rec; }), backgroundColor: '#10b981', borderRadius: 4 },
                    { label: 'Despesas', data: meses.map(function (m) { return m.des; }), backgroundColor: '#ef4444', borderRadius: 4 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { tooltip: { callbacks: { label: function (c) { return c.dataset.label + ': ' + fmt.moeda(c.parsed.y); } } } },
                scales: { y: { beginAtZero: true, ticks: { callback: function (v) { return fmt.moeda(v); } } } }
            }
        });
    }

    /* Rosca: despesas do período por categoria */
    function renderizarGraficoCategorias(lancs) {
        var porCat = {};
        lancs.forEach(function (x) {
            if (x.l.tipo !== 'Despesa' || x.st === 'Cancelado' || !noPeriodo(x)) return;
            var c = x.l.categoria || 'Sem categoria';
            porCat[c] = (porCat[c] || 0) + valor(x.l);
        });
        var nomes = Object.keys(porCat).sort(function (a, b) { return porCat[b] - porCat[a]; });
        if (graficos.categorias) graficos.categorias.destroy();
        graficos.categorias = null;
        var canvas = document.getElementById('grafico-categorias');
        document.getElementById('vazio-categorias').classList.toggle('hidden', nomes.length > 0);
        canvas.parentElement.classList.toggle('hidden', nomes.length === 0);
        if (!nomes.length || typeof Chart === 'undefined') return;
        graficos.categorias = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: nomes,
                datasets: [{ data: nomes.map(function (n) { return porCat[n]; }), backgroundColor: nomes.map(function (n, i) { return CORES_ROSCA[i % CORES_ROSCA.length]; }), borderWidth: 2, borderColor: '#fff' }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '60%',
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } },
                    tooltip: { callbacks: { label: function (c) { return c.label + ': ' + fmt.moeda(c.parsed); } } }
                }
            }
        });
    }

    /* ------------------------------------------------------------------ */
    /* Listas (receber, pagar, todos)                                      */
    /* ------------------------------------------------------------------ */
    function tipoDaAba() {
        return estado.aba === 'receber' ? 'Receita' : (estado.aba === 'pagar' ? 'Despesa' : '');
    }

    /* Atualiza as opções do filtro de categoria conforme a aba */
    function montarFiltroCategoria(lancs) {
        var tipo = tipoDaAba(), vistos = {};
        lancs.forEach(function (x) { if ((!tipo || x.l.tipo === tipo) && x.l.categoria) vistos[x.l.categoria] = true; });
        var nomes = Object.keys(vistos).sort();
        if (estado.categoria && !vistos[estado.categoria]) estado.categoria = '';
        var sel = document.getElementById('f-categoria');
        sel.innerHTML = '<option value="">Todas</option>' + nomes.map(function (n) {
            return '<option value="' + esc(n) + '"' + (n === estado.categoria ? ' selected' : '') + '>' + esc(n) + '</option>';
        }).join('');
    }

    function filtrarLista(lancs) {
        var tipo = tipoDaAba(), termo = estado.busca.trim().toLowerCase();
        return lancs.filter(function (x) {
            if (tipo && x.l.tipo !== tipo) return false;
            if (!noPeriodo(x)) return false;
            if (estado.status && x.st !== estado.status) return false;
            if (estado.categoria && x.l.categoria !== estado.categoria) return false;
            if (termo && String(x.l.descricao || '').toLowerCase().indexOf(termo) === -1) return false;
            return true;
        }).sort(function (a, b) {
            return a.l.vencimento < b.l.vencimento ? 1 : (a.l.vencimento > b.l.vencimento ? -1 : 0);
        });
    }

    function textoVinculo(l, mapaPedidos, mapaCompras) {
        if (l.pedidoId) {
            var p = mapaPedidos[l.pedidoId];
            return '<a href="pedidos.html?id=' + encodeURIComponent(l.pedidoId) + '" class="text-brand-purple font-semibold hover:underline">Pedido' + (p ? ' #' + esc(p.numero) : '') + '</a>';
        }
        if (l.compraId) {
            var c = mapaCompras[l.compraId];
            return '<span class="text-gray-700">Compra' + (c ? ' #' + esc(c.numero) : '') + '</span>';
        }
        return '<span class="text-gray-400">Manual</span>';
    }

    function botaoAcao(acao, id, icone, titulo, cor) {
        return '<button type="button" data-acao="' + acao + '" data-id="' + esc(id) + '" title="' + titulo + '" aria-label="' + titulo + '" ' +
            'class="w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-100 transition ' + cor + '"><i class="fa-solid ' + icone + '"></i></button>';
    }

    function renderizarLista(lancs) {
        montarFiltroCategoria(lancs);
        listaAtual = filtrarLista(lancs);
        var info = Nexo.ui.paginar(listaAtual, estado.pagina);
        estado.pagina = info.pagina;
        var mapaPedidos = C.mapa('pedidos'), mapaCompras = C.mapa('compras');
        var mostrarTipo = estado.aba === 'todos';

        // resumo do topo da lista
        var validos = listaAtual.filter(function (x) { return x.st !== 'Cancelado'; });
        var totRec = somar(validos.filter(function (x) { return x.l.tipo === 'Receita'; }));
        var totDes = somar(validos.filter(function (x) { return x.l.tipo === 'Despesa'; }));
        var resumo;
        if (estado.aba === 'receber') resumo = 'Total das receitas listadas: <b>' + fmt.moeda(totRec) + '</b>';
        else if (estado.aba === 'pagar') resumo = 'Total das despesas listadas: <b>' + fmt.moeda(totDes) + '</b>';
        else resumo = 'Receitas <b class="text-emerald-600">' + fmt.moeda(totRec) + '</b> &middot; Despesas <b class="text-red-600">' + fmt.moeda(totDes) + '</b> &middot; Resultado <b class="' + classeSaldo(totRec - totDes) + '">' + fmt.moeda(totRec - totDes) + '</b>';
        document.getElementById('resumo-lista').innerHTML = resumo + ' <span class="text-gray-400">(' + listaAtual.length + ' lançamentos, cancelados fora do total)</span>';

        var alvo = document.getElementById('lista');
        if (!info.itens.length) {
            alvo.innerHTML = '<div class="py-14 text-center px-4"><div class="w-14 h-14 mx-auto mb-3 rounded-full bg-gray-50 text-gray-400 flex items-center justify-center text-xl"><i class="fa-solid fa-receipt"></i></div>' +
                '<p class="font-semibold text-gray-800">Nenhum lançamento encontrado</p>' +
                '<p class="text-sm text-gray-500 mt-1">Ajuste o período ou os filtros, ou cadastre um novo lançamento.</p></div>';
            document.getElementById('paginacao').innerHTML = '';
            return;
        }

        var linhas = info.itens.map(function (x) {
            var l = x.l, rec = l.tipo === 'Receita', acoes = '';
            if (x.st === 'Pendente' || x.st === 'Atrasado') acoes += botaoAcao('baixar', l.id, 'fa-circle-check', rec ? 'Dar baixa (receber)' : 'Dar baixa (pagar)', 'hover:text-emerald-600');
            if (x.st === 'Pago') acoes += botaoAcao('estornar', l.id, 'fa-rotate-left', 'Estornar baixa', 'hover:text-amber-600');
            if (ehManual(l)) {
                acoes += botaoAcao('editar', l.id, 'fa-pen', 'Editar lançamento', 'hover:text-brand-purple');
                acoes += botaoAcao('excluir', l.id, 'fa-trash', 'Excluir lançamento', 'hover:text-red-600');
            }
            return '<tr class="hover:bg-gray-50/60">' +
                '<td class="px-4 py-3"><p class="font-semibold text-gray-900">' + esc(l.descricao) + '</p>' +
                (mostrarTipo ? '<div class="mt-1">' + Nexo.ui.badgeStatus(l.tipo) + '</div>' : '') + '</td>' +
                '<td class="px-4 py-3 text-gray-600">' + esc(l.categoria || '-') + '</td>' +
                '<td class="px-4 py-3 text-gray-600 whitespace-nowrap">' + fmt.data(l.vencimento) + '</td>' +
                '<td class="px-4 py-3 font-bold whitespace-nowrap ' + (rec ? 'text-emerald-600' : 'text-red-600') + '">' + (rec ? '+ ' : '- ') + fmt.moeda(l.valor) + '</td>' +
                '<td class="px-4 py-3 text-gray-600 whitespace-nowrap">' + esc(l.formaPagamento || '-') + '</td>' +
                '<td class="px-4 py-3 text-gray-600 whitespace-nowrap">' + fmt.data(l.dataPagamento) + '</td>' +
                '<td class="px-4 py-3">' + Nexo.ui.badgeStatus(x.st) + '</td>' +
                '<td class="px-4 py-3 whitespace-nowrap">' + textoVinculo(l, mapaPedidos, mapaCompras) + '</td>' +
                '<td class="px-4 py-3 whitespace-nowrap text-right">' + acoes + '</td></tr>';
        }).join('');

        alvo.innerHTML = '<div class="overflow-x-auto"><table class="w-full text-sm text-left min-w-[1000px]">' +
            '<thead class="bg-gray-50 text-xs uppercase text-gray-500"><tr>' +
            '<th class="px-4 py-3 font-semibold">Descrição</th><th class="px-4 py-3 font-semibold">Categoria</th>' +
            '<th class="px-4 py-3 font-semibold">Vencimento</th><th class="px-4 py-3 font-semibold">Valor</th>' +
            '<th class="px-4 py-3 font-semibold">Forma</th><th class="px-4 py-3 font-semibold">Pagamento</th>' +
            '<th class="px-4 py-3 font-semibold">Status</th><th class="px-4 py-3 font-semibold">Vínculo</th>' +
            '<th class="px-4 py-3 font-semibold text-right">Ações</th></tr></thead>' +
            '<tbody class="divide-y divide-gray-100">' + linhas + '</tbody></table></div>';
        document.getElementById('paginacao').innerHTML = Nexo.ui.htmlPaginacao(info, 'financeiroPagina');
    }

    /* Chamada pelos botões de paginação */
    window.financeiroPagina = function (n) {
        estado.pagina = n;
        renderizarLista(carregarLancamentos());
    };

    /* ------------------------------------------------------------------ */
    /* Fluxo de caixa                                                      */
    /* ------------------------------------------------------------------ */
    function intervaloBalde(inicio) {
        // devolve [inicio, fim] do balde conforme o agrupamento, limitado ao período
        var fim = estado.agrupar === 'semana' ? somarDias(inicio, 6) : inicio;
        return [inicio < estado.ini ? estado.ini : inicio, fim > estado.fim ? estado.fim : fim];
    }

    function calcularFluxo(lancs) {
        var pagos = lancs.filter(function (x) { return x.st === 'Pago'; });
        var saldoInicial = 0;
        pagos.forEach(function (x) {
            if (x.ref < estado.ini) saldoInicial += x.l.tipo === 'Receita' ? valor(x.l) : -valor(x.l);
        });
        // monta os baldes (dia ou semana) cobrindo todo o período
        var baldes = [], mapa = {};
        var cursor = estado.agrupar === 'semana' ? inicioSemana(estado.ini) : estado.ini;
        var passo = estado.agrupar === 'semana' ? 7 : 1;
        var guarda = 0;
        while (cursor <= estado.fim && guarda++ < 800) {
            var iv = intervaloBalde(cursor);
            var b = { chave: cursor, ini: iv[0], fim: iv[1], entradas: 0, saidas: 0 };
            baldes.push(b);
            mapa[cursor] = b;
            cursor = somarDias(cursor, passo);
        }
        pagos.forEach(function (x) {
            if (x.ref < estado.ini || x.ref > estado.fim) return;
            var b = mapa[estado.agrupar === 'semana' ? inicioSemana(x.ref) : x.ref];
            if (!b) return;
            if (x.l.tipo === 'Receita') b.entradas += valor(x.l); else b.saidas += valor(x.l);
        });
        var acum = saldoInicial;
        baldes.forEach(function (b) {
            b.saldo = b.entradas - b.saidas;
            acum += b.saldo;
            b.acumulado = acum;
            b.rotulo = b.ini === b.fim ? fmt.data(b.ini) : fmt.data(b.ini) + ' a ' + fmt.data(b.fim);
        });
        return { saldoInicial: saldoInicial, baldes: baldes };
    }

    function renderizarFluxo(lancs) {
        var f = calcularFluxo(lancs);
        var comMov = f.baldes.filter(function (b) { return b.entradas || b.saidas; });
        var totE = 0, totS = 0;
        f.baldes.forEach(function (b) { totE += b.entradas; totS += b.saidas; });
        var final = f.baldes.length ? f.baldes[f.baldes.length - 1].acumulado : f.saldoInicial;

        var linhas = '<tr class="bg-gray-50/70"><td class="px-4 py-3 font-semibold text-gray-700">Saldo anterior ao período</td><td></td><td></td><td></td>' +
            '<td class="px-4 py-3 text-right font-bold ' + classeSaldo(f.saldoInicial) + '">' + fmt.moeda(f.saldoInicial) + '</td></tr>';
        if (!comMov.length) {
            linhas += '<tr><td colspan="5" class="px-4 py-8 text-center text-gray-500">Nenhuma movimentação realizada neste período.</td></tr>';
        } else {
            linhas += comMov.map(function (b) {
                return '<tr class="hover:bg-gray-50/60"><td class="px-4 py-3 text-gray-800 whitespace-nowrap">' + b.rotulo + '</td>' +
                    '<td class="px-4 py-3 text-right text-emerald-600 font-semibold whitespace-nowrap">' + fmt.moeda(b.entradas) + '</td>' +
                    '<td class="px-4 py-3 text-right text-red-600 font-semibold whitespace-nowrap">' + fmt.moeda(b.saidas) + '</td>' +
                    '<td class="px-4 py-3 text-right font-semibold whitespace-nowrap ' + classeSaldo(b.saldo) + '">' + fmt.moeda(b.saldo) + '</td>' +
                    '<td class="px-4 py-3 text-right font-bold whitespace-nowrap ' + classeSaldo(b.acumulado) + '">' + fmt.moeda(b.acumulado) + '</td></tr>';
            }).join('');
        }
        linhas += '<tr class="bg-gray-50 font-bold"><td class="px-4 py-3">Total do período</td>' +
            '<td class="px-4 py-3 text-right text-emerald-600">' + fmt.moeda(totE) + '</td>' +
            '<td class="px-4 py-3 text-right text-red-600">' + fmt.moeda(totS) + '</td>' +
            '<td class="px-4 py-3 text-right ' + classeSaldo(totE - totS) + '">' + fmt.moeda(totE - totS) + '</td>' +
            '<td class="px-4 py-3 text-right ' + classeSaldo(final) + '">' + fmt.moeda(final) + '</td></tr>';

        document.getElementById('tabela-fluxo').innerHTML = '<div class="overflow-x-auto"><table class="w-full text-sm min-w-[640px]">' +
            '<thead class="bg-gray-50 text-xs uppercase text-gray-500"><tr><th class="px-4 py-3 text-left font-semibold">' + (estado.agrupar === 'semana' ? 'Semana' : 'Dia') + '</th>' +
            '<th class="px-4 py-3 text-right font-semibold">Entradas</th><th class="px-4 py-3 text-right font-semibold">Saídas</th>' +
            '<th class="px-4 py-3 text-right font-semibold">Saldo do período</th><th class="px-4 py-3 text-right font-semibold">Saldo acumulado</th></tr></thead>' +
            '<tbody class="divide-y divide-gray-100">' + linhas + '</tbody></table></div>';

        // gráfico de linha do saldo acumulado
        if (graficos.fluxo) graficos.fluxo.destroy();
        graficos.fluxo = null;
        if (typeof Chart !== 'undefined') {
            graficos.fluxo = new Chart(document.getElementById('grafico-fluxo'), {
                type: 'line',
                data: {
                    labels: f.baldes.map(function (b) { return b.ini === b.fim ? curto(b.ini) : curto(b.ini) + '-' + curto(b.fim); }),
                    datasets: [{
                        label: 'Saldo acumulado', data: f.baldes.map(function (b) { return b.acumulado; }),
                        borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,.12)', fill: true, tension: 0.25, pointRadius: f.baldes.length > 45 ? 0 : 3
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return 'Saldo: ' + fmt.moeda(c.parsed.y); } } } },
                    scales: { y: { ticks: { callback: function (v) { return fmt.moeda(v); } } }, x: { ticks: { maxTicksLimit: 12 } } }
                }
            });
        }
        renderizarProjecao(lancs);
    }

    /* Projeção dos pendentes pelo vencimento, de hoje até hoje + 30 dias */
    function renderizarProjecao(lancs) {
        var hoje = fmt.hojeInput(), limite = somarDias(hoje, 30), saldoAtual = 0;
        var faixas = [{ rotulo: 'Vencidos (em atraso)', rec: 0, des: 0, teste: function (v) { return v < hoje; } }];
        for (var i = 0; i < 5; i++) {
            (function (n) {
                var a = somarDias(hoje, n * 7), b = Math.min(n * 7 + 6, 30);
                var fimFaixa = somarDias(hoje, b);
                faixas.push({ rotulo: fmt.data(a) + ' a ' + fmt.data(fimFaixa), rec: 0, des: 0, teste: function (v) { return v >= a && v <= fimFaixa; } });
            })(i);
        }
        lancs.forEach(function (x) {
            var rec = x.l.tipo === 'Receita';
            if (x.st === 'Pago') { saldoAtual += rec ? valor(x.l) : -valor(x.l); return; }
            if (x.st === 'Cancelado') return;
            var venc = fmt.dataInput(x.l.vencimento);
            if (venc > limite) return;
            for (var k = 0; k < faixas.length; k++) {
                if (faixas[k].teste(venc)) { if (rec) faixas[k].rec += valor(x.l); else faixas[k].des += valor(x.l); break; }
            }
        });
        var acum = saldoAtual;
        var linhas = '<tr class="bg-gray-50/70"><td class="px-4 py-3 font-semibold text-gray-700">Saldo realizado até hoje</td><td></td><td></td><td></td>' +
            '<td class="px-4 py-3 text-right font-bold ' + classeSaldo(saldoAtual) + '">' + fmt.moeda(saldoAtual) + '</td></tr>';
        linhas += faixas.map(function (f) {
            var saldo = f.rec - f.des;
            acum += saldo;
            return '<tr class="hover:bg-gray-50/60"><td class="px-4 py-3 text-gray-800 whitespace-nowrap">' + f.rotulo + '</td>' +
                '<td class="px-4 py-3 text-right text-emerald-600 font-semibold whitespace-nowrap">' + fmt.moeda(f.rec) + '</td>' +
                '<td class="px-4 py-3 text-right text-red-600 font-semibold whitespace-nowrap">' + fmt.moeda(f.des) + '</td>' +
                '<td class="px-4 py-3 text-right font-semibold whitespace-nowrap ' + classeSaldo(saldo) + '">' + fmt.moeda(saldo) + '</td>' +
                '<td class="px-4 py-3 text-right font-bold whitespace-nowrap ' + classeSaldo(acum) + '">' + fmt.moeda(acum) + '</td></tr>';
        }).join('');
        document.getElementById('tabela-projecao').innerHTML = '<div class="overflow-x-auto"><table class="w-full text-sm min-w-[640px]">' +
            '<thead class="bg-gray-50 text-xs uppercase text-gray-500"><tr><th class="px-4 py-3 text-left font-semibold">Faixa de vencimento</th>' +
            '<th class="px-4 py-3 text-right font-semibold">A receber</th><th class="px-4 py-3 text-right font-semibold">A pagar</th>' +
            '<th class="px-4 py-3 text-right font-semibold">Saldo da faixa</th><th class="px-4 py-3 text-right font-semibold">Saldo projetado</th></tr></thead>' +
            '<tbody class="divide-y divide-gray-100">' + linhas + '</tbody></table></div>';
    }

    /* ------------------------------------------------------------------ */
    /* Abas e renderização geral                                           */
    /* ------------------------------------------------------------------ */
    function marcarAbas() {
        document.querySelectorAll('.aba').forEach(function (b) {
            var ativa = b.getAttribute('data-aba') === estado.aba;
            b.setAttribute('aria-selected', ativa ? 'true' : 'false');
            b.className = 'aba px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 ' +
                (ativa ? 'border-brand-purple text-brand-purple' : 'border-transparent text-gray-500 hover:text-gray-800');
        });
        var fluxo = estado.aba === 'fluxo';
        document.getElementById('painel-lista').classList.toggle('hidden', fluxo);
        document.getElementById('painel-fluxo').classList.toggle('hidden', !fluxo);
    }

    function renderizarTudo() {
        var lancs = carregarLancamentos();
        renderizarKpis(lancs);
        renderizarGraficoMeses(lancs);
        renderizarGraficoCategorias(lancs);
        marcarAbas();
        if (estado.aba === 'fluxo') renderizarFluxo(lancs);
        else renderizarLista(lancs);
    }

    /* ------------------------------------------------------------------ */
    /* Exportação CSV                                                      */
    /* ------------------------------------------------------------------ */
    function exportar() {
        var nome = 'financeiro-' + estado.aba + '-' + estado.ini + '_a_' + estado.fim;
        if (estado.aba === 'fluxo') {
            var f = calcularFluxo(carregarLancamentos());
            var linhasF = f.baldes.filter(function (b) { return b.entradas || b.saidas; }).map(function (b) {
                return [b.rotulo, b.entradas, b.saidas, b.saldo, b.acumulado];
            });
            if (!linhasF.length) { Nexo.ui.toast('Não há movimentações para exportar neste período.', 'aviso'); return; }
            Nexo.exportarCSV(nome, [estado.agrupar === 'semana' ? 'Semana' : 'Dia', 'Entradas', 'Saídas', 'Saldo do período', 'Saldo acumulado'], linhasF);
            return;
        }
        if (!listaAtual.length) { Nexo.ui.toast('Não há lançamentos para exportar com estes filtros.', 'aviso'); return; }
        var mp = C.mapa('pedidos'), mc = C.mapa('compras');
        var linhas = listaAtual.map(function (x) {
            var l = x.l, vinculo = 'Manual';
            if (l.pedidoId) vinculo = 'Pedido' + (mp[l.pedidoId] ? ' #' + mp[l.pedidoId].numero : '');
            else if (l.compraId) vinculo = 'Compra' + (mc[l.compraId] ? ' #' + mc[l.compraId].numero : '');
            return [l.tipo, l.descricao, l.categoria || '', fmt.data(l.vencimento), valor(l), l.formaPagamento || '', l.dataPagamento ? fmt.data(l.dataPagamento) : '', x.st, vinculo];
        });
        Nexo.exportarCSV(nome, ['Tipo', 'Descrição', 'Categoria', 'Vencimento', 'Valor', 'Forma de pagamento', 'Data de pagamento', 'Status', 'Vínculo'], linhas);
        Nexo.ui.toast('Arquivo CSV gerado.', 'sucesso');
    }

    /* ------------------------------------------------------------------ */
    /* Formulário de lançamento (nova receita/despesa e edição)            */
    /* ------------------------------------------------------------------ */
    function opcoesCategoria(tipo) {
        var lista = CATEGORIAS_PADRAO[tipo].slice();
        Nexo.db.listar('lancamentos').forEach(function (l) {
            if (l.tipo === tipo && l.categoria && lista.indexOf(l.categoria) === -1) lista.push(l.categoria);
        });
        return lista.sort().map(function (c) { return '<option value="' + esc(c) + '"></option>'; }).join('');
    }

    function abrirFormulario(tipo, existente) {
        var editando = !!existente;
        var l = existente || {};
        var rec = tipo === 'Receita';
        var pago = editando ? !!l.dataPagamento : false;
        var html = '<form novalidate class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
            '<div class="sm:col-span-2"><label class="nexo-label" for="lf-descricao">Descrição *</label>' +
            '<input type="text" id="lf-descricao" name="descricao" class="nexo-input" maxlength="120" value="' + esc(l.descricao || '') + '"></div>' +
            '<div><label class="nexo-label" for="lf-categoria">Categoria * (escolha ou digite)</label>' +
            '<input type="text" id="lf-categoria" name="categoria" list="lf-categorias" class="nexo-input" maxlength="60" value="' + esc(l.categoria || '') + '">' +
            '<datalist id="lf-categorias">' + opcoesCategoria(tipo) + '</datalist></div>' +
            '<div><label class="nexo-label" for="lf-valor">Valor (R$) *</label>' +
            '<input type="text" inputmode="decimal" id="lf-valor" name="valor" class="nexo-input" placeholder="0,00" value="' + (editando ? String(valor(l)).replace('.', ',') : '') + '"></div>' +
            '<div><label class="nexo-label" for="lf-vencimento">Vencimento *</label>' +
            '<input type="date" id="lf-vencimento" name="vencimento" class="nexo-input" value="' + esc(fmt.dataInput(l.vencimento) || fmt.hojeInput()) + '"></div>' +
            '<div><label class="nexo-label" for="lf-forma">Forma de pagamento</label>' +
            '<select id="lf-forma" name="formaPagamento" class="nexo-input">' + FORMAS.map(function (f) {
                return '<option' + (f === (l.formaPagamento || (rec ? 'Pix' : 'Boleto')) ? ' selected' : '') + '>' + esc(f) + '</option>';
            }).join('') + '</select></div>' +
            '<div class="sm:col-span-2 border border-gray-100 rounded-xl p-3 bg-gray-50/60">' +
            '<label class="flex items-center gap-2 text-sm font-semibold text-gray-700"><input type="checkbox" name="pago" id="lf-pago"' + (pago ? ' checked' : '') + '> Já foi ' + (rec ? 'recebida' : 'paga') + '?</label>' +
            '<div id="lf-bloco-pgto" class="mt-3 ' + (pago ? '' : 'hidden') + '"><label class="nexo-label" for="lf-dataPagamento">Data do ' + (rec ? 'recebimento' : 'pagamento') + ' *</label>' +
            '<input type="date" id="lf-dataPagamento" name="dataPagamento" class="nexo-input sm:w-56" max="' + fmt.hojeInput() + '" value="' + esc(fmt.dataInput(l.dataPagamento) || fmt.hojeInput()) + '"></div></div>' +
            ((!editando && !rec) ?
                '<div class="sm:col-span-2 border border-gray-100 rounded-xl p-3 bg-gray-50/60">' +
                '<label class="flex items-center gap-2 text-sm font-semibold text-gray-700"><input type="checkbox" name="recorrente" id="lf-recorrente"> Despesa recorrente (repetir todo mês)</label>' +
                '<div id="lf-bloco-rec" class="mt-3 hidden"><label class="nexo-label" for="lf-meses">Repetir por quantos meses? (2 a 36) *</label>' +
                '<input type="number" id="lf-meses" name="meses" min="2" max="36" step="1" class="nexo-input sm:w-40" value="12">' +
                '<p class="text-xs text-gray-500 mt-1">Cada mês gera um lançamento com o mesmo dia de vencimento. Se marcar como paga, só o primeiro é baixado.</p></div></div>' : '') +
            '</form>';

        Nexo.ui.abrirModal({
            titulo: (editando ? 'Editar ' : 'Nova ') + (rec ? 'receita' : 'despesa'),
            largura: 'max-w-2xl',
            html: html,
            aoAbrir: function (corpo) {
                var chkPago = corpo.querySelector('#lf-pago');
                chkPago.addEventListener('change', function () { corpo.querySelector('#lf-bloco-pgto').classList.toggle('hidden', !chkPago.checked); });
                var chkRec = corpo.querySelector('#lf-recorrente');
                if (chkRec) chkRec.addEventListener('change', function () { corpo.querySelector('#lf-bloco-rec').classList.toggle('hidden', !chkRec.checked); });
            },
            botoes: [
                { texto: 'Cancelar', classe: 'nexo-btn-secundario', acao: 'fechar' },
                { texto: editando ? 'Salvar alterações' : 'Cadastrar', classe: 'nexo-btn-primario', icone: 'fa-check', acao: function (modal, corpo) {
                    return salvarLancamento(corpo.querySelector('form'), tipo, existente);
                } }
            ]
        });
    }

    /* Valida e grava. Retorna false para manter o modal aberto. */
    function salvarLancamento(form, tipo, existente) {
        var d = Nexo.ui.lerFormulario(form);
        var erros = {};
        var v = fmt.paraNumero(d.valor);
        var hoje = fmt.hojeInput();
        if (!d.descricao) erros.descricao = 'Informe a descrição.';
        if (!d.categoria) erros.categoria = 'Informe ou escolha a categoria.';
        if (!d.valor || !(v > 0)) erros.valor = 'Informe um valor maior que zero.';
        if (!d.vencimento || isNaN(paraData(d.vencimento))) erros.vencimento = 'Informe a data de vencimento.';
        if (d.pago) {
            if (!d.dataPagamento) erros.dataPagamento = 'Informe a data.';
            else if (d.dataPagamento > hoje) erros.dataPagamento = 'A data não pode estar no futuro.';
        }
        var qtd = 1;
        if (d.recorrente) {
            qtd = Number(d.meses);
            if (!Number.isInteger(qtd) || qtd < 2 || qtd > 36) erros.meses = 'Informe de 2 a 36 meses.';
        }
        if (!Nexo.ui.mostrarErros(form, erros)) return false;

        var base = {
            tipo: tipo,
            descricao: d.descricao,
            categoria: d.categoria,
            valor: Math.round(v * 100) / 100,
            formaPagamento: d.formaPagamento,
            status: 'Ativo'
        };
        if (existente) {
            base.vencimento = d.vencimento;
            base.dataPagamento = d.pago ? d.dataPagamento : null;
            Nexo.db.atualizar('lancamentos', existente.id, base);
            Nexo.registrarAtividade('financeiro', 'Lançamento atualizado: ' + d.descricao + ' (' + fmt.moeda(base.valor) + ')', 'financeiro.html');
            Nexo.ui.toast('Lançamento atualizado.', 'sucesso');
        } else {
            for (var i = 0; i < qtd; i++) {
                var item = Object.assign({}, base);
                item.vencimento = somarMeses(d.vencimento, i);
                item.dataPagamento = (d.pago && i === 0) ? d.dataPagamento : null;
                if (qtd > 1) item.descricao = d.descricao + ' (' + (i + 1) + '/' + qtd + ')';
                Nexo.db.inserir('lancamentos', item);
            }
            Nexo.registrarAtividade('financeiro',
                (tipo === 'Receita' ? 'Receita' : 'Despesa') + ' cadastrada: ' + d.descricao + ' (' + fmt.moeda(base.valor) + (qtd > 1 ? ', ' + qtd + ' meses' : '') + ')', 'financeiro.html');
            Nexo.ui.toast(qtd > 1 ? qtd + ' lançamentos criados.' : (tipo === 'Receita' ? 'Receita cadastrada.' : 'Despesa cadastrada.'), 'sucesso');
        }
        renderizarTudo();
        return true;
    }

    /* ------------------------------------------------------------------ */
    /* Ações da tabela: baixa, estorno, edição e exclusão                  */
    /* ------------------------------------------------------------------ */
    function abrirBaixa(l) {
        var rec = l.tipo === 'Receita';
        Nexo.ui.abrirModal({
            titulo: rec ? 'Registrar recebimento' : 'Registrar pagamento',
            largura: 'max-w-md',
            html: '<form novalidate><p class="text-sm text-gray-600 mb-4"><b>' + esc(l.descricao) + '</b><br>Valor: ' + fmt.moeda(l.valor) + ' &middot; Vencimento: ' + fmt.data(l.vencimento) + '</p>' +
                '<label class="nexo-label" for="bx-data">Data do ' + (rec ? 'recebimento' : 'pagamento') + ' *</label>' +
                '<input type="date" id="bx-data" name="data" class="nexo-input" max="' + fmt.hojeInput() + '" value="' + fmt.hojeInput() + '"></form>',
            botoes: [
                { texto: 'Cancelar', classe: 'nexo-btn-secundario', acao: 'fechar' },
                { texto: 'Confirmar baixa', classe: 'nexo-btn-primario', icone: 'fa-check', acao: function (modal, corpo) {
                    var form = corpo.querySelector('form');
                    var d = Nexo.ui.lerFormulario(form);
                    var erros = {};
                    if (!d.data) erros.data = 'Informe a data.';
                    else if (d.data > fmt.hojeInput()) erros.data = 'A data não pode estar no futuro.';
                    if (!Nexo.ui.mostrarErros(form, erros)) return false;
                    var r = Nexo.ops.baixarLancamento(l.id, d.data);
                    if (!r.ok) { Nexo.ui.toast(r.erro, 'erro'); return false; }
                    Nexo.ui.toast(rec ? 'Recebimento registrado.' : 'Pagamento registrado.', 'sucesso');
                    renderizarTudo();
                    return true;
                } }
            ]
        });
    }

    function estornar(l) {
        Nexo.ui.confirmar('Estornar baixa?', 'O lançamento "' + l.descricao + '" voltará a ficar em aberto (pendente ou atrasado).', { textoOk: 'Estornar', perigo: true }).then(function (ok) {
            if (!ok) return;
            var r = Nexo.ops.estornarLancamento(l.id);
            if (!r.ok) { Nexo.ui.toast(r.erro, 'erro'); return; }
            Nexo.registrarAtividade('financeiro', 'Baixa estornada: ' + l.descricao + ' (' + fmt.moeda(l.valor) + ')', 'financeiro.html');
            Nexo.ui.toast('Baixa estornada.', 'sucesso');
            renderizarTudo();
        });
    }

    function excluir(l) {
        Nexo.ui.confirmar('Excluir lançamento?', 'Isso remove "' + l.descricao + '" (' + fmt.moeda(l.valor) + ') de forma permanente.', { textoOk: 'Excluir', perigo: true }).then(function (ok) {
            if (!ok) return;
            Nexo.db.remover('lancamentos', l.id);
            Nexo.registrarAtividade('financeiro', 'Lançamento excluído: ' + l.descricao + ' (' + fmt.moeda(l.valor) + ')', 'financeiro.html');
            Nexo.ui.toast('Lançamento excluído.', 'sucesso');
            renderizarTudo();
        });
    }

    function aoClicarLista(e) {
        var btn = e.target.closest('[data-acao]');
        if (!btn) return;
        var l = Nexo.db.obter('lancamentos', btn.getAttribute('data-id'));
        if (!l) { Nexo.ui.toast('Lançamento não encontrado.', 'erro'); renderizarTudo(); return; }
        var acao = btn.getAttribute('data-acao');
        if (acao === 'baixar') abrirBaixa(l);
        else if (acao === 'estornar') estornar(l);
        else if (acao === 'editar' && ehManual(l)) abrirFormulario(l.tipo, l);
        else if (acao === 'excluir' && ehManual(l)) excluir(l);
    }

    /* ------------------------------------------------------------------ */
    /* Início                                                              */
    /* ------------------------------------------------------------------ */
    function iniciar() {
        document.getElementById('f-periodo').addEventListener('change', aoMudarPeriodo);
        document.getElementById('f-ini').addEventListener('change', aoMudarDatas);
        document.getElementById('f-fim').addEventListener('change', aoMudarDatas);

        document.getElementById('abas').addEventListener('click', function (e) {
            var b = e.target.closest('[data-aba]');
            if (!b) return;
            estado.aba = b.getAttribute('data-aba');
            estado.pagina = 1;
            estado.categoria = '';
            renderizarTudo();
        });
        document.getElementById('f-busca').addEventListener('input', function (e) { estado.busca = e.target.value; estado.pagina = 1; renderizarLista(carregarLancamentos()); });
        document.getElementById('f-status').addEventListener('change', function (e) { estado.status = e.target.value; estado.pagina = 1; renderizarLista(carregarLancamentos()); });
        document.getElementById('f-categoria').addEventListener('change', function (e) { estado.categoria = e.target.value; estado.pagina = 1; renderizarLista(carregarLancamentos()); });
        document.getElementById('f-agrupar').addEventListener('change', function (e) { estado.agrupar = e.target.value; renderizarFluxo(carregarLancamentos()); });
        document.getElementById('btn-limpar').addEventListener('click', function () {
            estado.status = ''; estado.categoria = ''; estado.busca = ''; estado.pagina = 1;
            document.getElementById('f-busca').value = '';
            document.getElementById('f-status').value = '';
            renderizarLista(carregarLancamentos());
        });
        document.getElementById('lista').addEventListener('click', aoClicarLista);
        document.getElementById('btn-nova-receita').addEventListener('click', function () { abrirFormulario('Receita'); });
        document.getElementById('btn-nova-despesa').addEventListener('click', function () { abrirFormulario('Despesa'); });
        document.getElementById('btn-exportar').addEventListener('click', exportar);

        aplicarPeriodo();
        renderizarTudo();
    }

    iniciar();
})();
