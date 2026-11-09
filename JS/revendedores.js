/*
 * NEXO ERP - Tela de Revendedores
 * --------------------------------------------------------------
 * Lista com busca/filtros, cadastro e edição em modal, exclusão protegida
 * e visão de detalhes (revendedores.html?id=<id>) com crédito, clientes
 * vinculados e histórico de compras (pedidos com revendedorId).
 */
(function () {
    'use strict';

    if (!Nexo.layout.montar('revendedores')) return;

    var esc = Nexo.esc;
    var fmt = Nexo.fmt;

    var UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
    var CONDICOES = ['À vista', '28 dias', '30 dias', '30/60 dias', '30/60/90 dias'];

    var estado = { pagina: 1, pagHist: 1, detalheId: null, grafico: null };

    function $(id) { return document.getElementById(id); }

    /* ------------------------------------------------------------------ */
    /* Cálculos                                                            */
    /* ------------------------------------------------------------------ */
    /* Pedidos válidos (não cancelados) de um revendedor */
    function pedidosValidos(revId) {
        return Nexo.db.listar('pedidos').filter(function (p) { return p.revendedorId === revId && p.status !== 'Cancelado'; });
    }

    /* Resumo de um revendedor: total comprado, crédito usado, comissão, clientes */
    function resumo(r) {
        var pedidos = pedidosValidos(r.id);
        var total = 0, credito = 0;
        pedidos.forEach(function (p) {
            total += Number(p.total) || 0;
            if (p.pagamento && p.pagamento.status === 'Pendente') credito += Number(p.total) || 0;
        });
        var clientes = Nexo.db.listar('clientes').filter(function (c) { return c.revendedorId === r.id; });
        return {
            pedidos: pedidos,
            total: total,
            ticket: pedidos.length ? total / pedidos.length : 0,
            credito: credito,
            comissao: total * (Number(r.comissao) || 0) / 100,
            clientes: clientes
        };
    }

    function linkCliente(c) {
        return '<a href="clientes.html?id=' + encodeURIComponent(c.id) + '" class="font-semibold text-gray-900 hover:text-brand-purple">' + esc(c.nome) + '</a>';
    }

    function vazio(colunas, texto, icone) {
        return '<tr><td colspan="' + colunas + '" class="px-4 py-12 text-center text-gray-500">' +
            '<i class="fa-solid ' + (icone || 'fa-handshake') + ' text-3xl text-gray-300 mb-3 block"></i>' + esc(texto) + '</td></tr>';
    }

    /* ------------------------------------------------------------------ */
    /* Cards da lista                                                      */
    /* ------------------------------------------------------------------ */
    function desenharCards() {
        var revs = Nexo.db.listar('revendedores');
        var mapa = {};
        revs.forEach(function (r) { mapa[r.id] = r; });
        var mes = fmt.hojeInput().slice(0, 7);
        var faturamento = 0, comissao = 0;
        Nexo.db.listar('pedidos').forEach(function (p) {
            if (!p.revendedorId || p.status === 'Cancelado' || fmt.dataInput(p.data).slice(0, 7) !== mes) return;
            var total = Number(p.total) || 0;
            faturamento += total;
            comissao += total * ((mapa[p.revendedorId] || {}).comissao || 0) / 100;
        });
        var vinculados = Nexo.db.listar('clientes').filter(function (c) { return c.revendedorId && mapa[c.revendedorId]; }).length;
        var ativos = revs.filter(function (r) { return r.status === 'Ativo'; }).length;
        var cards = [
            ['Revendedores ativos', fmt.numero(ativos), 'fa-handshake', 'bg-purple-50 text-brand-purple'],
            ['Faturamento via revendedores (mês)', fmt.moeda(faturamento), 'fa-sack-dollar', 'bg-emerald-50 text-emerald-600'],
            ['Comissão a pagar (mês)', fmt.moeda(comissao), 'fa-percent', 'bg-amber-50 text-amber-600'],
            ['Clientes vinculados', fmt.numero(vinculados), 'fa-users', 'bg-blue-50 text-blue-600']
        ];
        $('cards').innerHTML = cards.map(function (c) {
            return '<div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">' +
                '<div class="w-9 h-9 rounded-xl flex items-center justify-center mb-3 ' + c[3] + '"><i class="fa-solid ' + c[2] + '"></i></div>' +
                '<p class="text-xs font-medium text-brand-textMuted">' + c[0] + '</p>' +
                '<p class="text-lg md:text-xl font-extrabold text-gray-900 mt-0.5 break-words">' + c[1] + '</p></div>';
        }).join('');
    }

    /* ------------------------------------------------------------------ */
    /* Lista                                                               */
    /* ------------------------------------------------------------------ */
    function preencherUF() {
        var usadas = {};
        Nexo.db.listar('revendedores').forEach(function (r) { if (r.uf) usadas[r.uf] = true; });
        $('filtro-uf').innerHTML = '<option value="">Todas as UFs</option>' +
            UFS.filter(function (u) { return usadas[u]; }).map(function (u) { return '<option>' + u + '</option>'; }).join('');
    }

    function revendedoresFiltrados() {
        var busca = $('filtro-busca').value.trim().toLowerCase();
        var buscaNum = busca.replace(/\D/g, '');
        var status = $('filtro-status').value;
        var uf = $('filtro-uf').value;
        return Nexo.db.listar('revendedores').filter(function (r) {
            if (status && r.status !== status) return false;
            if (uf && r.uf !== uf) return false;
            if (busca) {
                var texto = (r.nome + ' ' + (r.cidade || '')).toLowerCase();
                var docNum = String(r.documento || '').replace(/\D/g, '');
                if (texto.indexOf(busca) === -1 && !(buscaNum && docNum.indexOf(buscaNum) !== -1) && String(r.documento || '').toLowerCase().indexOf(busca) === -1) return false;
            }
            return true;
        }).sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
    }

    function desenharLista() {
        var lista = revendedoresFiltrados();
        var info = Nexo.ui.paginar(lista, estado.pagina);
        estado.pagina = info.pagina;
        $('lista-corpo').innerHTML = info.itens.length ? info.itens.map(function (r) {
            var s = resumo(r);
            var id = esc(r.id);
            return '<tr class="hover:bg-gray-50 cursor-pointer" data-abrir="' + id + '">' +
                '<td class="px-4 py-3"><p class="font-semibold text-gray-900">' + esc(r.nome) + '</p><p class="text-xs text-gray-500">' + esc(r.email || '') + '</p></td>' +
                '<td class="px-4 py-3 text-gray-600 whitespace-nowrap">' + esc(r.documento || '-') + '</td>' +
                '<td class="px-4 py-3 text-gray-600 whitespace-nowrap">' + esc(r.cidade || '-') + '/' + esc(r.uf || '-') + '</td>' +
                '<td class="px-4 py-3 text-right font-semibold text-gray-900">' + fmt.porcentagem(r.desconto) + '</td>' +
                '<td class="px-4 py-3 text-gray-600 whitespace-nowrap">' + esc(r.condicaoPagamento || '-') + '</td>' +
                '<td class="px-4 py-3 text-right text-gray-700 whitespace-nowrap">' + fmt.moeda(r.limiteCredito) + '</td>' +
                '<td class="px-4 py-3 text-right text-gray-700">' + fmt.numero(s.clientes.length) + '</td>' +
                '<td class="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">' + fmt.moeda(s.total) + '</td>' +
                '<td class="px-4 py-3">' + Nexo.ui.badgeStatus(r.status) + '</td>' +
                '<td class="px-4 py-3 text-right whitespace-nowrap">' +
                '<button type="button" data-abrir="' + id + '" class="w-8 h-8 rounded-lg text-gray-400 hover:text-brand-purple hover:bg-purple-50" title="Ver detalhes" aria-label="Ver detalhes"><i class="fa-solid fa-eye"></i></button>' +
                '<button type="button" data-editar="' + id + '" class="w-8 h-8 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50" title="Editar" aria-label="Editar"><i class="fa-solid fa-pen"></i></button>' +
                '<button type="button" data-excluir="' + id + '" class="w-8 h-8 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50" title="Excluir" aria-label="Excluir"><i class="fa-solid fa-trash"></i></button>' +
                '</td></tr>';
        }).join('') : vazio(10, 'Nenhum revendedor encontrado. Ajuste os filtros ou cadastre um novo revendedor.');
        $('lista-pag').innerHTML = Nexo.ui.htmlPaginacao(info, 'revendedoresPagina');
    }

    window.revendedoresPagina = function (n) { estado.pagina = n; desenharLista(); };

    function exportarCSV() {
        var lista = revendedoresFiltrados();
        if (!lista.length) { Nexo.ui.toast('Não há revendedores para exportar.', 'aviso'); return; }
        Nexo.exportarCSV('revendedores-' + fmt.hojeInput(),
            ['Nome', 'Documento', 'E-mail', 'Telefone', 'Cidade', 'UF', 'Desconto (%)', 'Comissão (%)', 'Condição de pagamento', 'Limite de crédito', 'Clientes vinculados', 'Total comprado', 'Status'],
            lista.map(function (r) {
                var s = resumo(r);
                return [r.nome, r.documento || '', r.email || '', r.telefone || '', r.cidade || '', r.uf || '', Number(r.desconto) || 0, Number(r.comissao) || 0,
                    r.condicaoPagamento || '', Number(r.limiteCredito) || 0, s.clientes.length, Math.round(s.total * 100) / 100, r.status];
            }));
    }

    /* ------------------------------------------------------------------ */
    /* Cadastro e edição                                                   */
    /* ------------------------------------------------------------------ */
    function abrirFormulario(id) {
        var r = id ? Nexo.db.obter('revendedores', id) : null;
        if (id && !r) { Nexo.ui.toast('Revendedor não encontrado.', 'erro'); return; }
        r = r || { status: 'Ativo', condicaoPagamento: '30 dias', desconto: 0, comissao: 0, limiteCredito: 0, uf: 'SP' };
        function val(v) { return esc(v === undefined || v === null ? '' : v); }

        var html =
            '<form id="form-rev" novalidate class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
            '<div class="sm:col-span-2"><label class="nexo-label" for="rv-nome">Nome / razão social *</label><input id="rv-nome" name="nome" type="text" maxlength="120" class="nexo-input" value="' + val(r.nome) + '"></div>' +
            '<div><label class="nexo-label" for="rv-doc">CPF ou CNPJ *</label><input id="rv-doc" name="documento" type="text" inputmode="numeric" class="nexo-input" placeholder="000.000.000-00" value="' + val(r.documento) + '"></div>' +
            '<div><label class="nexo-label" for="rv-email">E-mail *</label><input id="rv-email" name="email" type="email" class="nexo-input" value="' + val(r.email) + '"></div>' +
            '<div><label class="nexo-label" for="rv-tel">Telefone *</label><input id="rv-tel" name="telefone" type="tel" class="nexo-input" placeholder="(00) 00000-0000" value="' + val(r.telefone) + '"></div>' +
            '<div class="grid grid-cols-3 gap-3"><div class="col-span-2"><label class="nexo-label" for="rv-cidade">Cidade *</label><input id="rv-cidade" name="cidade" type="text" maxlength="60" class="nexo-input" value="' + val(r.cidade) + '"></div>' +
            '<div><label class="nexo-label" for="rv-uf">UF *</label><select id="rv-uf" name="uf" class="nexo-input">' +
            UFS.map(function (u) { return '<option' + (u === r.uf ? ' selected' : '') + '>' + u + '</option>'; }).join('') + '</select></div></div>' +
            '<div><label class="nexo-label" for="rv-desc">Desconto (%) *</label><input id="rv-desc" name="desconto" type="number" min="0" max="100" step="0.01" class="nexo-input" value="' + val(r.desconto) + '"></div>' +
            '<div><label class="nexo-label" for="rv-com">Comissão (%) *</label><input id="rv-com" name="comissao" type="number" min="0" max="100" step="0.01" class="nexo-input" value="' + val(r.comissao) + '"></div>' +
            '<div><label class="nexo-label" for="rv-cond">Condição de pagamento *</label><select id="rv-cond" name="condicaoPagamento" class="nexo-input">' +
            CONDICOES.map(function (c) { return '<option' + (c === r.condicaoPagamento ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select></div>' +
            '<div><label class="nexo-label" for="rv-lim">Limite de crédito (R$) *</label><input id="rv-lim" name="limiteCredito" type="number" min="0" step="0.01" class="nexo-input" value="' + val(r.limiteCredito) + '"></div>' +
            '<div><label class="nexo-label" for="rv-status">Status *</label><select id="rv-status" name="status" class="nexo-input">' +
            ['Ativo', 'Inativo'].map(function (s) { return '<option' + (s === r.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div>' +
            '<div class="sm:col-span-2"><label class="nexo-label" for="rv-obs">Observações</label><textarea id="rv-obs" name="observacoes" rows="3" maxlength="500" class="nexo-input">' + val(r.observacoes) + '</textarea></div>' +
            '</form>';

        Nexo.ui.abrirModal({
            titulo: id ? 'Editar revendedor' : 'Novo revendedor',
            largura: 'max-w-3xl',
            html: html,
            botoes: [
                { texto: 'Cancelar', classe: 'nexo-btn-secundario', acao: 'fechar' },
                { texto: id ? 'Salvar alterações' : 'Cadastrar', classe: 'nexo-btn-primario', icone: 'fa-check', acao: function () { return salvar(id); } }
            ],
            aoAbrir: function (corpo) {
                Nexo.mascara.aplicar(corpo.querySelector('[name="documento"]'), 'documento');
                Nexo.mascara.aplicar(corpo.querySelector('[name="telefone"]'), 'telefone');
            }
        });
    }

    function salvar(id) {
        var form = $('form-rev');
        var v = Nexo.ui.lerFormulario(form);
        var erros = {};
        if (!Nexo.validar.obrigatorio(v.nome)) erros.nome = 'Informe o nome ou razão social.';
        var docNum = v.documento.replace(/\D/g, '');
        if (!docNum) erros.documento = 'Informe o CPF ou CNPJ.';
        else if (docNum.length !== 11 && docNum.length !== 14) erros.documento = 'Documento deve ter 11 (CPF) ou 14 (CNPJ) dígitos.';
        else if (!Nexo.validar.documento(v.documento)) erros.documento = 'CPF/CNPJ inválido.';
        else if (Nexo.db.listar('revendedores').some(function (x) { return x.id !== id && String(x.documento || '').replace(/\D/g, '') === docNum; })) erros.documento = 'Já existe um revendedor com este documento.';
        if (!Nexo.validar.obrigatorio(v.email)) erros.email = 'Informe o e-mail.';
        else if (!Nexo.validar.email(v.email)) erros.email = 'E-mail inválido.';
        if (!Nexo.validar.obrigatorio(v.telefone)) erros.telefone = 'Informe o telefone.';
        else if (!Nexo.validar.telefone(v.telefone)) erros.telefone = 'Telefone inválido (use DDD + número).';
        if (!Nexo.validar.obrigatorio(v.cidade)) erros.cidade = 'Informe a cidade.';
        if (UFS.indexOf(v.uf) === -1) erros.uf = 'Selecione a UF.';
        var desc = Number(v.desconto), com = Number(v.comissao), lim = Number(v.limiteCredito);
        if (v.desconto === '' || isNaN(desc) || desc < 0 || desc > 100) erros.desconto = 'Informe um valor entre 0 e 100.';
        if (v.comissao === '' || isNaN(com) || com < 0 || com > 100) erros.comissao = 'Informe um valor entre 0 e 100.';
        if (v.limiteCredito === '' || isNaN(lim) || lim < 0) erros.limiteCredito = 'Informe um valor maior ou igual a zero.';
        if (!Nexo.ui.mostrarErros(form, erros)) return false;

        var registro = {
            nome: v.nome, documento: v.documento, email: v.email, telefone: v.telefone, cidade: v.cidade, uf: v.uf,
            desconto: desc, comissao: com, condicaoPagamento: v.condicaoPagamento, limiteCredito: lim,
            status: v.status, observacoes: v.observacoes
        };
        if (id) {
            Nexo.db.atualizar('revendedores', id, registro);
            Nexo.registrarAtividade('revendedor', 'Revendedor ' + v.nome + ' atualizado', 'revendedores.html?id=' + id);
            Nexo.ui.toast('Revendedor atualizado.');
        } else {
            var novo = Nexo.db.inserir('revendedores', registro);
            Nexo.registrarAtividade('revendedor', 'Revendedor ' + v.nome + ' cadastrado', 'revendedores.html?id=' + novo.id);
            Nexo.ui.toast('Revendedor cadastrado.');
        }
        atualizarTela();
        return true;
    }

    /* ------------------------------------------------------------------ */
    /* Exclusão (só sem pedidos nem clientes vinculados)                   */
    /* ------------------------------------------------------------------ */
    function excluir(id) {
        var r = Nexo.db.obter('revendedores', id);
        if (!r) return;
        var temPedidos = Nexo.db.listar('pedidos').some(function (p) { return p.revendedorId === id; });
        var nClientes = Nexo.db.listar('clientes').filter(function (c) { return c.revendedorId === id; }).length;
        if (temPedidos || nClientes) {
            var motivo = (temPedidos ? 'possui pedidos' : '') + (temPedidos && nClientes ? ' e ' : '') + (nClientes ? 'tem ' + nClientes + ' cliente(s) vinculado(s)' : '');
            if (r.status === 'Inativo') {
                Nexo.ui.toast('Não é possível excluir: ' + r.nome + ' ' + motivo + '. Ele já está inativo.', 'aviso');
                return;
            }
            Nexo.ui.confirmar('Não é possível excluir', r.nome + ' ' + motivo + '. Deseja inativá-lo em vez de excluir?', { textoOk: 'Inativar' }).then(function (ok) {
                if (!ok) return;
                Nexo.db.atualizar('revendedores', id, { status: 'Inativo' });
                Nexo.registrarAtividade('revendedor', 'Revendedor ' + r.nome + ' inativado', 'revendedores.html?id=' + id);
                Nexo.ui.toast('Revendedor inativado.');
                atualizarTela();
            });
            return;
        }
        Nexo.ui.confirmar('Excluir revendedor?', 'Excluir "' + r.nome + '" definitivamente? Esta ação não pode ser desfeita.', { textoOk: 'Excluir', perigo: true }).then(function (ok) {
            if (!ok) return;
            Nexo.db.remover('revendedores', id);
            Nexo.registrarAtividade('revendedor', 'Revendedor ' + r.nome + ' excluído', 'revendedores.html');
            Nexo.ui.toast('Revendedor excluído.');
            if (estado.detalheId === id) mostrarLista();
            else atualizarTela();
        });
    }

    /* ------------------------------------------------------------------ */
    /* Detalhes                                                            */
    /* ------------------------------------------------------------------ */
    function mostrarLista() {
        estado.detalheId = null;
        if (estado.grafico) { estado.grafico.destroy(); estado.grafico = null; }
        $('visao-detalhe').classList.add('hidden');
        $('visao-lista').classList.remove('hidden');
        try { history.replaceState(null, '', location.pathname); } catch (e) { /* file:// pode bloquear */ }
        atualizarTela();
    }

    function abrirDetalhe(id) {
        var r = Nexo.db.obter('revendedores', id);
        if (!r) { Nexo.ui.toast('Revendedor não encontrado.', 'erro'); return; }
        estado.detalheId = id;
        estado.pagHist = 1;
        $('visao-lista').classList.add('hidden');
        $('visao-detalhe').classList.remove('hidden');
        try { history.replaceState(null, '', location.pathname + '?id=' + encodeURIComponent(id)); } catch (e) { /* file:// pode bloquear */ }
        desenharDetalhe();
        var main = document.querySelector('main');
        if (main) main.scrollTop = 0;
    }

    function desenharDetalhe() {
        var r = Nexo.db.obter('revendedores', estado.detalheId);
        if (!r) { mostrarLista(); return; }
        var s = resumo(r);
        var limite = Number(r.limiteCredito) || 0;
        var pct = limite > 0 ? Math.min(100, Math.round(s.credito / limite * 100)) : (s.credito > 0 ? 100 : 0);
        var corBarra = pct >= 90 ? 'bg-red-500' : (pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500');
        var disponivel = limite - s.credito;

        function linha(rotulo, valor) {
            return '<div class="flex justify-between gap-4 py-2 border-b border-gray-50 last:border-0"><dt class="text-sm text-brand-textMuted">' + rotulo + '</dt><dd class="text-sm font-semibold text-gray-900 text-right break-words min-w-0">' + valor + '</dd></div>';
        }
        function mini(rotulo, valor, icone, cor) {
            return '<div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"><div class="w-9 h-9 rounded-xl flex items-center justify-center mb-3 ' + cor + '"><i class="fa-solid ' + icone + '"></i></div>' +
                '<p class="text-xs font-medium text-brand-textMuted">' + rotulo + '</p><p class="text-lg md:text-xl font-extrabold text-gray-900 mt-0.5 break-words">' + valor + '</p></div>';
        }

        $('visao-detalhe').innerHTML =
            '<button type="button" id="det-voltar" class="text-sm font-semibold text-brand-purple hover:underline mb-4"><i class="fa-solid fa-arrow-left mr-1"></i> Voltar para a lista</button>' +
            '<div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">' +
            '<div><h1 class="text-2xl md:text-3xl font-extrabold text-brand-textMain">' + esc(r.nome) + '</h1>' +
            '<div class="flex items-center gap-2 mt-2">' + Nexo.ui.badgeStatus(r.status) + '<span class="text-sm text-brand-textMuted">' + esc(r.cidade || '-') + '/' + esc(r.uf || '-') + '</span></div></div>' +
            '<div class="flex gap-2"><button type="button" id="det-editar" class="nexo-btn nexo-btn-secundario"><i class="fa-solid fa-pen"></i> Editar</button>' +
            '<button type="button" id="det-excluir" class="nexo-btn nexo-btn-secundario !text-red-600"><i class="fa-solid fa-trash"></i> Excluir</button></div></div>' +

            '<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">' +
            mini('Total comprado', fmt.moeda(s.total), 'fa-sack-dollar', 'bg-emerald-50 text-emerald-600') +
            mini('Ticket médio', fmt.moeda(s.ticket), 'fa-receipt', 'bg-purple-50 text-brand-purple') +
            mini('Pedidos', fmt.numero(s.pedidos.length), 'fa-cart-shopping', 'bg-blue-50 text-blue-600') +
            mini('Comissão gerada', fmt.moeda(s.comissao), 'fa-percent', 'bg-amber-50 text-amber-600') + '</div>' +

            '<div class="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-6">' +
            '<div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"><h2 class="font-bold text-gray-900 mb-2">Dados comerciais</h2><dl>' +
            linha('Documento', esc(r.documento || '-')) +
            linha('E-mail', esc(r.email || '-')) +
            linha('Telefone', esc(r.telefone || '-')) +
            linha('Desconto', fmt.porcentagem(r.desconto)) +
            linha('Comissão', fmt.porcentagem(r.comissao)) +
            linha('Condição de pagamento', esc(r.condicaoPagamento || '-')) +
            linha('Cadastrado em', fmt.data(r.criadoEm)) +
            '</dl>' + (r.observacoes ? '<p class="text-sm text-gray-600 mt-3 pt-3 border-t border-gray-100"><b>Observações:</b> ' + esc(r.observacoes) + '</p>' : '') + '</div>' +

            '<div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"><h2 class="font-bold text-gray-900 mb-4">Crédito</h2>' +
            '<div class="flex items-end justify-between mb-2"><span class="text-2xl font-extrabold text-gray-900">' + fmt.moeda(s.credito) + '</span><span class="text-sm text-brand-textMuted">de ' + fmt.moeda(limite) + '</span></div>' +
            '<div class="w-full h-3 rounded-full bg-gray-100 overflow-hidden" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100" aria-label="Crédito utilizado"><div class="h-full ' + corBarra + '" style="width:' + pct + '%"></div></div>' +
            '<p class="text-xs text-brand-textMuted mt-2">' + pct + '% do limite utilizado (pedidos com pagamento pendente)</p>' +
            '<p class="text-sm mt-4 ' + (disponivel < 0 ? 'text-red-600 font-semibold' : 'text-gray-700') + '">' + (disponivel < 0 ? 'Limite excedido em ' + fmt.moeda(-disponivel) : 'Disponível: <b>' + fmt.moeda(disponivel) + '</b>') + '</p></div>' +

            '<div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"><h2 class="font-bold text-gray-900 mb-3">Compras por mês</h2><div class="relative h-48"><canvas id="det-grafico" aria-label="Gráfico de compras por mês"></canvas></div></div>' +
            '</div>' +

            '<div class="bg-white rounded-2xl border border-gray-100 shadow-sm mb-6"><div class="px-5 py-4 border-b border-gray-100"><h2 class="font-bold text-gray-900">Clientes vinculados (' + s.clientes.length + ')</h2></div>' +
            (s.clientes.length ? '<ul class="divide-y divide-gray-50">' + s.clientes.map(function (c) {
                return '<li class="px-5 py-3 flex items-center justify-between gap-3"><div class="min-w-0">' + linkCliente(c) + '<p class="text-xs text-gray-500">' + esc(c.tipo === 'PJ' ? 'Pessoa jurídica' : 'Pessoa física') + ' | ' + esc(c.email || '') + '</p></div>' + Nexo.ui.badgeStatus(c.status || 'Ativo') + '</li>';
            }).join('') + '</ul>' : '<p class="px-5 py-8 text-center text-sm text-gray-500">Nenhum cliente vinculado a este revendedor.</p>') + '</div>' +

            '<div class="bg-white rounded-2xl border border-gray-100 shadow-sm"><div class="px-5 py-4 border-b border-gray-100"><h2 class="font-bold text-gray-900">Histórico de compras</h2></div>' +
            '<div class="overflow-x-auto"><table class="w-full text-sm min-w-[640px]"><thead class="text-left text-xs uppercase text-gray-500 bg-gray-50"><tr>' +
            '<th class="px-4 py-3">Pedido</th><th class="px-4 py-3">Data</th><th class="px-4 py-3">Cliente</th><th class="px-4 py-3 text-right">Total</th><th class="px-4 py-3">Status</th></tr></thead>' +
            '<tbody id="det-hist" class="divide-y divide-gray-50"></tbody></table></div><div id="det-hist-pag"></div></div>';

        $('det-voltar').addEventListener('click', mostrarLista);
        $('det-editar').addEventListener('click', function () { abrirFormulario(r.id); });
        $('det-excluir').addEventListener('click', function () { excluir(r.id); });
        desenharHistorico();
        desenharGraficoCompras(s.pedidos);
    }

    function desenharHistorico() {
        var clientes = Nexo.consultas.mapa('clientes');
        var todos = Nexo.db.listar('pedidos').filter(function (p) { return p.revendedorId === estado.detalheId; })
            .sort(function (a, b) { return a.data < b.data ? 1 : (a.data > b.data ? -1 : 0); });
        var info = Nexo.ui.paginar(todos, estado.pagHist);
        estado.pagHist = info.pagina;
        $('det-hist').innerHTML = info.itens.length ? info.itens.map(function (p) {
            var c = clientes[p.clienteId];
            return '<tr class="hover:bg-gray-50">' +
                '<td class="px-4 py-3"><a href="pedidos.html?id=' + encodeURIComponent(p.id) + '" class="font-semibold text-brand-purple hover:underline">#' + esc(p.numero) + '</a></td>' +
                '<td class="px-4 py-3 text-gray-600 whitespace-nowrap">' + fmt.data(p.data) + '</td>' +
                '<td class="px-4 py-3">' + (c ? linkCliente(c) : '<span class="text-gray-400">Cliente removido</span>') + '</td>' +
                '<td class="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">' + fmt.moeda(p.total) + '</td>' +
                '<td class="px-4 py-3">' + Nexo.ui.badgeStatus(p.status) + '</td></tr>';
        }).join('') : vazio(5, 'Este revendedor ainda não possui compras.', 'fa-cart-shopping');
        $('det-hist-pag').innerHTML = Nexo.ui.htmlPaginacao(info, 'revendedoresPaginaHist');
    }

    window.revendedoresPaginaHist = function (n) { estado.pagHist = n; desenharHistorico(); };

    /* Gráfico de barras: total comprado nos últimos 6 meses */
    function desenharGraficoCompras(pedidos) {
        if (typeof Chart === 'undefined') return;
        var meses = [];
        var hoje = new Date();
        for (var i = 5; i >= 0; i--) {
            var d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
            meses.push({
                chave: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'),
                rotulo: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
                total: 0
            });
        }
        pedidos.forEach(function (p) {
            var chave = fmt.dataInput(p.data).slice(0, 7);
            meses.forEach(function (m) { if (m.chave === chave) m.total += Number(p.total) || 0; });
        });
        if (estado.grafico) estado.grafico.destroy();
        estado.grafico = new Chart($('det-grafico'), {
            type: 'bar',
            data: { labels: meses.map(function (m) { return m.rotulo; }), datasets: [{ label: 'Compras (R$)', data: meses.map(function (m) { return Math.round(m.total * 100) / 100; }), backgroundColor: '#7c3aed', borderRadius: 4 }] },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return fmt.moeda(c.parsed.y); } } } },
                scales: { y: { beginAtZero: true, ticks: { callback: function (v) { return 'R$ ' + fmt.numero(v); } } }, x: { grid: { display: false } } }
            }
        });
    }

    /* ------------------------------------------------------------------ */
    /* Inicialização                                                       */
    /* ------------------------------------------------------------------ */
    function atualizarTela() {
        desenharCards();
        preencherUFMantendo();
        if (estado.detalheId) desenharDetalhe();
        else desenharLista();
    }

    /* Recria as opções de UF sem perder o filtro escolhido */
    function preencherUFMantendo() {
        var atual = $('filtro-uf').value;
        preencherUF();
        $('filtro-uf').value = atual;
    }

    function iniciar() {
        preencherUF();
        $('btn-novo').addEventListener('click', function () { abrirFormulario(null); });
        $('btn-csv').addEventListener('click', exportarCSV);
        ['filtro-busca', 'filtro-status', 'filtro-uf'].forEach(function (id) {
            $(id).addEventListener('input', function () { estado.pagina = 1; desenharLista(); });
        });
        /* ações da tabela: abrir (linha ou olho), editar, excluir */
        $('lista-corpo').addEventListener('click', function (e) {
            var ed = e.target.closest('[data-editar]');
            if (ed) { abrirFormulario(ed.getAttribute('data-editar')); return; }
            var ex = e.target.closest('[data-excluir]');
            if (ex) { excluir(ex.getAttribute('data-excluir')); return; }
            var ab = e.target.closest('[data-abrir]');
            if (ab) abrirDetalhe(ab.getAttribute('data-abrir'));
        });

        desenharCards();
        desenharLista();

        var id = Nexo.ui.parametro('id');
        if (id) abrirDetalhe(id);
    }

    iniciar();
})();
