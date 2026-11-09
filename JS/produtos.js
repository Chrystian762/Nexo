/*
 * NEXO ERP - Tela de Produtos
 * --------------------------------------------------------------
 * Lista, categorias, busca/filtros, detalhes (com resumo de vendas),
 * cadastro e edicao de produtos. Dados em localStorage via Nexo.db.
 * Esta tela substitui a antiga telas/produto.html.
 */
(function () {
    'use strict';

    if (!Nexo.layout.montar('produtos')) return;

    var esc = Nexo.esc;
    var fmt = Nexo.fmt;

    /* Estado da tela (filtros e modo de exibicao) */
    var estado = {
        categoria: '', busca: '', marca: '', fornecedor: '', status: '', estoque: '',
        ordem: 'nome', modo: 'tabela', pagina: 1
    };
    var graficoVendas = null;
    var produtoAberto = null; /* id do produto no detalhe */

    var ICONES = [
        ['fa-pump-soap', 'Shampoo'], ['fa-bottle-droplet', 'Frasco'], ['fa-jar', 'Pote'], ['fa-spray-can', 'Spray'],
        ['fa-wand-magic-sparkles', 'Varinha'], ['fa-flask', 'Frasco de laboratório'], ['fa-droplet', 'Gota'],
        ['fa-vial', 'Ampola'], ['fa-scissors', 'Tesoura'], ['fa-box', 'Caixa'], ['fa-tag', 'Etiqueta'],
        ['fa-star', 'Estrela'], ['fa-heart', 'Coração'], ['fa-leaf', 'Folha'], ['fa-gift', 'Presente']
    ];

    /* ------------------------------------------------------------------ */
    /* Funcoes de apoio                                                    */
    /* ------------------------------------------------------------------ */
    function $(id) { return document.getElementById(id); }

    /* Margem percentual sobre o preco de venda */
    function margemPct(preco, custo) {
        preco = Number(preco) || 0;
        return preco > 0 ? ((preco - (Number(custo) || 0)) / preco) * 100 : 0;
    }

    /* Situacao do estoque: Normal, Estoque baixo ou Sem estoque */
    function situacaoEstoque(p) {
        var e = Number(p.estoque) || 0;
        if (e <= 0) return 'Sem estoque';
        if (e <= (Number(p.estoqueMinimo) || 0)) return 'Estoque baixo';
        return 'Normal';
    }

    function classeMargem(m) {
        return m < 20 ? 'text-red-600' : (m < 35 ? 'text-amber-600' : 'text-emerald-600');
    }

    /* Vendas por produto, calculadas dos pedidos nao cancelados */
    function calcularVendas() {
        var mapa = {};
        var limite30 = Nexo.consultas.diasAtras(30);
        Nexo.db.listar('pedidos').forEach(function (ped) {
            if (ped.status === 'Cancelado') return;
            var recente = fmt.dataInput(ped.data) >= limite30;
            var contou = {};
            (ped.itens || []).forEach(function (it) {
                var v = mapa[it.produtoId] || (mapa[it.produtoId] = {
                    unidades: 0, faturamento: 0, lucro: 0, pedidos: 0, un30: 0, fat30: 0, lucro30: 0, ped30: 0, porMes: {}
                });
                var q = Number(it.quantidade) || 0;
                var fat = q * (Number(it.precoUnitario) || 0);
                var luc = fat - q * (Number(it.custoUnitario) || 0);
                v.unidades += q; v.faturamento += fat; v.lucro += luc;
                if (!contou[it.produtoId]) { v.pedidos++; if (recente) v.ped30++; contou[it.produtoId] = true; }
                if (recente) { v.un30 += q; v.fat30 += fat; v.lucro30 += luc; }
                var d = new Date(ped.data);
                var chave = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
                v.porMes[chave] = (v.porMes[chave] || 0) + q;
            });
        });
        return mapa;
    }
    var VENDAS_VAZIO = { unidades: 0, faturamento: 0, lucro: 0, pedidos: 0, un30: 0, fat30: 0, lucro30: 0, ped30: 0, porMes: {} };

    function nomeCategoria(id) {
        var c = Nexo.db.obter('categorias', id);
        return c ? c.nome : 'Sem categoria';
    }

    function nomeFornecedor(id) {
        var f = Nexo.db.obter('fornecedores', id);
        return f ? (f.nomeFantasia || f.razaoSocial) : '-';
    }

    function semAcento(t) {
        return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    }

    /* ------------------------------------------------------------------ */
    /* Cards de resumo                                                     */
    /* ------------------------------------------------------------------ */
    function renderResumo() {
        var todos = Nexo.db.listar('produtos');
        var ativos = todos.filter(function (p) { return p.status === 'Ativo'; });
        var valorEstoque = todos.reduce(function (s, p) { return s + (Number(p.estoque) || 0) * (Number(p.custo) || 0); }, 0);
        var baixos = ativos.filter(function (p) { return situacaoEstoque(p) !== 'Normal'; });
        var semEstoque = ativos.filter(function (p) { return situacaoEstoque(p) === 'Sem estoque'; }).length;
        var margemMedia = ativos.length ? ativos.reduce(function (s, p) { return s + margemPct(p.preco, p.custo); }, 0) / ativos.length : 0;

        function card(icone, cor, rotulo, valor, sub) {
            return '<div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 md:p-5 flex items-start gap-3">' +
                '<div class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ' + cor + '"><i class="fa-solid ' + icone + '"></i></div>' +
                '<div class="min-w-0"><p class="text-xs font-semibold text-gray-500">' + rotulo + '</p>' +
                '<p class="text-xl md:text-2xl font-extrabold text-gray-900 truncate">' + valor + '</p>' +
                '<p class="text-xs text-gray-400 truncate">' + sub + '</p></div></div>';
        }
        $('cards-resumo').innerHTML =
            card('fa-box-open', 'bg-purple-50 text-brand-purple', 'Produtos ativos', fmt.numero(ativos.length), 'de ' + fmt.numero(todos.length) + ' cadastrados') +
            card('fa-sack-dollar', 'bg-emerald-50 text-emerald-600', 'Valor do estoque (custo)', fmt.moeda(valorEstoque), 'soma de estoque x custo') +
            card('fa-triangle-exclamation', 'bg-amber-50 text-amber-600', 'Estoque baixo', fmt.numero(baixos.length), fmt.numero(semEstoque) + ' sem estoque') +
            card('fa-percent', 'bg-blue-50 text-blue-600', 'Margem média', fmt.porcentagem(margemMedia), 'dos produtos ativos');
    }

    /* ------------------------------------------------------------------ */
    /* Faixa de categorias                                                 */
    /* ------------------------------------------------------------------ */
    function renderCategorias() {
        var produtos = Nexo.db.listar('produtos');
        var cats = Nexo.db.listar('categorias');
        function bloco(id, icone, nome, qtd) {
            var ativo = estado.categoria === id;
            return '<button type="button" data-cat="' + esc(id) + '" class="text-left rounded-2xl border p-3 transition ' +
                (ativo ? 'bg-brand-purple border-brand-purple text-white shadow-md' : 'bg-white border-gray-100 shadow-sm hover:border-brand-purple hover:shadow-md') + '">' +
                '<i class="fa-solid ' + esc(icone) + ' text-lg ' + (ativo ? 'text-white' : 'text-brand-purple') + '"></i>' +
                '<p class="text-sm font-bold mt-2 truncate ' + (ativo ? 'text-white' : 'text-gray-800') + '">' + esc(nome) + '</p>' +
                '<p class="text-xs ' + (ativo ? 'text-purple-100' : 'text-gray-500') + '">' + qtd + (qtd === 1 ? ' produto' : ' produtos') + '</p></button>';
        }
        var html = bloco('', 'fa-border-all', 'Todas', produtos.length);
        cats.forEach(function (c) {
            html += bloco(c.id, c.icone || 'fa-tag', c.nome, produtos.filter(function (p) { return p.categoriaId === c.id; }).length);
        });
        $('faixa-categorias').innerHTML = html;
    }

    /* ------------------------------------------------------------------ */
    /* Filtros                                                             */
    /* ------------------------------------------------------------------ */
    function opcoes(selectId, primeira, lista, atual) {
        var sel = $(selectId);
        sel.innerHTML = '<option value="">' + esc(primeira) + '</option>' + lista.map(function (o) {
            return '<option value="' + esc(o[0]) + '"' + (o[0] === atual ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
        }).join('');
        sel.value = atual || '';
    }

    function renderFiltros() {
        var produtos = Nexo.db.listar('produtos');
        opcoes('filtro-categoria', 'Todas as categorias', Nexo.db.listar('categorias').map(function (c) { return [c.id, c.nome]; }), estado.categoria);
        var marcas = [];
        produtos.forEach(function (p) { if (p.marca && marcas.indexOf(p.marca) === -1) marcas.push(p.marca); });
        marcas.sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
        opcoes('filtro-marca', 'Todas as marcas', marcas.map(function (m) { return [m, m]; }), estado.marca);
        opcoes('filtro-fornecedor', 'Todos os fornecedores', Nexo.db.listar('fornecedores').map(function (f) { return [f.id, f.nomeFantasia || f.razaoSocial]; }), estado.fornecedor);
        $('filtro-status').value = estado.status;
        $('filtro-estoque').value = estado.estoque;
        $('ordenacao').value = estado.ordem;
        $('busca').value = estado.busca;
    }

    /* Produtos filtrados e ordenados */
    function produtosFiltrados() {
        var vendas = calcularVendas();
        var termo = semAcento(estado.busca).trim();
        var lista = Nexo.db.listar('produtos').filter(function (p) {
            if (estado.categoria && p.categoriaId !== estado.categoria) return false;
            if (estado.marca && p.marca !== estado.marca) return false;
            if (estado.fornecedor && p.fornecedorId !== estado.fornecedor) return false;
            if (estado.status && p.status !== estado.status) return false;
            if (estado.estoque && situacaoEstoque(p) !== estado.estoque) return false;
            if (termo) {
                var alvo = semAcento([p.nome, p.sku, p.codigoBarras, p.marca].join(' '));
                if (alvo.indexOf(termo) === -1) return false;
            }
            return true;
        });
        var o = estado.ordem;
        lista.sort(function (a, b) {
            if (o === 'preco-asc') return a.preco - b.preco;
            if (o === 'preco-desc') return b.preco - a.preco;
            if (o === 'estoque-asc') return a.estoque - b.estoque;
            if (o === 'estoque-desc') return b.estoque - a.estoque;
            if (o === 'vendidos') return ((vendas[b.id] || VENDAS_VAZIO).unidades) - ((vendas[a.id] || VENDAS_VAZIO).unidades);
            return a.nome.localeCompare(b.nome, 'pt-BR');
        });
        return lista;
    }

    /* ------------------------------------------------------------------ */
    /* Lista (tabela ou cards)                                             */
    /* ------------------------------------------------------------------ */
    function renderLista() {
        var lista = produtosFiltrados();
        var cont = $('lista-produtos');

        /* estilo dos botoes de modo */
        $('modo-tabela').className = 'px-3 py-1.5 text-sm ' + (estado.modo === 'tabela' ? 'bg-brand-purple text-white' : 'text-gray-500 hover:bg-gray-50');
        $('modo-grade').className = 'px-3 py-1.5 text-sm border-l border-gray-200 ' + (estado.modo === 'grade' ? 'bg-brand-purple text-white' : 'text-gray-500 hover:bg-gray-50');

        if (!lista.length) {
            var temFiltro = estado.categoria || estado.busca || estado.marca || estado.fornecedor || estado.status || estado.estoque;
            cont.innerHTML = '<div class="py-16 px-6 text-center">' +
                '<div class="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-50 text-brand-purple flex items-center justify-center text-2xl"><i class="fa-solid fa-box-open"></i></div>' +
                '<h3 class="font-bold text-gray-900">Nenhum produto encontrado</h3>' +
                '<p class="text-sm text-gray-500 mt-1">' + (temFiltro ? 'Tente mudar a busca ou limpar os filtros.' : 'Cadastre o primeiro produto para começar.') + '</p></div>';
            return;
        }

        var info = Nexo.ui.paginar(lista, estado.pagina, estado.modo === 'grade' ? 12 : undefined);
        estado.pagina = info.pagina;
        var vendas = calcularVendas();
        var corpo;

        if (estado.modo === 'grade') {
            corpo = '<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 p-4">' + info.itens.map(function (p) {
                var cat = Nexo.db.obter('categorias', p.categoriaId) || {};
                var m = margemPct(p.preco, p.custo);
                return '<div data-acao="ver" data-id="' + esc(p.id) + '" class="border border-gray-100 rounded-2xl p-4 hover:border-brand-purple hover:shadow-md transition cursor-pointer bg-white">' +
                    '<div class="flex items-start justify-between gap-2">' +
                    '<div class="w-10 h-10 rounded-xl bg-purple-50 text-brand-purple flex items-center justify-center shrink-0"><i class="fa-solid ' + esc(cat.icone || 'fa-tag') + '"></i></div>' +
                    Nexo.ui.badgeStatus(p.status) + '</div>' +
                    '<h3 class="font-bold text-gray-900 mt-3 leading-snug">' + esc(p.nome) + '</h3>' +
                    '<p class="text-xs text-gray-500">' + esc(p.sku) + ' &bull; ' + esc(p.marca || '-') + ' &bull; ' + esc(p.volume || '-') + '</p>' +
                    '<div class="flex items-end justify-between mt-3">' +
                    '<div><p class="text-lg font-extrabold text-gray-900">' + fmt.moeda(p.preco) + '</p><p class="text-xs text-gray-500">Custo ' + fmt.moeda(p.custo) + ' &bull; <span class="font-semibold ' + classeMargem(m) + '">' + fmt.porcentagem(m) + '</span></p></div>' +
                    '<div class="text-right"><p class="text-sm font-bold text-gray-800">' + fmt.numero(p.estoque) + ' un.</p>' + Nexo.ui.badgeStatus(situacaoEstoque(p)) + '</div></div>' +
                    '<div class="flex gap-2 mt-3 pt-3 border-t border-gray-50">' +
                    '<button type="button" data-acao="editar" data-id="' + esc(p.id) + '" class="flex-1 text-sm font-semibold text-gray-600 hover:text-brand-purple py-1"><i class="fa-solid fa-pen mr-1"></i>Editar</button>' +
                    '<button type="button" data-acao="ver" data-id="' + esc(p.id) + '" class="flex-1 text-sm font-semibold text-brand-purple py-1"><i class="fa-solid fa-eye mr-1"></i>Detalhes</button></div></div>';
            }).join('') + '</div>';
        } else {
            corpo = '<div class="overflow-x-auto"><table class="w-full text-sm text-left">' +
                '<thead class="bg-gray-50 text-xs uppercase text-gray-500"><tr>' +
                ['Produto', 'SKU', 'Categoria', 'Marca', 'Preço', 'Custo', 'Margem', 'Estoque', 'Status', ''].map(function (h) {
                    return '<th class="px-4 py-3 font-semibold whitespace-nowrap">' + h + '</th>';
                }).join('') + '</tr></thead><tbody class="divide-y divide-gray-50">' +
                info.itens.map(function (p) {
                    var m = margemPct(p.preco, p.custo);
                    var v = vendas[p.id] || VENDAS_VAZIO;
                    return '<tr data-acao="ver" data-id="' + esc(p.id) + '" class="hover:bg-purple-50/40 cursor-pointer">' +
                        '<td class="px-4 py-3"><p class="font-semibold text-gray-900">' + esc(p.nome) + '</p><p class="text-xs text-gray-400">' + esc(p.volume || '-') + ' &bull; ' + fmt.numero(v.unidades) + ' vendidas</p></td>' +
                        '<td class="px-4 py-3 text-gray-600 whitespace-nowrap">' + esc(p.sku) + '</td>' +
                        '<td class="px-4 py-3 text-gray-600 whitespace-nowrap">' + esc(nomeCategoria(p.categoriaId)) + '</td>' +
                        '<td class="px-4 py-3 text-gray-600 whitespace-nowrap">' + esc(p.marca || '-') + '</td>' +
                        '<td class="px-4 py-3 font-semibold whitespace-nowrap">' + fmt.moeda(p.preco) + '</td>' +
                        '<td class="px-4 py-3 text-gray-600 whitespace-nowrap">' + fmt.moeda(p.custo) + '</td>' +
                        '<td class="px-4 py-3 font-semibold whitespace-nowrap ' + classeMargem(m) + '">' + fmt.porcentagem(m) + '</td>' +
                        '<td class="px-4 py-3 whitespace-nowrap"><span class="font-semibold mr-2">' + fmt.numero(p.estoque) + '</span>' + Nexo.ui.badgeStatus(situacaoEstoque(p)) + '</td>' +
                        '<td class="px-4 py-3">' + Nexo.ui.badgeStatus(p.status) + '</td>' +
                        '<td class="px-4 py-3 whitespace-nowrap text-right">' +
                        '<button type="button" data-acao="editar" data-id="' + esc(p.id) + '" class="w-8 h-8 rounded-lg text-gray-400 hover:text-brand-purple hover:bg-purple-50" title="Editar" aria-label="Editar ' + esc(p.nome) + '"><i class="fa-solid fa-pen"></i></button></td></tr>';
                }).join('') + '</tbody></table></div>';
        }
        cont.innerHTML = corpo + Nexo.ui.htmlPaginacao(info, 'produtosPagina');
    }

    window.produtosPagina = function (n) {
        estado.pagina = n;
        renderLista();
    };

    function atualizarLista() {
        renderResumo();
        renderCategorias();
        renderFiltros();
        renderLista();
    }

    /* ------------------------------------------------------------------ */
    /* Exportar CSV (respeita filtros atuais)                              */
    /* ------------------------------------------------------------------ */
    function exportar() {
        var lista = produtosFiltrados();
        if (!lista.length) { Nexo.ui.toast('Não há produtos para exportar.', 'aviso'); return; }
        var linhas = lista.map(function (p) {
            return [p.nome, p.sku, p.codigoBarras || '', nomeCategoria(p.categoriaId), p.marca || '', nomeFornecedor(p.fornecedorId),
                p.volume || '', p.lote || '', p.validade ? fmt.data(p.validade) : '', Number(p.preco) || 0, Number(p.custo) || 0,
                Math.round(margemPct(p.preco, p.custo) * 10) / 10, Number(p.estoque) || 0, Number(p.estoqueMinimo) || 0,
                situacaoEstoque(p), p.status];
        });
        Nexo.exportarCSV('produtos', ['Nome', 'SKU', 'Código de barras', 'Categoria', 'Marca', 'Fornecedor', 'Volume', 'Lote', 'Validade',
            'Preço', 'Custo', 'Margem %', 'Estoque', 'Estoque mínimo', 'Situação do estoque', 'Status'], linhas);
        Nexo.ui.toast(lista.length + ' produtos exportados.');
    }

    /* ------------------------------------------------------------------ */
    /* Detalhes                                                            */
    /* ------------------------------------------------------------------ */
    function infoLinha(rotulo, valorHtml) {
        return '<div class="py-2.5 border-b border-gray-50 flex justify-between gap-4 text-sm"><span class="text-gray-500">' + rotulo + '</span><span class="font-semibold text-gray-900 text-right">' + valorHtml + '</span></div>';
    }

    function tabelaMov(lista, vazio) {
        if (!lista.length) return '<p class="text-sm text-gray-400 py-4 text-center">' + vazio + '</p>';
        return '<div class="overflow-x-auto"><table class="w-full text-sm"><tbody class="divide-y divide-gray-50">' + lista.map(function (m) {
            return '<tr><td class="py-2 pr-3 text-gray-500 whitespace-nowrap">' + fmt.data(m.data) + '</td>' +
                '<td class="py-2 pr-3 font-semibold whitespace-nowrap">' + fmt.numero(Math.abs(m.quantidade)) + ' un.</td>' +
                '<td class="py-2 text-gray-600">' + esc(m.motivo || m.referencia || '-') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }

    function abrirDetalhe(id, semHistorico) {
        var p = Nexo.db.obter('produtos', id);
        if (!p) { Nexo.ui.toast('Produto não encontrado.', 'erro'); voltarLista(); return; }
        produtoAberto = id;
        if (!semHistorico) {
            try { history.pushState({ id: id }, '', 'produtos.html?id=' + encodeURIComponent(id)); } catch (e) { /* file:// pode bloquear */ }
        }

        var cat = Nexo.db.obter('categorias', p.categoriaId) || {};
        var forn = Nexo.db.obter('fornecedores', p.fornecedorId);
        var m = margemPct(p.preco, p.custo);
        var lucroUn = (Number(p.preco) || 0) - (Number(p.custo) || 0);
        var v = calcularVendas()[id] || VENDAS_VAZIO;
        var sit = situacaoEstoque(p);

        /* validade */
        var validadeHtml = '-';
        if (p.validade) {
            var dias = Math.ceil((new Date(p.validade + 'T12:00:00').getTime() - Date.now()) / 86400000);
            validadeHtml = fmt.data(p.validade);
            if (dias < 0) validadeHtml += ' <span class="ml-1 text-xs text-red-600"><i class="fa-solid fa-circle-exclamation"></i> Vencido há ' + Math.abs(dias) + ' dias</span>';
            else if (dias < 60) validadeHtml += ' <span class="ml-1 text-xs text-amber-600"><i class="fa-solid fa-triangle-exclamation"></i> Vence em ' + dias + ' dias</span>';
        }

        var movs = Nexo.db.listar('movimentacoes').filter(function (x) { return x.produtoId === id; })
            .sort(function (a, b) { return b.data < a.data ? -1 : 1; });
        var entradas = movs.filter(function (x) { return x.tipo === 'Entrada'; }).slice(0, 5);
        var saidas = movs.filter(function (x) { return x.tipo === 'Saída'; }).slice(0, 5);

        function mini(rotulo, valor, sub) {
            return '<div class="bg-gray-50 rounded-xl p-3"><p class="text-xs text-gray-500">' + rotulo + '</p><p class="text-lg font-extrabold text-gray-900">' + valor + '</p>' + (sub ? '<p class="text-xs text-gray-400">' + sub + '</p>' : '') + '</div>';
        }
        var sec = 'bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-6';
        var titulo = 'text-lg font-bold text-brand-purple mb-3 flex items-center gap-2';

        var html =
            '<button type="button" data-acao="voltar" class="text-sm font-semibold text-gray-500 hover:text-brand-purple mb-4"><i class="fa-solid fa-arrow-left mr-1"></i>Voltar para produtos</button>' +
            '<header class="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">' +
            '<div class="flex items-start gap-4 min-w-0">' +
            '<div class="w-14 h-14 rounded-2xl bg-purple-50 text-brand-purple flex items-center justify-center text-2xl shrink-0"><i class="fa-solid ' + esc(cat.icone || 'fa-tag') + '"></i></div>' +
            '<div class="min-w-0"><h1 class="text-2xl md:text-3xl font-extrabold text-gray-900">' + esc(p.nome) + '</h1>' +
            '<p class="text-brand-textMuted mt-1">' + esc(p.sku) + ' &bull; ' + esc(cat.nome || 'Sem categoria') + ' &bull; ' + esc(p.marca || 'Sem marca') + '</p>' +
            '<div class="flex flex-wrap gap-2 mt-2">' + Nexo.ui.badgeStatus(p.status) + Nexo.ui.badgeStatus(sit) + '</div></div></div>' +
            '<div class="flex flex-wrap gap-2">' +
            '<button type="button" data-acao="editar" data-id="' + esc(id) + '" class="nexo-btn nexo-btn-primario"><i class="fa-solid fa-pen"></i> Editar</button>' +
            '<button type="button" data-acao="alternar" data-id="' + esc(id) + '" class="nexo-btn nexo-btn-secundario"><i class="fa-solid ' + (p.status === 'Ativo' ? 'fa-ban' : 'fa-circle-check') + '"></i> ' + (p.status === 'Ativo' ? 'Inativar' : 'Ativar') + '</button>' +
            '<button type="button" data-acao="excluir" data-id="' + esc(id) + '" class="nexo-btn nexo-btn-secundario !text-red-600"><i class="fa-solid fa-trash"></i> Excluir</button></div></header>' +

            '<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">' +
            '<div class="lg:col-span-2 space-y-6">' +

            /* Resumo de vendas */
            '<div class="' + sec + '"><h2 class="' + titulo + '"><i class="fa-solid fa-chart-line"></i> Resumo de Vendas</h2>' +
            '<div class="grid grid-cols-2 md:grid-cols-4 gap-3">' +
            mini('Unidades vendidas', fmt.numero(v.unidades), fmt.numero(v.un30) + ' nos últimos 30 dias') +
            mini('Faturamento', fmt.moeda(v.faturamento), fmt.moeda(v.fat30) + ' em 30 dias') +
            mini('Lucro', fmt.moeda(v.lucro), fmt.moeda(v.lucro30) + ' em 30 dias') +
            mini('Pedidos', fmt.numero(v.pedidos), fmt.numero(v.ped30) + ' em 30 dias') + '</div>' +
            '<p class="text-xs text-gray-400 mt-2">Considera apenas pedidos não cancelados. Lucro = (preço vendido - custo registrado no pedido) x quantidade.</p>' +
            '<h3 class="text-sm font-bold text-gray-600 mt-5 mb-2">Unidades vendidas por mês (últimos 6 meses)</h3>' +
            '<div class="relative h-56"><canvas id="grafico-vendas" aria-label="Gráfico de vendas por mês" role="img"></canvas></div></div>' +

            /* Estoque e movimentacao */
            '<div class="' + sec + '"><div class="flex flex-wrap items-center justify-between gap-2 mb-3"><h2 class="text-lg font-bold text-brand-purple flex items-center gap-2"><i class="fa-solid fa-boxes-stacked"></i> Detalhes de Estoque e Movimentação</h2>' +
            '<a href="estoque.html?produto=' + encodeURIComponent(id) + '" class="nexo-btn nexo-btn-secundario !py-1.5"><i class="fa-solid fa-right-left"></i> Movimentar estoque</a></div>' +
            '<div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">' +
            mini('Estoque atual', fmt.numero(p.estoque) + ' un.', Nexo.ui.badgeStatus(sit)) +
            mini('Estoque mínimo', fmt.numero(p.estoqueMinimo) + ' un.', '') +
            mini('Valor em estoque (custo)', fmt.moeda((Number(p.estoque) || 0) * (Number(p.custo) || 0)), '') + '</div>' +
            '<div class="grid grid-cols-1 md:grid-cols-2 gap-6">' +
            '<div><h3 class="text-sm font-bold text-emerald-700 mb-1"><i class="fa-solid fa-arrow-down mr-1"></i>Últimas entradas</h3>' + tabelaMov(entradas, 'Nenhuma entrada registrada.') + '</div>' +
            '<div><h3 class="text-sm font-bold text-red-700 mb-1"><i class="fa-solid fa-arrow-up mr-1"></i>Últimas saídas</h3>' + tabelaMov(saidas, 'Nenhuma saída registrada.') + '</div></div></div>' +
            '</div>' +

            '<div class="space-y-6">' +
            /* Preco e custo */
            '<div class="' + sec + '"><h2 class="' + titulo + '"><i class="fa-solid fa-tags"></i> Preço e Custo</h2>' +
            infoLinha('Preço de venda', fmt.moeda(p.preco)) +
            infoLinha('Custo', fmt.moeda(p.custo)) +
            infoLinha('Lucro unitário', '<span class="' + classeMargem(m) + '">' + fmt.moeda(lucroUn) + '</span>') +
            infoLinha('Margem', '<span class="' + classeMargem(m) + '">' + fmt.porcentagem(m) + '</span>') + '</div>' +

            /* Informacoes tecnicas */
            '<div class="' + sec + '"><h2 class="' + titulo + '"><i class="fa-solid fa-circle-info"></i> Informações Técnicas</h2>' +
            infoLinha('SKU', esc(p.sku)) +
            infoLinha('Código de barras', esc(p.codigoBarras || '-')) +
            infoLinha('Volume', esc(p.volume || '-')) +
            infoLinha('Lote', esc(p.lote || '-')) +
            infoLinha('Validade', validadeHtml) +
            infoLinha('Marca', esc(p.marca || '-')) +
            infoLinha('Fornecedor', forn ? '<a class="text-brand-purple hover:underline" href="fornecedores.html?id=' + encodeURIComponent(forn.id) + '">' + esc(forn.nomeFantasia || forn.razaoSocial) + '</a>' : '-') +
            infoLinha('Cadastrado em', fmt.data(p.criadoEm)) + '</div>' +

            /* Informacoes adicionais */
            '<div class="' + sec + '"><h2 class="' + titulo + '"><i class="fa-solid fa-align-left"></i> Informações Adicionais</h2>' +
            '<p class="text-sm text-gray-700 whitespace-pre-line">' + esc(p.descricao || 'Sem descrição.') + '</p></div>' +
            '</div></div>';

        $('view-lista').classList.add('hidden');
        var det = $('view-detalhe');
        det.innerHTML = html;
        det.classList.remove('hidden');
        document.querySelector('main').scrollTop = 0;
        desenharGrafico(v);
    }

    /* Grafico de unidades vendidas por mes (ultimos 6 meses) */
    function desenharGrafico(v) {
        if (graficoVendas) { graficoVendas.destroy(); graficoVendas = null; }
        var canvas = $('grafico-vendas');
        if (!canvas) return;
        if (typeof Chart === 'undefined') {
            canvas.parentNode.innerHTML = '<p class="text-sm text-gray-400 text-center pt-16">Gráfico indisponível (sem conexão com a biblioteca de gráficos).</p>';
            return;
        }
        var rotulos = [], dados = [];
        var hoje = new Date();
        for (var i = 5; i >= 0; i--) {
            var d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
            var chave = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
            rotulos.push(d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', ''));
            dados.push(v.porMes[chave] || 0);
        }
        graficoVendas = new Chart(canvas, {
            type: 'bar',
            data: { labels: rotulos, datasets: [{ label: 'Unidades vendidas', data: dados, backgroundColor: '#7c3aed', borderRadius: 6 }] },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } }
            }
        });
    }

    function voltarLista(semHistorico) {
        produtoAberto = null;
        if (graficoVendas) { graficoVendas.destroy(); graficoVendas = null; }
        $('view-detalhe').classList.add('hidden');
        $('view-detalhe').innerHTML = '';
        $('view-lista').classList.remove('hidden');
        if (!semHistorico) {
            try { history.pushState({}, '', 'produtos.html'); } catch (e) { /* ignora */ }
        }
        atualizarLista();
    }

    /* Atualiza a tela atual (detalhe ou lista) apos uma alteracao */
    function recarregar() {
        if (produtoAberto && Nexo.db.obter('produtos', produtoAberto)) abrirDetalhe(produtoAberto, true);
        else voltarLista(true);
    }

    /* ------------------------------------------------------------------ */
    /* Ativar/inativar e excluir                                           */
    /* ------------------------------------------------------------------ */
    function alternarStatus(id) {
        var p = Nexo.db.obter('produtos', id);
        if (!p) return;
        var novo = p.status === 'Ativo' ? 'Inativo' : 'Ativo';
        Nexo.db.atualizar('produtos', id, { status: novo });
        Nexo.registrarAtividade('produto', 'Produto "' + p.nome + '" ' + (novo === 'Ativo' ? 'ativado' : 'inativado'), 'produtos.html?id=' + id);
        Nexo.ui.toast('Produto ' + (novo === 'Ativo' ? 'ativado.' : 'inativado.'));
        recarregar();
    }

    function produtoEmUso(id) {
        var noPedido = Nexo.db.listar('pedidos').some(function (ped) {
            return (ped.itens || []).some(function (it) { return it.produtoId === id; });
        });
        var naCompra = Nexo.db.listar('compras').some(function (c) {
            return (c.itens || []).some(function (it) { return it.produtoId === id; });
        });
        return noPedido || naCompra;
    }

    function excluir(id) {
        var p = Nexo.db.obter('produtos', id);
        if (!p) return;
        if (produtoEmUso(id)) {
            Nexo.ui.abrirModal({
                titulo: 'Não é possível excluir',
                largura: 'max-w-md',
                html: '<p class="text-sm text-gray-600">"' + esc(p.nome) + '" aparece em pedidos ou compras e por isso não pode ser excluído. ' +
                    'Para parar de vendê-lo, inative o produto: ele continua no histórico, mas deixa de ser usado.</p>',
                botoes: [
                    { texto: 'Fechar', classe: 'nexo-btn-secundario', acao: 'fechar' },
                    p.status === 'Ativo' ? { texto: 'Inativar produto', classe: 'nexo-btn-primario', acao: function () { alternarStatus(id); } } : { texto: 'Entendi', classe: 'nexo-btn-primario', acao: 'fechar' }
                ]
            });
            return;
        }
        Nexo.ui.confirmar('Excluir produto?', 'O produto "' + p.nome + '" e suas movimentações de estoque serão removidos. Esta ação não pode ser desfeita.', { textoOk: 'Excluir', perigo: true }).then(function (ok) {
            if (!ok) return;
            Nexo.db.remover('produtos', id);
            Nexo.db.substituir('movimentacoes', Nexo.db.listar('movimentacoes').filter(function (m) { return m.produtoId !== id; }));
            Nexo.registrarAtividade('produto', 'Produto "' + p.nome + '" excluído', 'produtos.html');
            Nexo.ui.toast('Produto excluído.');
            voltarLista();
        });
    }

    /* ------------------------------------------------------------------ */
    /* Formulario de cadastro e edicao                                     */
    /* ------------------------------------------------------------------ */
    function sugerirSku(categoriaId) {
        var nome = semAcento((Nexo.db.obter('categorias', categoriaId) || {}).nome || 'GER').replace(/[^a-z]/g, '').slice(0, 3).toUpperCase() || 'GER';
        var existentes = Nexo.db.listar('produtos').map(function (p) { return String(p.sku).toUpperCase(); });
        var n = existentes.length + 1;
        var sku;
        do { sku = 'NX-' + nome + '-' + String(n).padStart(3, '0'); n++; } while (existentes.indexOf(sku) !== -1);
        return sku;
    }

    function abrirFormulario(id) {
        var editando = !!id;
        var p = editando ? Nexo.db.obter('produtos', id) : null;
        if (editando && !p) { Nexo.ui.toast('Produto não encontrado.', 'erro'); return; }
        var cfg = (Nexo.db.lerObjeto('configuracoes', {}).geral) || {};
        var d = p || { status: 'Ativo', estoqueMinimo: cfg.estoqueMinimoPadrao || 10 };
        var cats = Nexo.db.listar('categorias');
        var forns = Nexo.db.listar('fornecedores');
        var marcas = [];
        Nexo.db.listar('produtos').forEach(function (x) { if (x.marca && marcas.indexOf(x.marca) === -1) marcas.push(x.marca); });

        function campo(rotulo, conteudo, extra) {
            return '<div class="' + (extra || '') + '"><label class="nexo-label">' + rotulo + '</label>' + conteudo + '</div>';
        }
        function inp(nome, tipo, valor, atributos) {
            return '<input class="nexo-input" name="' + nome + '" type="' + tipo + '" value="' + esc(valor === undefined || valor === null ? '' : valor) + '" ' + (atributos || '') + '>';
        }

        var html = '<form id="form-produto" novalidate class="grid grid-cols-1 md:grid-cols-6 gap-4">' +
            campo('Nome *', inp('nome', 'text', d.nome, 'maxlength="120" autocomplete="off"'), 'md:col-span-4') +
            campo('Status', '<select class="nexo-input" name="status"><option' + (d.status === 'Ativo' ? ' selected' : '') + '>Ativo</option><option' + (d.status === 'Inativo' ? ' selected' : '') + '>Inativo</option></select>', 'md:col-span-2') +
            campo('Categoria *', '<select class="nexo-input" name="categoriaId"><option value="">Selecione</option>' + cats.map(function (c) {
                return '<option value="' + esc(c.id) + '"' + (c.id === d.categoriaId ? ' selected' : '') + '>' + esc(c.nome) + '</option>';
            }).join('') + '</select>', 'md:col-span-2') +
            campo('Marca *', inp('marca', 'text', d.marca, 'list="lista-marcas" maxlength="60" autocomplete="off"') + '<datalist id="lista-marcas">' + marcas.map(function (m) { return '<option value="' + esc(m) + '">'; }).join('') + '</datalist>', 'md:col-span-2') +
            campo('Fornecedor *', '<select class="nexo-input" name="fornecedorId"><option value="">Selecione</option>' + forns.map(function (f) {
                return '<option value="' + esc(f.id) + '"' + (f.id === d.fornecedorId ? ' selected' : '') + '>' + esc(f.nomeFantasia || f.razaoSocial) + '</option>';
            }).join('') + '</select>', 'md:col-span-2') +
            campo('SKU *', '<div class="flex gap-2">' + inp('sku', 'text', d.sku, 'maxlength="30" autocomplete="off"') + '<button type="button" id="btn-gerar-sku" class="nexo-btn nexo-btn-secundario shrink-0" title="Sugerir SKU"><i class="fa-solid fa-wand-magic-sparkles"></i></button></div>', 'md:col-span-3') +
            campo('Código de barras', inp('codigoBarras', 'text', d.codigoBarras, 'inputmode="numeric" maxlength="14" placeholder="8 a 14 dígitos"'), 'md:col-span-3') +
            campo('Volume', inp('volume', 'text', d.volume, 'maxlength="20" placeholder="Ex.: 250ml"'), 'md:col-span-2') +
            campo('Lote', inp('lote', 'text', d.lote, 'maxlength="30"'), 'md:col-span-2') +
            campo('Validade', inp('validade', 'date', d.validade), 'md:col-span-2') +
            campo('Preço de venda (R$) *', inp('preco', 'number', d.preco, 'step="0.01" min="0"'), 'md:col-span-2') +
            campo('Custo (R$) *', inp('custo', 'number', d.custo, 'step="0.01" min="0"'), 'md:col-span-2') +
            campo('Margem', '<div id="form-margem" class="h-[42px] flex items-center px-3 rounded-lg bg-gray-50 border border-gray-100 text-sm font-bold text-gray-700">-</div>', 'md:col-span-2') +
            '<p id="aviso-preco" class="hidden md:col-span-6 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Atenção: o preço de venda está abaixo do custo (prejuízo por unidade).</p>' +
            campo('Estoque mínimo *', inp('estoqueMinimo', 'number', d.estoqueMinimo, 'step="1" min="0"'), 'md:col-span-2') +
            (editando
                ? '<div class="md:col-span-4"><label class="nexo-label">Estoque atual</label><div class="h-[42px] flex items-center justify-between px-3 rounded-lg bg-gray-50 border border-gray-100 text-sm"><span class="font-bold">' + fmt.numero(p.estoque) + ' un.</span><a class="text-brand-purple font-semibold hover:underline" href="estoque.html?produto=' + encodeURIComponent(id) + '">Alterar na tela de Estoque</a></div></div>'
                : campo('Estoque inicial', inp('estoqueInicial', 'number', 0, 'step="1" min="0"') + '<p class="text-xs text-gray-400 mt-1">Gera uma movimentação de Entrada.</p>', 'md:col-span-4')) +
            campo('Descrição', '<textarea class="nexo-input" name="descricao" rows="3" maxlength="500">' + esc(d.descricao || '') + '</textarea>', 'md:col-span-6') +
            '</form>';

        Nexo.ui.abrirModal({
            titulo: editando ? 'Editar produto' : 'Novo produto',
            largura: 'max-w-3xl',
            html: html,
            botoes: [
                { texto: 'Cancelar', classe: 'nexo-btn-secundario', acao: 'fechar' },
                { texto: editando ? 'Salvar alterações' : 'Cadastrar produto', classe: 'nexo-btn-primario', icone: 'fa-check', acao: function (modal, corpo) { return salvar(corpo.querySelector('form'), id); } }
            ],
            aoAbrir: function (corpo) {
                var form = corpo.querySelector('form');
                var preco = form.elements.preco, custo = form.elements.custo;

                /* margem ao vivo + aviso de preco abaixo do custo */
                function atualizarMargem() {
                    var pr = parseFloat(preco.value), cu = parseFloat(custo.value);
                    var box = form.querySelector('#form-margem');
                    if (isNaN(pr) || isNaN(cu) || pr <= 0) { box.textContent = '-'; box.className = box.className.replace(/text-(red|amber|emerald)-600/g, ''); form.querySelector('#aviso-preco').classList.add('hidden'); return; }
                    var m = margemPct(pr, cu);
                    box.textContent = fmt.porcentagem(m) + ' (lucro ' + fmt.moeda(pr - cu) + ')';
                    box.className = 'h-[42px] flex items-center px-3 rounded-lg bg-gray-50 border border-gray-100 text-sm font-bold ' + classeMargem(m);
                    form.querySelector('#aviso-preco').classList.toggle('hidden', pr >= cu);
                }
                preco.addEventListener('input', atualizarMargem);
                custo.addEventListener('input', atualizarMargem);
                atualizarMargem();

                /* sugestao de SKU */
                form.querySelector('#btn-gerar-sku').addEventListener('click', function () {
                    form.elements.sku.value = sugerirSku(form.elements.categoriaId.value);
                });
                if (!editando) {
                    form.elements.categoriaId.addEventListener('change', function () {
                        if (!form.elements.sku.dataset.manual) form.elements.sku.value = sugerirSku(form.elements.categoriaId.value);
                    });
                    form.elements.sku.value = sugerirSku('');
                    form.elements.sku.addEventListener('input', function () { form.elements.sku.dataset.manual = '1'; });
                }
                form.elements.codigoBarras.addEventListener('input', function () {
                    form.elements.codigoBarras.value = form.elements.codigoBarras.value.replace(/\D/g, '');
                });
            }
        });
    }

    /* Valida e grava. Retorna false para manter o modal aberto. */
    function salvar(form, id) {
        var dados = Nexo.ui.lerFormulario(form);
        var erros = {};
        var todos = Nexo.db.listar('produtos').filter(function (x) { return x.id !== id; });

        if (!dados.nome) erros.nome = 'Informe o nome do produto.';
        if (!dados.categoriaId) erros.categoriaId = 'Selecione a categoria.';
        if (!dados.marca) erros.marca = 'Informe a marca.';
        if (!dados.fornecedorId) erros.fornecedorId = 'Selecione o fornecedor.';

        if (!dados.sku) erros.sku = 'Informe o SKU.';
        else if (todos.some(function (x) { return String(x.sku).toUpperCase() === dados.sku.toUpperCase(); })) erros.sku = 'Já existe um produto com este SKU.';

        if (dados.codigoBarras) {
            if (!/^\d{8,14}$/.test(dados.codigoBarras)) erros.codigoBarras = 'Use de 8 a 14 dígitos.';
            else if (todos.some(function (x) { return x.codigoBarras === dados.codigoBarras; })) erros.codigoBarras = 'Já existe um produto com este código de barras.';
        }

        var preco = parseFloat(dados.preco), custo = parseFloat(dados.custo);
        if (dados.preco === '' || isNaN(preco) || preco < 0) erros.preco = 'Informe um preço válido (0 ou mais).';
        if (dados.custo === '' || isNaN(custo) || custo < 0) erros.custo = 'Informe um custo válido (0 ou mais).';
        var min = parseInt(dados.estoqueMinimo, 10);
        if (dados.estoqueMinimo === '' || isNaN(min) || min < 0) erros.estoqueMinimo = 'Informe um número inteiro (0 ou mais).';

        var inicial = 0;
        if (!id) {
            inicial = dados.estoqueInicial === '' ? 0 : parseInt(dados.estoqueInicial, 10);
            if (isNaN(inicial) || inicial < 0 || String(inicial) !== String(dados.estoqueInicial || 0)) erros.estoqueInicial = 'Informe um número inteiro (0 ou mais).';
        }

        if (!Nexo.ui.mostrarErros(form, erros)) return false;

        var campos = {
            nome: dados.nome, sku: dados.sku.toUpperCase(), codigoBarras: dados.codigoBarras, categoriaId: dados.categoriaId,
            marca: dados.marca, fornecedorId: dados.fornecedorId, volume: dados.volume, lote: dados.lote, validade: dados.validade,
            preco: preco, custo: custo, estoqueMinimo: min, status: dados.status, descricao: dados.descricao
        };

        if (id) {
            Nexo.db.atualizar('produtos', id, campos);
            Nexo.registrarAtividade('produto', 'Produto "' + campos.nome + '" atualizado', 'produtos.html?id=' + id);
            Nexo.ui.toast('Produto atualizado.');
        } else {
            campos.estoque = 0;
            var novo = Nexo.db.inserir('produtos', campos);
            if (inicial > 0) {
                var r = Nexo.ops.movimentarEstoque(novo.id, 'Entrada', inicial, 'Estoque inicial', 'Cadastro do produto');
                if (!r.ok) Nexo.ui.toast(r.erro, 'erro');
            }
            Nexo.registrarAtividade('produto', 'Produto "' + campos.nome + '" cadastrado', 'produtos.html?id=' + novo.id);
            Nexo.ui.toast('Produto cadastrado.');
            id = novo.id;
        }
        if (produtoAberto) abrirDetalhe(id, true);
        else atualizarLista();
        return true;
    }

    /* ------------------------------------------------------------------ */
    /* Gerenciar categorias                                                */
    /* ------------------------------------------------------------------ */
    function gerenciarCategorias() {
        function selectIcone(nome, atual) {
            return '<select name="' + nome + '" class="nexo-input !w-auto" aria-label="Ícone">' + ICONES.map(function (i) {
                return '<option value="' + i[0] + '"' + (i[0] === atual ? ' selected' : '') + '>' + i[1] + '</option>';
            }).join('') + '</select>';
        }
        function desenhar(corpo) {
            var cats = Nexo.db.listar('categorias');
            var produtos = Nexo.db.listar('produtos');
            corpo.innerHTML =
                '<div class="flex flex-col sm:flex-row gap-2 mb-5 p-3 bg-purple-50/50 rounded-xl">' +
                '<input class="nexo-input" id="cat-nova-nome" placeholder="Nome da nova categoria" maxlength="40" aria-label="Nome da nova categoria">' +
                selectIcone('cat-nova-icone', 'fa-tag') +
                '<button type="button" data-cat-acao="criar" class="nexo-btn nexo-btn-primario shrink-0"><i class="fa-solid fa-plus"></i> Criar</button></div>' +
                '<div class="space-y-2">' + cats.map(function (c) {
                    var qtd = produtos.filter(function (p) { return p.categoriaId === c.id; }).length;
                    return '<div class="flex flex-col sm:flex-row sm:items-center gap-2 p-2 border border-gray-100 rounded-xl" data-cat-id="' + esc(c.id) + '">' +
                        '<i class="fa-solid ' + esc(c.icone || 'fa-tag') + ' text-brand-purple w-6 text-center hidden sm:block"></i>' +
                        '<input class="nexo-input" data-campo="nome" value="' + esc(c.nome) + '" maxlength="40" aria-label="Nome da categoria">' +
                        selectIcone('icone', c.icone || 'fa-tag') +
                        '<span class="text-xs text-gray-500 whitespace-nowrap sm:w-24">' + qtd + (qtd === 1 ? ' produto' : ' produtos') + '</span>' +
                        '<div class="flex gap-1">' +
                        '<button type="button" data-cat-acao="salvar" class="nexo-btn nexo-btn-secundario !py-1.5" title="Salvar nome e ícone"><i class="fa-solid fa-check"></i></button>' +
                        '<button type="button" data-cat-acao="excluir" class="nexo-btn nexo-btn-secundario !py-1.5 !text-red-600" title="Excluir categoria"><i class="fa-solid fa-trash"></i></button></div></div>';
                }).join('') + '</div>';
        }

        function nomeDuplicado(nome, ignorarId) {
            return Nexo.db.listar('categorias').some(function (c) {
                return c.id !== ignorarId && semAcento(c.nome) === semAcento(nome);
            });
        }

        Nexo.ui.abrirModal({
            titulo: 'Gerenciar categorias',
            largura: 'max-w-2xl',
            html: '',
            botoes: [{ texto: 'Concluir', classe: 'nexo-btn-primario', acao: 'fechar' }],
            aoFechar: atualizarLista,
            aoAbrir: function (corpo) {
                desenhar(corpo);
                corpo.addEventListener('keydown', function (e) {
                    if (e.key === 'Enter' && e.target.id === 'cat-nova-nome') { e.preventDefault(); corpo.querySelector('[data-cat-acao="criar"]').click(); }
                });
                corpo.addEventListener('click', function (e) {
                    var btn = e.target.closest('[data-cat-acao]');
                    if (!btn) return;
                    var acao = btn.getAttribute('data-cat-acao');
                    var linha = btn.closest('[data-cat-id]');
                    var catId = linha ? linha.getAttribute('data-cat-id') : null;

                    if (acao === 'criar') {
                        var nome = corpo.querySelector('#cat-nova-nome').value.trim();
                        if (!nome) { Nexo.ui.toast('Informe o nome da categoria.', 'erro'); return; }
                        if (nomeDuplicado(nome)) { Nexo.ui.toast('Já existe uma categoria com este nome.', 'erro'); return; }
                        Nexo.db.inserir('categorias', { nome: nome, icone: corpo.querySelector('[name="cat-nova-icone"]').value });
                        Nexo.registrarAtividade('produto', 'Categoria "' + nome + '" criada', 'produtos.html');
                        Nexo.ui.toast('Categoria criada.');
                        desenhar(corpo);
                    } else if (acao === 'salvar') {
                        var novoNome = linha.querySelector('[data-campo="nome"]').value.trim();
                        if (!novoNome) { Nexo.ui.toast('O nome não pode ficar vazio.', 'erro'); return; }
                        if (nomeDuplicado(novoNome, catId)) { Nexo.ui.toast('Já existe uma categoria com este nome.', 'erro'); return; }
                        Nexo.db.atualizar('categorias', catId, { nome: novoNome, icone: linha.querySelector('[name="icone"]').value });
                        Nexo.registrarAtividade('produto', 'Categoria "' + novoNome + '" atualizada', 'produtos.html');
                        Nexo.ui.toast('Categoria atualizada.');
                        desenhar(corpo);
                    } else if (acao === 'excluir') {
                        var cat = Nexo.db.obter('categorias', catId);
                        var qtd = Nexo.db.listar('produtos').filter(function (p) { return p.categoriaId === catId; }).length;
                        if (qtd > 0) {
                            Nexo.ui.toast('Não é possível excluir "' + cat.nome + '": há ' + qtd + ' produto(s) nela. Mova-os para outra categoria antes.', 'erro');
                            return;
                        }
                        Nexo.ui.confirmar('Excluir categoria?', 'A categoria "' + cat.nome + '" será removida.', { textoOk: 'Excluir', perigo: true }).then(function (ok) {
                            if (!ok) return;
                            Nexo.db.remover('categorias', catId);
                            if (estado.categoria === catId) estado.categoria = '';
                            Nexo.registrarAtividade('produto', 'Categoria "' + cat.nome + '" excluída', 'produtos.html');
                            Nexo.ui.toast('Categoria excluída.');
                            desenhar(corpo);
                        });
                    }
                });
            }
        });
    }

    /* ------------------------------------------------------------------ */
    /* Eventos e inicio                                                    */
    /* ------------------------------------------------------------------ */
    function ligarFiltro(id, chave, evento) {
        $(id).addEventListener(evento || 'change', function () {
            estado[chave] = this.value;
            estado.pagina = 1;
            if (chave === 'categoria') renderCategorias();
            renderLista();
        });
    }
    ligarFiltro('busca', 'busca', 'input');
    ligarFiltro('filtro-categoria', 'categoria');
    ligarFiltro('filtro-marca', 'marca');
    ligarFiltro('filtro-fornecedor', 'fornecedor');
    ligarFiltro('filtro-status', 'status');
    ligarFiltro('filtro-estoque', 'estoque');
    ligarFiltro('ordenacao', 'ordem');

    $('btn-limpar').addEventListener('click', function () {
        estado.categoria = estado.busca = estado.marca = estado.fornecedor = estado.status = estado.estoque = '';
        estado.ordem = 'nome';
        estado.pagina = 1;
        atualizarLista();
    });
    $('modo-tabela').addEventListener('click', function () { estado.modo = 'tabela'; estado.pagina = 1; renderLista(); });
    $('modo-grade').addEventListener('click', function () { estado.modo = 'grade'; estado.pagina = 1; renderLista(); });
    $('btn-exportar').addEventListener('click', exportar);
    $('btn-categorias').addEventListener('click', gerenciarCategorias);
    $('btn-novo').addEventListener('click', function () { abrirFormulario(null); });

    /* clique nos cards de categoria */
    $('faixa-categorias').addEventListener('click', function (e) {
        var b = e.target.closest('[data-cat]');
        if (!b) return;
        estado.categoria = b.getAttribute('data-cat');
        estado.pagina = 1;
        $('filtro-categoria').value = estado.categoria;
        renderCategorias();
        renderLista();
    });

    /* acoes da lista e do detalhe (delegacao) */
    document.querySelector('main').addEventListener('click', function (e) {
        var alvo = e.target.closest('[data-acao]');
        if (!alvo || !document.querySelector('main').contains(alvo)) return;
        var acao = alvo.getAttribute('data-acao');
        var id = alvo.getAttribute('data-id');
        /* botao dentro de linha clicavel: o botao tem prioridade sobre a linha */
        if (acao === 'ver') {
            var interno = e.target.closest('button[data-acao]');
            if (interno && interno !== alvo) return;
            abrirDetalhe(id);
        } else if (acao === 'editar') abrirFormulario(id);
        else if (acao === 'alternar') alternarStatus(id);
        else if (acao === 'excluir') excluir(id);
        else if (acao === 'voltar') voltarLista();
    });

    /* botao Voltar/Avancar do navegador */
    window.addEventListener('popstate', function () {
        var id = Nexo.ui.parametro('id');
        if (id && Nexo.db.obter('produtos', id)) abrirDetalhe(id, true);
        else voltarLista(true);
    });

    /* abertura inicial: ?id= abre o detalhe direto */
    atualizarLista();
    var idInicial = Nexo.ui.parametro('id');
    if (idInicial) {
        if (Nexo.db.obter('produtos', idInicial)) abrirDetalhe(idInicial, true);
        else Nexo.ui.toast('Produto não encontrado.', 'aviso');
    }
})();
