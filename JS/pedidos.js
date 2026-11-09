/*
 * NEXO ERP - Tela de Pedidos
 * --------------------------------------------------------------
 * Lista, busca/filtros, detalhes, alteracao de status e criacao de pedidos.
 * Usa a base: Nexo.db, Nexo.ops, Nexo.fmt, Nexo.ui (nexo-data.js e nexo-layout.js).
 * Dados lidos do localStorage sempre passam por Nexo.esc() antes de ir para o HTML.
 */
(function () {
    'use strict';

    if (!Nexo.layout.montar('pedidos')) return;

    var esc = Nexo.esc;
    var fmt = Nexo.fmt;
    var ui = Nexo.ui;

    /* Proximo status permitido no fluxo normal */
    var PROXIMO_STATUS = { 'Novo': 'Em separação', 'Em separação': 'Enviado', 'Enviado': 'Entregue' };
    /* Status em que ainda e possivel cancelar */
    var PODE_CANCELAR = ['Novo', 'Em separação', 'Enviado'];
    var ICONE_STATUS = { 'Novo': 'fa-file-circle-plus', 'Em separação': 'fa-box-open', 'Enviado': 'fa-truck-fast', 'Entregue': 'fa-circle-check', 'Cancelado': 'fa-ban' };

    /* Estado da lista */
    var estado = { pagina: 1, statusAtivo: '' };

    var el = function (id) { return document.getElementById(id); };

    /* Configuracoes gerais (tela Configuracoes): venda sem estoque e frete gratis */
    function cfgGeral() { return Nexo.db.lerObjeto('configuracoes', {}).geral || {}; }
    function vendaSemEstoque() { return !!cfgGeral().permitirVendaSemEstoque; }

    /* ------------------------------------------------------------------ */
    /* Utilitarios locais                                                  */
    /* ------------------------------------------------------------------ */
    /* Remove acentos e poe em minusculo (busca tolerante) */
    function normalizar(t) {
        return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    }

    /* Data local (YYYY-MM-DD) de um ISO, para comparar com os filtros de periodo */
    function dataLocal(iso) {
        var d = new Date(iso);
        if (isNaN(d)) return '';
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function arredondar(v) { return Math.round((Number(v) || 0) * 100) / 100; }

    function totalDe(p) { return Number(p.total) || Nexo.consultas.totalPedido(p); }

    function qtdItens(p) {
        return (p.itens || []).reduce(function (s, it) { return s + (Number(it.quantidade) || 0); }, 0);
    }

    function statusPagamento(p) { return (p.pagamento && p.pagamento.status) || 'Pendente'; }

    function enderecoTexto(e) {
        if (!e) return '';
        return [e.logradouro, e.numero, e.complemento].filter(Boolean).join(', ') +
            (e.bairro ? ' - ' + e.bairro : '') +
            (e.cidade ? ', ' + e.cidade + (e.uf ? '/' + e.uf : '') : '') +
            (e.cep ? ' (CEP ' + e.cep + ')' : '');
    }

    /* ------------------------------------------------------------------ */
    /* Filtros e lista                                                     */
    /* ------------------------------------------------------------------ */
    function preencherSelects() {
        var pedidos = Nexo.db.listar('pedidos');
        var vendedores = [];
        pedidos.forEach(function (p) { if (p.vendedor && vendedores.indexOf(p.vendedor) === -1) vendedores.push(p.vendedor); });
        vendedores.sort();
        el('f-status').innerHTML = '<option value="">Todos</option>' +
            Nexo.consultas.STATUS_PEDIDO.map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('');
        el('f-forma').innerHTML = '<option value="">Todas</option>' +
            Nexo.consultas.FORMAS_PAGAMENTO.map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('');
        el('f-vendedor').innerHTML = '<option value="">Todos</option>' +
            vendedores.map(function (v) { return '<option>' + esc(v) + '</option>'; }).join('');
    }

    /* Le os filtros da tela */
    function lerFiltros() {
        return {
            busca: normalizar(el('f-busca').value),
            status: el('f-status').value,
            pgto: el('f-pgto-status').value,
            forma: el('f-forma').value,
            vendedor: el('f-vendedor').value,
            inicio: el('f-inicio').value,
            fim: el('f-fim').value,
            ordem: el('f-ordem').value
        };
    }

    /* Aplica os filtros. ignorarStatus: usado nos contadores por status */
    function filtrar(ignorarStatus) {
        var f = lerFiltros();
        var clientes = Nexo.consultas.mapa('clientes');
        var lista = Nexo.db.listar('pedidos').filter(function (p) {
            if (!ignorarStatus && f.status && p.status !== f.status) return false;
            if (f.pgto && statusPagamento(p) !== f.pgto) return false;
            if (f.forma && (p.pagamento || {}).forma !== f.forma) return false;
            if (f.vendedor && p.vendedor !== f.vendedor) return false;
            var d = dataLocal(p.data);
            if (f.inicio && d < f.inicio) return false;
            if (f.fim && d > f.fim) return false;
            if (f.busca) {
                var nomeCli = normalizar((clientes[p.clienteId] || {}).nome);
                var num = String(p.numero);
                var termo = f.busca.replace(/^#/, '');
                if (num.indexOf(termo) === -1 && nomeCli.indexOf(f.busca) === -1) return false;
            }
            return true;
        });
        lista.sort(function (a, b) {
            if (f.ordem === 'total-desc') return totalDe(b) - totalDe(a);
            if (f.ordem === 'total-asc') return totalDe(a) - totalDe(b);
            if (f.ordem === 'data-asc') return a.data < b.data ? -1 : 1;
            return a.data < b.data ? 1 : -1;
        });
        return lista;
    }

    function desenharCards(lista) {
        var validos = lista.filter(function (p) { return p.status !== 'Cancelado'; });
        var faturamento = validos.reduce(function (s, p) { return s + totalDe(p); }, 0);
        var ticket = validos.length ? faturamento / validos.length : 0;
        var aguardando = Nexo.db.listar('pedidos').filter(function (p) { return p.status === 'Novo'; }).length;
        function card(icone, cor, rotulo, valor, nota) {
            return '<div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 md:p-5">' +
                '<div class="flex items-center gap-3 mb-2"><div class="w-9 h-9 rounded-xl flex items-center justify-center ' + cor + '"><i class="fa-solid ' + icone + '"></i></div>' +
                '<span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">' + rotulo + '</span></div>' +
                '<p class="text-xl md:text-2xl font-extrabold text-gray-900 break-words">' + valor + '</p>' +
                '<p class="text-xs text-gray-400 mt-1">' + nota + '</p></div>';
        }
        el('cards-resumo').innerHTML =
            card('fa-cart-shopping', 'bg-purple-50 text-brand-purple', 'Pedidos', fmt.numero(lista.length), 'Conforme os filtros aplicados') +
            card('fa-sack-dollar', 'bg-emerald-50 text-emerald-600', 'Faturamento', fmt.moeda(faturamento), 'Sem pedidos cancelados') +
            card('fa-receipt', 'bg-blue-50 text-blue-600', 'Ticket médio', fmt.moeda(ticket), fmt.numero(validos.length) + ' pedidos válidos') +
            card('fa-box-open', 'bg-amber-50 text-amber-600', 'Aguardando separação', fmt.numero(aguardando), 'Pedidos com status Novo (geral)');
    }

    function desenharContadores() {
        var base = filtrar(true);
        var html = '';
        var contagem = {};
        base.forEach(function (p) { contagem[p.status] = (contagem[p.status] || 0) + 1; });
        var ativo = el('f-status').value;
        function botao(valor, rotulo, qtd, icone) {
            var sel = ativo === valor;
            return '<button type="button" data-status="' + esc(valor) + '" class="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition ' +
                (sel ? 'bg-brand-purple text-white border-brand-purple shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50') + '">' +
                '<i class="fa-solid ' + icone + '"></i>' + esc(rotulo) +
                '<span class="px-1.5 rounded-full text-xs ' + (sel ? 'bg-white/25' : 'bg-gray-100') + '">' + qtd + '</span></button>';
        }
        html += botao('', 'Todos', base.length, 'fa-layer-group');
        Nexo.consultas.STATUS_PEDIDO.forEach(function (s) { html += botao(s, s, contagem[s] || 0, ICONE_STATUS[s]); });
        el('contadores-status').innerHTML = html;
    }

    function desenharLista() {
        var lista = filtrar(false);
        desenharCards(lista);
        desenharContadores();
        var clientes = Nexo.consultas.mapa('clientes');
        var info = ui.paginar(lista, estado.pagina);
        estado.pagina = info.pagina;
        el('tbody-pedidos').innerHTML = info.itens.map(function (p) {
            var cli = clientes[p.clienteId] || {};
            return '<tr class="hover:bg-purple-50/40 cursor-pointer" data-abrir="' + esc(p.id) + '">' +
                '<td class="px-5 py-3 font-bold text-gray-900">#' + esc(p.numero) + '</td>' +
                '<td class="px-3 py-3 text-gray-600 whitespace-nowrap">' + fmt.data(p.data) + '</td>' +
                '<td class="px-3 py-3 text-gray-800 font-medium">' + esc(cli.nome || '(cliente removido)') + '</td>' +
                '<td class="px-3 py-3 text-gray-600">' + esc(p.vendedor || '-') + '</td>' +
                '<td class="px-3 py-3 text-right text-gray-600">' + fmt.numero(qtdItens(p)) + '</td>' +
                '<td class="px-3 py-3 text-right font-bold text-gray-900 whitespace-nowrap">' + fmt.moeda(totalDe(p)) + '</td>' +
                '<td class="px-3 py-3">' + ui.badgeStatus(statusPagamento(p)) + '</td>' +
                '<td class="px-3 py-3">' + ui.badgeStatus(p.status) + '</td>' +
                '<td class="px-3 py-3 text-right"><button type="button" class="text-brand-purple font-semibold text-xs hover:underline" data-abrir="' + esc(p.id) + '">Ver</button></td>' +
                '</tr>';
        }).join('');
        el('vazio-pedidos').classList.toggle('hidden', lista.length > 0);
        el('paginacao-pedidos').innerHTML = ui.htmlPaginacao(info, 'pedidosIrParaPagina');
    }

    /* Chamada pelos botoes da paginacao (precisa ser global) */
    window.pedidosIrParaPagina = function (n) {
        estado.pagina = n;
        desenharLista();
    };

    function aoFiltrar() {
        estado.pagina = 1;
        desenharLista();
    }

    function limparFiltros() {
        ['f-busca', 'f-status', 'f-pgto-status', 'f-forma', 'f-vendedor', 'f-inicio', 'f-fim'].forEach(function (id) { el(id).value = ''; });
        el('f-ordem').value = 'data-desc';
        aoFiltrar();
    }

    function exportarCSV() {
        var lista = filtrar(false);
        if (!lista.length) { ui.toast('Não há pedidos para exportar.', 'aviso'); return; }
        var clientes = Nexo.consultas.mapa('clientes');
        var linhas = lista.map(function (p) {
            var cli = clientes[p.clienteId] || {};
            return [p.numero, fmt.data(p.data), cli.nome || '', p.vendedor || '', qtdItens(p), arredondar(totalDe(p)),
                (p.pagamento || {}).forma || '', statusPagamento(p), p.status];
        });
        Nexo.exportarCSV('pedidos-' + fmt.hojeInput(),
            ['Pedido', 'Data', 'Cliente', 'Vendedor', 'Itens', 'Total', 'Forma de pagamento', 'Pagamento', 'Status'], linhas);
        ui.toast(linhas.length + ' pedidos exportados.');
    }

    /* ------------------------------------------------------------------ */
    /* Detalhes do pedido                                                  */
    /* ------------------------------------------------------------------ */
    function abrirDetalhe(id, atualizarUrl) {
        var p = Nexo.db.obter('pedidos', id);
        if (!p) {
            ui.toast('Pedido não encontrado.', 'erro');
            voltarParaLista();
            return;
        }
        if (atualizarUrl !== false) {
            try { history.replaceState(null, '', '?id=' + encodeURIComponent(id)); } catch (e) { /* ignora */ }
        }
        el('vista-lista').classList.add('hidden');
        el('vista-detalhe').classList.remove('hidden');
        desenharDetalhe(p);
        el('vista-detalhe').closest('main').scrollTop = 0;
    }

    function voltarParaLista() {
        try { history.replaceState(null, '', location.pathname); } catch (e) { /* ignora */ }
        el('vista-detalhe').classList.add('hidden');
        el('vista-detalhe').innerHTML = '';
        el('vista-lista').classList.remove('hidden');
        desenharLista();
    }

    function linhaInfo(rotulo, valorHtml) {
        return '<div class="flex flex-col sm:flex-row sm:gap-3 py-1.5"><dt class="text-xs font-semibold text-gray-500 uppercase tracking-wide sm:w-36 shrink-0 sm:pt-0.5">' + rotulo + '</dt>' +
            '<dd class="text-sm text-gray-800 min-w-0 break-words">' + (valorHtml || '<span class="text-gray-400">-</span>') + '</dd></div>';
    }

    function cartao(titulo, icone, conteudo) {
        return '<div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-6">' +
            '<h2 class="text-base font-bold text-gray-900 mb-3 flex items-center gap-2"><i class="fa-solid ' + icone + ' text-brand-purple"></i>' + titulo + '</h2>' +
            conteudo + '</div>';
    }

    function desenharDetalhe(p) {
        var cli = Nexo.db.obter('clientes', p.clienteId) || null;
        var rev = p.revendedorId ? Nexo.db.obter('revendedores', p.revendedorId) : null;
        var produtos = Nexo.consultas.mapa('produtos');
        var pag = p.pagamento || {};
        var ent = p.entrega || {};
        var subtotal = (p.itens || []).reduce(function (s, it) { return s + (Number(it.quantidade) || 0) * (Number(it.precoUnitario) || 0); }, 0);
        var desconto = Number(p.desconto) || 0;
        var frete = Number(p.frete) || 0;
        var final = (p.status === 'Cancelado' || p.status === 'Entregue');
        var podeEditarRastreio = !final;

        /* Cabecalho com acoes de status */
        var acoes = '';
        if (PROXIMO_STATUS[p.status]) {
            acoes += '<button type="button" data-avancar="' + esc(PROXIMO_STATUS[p.status]) + '" class="nexo-btn nexo-btn-primario"><i class="fa-solid ' + ICONE_STATUS[PROXIMO_STATUS[p.status]] + '"></i> Marcar como ' + esc(PROXIMO_STATUS[p.status]) + '</button>';
        }
        if (PODE_CANCELAR.indexOf(p.status) !== -1) {
            acoes += '<button type="button" data-cancelar class="nexo-btn nexo-btn-secundario text-red-600"><i class="fa-solid fa-ban"></i> Cancelar pedido</button>';
        }
        acoes += '<button type="button" data-imprimir class="nexo-btn nexo-btn-secundario"><i class="fa-solid fa-print"></i> Imprimir</button>';

        /* Cliente */
        var clienteHtml;
        if (cli) {
            clienteHtml = '<dl>' +
                linhaInfo('Nome', '<a class="text-brand-purple font-semibold hover:underline" href="clientes.html?id=' + encodeURIComponent(cli.id) + '">' + esc(cli.nome) + '</a>') +
                linhaInfo('Documento', esc(cli.documento)) +
                linhaInfo('E-mail', esc(cli.email)) +
                linhaInfo('Telefone', esc(cli.telefone)) +
                linhaInfo('Endereço', esc(enderecoTexto(cli.endereco))) +
                linhaInfo('Revendedor', rev ? '<a class="text-brand-purple font-semibold hover:underline" href="revendedores.html?id=' + encodeURIComponent(rev.id) + '">' + esc(rev.nome) + '</a> (' + fmt.porcentagem(rev.desconto, 0) + ' de desconto)' : '') +
                linhaInfo('Vendedor', esc(p.vendedor)) +
                '</dl>';
        } else {
            clienteHtml = '<p class="text-sm text-gray-500">O cliente deste pedido não existe mais no cadastro.</p>';
        }

        /* Produtos e valores */
        var linhasItens = (p.itens || []).map(function (it) {
            var existe = produtos[it.produtoId];
            var nome = existe ? '<a class="text-brand-purple font-semibold hover:underline" href="produtos.html?id=' + encodeURIComponent(it.produtoId) + '">' + esc(it.nome) + '</a>' : esc(it.nome);
            return '<tr><td class="py-2 pr-3">' + nome + '</td><td class="py-2 px-3 text-gray-500 whitespace-nowrap">' + esc(it.sku) + '</td>' +
                '<td class="py-2 px-3 text-right">' + fmt.numero(it.quantidade) + '</td>' +
                '<td class="py-2 px-3 text-right whitespace-nowrap">' + fmt.moeda(it.precoUnitario) + '</td>' +
                '<td class="py-2 pl-3 text-right font-semibold whitespace-nowrap">' + fmt.moeda(it.quantidade * it.precoUnitario) + '</td></tr>';
        }).join('');
        var produtosHtml =
            '<div class="overflow-x-auto"><table class="w-full text-sm min-w-[520px]"><thead class="text-xs uppercase text-gray-500 border-b border-gray-100"><tr>' +
            '<th class="text-left font-semibold py-2 pr-3">Produto</th><th class="text-left font-semibold py-2 px-3">SKU</th>' +
            '<th class="text-right font-semibold py-2 px-3">Qtd.</th><th class="text-right font-semibold py-2 px-3">Preço unit.</th>' +
            '<th class="text-right font-semibold py-2 pl-3">Subtotal</th></tr></thead><tbody class="divide-y divide-gray-50">' + linhasItens + '</tbody></table></div>' +
            '<div class="mt-4 ml-auto max-w-xs space-y-1 text-sm">' +
            '<div class="flex justify-between text-gray-600"><span>Subtotal</span><span>' + fmt.moeda(subtotal) + '</span></div>' +
            '<div class="flex justify-between text-gray-600"><span>Desconto</span><span>- ' + fmt.moeda(desconto) + '</span></div>' +
            '<div class="flex justify-between text-gray-600"><span>Frete</span><span>' + fmt.moeda(frete) + '</span></div>' +
            '<div class="flex justify-between text-base font-extrabold text-gray-900 border-t border-gray-100 pt-2 mt-2"><span>Total</span><span>' + fmt.moeda(totalDe(p)) + '</span></div></div>';

        /* Pagamento */
        var pagamentoHtml = '<dl>' +
            linhaInfo('Forma', esc(pag.forma)) +
            linhaInfo('Parcelas', pag.parcelas ? esc(pag.parcelas) + 'x de ' + fmt.moeda(totalDe(p) / pag.parcelas) : '') +
            linhaInfo('Situação', ui.badgeStatus(statusPagamento(p))) + '</dl>';
        if (statusPagamento(p) === 'Pendente' && p.status !== 'Cancelado') {
            pagamentoHtml += '<button type="button" data-pagar class="nexo-btn nexo-btn-primario mt-3 nao-imprimir"><i class="fa-solid fa-hand-holding-dollar"></i> Registrar pagamento</button>';
        }

        /* Entrega */
        var rastreioHtml = podeEditarRastreio
            ? '<form data-form-rastreio class="flex gap-2 nao-imprimir" onsubmit="return false"><input name="rastreio" class="nexo-input" maxlength="40" placeholder="Código de rastreio" value="' + esc(ent.codigoRastreio || '') + '">' +
              '<button type="button" data-salvar-rastreio class="nexo-btn nexo-btn-secundario shrink-0"><i class="fa-solid fa-floppy-disk"></i> Salvar</button></form>' +
              '<span class="hidden print:inline">' + esc(ent.codigoRastreio || '-') + '</span>'
            : esc(ent.codigoRastreio || '');
        var entregaHtml = '<dl>' +
            linhaInfo('Tipo', esc(ent.tipo)) +
            (ent.tipo === 'Retirada na loja' ? '' : linhaInfo('Transportadora', esc(ent.transportadora))) +
            linhaInfo('Endereço', esc(ent.endereco)) +
            linhaInfo('Rastreio', rastreioHtml) +
            linhaInfo('Previsão', ent.previsao ? fmt.data(ent.previsao) : '') +
            linhaInfo('Entregue em', ent.dataEntrega ? fmt.dataHora(ent.dataEntrega) : '') + '</dl>';

        /* Linha do tempo */
        var hist = (p.historico || []).slice().reverse();
        var historicoHtml = hist.length ? '<ol class="relative border-l-2 border-gray-100 ml-3 space-y-4">' + hist.map(function (h) {
            return '<li class="ml-5"><span class="absolute -left-[13px] w-6 h-6 rounded-full bg-purple-50 text-brand-purple flex items-center justify-center text-xs"><i class="fa-solid ' + (ICONE_STATUS[h.status] || 'fa-circle') + '"></i></span>' +
                '<div class="flex flex-wrap items-center gap-2">' + ui.badgeStatus(h.status) + '<span class="text-xs text-gray-500">' + fmt.dataHora(h.data) + ' por ' + esc(h.usuario || 'Sistema') + '</span></div>' +
                (h.observacao ? '<p class="text-sm text-gray-600 mt-1">' + esc(h.observacao) + '</p>' : '') + '</li>';
        }).join('') + '</ol>' : '<p class="text-sm text-gray-500">Sem histórico registrado.</p>';

        el('vista-detalhe').setAttribute('data-pedido', p.id);
        el('vista-detalhe').innerHTML =
            '<button type="button" data-voltar class="text-sm font-semibold text-gray-500 hover:text-brand-purple mb-3 nao-imprimir"><i class="fa-solid fa-arrow-left mr-1"></i> Voltar para a lista</button>' +
            '<header class="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">' +
            '<div><div class="flex flex-wrap items-center gap-3"><h1 class="text-2xl md:text-3xl font-extrabold text-gray-900">Pedido #' + esc(p.numero) + '</h1>' + ui.badgeStatus(p.status) + ui.badgeStatus(statusPagamento(p)) + '</div>' +
            '<p class="text-brand-textMuted mt-1">Realizado em ' + fmt.dataHora(p.data) + (final && p.status === 'Entregue' ? ' (pedido concluído, sem novas alterações)' : '') + (p.status === 'Cancelado' ? ' (pedido cancelado, sem novas alterações)' : '') + '</p></div>' +
            '<div class="flex flex-wrap gap-2 nao-imprimir">' + acoes + '</div></header>' +
            '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">' +
            cartao('Informações do cliente', 'fa-user', clienteHtml) +
            '<div class="space-y-4 md:space-y-6">' + cartao('Pagamento', 'fa-credit-card', pagamentoHtml) + cartao('Entrega', 'fa-truck', entregaHtml) + '</div>' +
            '<div class="lg:col-span-2">' + cartao('Produtos e valores', 'fa-bottle-droplet', produtosHtml) + '</div>' +
            cartao('Histórico de status', 'fa-clock-rotate-left', historicoHtml) +
            cartao('Observações', 'fa-note-sticky', p.observacoes ? '<p class="text-sm text-gray-700 whitespace-pre-line">' + esc(p.observacoes) + '</p>' : '<p class="text-sm text-gray-500">Nenhuma observação.</p>') +
            '</div>';
    }

    /* Avanca o pedido para o proximo status do fluxo */
    function avancarStatus(id, novo) {
        ui.confirmar('Alterar status', 'Marcar o pedido como "' + novo + '"?', { textoOk: 'Confirmar' }).then(function (ok) {
            if (!ok) return;
            var r = Nexo.ops.alterarStatusPedido(id, novo, '');
            if (!r.ok) { ui.toast(r.erro, 'erro'); return; }
            ui.toast('Pedido atualizado para "' + novo + '".');
            abrirDetalhe(id, false);
        });
    }

    /* Cancelamento com motivo obrigatorio */
    function cancelarPedido(id) {
        var p = Nexo.db.obter('pedidos', id);
        if (!p) return;
        ui.abrirModal({
            titulo: 'Cancelar pedido #' + p.numero,
            largura: 'max-w-md',
            html: '<form autocomplete="off"><p class="text-sm text-gray-600 mb-3">Os produtos voltam ao estoque e a receita do pedido é cancelada. Esta ação não pode ser desfeita.</p>' +
                '<label class="nexo-label" for="cancel-motivo">Motivo do cancelamento *</label>' +
                '<textarea id="cancel-motivo" name="motivo" rows="3" maxlength="300" class="nexo-input" placeholder="Ex.: cliente desistiu da compra"></textarea></form>',
            botoes: [
                { texto: 'Voltar', classe: 'nexo-btn-secundario', acao: 'fechar' },
                {
                    texto: 'Cancelar pedido', classe: 'nexo-btn-perigo', icone: 'fa-ban', acao: function (modal, corpo) {
                        var form = corpo.querySelector('form');
                        var motivo = form.motivo.value.trim();
                        if (!ui.mostrarErros(form, motivo.length < 3 ? { motivo: 'Informe o motivo do cancelamento.' } : {})) return false;
                        var r = Nexo.ops.alterarStatusPedido(id, 'Cancelado', 'Motivo: ' + motivo);
                        if (!r.ok) { ui.toast(r.erro, 'erro'); return false; }
                        ui.toast('Pedido cancelado.');
                        abrirDetalhe(id, false);
                    }
                }
            ]
        });
    }

    function registrarPagamento(id) {
        ui.confirmar('Registrar pagamento', 'Confirmar o recebimento deste pedido?', { textoOk: 'Registrar' }).then(function (ok) {
            if (!ok) return;
            var r = Nexo.ops.registrarPagamentoPedido(id);
            if (!r.ok) { ui.toast(r.erro, 'erro'); return; }
            ui.toast('Pagamento registrado.');
            abrirDetalhe(id, false);
        });
    }

    function salvarRastreio(id) {
        var p = Nexo.db.obter('pedidos', id);
        if (!p) return;
        var campo = el('vista-detalhe').querySelector('[name="rastreio"]');
        var codigo = campo.value.trim().toUpperCase();
        if (codigo && !/^[A-Z0-9\-\.]{4,40}$/.test(codigo)) {
            ui.mostrarErros(campo.form, { rastreio: 'Use apenas letras, números, ponto e hífen (mínimo 4 caracteres).' });
            return;
        }
        ui.mostrarErros(campo.form, {});
        Nexo.db.atualizar('pedidos', id, { entrega: Object.assign({}, p.entrega, { codigoRastreio: codigo }) });
        Nexo.registrarAtividade('pedido', 'Rastreio do pedido #' + p.numero + (codigo ? ' atualizado' : ' removido'), 'pedidos.html?id=' + p.id);
        ui.toast('Código de rastreio salvo.');
        abrirDetalhe(id, false);
    }

    /* ------------------------------------------------------------------ */
    /* Novo pedido                                                         */
    /* ------------------------------------------------------------------ */
    function novoPedido() {
        var clientes = Nexo.db.listar('clientes').filter(function (c) { return c.status === 'Ativo'; });
        var revendedores = Nexo.db.listar('revendedores').filter(function (r) { return r.status === 'Ativo'; });
        var produtos = Nexo.db.listar('produtos').filter(function (p) { return p.status === 'Ativo'; });
        var usuarioAtual = Nexo.auth.usuarioAtual();
        var vendedores = Nexo.db.listar('usuarios').filter(function (u) { return u.ativo && u.perfil === 'Vendedor'; }).map(function (u) { return u.nome; });
        if (usuarioAtual && vendedores.indexOf(usuarioAtual.nome) === -1) vendedores.unshift(usuarioAtual.nome);
        var cfg = Nexo.db.lerObjeto('configuracoes', {}).geral || {};
        var prazo = Number(cfg.prazoEntregaPadrao) || 5;
        var previsaoPadrao = Nexo.consultas.diasAtras(-prazo);

        var mapaProdutos = {};
        produtos.forEach(function (p) { mapaProdutos[p.id] = p; });
        var mapaRev = {};
        revendedores.forEach(function (r) { mapaRev[r.id] = r; });

        /* texto do datalist -> cliente */
        function rotuloCliente(c) { return c.nome + ' (' + c.documento + ')'; }
        var porRotulo = {};
        clientes.forEach(function (c) { porRotulo[rotuloCliente(c)] = c; });

        var optsProduto = '<option value="">Selecione o produto</option>' + produtos.map(function (p) {
            var est = Number(p.estoque) || 0;
            return '<option value="' + esc(p.id) + '"' + (est <= 0 && !vendaSemEstoque() ? ' disabled' : '') + '>' + esc(p.nome + ' - ' + p.sku + ' (estoque: ' + est + ')') + '</option>';
        }).join('');

        var html =
            '<form id="form-novo" autocomplete="off" novalidate>' +
            '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
            '<div class="sm:col-span-2"><label class="nexo-label" for="n-cliente">Cliente *</label>' +
            '<input id="n-cliente" name="cliente" list="n-lista-clientes" class="nexo-input" placeholder="Digite para buscar o cliente">' +
            '<datalist id="n-lista-clientes">' + clientes.map(function (c) { return '<option value="' + esc(rotuloCliente(c)) + '"></option>'; }).join('') + '</datalist></div>' +
            '<div><label class="nexo-label" for="n-revendedor">Revendedor</label><select id="n-revendedor" name="revendedor" class="nexo-input"><option value="">Sem revendedor</option>' +
            revendedores.map(function (r) { return '<option value="' + esc(r.id) + '">' + esc(r.nome + ' (' + r.desconto + '% de desconto)') + '</option>'; }).join('') + '</select></div>' +
            '<div><label class="nexo-label" for="n-vendedor">Vendedor *</label><select id="n-vendedor" name="vendedor" class="nexo-input">' +
            vendedores.map(function (v) { return '<option' + (usuarioAtual && usuarioAtual.nome === v ? ' selected' : '') + '>' + esc(v) + '</option>'; }).join('') + '</select></div>' +
            '</div>' +

            '<h3 class="text-sm font-bold text-gray-900 mt-5 mb-2">Itens do pedido</h3>' +
            '<div id="n-itens" class="space-y-3"></div>' +
            '<p id="n-erro-itens" class="text-xs text-red-600 mt-1 hidden"></p>' +
            '<button type="button" id="n-add-item" class="nexo-btn nexo-btn-secundario mt-3"><i class="fa-solid fa-plus"></i> Adicionar item</button>' +

            '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">' +
            '<div><label class="nexo-label" for="n-desconto">Desconto (R$)</label><input id="n-desconto" name="desconto" type="number" min="0" step="0.01" value="0" class="nexo-input"></div>' +
            '<div><label class="nexo-label" for="n-frete">Frete (R$)</label><input id="n-frete" name="frete" type="number" min="0" step="0.01" value="0" class="nexo-input"></div>' +
            '</div>' +

            '<h3 class="text-sm font-bold text-gray-900 mt-5 mb-2">Pagamento</h3>' +
            '<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">' +
            '<div><label class="nexo-label" for="n-forma">Forma *</label><select id="n-forma" name="forma" class="nexo-input">' +
            Nexo.consultas.FORMAS_PAGAMENTO.map(function (f) { return '<option>' + esc(f) + '</option>'; }).join('') + '</select></div>' +
            '<div><label class="nexo-label" for="n-parcelas">Parcelas</label><select id="n-parcelas" name="parcelas" class="nexo-input" disabled>' +
            [1, 2, 3, 4, 5, 6, 10, 12].map(function (n) { return '<option value="' + n + '">' + n + 'x</option>'; }).join('') + '</select></div>' +
            '<div><label class="nexo-label" for="n-venc">Vencimento</label><input id="n-venc" name="vencimento" type="date" value="' + fmt.hojeInput() + '" class="nexo-input"></div>' +
            '<label class="sm:col-span-3 flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" name="pago" class="w-4 h-4 accent-purple-600"> Pedido já foi pago</label>' +
            '</div>' +

            '<h3 class="text-sm font-bold text-gray-900 mt-5 mb-2">Entrega</h3>' +
            '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
            '<div><label class="nexo-label" for="n-tipo">Tipo *</label><select id="n-tipo" name="tipoEntrega" class="nexo-input"><option>Transportadora</option><option>Retirada na loja</option></select></div>' +
            '<div id="n-box-transp"><label class="nexo-label" for="n-transp">Transportadora</label><select id="n-transp" name="transportadora" class="nexo-input">' +
            ['Correios SEDEX', 'Jadlog', 'Loggi', 'Entrega própria'].map(function (t) { return '<option>' + esc(t) + '</option>'; }).join('') + '</select></div>' +
            '<div class="sm:col-span-2" id="n-box-end"><label class="nexo-label" for="n-endereco">Endereço de entrega</label><input id="n-endereco" name="endereco" class="nexo-input" maxlength="200" placeholder="Rua, número, bairro, cidade/UF"></div>' +
            '<div><label class="nexo-label" for="n-previsao">Previsão de entrega</label><input id="n-previsao" name="previsao" type="date" value="' + previsaoPadrao + '" class="nexo-input"></div>' +
            '</div>' +

            '<div class="mt-5"><label class="nexo-label" for="n-obs">Observações</label><textarea id="n-obs" name="observacoes" rows="2" maxlength="500" class="nexo-input"></textarea></div>' +

            '<div class="mt-5 bg-purple-50 rounded-xl p-4 text-sm space-y-1">' +
            '<div class="flex justify-between text-gray-600"><span>Subtotal</span><span id="n-subtotal">R$ 0,00</span></div>' +
            '<div class="flex justify-between text-gray-600"><span>Desconto</span><span id="n-t-desc">- R$ 0,00</span></div>' +
            '<div class="flex justify-between text-gray-600"><span>Frete</span><span id="n-t-frete">R$ 0,00</span></div>' +
            '<div class="flex justify-between text-lg font-extrabold text-brand-purple pt-1"><span>Total</span><span id="n-total">R$ 0,00</span></div></div>' +
            '</form>';

        ui.abrirModal({
            titulo: 'Novo pedido',
            largura: 'max-w-3xl',
            html: html,
            aoAbrir: function (corpo) { iniciarFormulario(corpo); },
            botoes: [
                { texto: 'Cancelar', classe: 'nexo-btn-secundario', acao: 'fechar' },
                { texto: 'Salvar pedido', classe: 'nexo-btn-primario', icone: 'fa-floppy-disk', acao: function (modal, corpo) { return salvarNovo(corpo, porRotulo, mapaProdutos); } }
            ]
        });

        /* Liga os eventos e as regras dinamicas do formulario */
        function iniciarFormulario(corpo) {
            var form = corpo.querySelector('#form-novo');
            var itens = corpo.querySelector('#n-itens');
            var endManual = false;

            function descontoRevendedor() {
                var r = mapaRev[form.revendedor.value];
                return r ? Number(r.desconto) || 0 : 0;
            }
            function precoSugerido(prod) {
                return arredondar(prod.preco * (1 - descontoRevendedor() / 100));
            }

            function calcular() {
                var sub = 0;
                itens.querySelectorAll('[data-linha]').forEach(function (l) {
                    var q = Number(l.querySelector('[name="qtd"]').value) || 0;
                    var pr = Number(l.querySelector('[name="preco"]').value) || 0;
                    var s = q * pr;
                    sub += s;
                    l.querySelector('[data-subtotal]').textContent = fmt.moeda(s);
                });
                var desc = Math.max(0, Number(form.desconto.value) || 0);
                /* frete gratis acima do valor definido em Configuracoes > Gerais */
                var limiteFrete = Number(cfgGeral().freteGratisAcima) || 0;
                var freteGratis = limiteFrete > 0 && sub >= limiteFrete;
                if (freteGratis && Number(form.frete.value) !== 0) form.frete.value = '0';
                var frete = Math.max(0, Number(form.frete.value) || 0);
                corpo.querySelector('#n-subtotal').textContent = fmt.moeda(sub);
                corpo.querySelector('#n-t-desc').textContent = '- ' + fmt.moeda(desc);
                corpo.querySelector('#n-t-frete').textContent = freteGratis ? 'Grátis (acima de ' + fmt.moeda(limiteFrete) + ')' : fmt.moeda(frete);
                corpo.querySelector('#n-total').textContent = fmt.moeda(Math.max(0, sub - desc + frete));
            }

            function adicionarLinha() {
                var l = document.createElement('div');
                l.setAttribute('data-linha', '');
                l.className = 'bg-gray-50 rounded-xl p-3';
                l.innerHTML =
                    '<div class="grid grid-cols-12 gap-2 items-end">' +
                    '<div class="col-span-12 sm:col-span-5"><label class="nexo-label">Produto</label><select name="produto" class="nexo-input">' + optsProduto + '</select></div>' +
                    '<div class="col-span-4 sm:col-span-2"><label class="nexo-label">Qtd.</label><input name="qtd" type="number" min="1" step="1" value="1" class="nexo-input"></div>' +
                    '<div class="col-span-8 sm:col-span-2"><label class="nexo-label">Preço unit. (R$)</label><input name="preco" type="number" min="0" step="0.01" value="0" class="nexo-input"></div>' +
                    '<div class="col-span-9 sm:col-span-2"><label class="nexo-label">Subtotal</label><p data-subtotal class="text-sm font-bold text-gray-800 py-2">R$ 0,00</p></div>' +
                    '<div class="col-span-3 sm:col-span-1 text-right"><button type="button" data-remover class="w-9 h-9 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50" aria-label="Remover item"><i class="fa-solid fa-trash"></i></button></div>' +
                    '</div><p data-info class="text-xs text-gray-500 mt-1"></p>';
                itens.appendChild(l);
                calcular();
            }

            /* Atualiza dica de estoque e limita a quantidade */
            function atualizarInfoLinha(l) {
                var prod = mapaProdutos[l.querySelector('[name="produto"]').value];
                var q = l.querySelector('[name="qtd"]');
                var info = l.querySelector('[data-info]');
                if (!prod) { info.textContent = ''; q.removeAttribute('max'); return; }
                var est = Number(prod.estoque) || 0;
                if (vendaSemEstoque()) q.removeAttribute('max'); else q.max = est;
                var usado = 0;
                itens.querySelectorAll('[data-linha]').forEach(function (o) {
                    if (o !== l && o.querySelector('[name="produto"]').value === prod.id) usado += Number(o.querySelector('[name="qtd"]').value) || 0;
                });
                info.textContent = 'Estoque disponível: ' + est + ' un.' + (usado ? ' (' + usado + ' já em outro item)' : '') +
                    ' | Preço de tabela: ' + fmt.moeda(prod.preco);
                info.className = 'text-xs mt-1 ' + ((Number(q.value) || 0) + usado > est && !vendaSemEstoque() ? 'text-red-600 font-semibold' : 'text-gray-500');
            }

            itens.addEventListener('change', function (e) {
                var l = e.target.closest('[data-linha]');
                if (!l) return;
                if (e.target.name === 'produto') {
                    var prod = mapaProdutos[e.target.value];
                    var preco = l.querySelector('[name="preco"]');
                    preco.removeAttribute('data-manual');
                    preco.value = prod ? precoSugerido(prod) : 0;
                    var q = l.querySelector('[name="qtd"]');
                    if (prod && !vendaSemEstoque() && (Number(q.value) || 0) > (Number(prod.estoque) || 0)) q.value = Math.max(1, Number(prod.estoque) || 1);
                }
                itens.querySelectorAll('[data-linha]').forEach(atualizarInfoLinha);
                calcular();
            });
            itens.addEventListener('input', function (e) {
                var l = e.target.closest('[data-linha]');
                if (!l) return;
                if (e.target.name === 'preco') e.target.setAttribute('data-manual', '1');
                itens.querySelectorAll('[data-linha]').forEach(atualizarInfoLinha);
                calcular();
            });
            itens.addEventListener('click', function (e) {
                var b = e.target.closest('[data-remover]');
                if (!b) return;
                if (itens.querySelectorAll('[data-linha]').length === 1) { ui.toast('O pedido precisa de pelo menos um item.', 'aviso'); return; }
                b.closest('[data-linha]').remove();
                itens.querySelectorAll('[data-linha]').forEach(atualizarInfoLinha);
                calcular();
            });
            corpo.querySelector('#n-add-item').addEventListener('click', adicionarLinha);
            form.desconto.addEventListener('input', calcular);
            form.frete.addEventListener('input', calcular);

            /* Cliente escolhido: preenche revendedor e endereco */
            function aoEscolherCliente() {
                var c = porRotulo[form.cliente.value];
                if (!c) return;
                form.revendedor.value = c.revendedorId && mapaRev[c.revendedorId] ? c.revendedorId : '';
                if (!endManual) form.endereco.value = enderecoTexto(c.endereco).replace(/ \(CEP [^)]*\)$/, '');
                aplicarRevendedor();
            }
            /* Reaplica o desconto do revendedor nos precos que nao foram editados a mao */
            function aplicarRevendedor() {
                itens.querySelectorAll('[data-linha]').forEach(function (l) {
                    var prod = mapaProdutos[l.querySelector('[name="produto"]').value];
                    var preco = l.querySelector('[name="preco"]');
                    if (prod && !preco.hasAttribute('data-manual')) preco.value = precoSugerido(prod);
                });
                calcular();
            }
            form.cliente.addEventListener('input', aoEscolherCliente);
            form.cliente.addEventListener('change', aoEscolherCliente);
            form.revendedor.addEventListener('change', aplicarRevendedor);
            form.endereco.addEventListener('input', function () { endManual = true; });

            /* Parcelas so para cartao de credito */
            form.forma.addEventListener('change', function () {
                var credito = form.forma.value === 'Cartão de crédito';
                form.parcelas.disabled = !credito;
                if (!credito) form.parcelas.value = '1';
            });
            /* Retirada na loja nao precisa de transportadora/endereco */
            form.tipoEntrega.addEventListener('change', function () {
                var retirada = form.tipoEntrega.value === 'Retirada na loja';
                corpo.querySelector('#n-box-transp').classList.toggle('hidden', retirada);
                corpo.querySelector('#n-box-end').classList.toggle('hidden', retirada);
            });

            adicionarLinha();
        }
    }

    /* Valida e grava o novo pedido. Retorna false para manter o modal aberto. */
    function salvarNovo(corpo, porRotulo, mapaProdutos) {
        var form = corpo.querySelector('#form-novo');
        var erros = {};
        var cliente = porRotulo[form.cliente.value.trim()];
        if (!cliente) erros.cliente = 'Selecione um cliente da lista.';
        if (!form.vendedor.value) erros.vendedor = 'Selecione o vendedor.';

        /* itens */
        var itens = [];
        var porProduto = {};
        var erroItens = '';
        corpo.querySelectorAll('[data-linha]').forEach(function (l, i) {
            var pid = l.querySelector('[name="produto"]').value;
            var q = Number(l.querySelector('[name="qtd"]').value);
            var pr = Number(l.querySelector('[name="preco"]').value);
            if (!erroItens) {
                if (!pid) erroItens = 'Item ' + (i + 1) + ': selecione o produto.';
                else if (!(q > 0) || Math.floor(q) !== q) erroItens = 'Item ' + (i + 1) + ': informe uma quantidade inteira maior que zero.';
                else if (isNaN(pr) || pr < 0) erroItens = 'Item ' + (i + 1) + ': preço inválido.';
            }
            if (pid) porProduto[pid] = (porProduto[pid] || 0) + q;
            itens.push({ produtoId: pid, quantidade: q, precoUnitario: pr });
        });
        if (!erroItens) {
            Object.keys(porProduto).forEach(function (pid) {
                var prod = mapaProdutos[pid];
                if (!erroItens && prod && !vendaSemEstoque() && porProduto[pid] > (Number(prod.estoque) || 0)) {
                    erroItens = 'Estoque insuficiente de "' + prod.nome + '" (disponível: ' + (prod.estoque || 0) + ').';
                }
            });
        }
        var boxErro = corpo.querySelector('#n-erro-itens');
        boxErro.textContent = erroItens;
        boxErro.classList.toggle('hidden', !erroItens);

        var subtotal = itens.reduce(function (s, x) { return s + x.quantidade * x.precoUnitario; }, 0);
        var desconto = Number(form.desconto.value);
        var frete = Number(form.frete.value);
        if (form.desconto.value === '' || isNaN(desconto) || desconto < 0) erros.desconto = 'Informe um valor maior ou igual a zero.';
        else if (desconto > subtotal) erros.desconto = 'O desconto não pode ser maior que o subtotal.';
        if (form.frete.value === '' || isNaN(frete) || frete < 0) erros.frete = 'Informe um valor maior ou igual a zero.';
        if (!form.vencimento.value) erros.vencimento = 'Informe o vencimento.';
        var retirada = form.tipoEntrega.value === 'Retirada na loja';
        if (!retirada && !form.endereco.value.trim()) erros.endereco = 'Informe o endereço de entrega.';

        var ok = ui.mostrarErros(form, erros);
        if (!ok || erroItens) return false;

        var r = Nexo.ops.criarPedido({
            clienteId: cliente.id,
            revendedorId: form.revendedor.value || null,
            vendedor: form.vendedor.value,
            itens: itens,
            desconto: desconto,
            frete: frete,
            pagamento: {
                forma: form.forma.value,
                parcelas: form.forma.value === 'Cartão de crédito' ? Number(form.parcelas.value) : 1,
                vencimento: form.vencimento.value,
                pago: form.pago.checked
            },
            entrega: {
                tipo: form.tipoEntrega.value,
                transportadora: retirada ? '' : form.transportadora.value,
                endereco: retirada ? '' : form.endereco.value.trim(),
                codigoRastreio: '',
                previsao: form.previsao.value || ''
            },
            observacoes: form.observacoes.value.trim()
        });
        if (!r.ok) {
            boxErro.textContent = r.erro;
            boxErro.classList.remove('hidden');
            ui.toast(r.erro, 'erro');
            return false;
        }
        ui.toast('Pedido #' + r.pedido.numero + ' criado com sucesso.');
        preencherSelects();
        estado.pagina = 1;
        abrirDetalhe(r.pedido.id);
        return true;
    }

    /* ------------------------------------------------------------------ */
    /* Inicio                                                              */
    /* ------------------------------------------------------------------ */
    function iniciar() {
        preencherSelects();

        /* eventos de filtro */
        ['f-busca', 'f-inicio', 'f-fim'].forEach(function (id) { el(id).addEventListener('input', aoFiltrar); });
        ['f-status', 'f-pgto-status', 'f-forma', 'f-vendedor', 'f-ordem'].forEach(function (id) { el(id).addEventListener('change', aoFiltrar); });
        el('btn-limpar').addEventListener('click', limparFiltros);
        el('btn-exportar').addEventListener('click', exportarCSV);
        el('btn-novo').addEventListener('click', novoPedido);

        /* contadores de status filtram a lista */
        el('contadores-status').addEventListener('click', function (e) {
            var b = e.target.closest('[data-status]');
            if (!b) return;
            el('f-status').value = b.getAttribute('data-status');
            aoFiltrar();
        });

        /* abrir detalhe ao clicar na linha */
        el('tbody-pedidos').addEventListener('click', function (e) {
            var alvo = e.target.closest('[data-abrir]');
            if (alvo) abrirDetalhe(alvo.getAttribute('data-abrir'));
        });

        /* acoes da tela de detalhe */
        el('vista-detalhe').addEventListener('click', function (e) {
            var id = el('vista-detalhe').getAttribute('data-pedido');
            var b = e.target.closest('button');
            if (!b) return;
            if (b.hasAttribute('data-voltar')) voltarParaLista();
            else if (b.hasAttribute('data-imprimir')) window.print();
            else if (b.hasAttribute('data-avancar')) avancarStatus(id, b.getAttribute('data-avancar'));
            else if (b.hasAttribute('data-cancelar')) cancelarPedido(id);
            else if (b.hasAttribute('data-pagar')) registrarPagamento(id);
            else if (b.hasAttribute('data-salvar-rastreio')) salvarRastreio(id);
        });

        var idUrl = ui.parametro('id');
        if (idUrl) abrirDetalhe(idUrl, false);
        else desenharLista();
    }

    iniciar();
})();
