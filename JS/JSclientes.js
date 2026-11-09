/*
 * NEXO ERP - Tela de Clientes
 * Lista, busca/filtros, cadastro/edição, detalhes com histórico de pedidos,
 * revendedor vinculado e comentários. Dados vêm de Nexo.db (localStorage).
 */
(function () {
    'use strict';

    var UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
    var esc = Nexo.esc;
    var $ = function (id) { return document.getElementById(id); };

    /* Estado da lista: página atual e dados calculados na última renderização */
    var estado = { pagina: 1, stats: {}, lista: [] };

    if (Nexo.layout.montar('clientes')) { iniciar(); }

    /* ------------------------------------------------------------------ */
    /* Utilitários                                                         */
    /* ------------------------------------------------------------------ */
    function semAcento(t) {
        return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    }
    function digitos(t) { return String(t || '').replace(/\D/g, ''); }
    function iniciais(nome) {
        return String(nome || '?').split(/\s+/).slice(0, 2).map(function (p) { return p.charAt(0); }).join('').toUpperCase();
    }
    function cidadeUF(c) {
        var e = c.endereco || {};
        return e.cidade ? e.cidade + (e.uf ? ' - ' + e.uf : '') : '-';
    }
    function pedidosDoCliente(id) {
        return Nexo.db.listar('pedidos').filter(function (p) { return p.clienteId === id; })
            .sort(function (a, b) { return a.data < b.data ? 1 : -1; });
    }

    /* Resumo de compras de todos os clientes (pedidos cancelados não contam) */
    function calcularStats() {
        var s = {};
        Nexo.db.listar('pedidos').forEach(function (p) {
            var x = s[p.clienteId] || (s[p.clienteId] = { todos: 0, n: 0, total: 0, ultima: '' });
            x.todos++;
            if (p.status === 'Cancelado') return;
            x.n++;
            x.total += Number(p.total) || 0;
            if (p.data > x.ultima) x.ultima = p.data;
        });
        return s;
    }
    function statDe(id) { return estado.stats[id] || { todos: 0, n: 0, total: 0, ultima: '' }; }

    function selectUF(valor) {
        return '<option value="">UF</option>' + UFS.map(function (u) {
            return '<option value="' + u + '"' + (u === valor ? ' selected' : '') + '>' + u + '</option>';
        }).join('');
    }

    /* ------------------------------------------------------------------ */
    /* Inicialização                                                       */
    /* ------------------------------------------------------------------ */
    function iniciar() {
        ['fBusca'].forEach(function (id) { $(id).addEventListener('input', function () { estado.pagina = 1; desenhar(); }); });
        ['fTipo', 'fStatus', 'fCidade', 'fRevendedor', 'fCompras', 'fOrdem'].forEach(function (id) {
            $(id).addEventListener('change', function () { estado.pagina = 1; desenhar(); });
        });
        $('btnLimpar').addEventListener('click', limparFiltros);
        $('btnCadastrar').addEventListener('click', function () { abrirFormulario(null); });
        $('btnExportar').addEventListener('click', exportar);

        /* ações da tabela (delegação de eventos) */
        $('tabelaClientes').addEventListener('click', function (e) {
            var btn = e.target.closest('[data-acao]');
            if (btn) {
                e.stopPropagation();
                var id = btn.getAttribute('data-id');
                var acao = btn.getAttribute('data-acao');
                if (acao === 'ver') abrirDetalhe(id);
                if (acao === 'editar') abrirFormulario(id);
                if (acao === 'excluir') excluirCliente(id);
                return;
            }
            if (e.target.closest('a')) return;
            var linha = e.target.closest('tr[data-id]');
            if (linha) abrirDetalhe(linha.getAttribute('data-id'));
        });

        window.clientesIrPagina = function (n) { estado.pagina = n; desenhar(); };

        desenhar();

        /* clientes.html?id=XYZ abre direto o detalhe */
        var idUrl = Nexo.ui.parametro('id');
        if (idUrl) {
            if (Nexo.db.obter('clientes', idUrl)) abrirDetalhe(idUrl);
            else Nexo.ui.toast('Cliente não encontrado.', 'erro');
        }
    }

    function limparFiltros() {
        $('fBusca').value = '';
        ['fTipo', 'fStatus', 'fCidade', 'fRevendedor', 'fCompras'].forEach(function (id) { $(id).value = ''; });
        $('fOrdem').value = 'nome-asc';
        estado.pagina = 1;
        desenhar();
    }

    /* ------------------------------------------------------------------ */
    /* Lista, métricas e filtros                                           */
    /* ------------------------------------------------------------------ */
    function preencherFiltrosDinamicos(clientes) {
        /* cidades existentes */
        var atualCidade = $('fCidade').value;
        var cidades = {};
        clientes.forEach(function (c) { var t = cidadeUF(c); if (t !== '-') cidades[t] = true; });
        $('fCidade').innerHTML = '<option value="">Todas</option>' + Object.keys(cidades).sort().map(function (t) {
            return '<option value="' + esc(t) + '"' + (t === atualCidade ? ' selected' : '') + '>' + esc(t) + '</option>';
        }).join('');

        /* revendedores */
        var atualRev = $('fRevendedor').value;
        $('fRevendedor').innerHTML = '<option value="">Todos</option><option value="__nenhum"' + (atualRev === '__nenhum' ? ' selected' : '') + '>Sem revendedor</option>' +
            Nexo.db.listar('revendedores').sort(function (a, b) { return a.nome.localeCompare(b.nome); }).map(function (r) {
                return '<option value="' + esc(r.id) + '"' + (r.id === atualRev ? ' selected' : '') + '>' + esc(r.nome) + '</option>';
            }).join('');
    }

    function filtrar(clientes) {
        var busca = semAcento($('fBusca').value.trim());
        var buscaNum = digitos(busca);
        var tipo = $('fTipo').value, status = $('fStatus').value, cidade = $('fCidade').value;
        var rev = $('fRevendedor').value, compras = $('fCompras').value;

        var lista = clientes.filter(function (c) {
            if (tipo && c.tipo !== tipo) return false;
            if (status && c.status !== status) return false;
            if (cidade && cidadeUF(c) !== cidade) return false;
            if (rev === '__nenhum' && c.revendedorId) return false;
            if (rev && rev !== '__nenhum' && c.revendedorId !== rev) return false;
            var n = statDe(c.id).n;
            if (compras === 'com' && n === 0) return false;
            if (compras === 'sem' && n > 0) return false;
            if (busca) {
                var texto = semAcento([c.nome, c.razaoSocial, c.nomeFantasia, c.email, c.documento, c.telefone].join(' '));
                var achou = texto.indexOf(busca) !== -1;
                if (!achou && buscaNum.length >= 3) {
                    achou = digitos(c.documento).indexOf(buscaNum) !== -1 || digitos(c.telefone).indexOf(buscaNum) !== -1;
                }
                if (!achou) return false;
            }
            return true;
        });

        var partes = $('fOrdem').value.split('-');
        var campo = partes[0], dir = partes[1] === 'desc' ? -1 : 1;
        lista.sort(function (a, b) {
            var va, vb;
            if (campo === 'nome') return dir * semAcento(a.nome).localeCompare(semAcento(b.nome));
            if (campo === 'total') { va = statDe(a.id).total; vb = statDe(b.id).total; }
            else if (campo === 'pedidos') { va = statDe(a.id).n; vb = statDe(b.id).n; }
            else if (campo === 'ultima') { va = statDe(a.id).ultima; vb = statDe(b.id).ultima; }
            else { va = a.criadoEm || ''; vb = b.criadoEm || ''; }
            return va === vb ? 0 : (va < vb ? -dir : dir);
        });
        return lista;
    }

    function desenharMetricas(clientes) {
        var mes = Nexo.fmt.hojeInput().slice(0, 7);
        var vendas = 0, qtd = 0;
        Object.keys(estado.stats).forEach(function (id) { vendas += estado.stats[id].total; qtd += estado.stats[id].n; });
        $('mTotal').textContent = Nexo.fmt.numero(clientes.length);
        $('mAtivos').textContent = Nexo.fmt.numero(clientes.filter(function (c) { return c.status === 'Ativo'; }).length);
        $('mNovos').textContent = Nexo.fmt.numero(clientes.filter(function (c) { return String(c.criadoEm || '').slice(0, 7) === mes; }).length);
        $('mTicket').textContent = Nexo.fmt.moeda(qtd ? vendas / qtd : 0);
    }

    function desenhar() {
        var clientes = Nexo.db.listar('clientes');
        var revMap = Nexo.consultas.mapa('revendedores');
        estado.stats = calcularStats();
        preencherFiltrosDinamicos(clientes);
        desenharMetricas(clientes);

        estado.lista = filtrar(clientes);
        var info = Nexo.ui.paginar(estado.lista, estado.pagina);
        estado.pagina = info.pagina;

        if (!info.itens.length) {
            $('tabelaClientes').innerHTML = '<tr><td colspan="11" class="px-5 py-12 text-center text-gray-500">' +
                '<i class="fa-solid fa-magnifying-glass text-2xl mb-2"></i><p class="font-semibold">Nenhum cliente encontrado.</p>' +
                '<p class="text-xs mt-1">Ajuste os filtros ou cadastre um novo cliente.</p></td></tr>';
            $('paginacao').innerHTML = '';
            return;
        }

        $('tabelaClientes').innerHTML = info.itens.map(function (c) {
            var st = statDe(c.id);
            var rev = c.revendedorId ? revMap[c.revendedorId] : null;
            return '<tr class="hover:bg-gray-50 transition cursor-pointer" data-id="' + esc(c.id) + '">' +
                '<td class="px-4 py-3"><div class="flex items-center gap-3">' +
                '<div class="w-8 h-8 rounded-full bg-purple-100 text-brand-purple flex items-center justify-center font-bold text-xs shrink-0">' + esc(iniciais(c.nome)) + '</div>' +
                '<div class="min-w-0"><p class="font-bold text-gray-900">' + esc(c.nome) + '</p><p class="text-gray-400 truncate max-w-[220px]">' + esc(c.email) + '</p></div></div></td>' +
                '<td class="px-4 py-3"><span class="bg-brand-purpleLight text-brand-purple border border-purple-100 px-2 py-1 rounded-md font-semibold">' + (c.tipo === 'PJ' ? 'PJ' : 'PF') + '</span></td>' +
                '<td class="px-4 py-3 text-gray-600 whitespace-nowrap">' + esc(c.documento) + '</td>' +
                '<td class="px-4 py-3 text-gray-600 whitespace-nowrap">' + esc(c.telefone) + '</td>' +
                '<td class="px-4 py-3 text-gray-600">' + esc(cidadeUF(c)) + '</td>' +
                '<td class="px-4 py-3 text-gray-600">' + (rev ? esc(rev.nome) : '<span class="text-gray-400">-</span>') + '</td>' +
                '<td class="px-4 py-3 text-center">' + st.n + '</td>' +
                '<td class="px-4 py-3 text-right whitespace-nowrap">' + Nexo.fmt.moeda(st.total) + '</td>' +
                '<td class="px-4 py-3 text-gray-600 whitespace-nowrap">' + (st.ultima ? Nexo.fmt.data(st.ultima) : '-') + '</td>' +
                '<td class="px-4 py-3 text-center">' + Nexo.ui.badgeStatus(c.status || 'Ativo') + '</td>' +
                '<td class="px-4 py-3"><div class="flex justify-center gap-1">' +
                '<button type="button" data-acao="ver" data-id="' + esc(c.id) + '" title="Visualizar" class="w-7 h-7 rounded-full text-brand-purple hover:bg-brand-purpleLight"><i class="fa-regular fa-eye"></i></button>' +
                '<button type="button" data-acao="editar" data-id="' + esc(c.id) + '" title="Editar" class="w-7 h-7 rounded-full text-blue-600 hover:bg-blue-50"><i class="fa-solid fa-pen"></i></button>' +
                '<button type="button" data-acao="excluir" data-id="' + esc(c.id) + '" title="Excluir" class="w-7 h-7 rounded-full text-red-500 hover:bg-red-50"><i class="fa-solid fa-trash"></i></button>' +
                '</div></td></tr>';
        }).join('');
        $('paginacao').innerHTML = Nexo.ui.htmlPaginacao(info, 'clientesIrPagina');
    }

    function exportar() {
        if (!estado.lista.length) { Nexo.ui.toast('Não há clientes para exportar.', 'aviso'); return; }
        var revMap = Nexo.consultas.mapa('revendedores');
        var linhas = estado.lista.map(function (c) {
            var st = statDe(c.id), e = c.endereco || {};
            return [c.nome, c.tipo, c.documento, c.email, c.telefone, c.whatsapp || '', e.cidade || '', e.uf || '',
                c.revendedorId && revMap[c.revendedorId] ? revMap[c.revendedorId].nome : '',
                st.n, st.total, st.ultima ? Nexo.fmt.data(st.ultima) : '', c.status];
        });
        Nexo.exportarCSV('clientes', ['Nome', 'Tipo', 'Documento', 'E-mail', 'Telefone', 'WhatsApp', 'Cidade', 'UF', 'Revendedor', 'Pedidos', 'Total comprado', 'Última compra', 'Status'], linhas);
        Nexo.ui.toast('Exportação concluída (' + linhas.length + ' clientes).');
    }

    /* ------------------------------------------------------------------ */
    /* Cadastro e edição                                                   */
    /* ------------------------------------------------------------------ */
    function htmlFormulario(c) {
        c = c || { tipo: 'PF', status: 'Ativo', endereco: {} };
        var e = c.endereco || {};
        var v = function (x) { return esc(x === undefined || x === null ? '' : x); };
        var revendedores = Nexo.db.listar('revendedores').filter(function (r) { return r.status === 'Ativo' || r.id === c.revendedorId; });
        var optsRev = '<option value="">Nenhum</option>' + revendedores.map(function (r) {
            return '<option value="' + esc(r.id) + '"' + (r.id === c.revendedorId ? ' selected' : '') + '>' + esc(r.nome) + ' (' + r.desconto + '% de desconto)' + (r.status !== 'Ativo' ? ' - inativo' : '') + '</option>';
        }).join('');

        return '<form novalidate class="space-y-6">' +
            '<div><label class="nexo-label">Tipo de cliente *</label>' +
            '<select name="tipo" class="nexo-input"><option value="PF"' + (c.tipo !== 'PJ' ? ' selected' : '') + '>Pessoa Física</option><option value="PJ"' + (c.tipo === 'PJ' ? ' selected' : '') + '>Pessoa Jurídica</option></select></div>' +

            '<div><h3 class="text-sm font-bold text-gray-900 mb-3"><i class="fa-solid fa-id-card text-brand-purple mr-2"></i><span data-titulo-dados>Dados pessoais</span></h3>' +
            '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
            '<div data-pf class="sm:col-span-2"><label class="nexo-label">Nome completo *</label><input name="nome" class="nexo-input" value="' + v(c.tipo === 'PJ' ? '' : c.nome) + '"></div>' +
            '<div data-pj><label class="nexo-label">Razão social *</label><input name="razaoSocial" class="nexo-input" value="' + v(c.razaoSocial) + '"></div>' +
            '<div data-pj><label class="nexo-label">Nome fantasia</label><input name="nomeFantasia" class="nexo-input" value="' + v(c.nomeFantasia) + '"></div>' +
            '<div><label class="nexo-label" data-rotulo-doc>CPF *</label><input name="documento" class="nexo-input" inputmode="numeric" value="' + v(c.documento) + '"></div>' +
            '<div data-pf><label class="nexo-label">Data de nascimento</label><input type="date" name="dataNascimento" class="nexo-input" value="' + v(Nexo.fmt.dataInput(c.dataNascimento)) + '"></div>' +
            '<div data-pj><label class="nexo-label">Responsável</label><input name="responsavel" class="nexo-input" value="' + v(c.responsavel) + '"></div>' +
            '</div></div>' +

            '<div><h3 class="text-sm font-bold text-gray-900 mb-3"><i class="fa-solid fa-phone text-brand-purple mr-2"></i>Contato</h3>' +
            '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
            '<div class="sm:col-span-2"><label class="nexo-label">E-mail *</label><input type="email" name="email" class="nexo-input" value="' + v(c.email) + '"></div>' +
            '<div><label class="nexo-label">Telefone *</label><input name="telefone" class="nexo-input" inputmode="tel" placeholder="(00) 00000-0000" value="' + v(c.telefone) + '"></div>' +
            '<div><label class="nexo-label">WhatsApp (opcional)</label><input name="whatsapp" class="nexo-input" inputmode="tel" placeholder="(00) 00000-0000" value="' + v(c.whatsapp) + '"></div>' +
            '</div></div>' +

            '<div><h3 class="text-sm font-bold text-gray-900 mb-3"><i class="fa-solid fa-location-dot text-brand-purple mr-2"></i>Endereço</h3>' +
            '<div class="grid grid-cols-1 sm:grid-cols-6 gap-4">' +
            '<div class="sm:col-span-2"><label class="nexo-label">CEP</label><input name="cep" class="nexo-input" inputmode="numeric" placeholder="00000-000" value="' + v(e.cep) + '"></div>' +
            '<div class="sm:col-span-4"><label class="nexo-label">Logradouro</label><input name="logradouro" class="nexo-input" value="' + v(e.logradouro) + '"></div>' +
            '<div class="sm:col-span-2"><label class="nexo-label">Número</label><input name="numero" class="nexo-input" value="' + v(e.numero) + '"></div>' +
            '<div class="sm:col-span-4"><label class="nexo-label">Complemento</label><input name="complemento" class="nexo-input" value="' + v(e.complemento) + '"></div>' +
            '<div class="sm:col-span-2"><label class="nexo-label">Bairro</label><input name="bairro" class="nexo-input" value="' + v(e.bairro) + '"></div>' +
            '<div class="sm:col-span-3"><label class="nexo-label">Cidade *</label><input name="cidade" class="nexo-input" value="' + v(e.cidade) + '"></div>' +
            '<div class="sm:col-span-1"><label class="nexo-label">UF *</label><select name="uf" class="nexo-input">' + selectUF(e.uf) + '</select></div>' +
            '</div></div>' +

            '<div><h3 class="text-sm font-bold text-gray-900 mb-3"><i class="fa-solid fa-handshake text-brand-purple mr-2"></i>Relacionamento</h3>' +
            '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
            '<div><label class="nexo-label">Revendedor vinculado</label><select name="revendedorId" class="nexo-input">' + optsRev + '</select></div>' +
            '<div><label class="nexo-label">Status</label><select name="status" class="nexo-input"><option value="Ativo"' + (c.status !== 'Inativo' ? ' selected' : '') + '>Ativo</option><option value="Inativo"' + (c.status === 'Inativo' ? ' selected' : '') + '>Inativo</option></select></div>' +
            '<div class="sm:col-span-2"><label class="nexo-label">Observações</label><textarea name="observacoes" rows="3" class="nexo-input">' + v(c.observacoes) + '</textarea></div>' +
            '</div></div>' +
            '</form>';
    }

    /* Liga máscaras e alterna os campos PF/PJ no formulário */
    function ligarFormulario(el) {
        var form = el.querySelector('form');
        var selTipo = form.elements.tipo;
        var docInput = form.elements.documento;

        function aplicarTipo() {
            var pj = selTipo.value === 'PJ';
            form.querySelectorAll('[data-pf]').forEach(function (x) { x.classList.toggle('hidden', pj); });
            form.querySelectorAll('[data-pj]').forEach(function (x) { x.classList.toggle('hidden', !pj); });
            form.querySelector('[data-titulo-dados]').textContent = pj ? 'Dados empresariais' : 'Dados pessoais';
            form.querySelector('[data-rotulo-doc]').textContent = pj ? 'CNPJ *' : 'CPF *';
            docInput.placeholder = pj ? '00.000.000/0000-00' : '000.000.000-00';
            docInput.value = pj ? Nexo.mascara.cnpj(docInput.value) : Nexo.mascara.cpf(docInput.value);
        }
        selTipo.addEventListener('change', aplicarTipo);
        docInput.addEventListener('input', function () {
            docInput.value = selTipo.value === 'PJ' ? Nexo.mascara.cnpj(docInput.value) : Nexo.mascara.cpf(docInput.value);
        });
        Nexo.mascara.aplicar(form.elements.telefone, 'telefone');
        Nexo.mascara.aplicar(form.elements.whatsapp, 'telefone');
        Nexo.mascara.aplicar(form.elements.cep, 'cep');
        aplicarTipo();
    }

    /* Valida os dados do formulário. Retorna {erros}. */
    function validarCliente(d, idAtual) {
        var erros = {};
        var pj = d.tipo === 'PJ';
        if (pj) {
            if (!d.razaoSocial) erros.razaoSocial = 'Informe a razão social.';
        } else if (!d.nome) erros.nome = 'Informe o nome completo.';

        if (!d.documento) erros.documento = 'Informe o ' + (pj ? 'CNPJ' : 'CPF') + '.';
        else if (pj ? !Nexo.validar.cnpj(d.documento) : !Nexo.validar.cpf(d.documento)) erros.documento = (pj ? 'CNPJ' : 'CPF') + ' inválido.';
        else {
            var dig = digitos(d.documento);
            var repetido = Nexo.db.listar('clientes').some(function (c) { return c.id !== idAtual && digitos(c.documento) === dig; });
            if (repetido) erros.documento = 'Já existe um cliente com este documento.';
        }
        if (!pj && d.dataNascimento && d.dataNascimento > Nexo.fmt.hojeInput()) erros.dataNascimento = 'A data não pode estar no futuro.';

        if (!d.email) erros.email = 'Informe o e-mail.';
        else if (!Nexo.validar.email(d.email)) erros.email = 'E-mail inválido.';
        if (!d.telefone) erros.telefone = 'Informe o telefone.';
        else if (!Nexo.validar.telefone(d.telefone)) erros.telefone = 'Telefone inválido (use DDD + número).';
        if (d.whatsapp && !Nexo.validar.telefone(d.whatsapp)) erros.whatsapp = 'WhatsApp inválido.';

        if (d.cep && digitos(d.cep).length !== 8) erros.cep = 'CEP deve ter 8 dígitos.';
        if (!d.cidade) erros.cidade = 'Informe a cidade.';
        if (!d.uf) erros.uf = 'Selecione a UF.';
        return erros;
    }

    /* id = null cadastra; id existente edita. voltarAoDetalhe reabre o detalhe ao salvar. */
    function abrirFormulario(id, voltarAoDetalhe) {
        var cliente = id ? Nexo.db.obter('clientes', id) : null;
        if (id && !cliente) { Nexo.ui.toast('Cliente não encontrado.', 'erro'); return; }

        Nexo.ui.abrirModal({
            titulo: cliente ? 'Editar Cliente' : 'Cadastrar Cliente',
            largura: 'max-w-3xl',
            html: htmlFormulario(cliente),
            aoAbrir: ligarFormulario,
            botoes: [
                { texto: 'Cancelar', classe: 'nexo-btn-secundario', acao: function () { if (voltarAoDetalhe) abrirDetalhe(id); } },
                {
                    texto: cliente ? 'Salvar alterações' : 'Cadastrar', classe: 'nexo-btn-primario', icone: 'fa-check',
                    acao: function (modal, corpo) {
                        var form = corpo.querySelector('form');
                        var d = Nexo.ui.lerFormulario(form);
                        var erros = validarCliente(d, id);
                        if (!Nexo.ui.mostrarErros(form, erros)) return false;

                        var pj = d.tipo === 'PJ';
                        var dados = {
                            tipo: d.tipo,
                            nome: pj ? (d.nomeFantasia || d.razaoSocial) : d.nome,
                            razaoSocial: pj ? d.razaoSocial : '',
                            nomeFantasia: pj ? d.nomeFantasia : '',
                            responsavel: pj ? d.responsavel : '',
                            dataNascimento: pj ? '' : d.dataNascimento,
                            documento: pj ? Nexo.mascara.cnpj(d.documento) : Nexo.mascara.cpf(d.documento),
                            email: d.email,
                            telefone: d.telefone,
                            whatsapp: d.whatsapp,
                            endereco: { cep: d.cep, logradouro: d.logradouro, numero: d.numero, complemento: d.complemento, bairro: d.bairro, cidade: d.cidade, uf: d.uf },
                            revendedorId: d.revendedorId || null,
                            observacoes: d.observacoes,
                            status: d.status
                        };
                        var salvo;
                        if (cliente) {
                            salvo = Nexo.db.atualizar('clientes', cliente.id, dados);
                            Nexo.registrarAtividade('cliente', 'Cliente ' + salvo.nome + ' atualizado', 'clientes.html?id=' + salvo.id);
                            Nexo.ui.toast('Cliente atualizado com sucesso.');
                        } else {
                            dados.comentarios = [];
                            salvo = Nexo.db.inserir('clientes', dados);
                            Nexo.registrarAtividade('cliente', 'Cliente ' + salvo.nome + ' cadastrado', 'clientes.html?id=' + salvo.id);
                            Nexo.ui.toast('Cliente cadastrado com sucesso.');
                        }
                        desenhar();
                        if (voltarAoDetalhe) abrirDetalhe(salvo.id);
                        return true;
                    }
                }
            ]
        });
    }

    /* ------------------------------------------------------------------ */
    /* Exclusão                                                            */
    /* ------------------------------------------------------------------ */
    function excluirCliente(id, aposExcluir) {
        var c = Nexo.db.obter('clientes', id);
        if (!c) return;
        var qtd = pedidosDoCliente(id).length;

        if (qtd > 0) {
            /* cliente com pedidos não pode ser excluído: sugere inativar */
            if (c.status === 'Inativo') {
                Nexo.ui.toast('Este cliente tem ' + qtd + ' pedido(s) e não pode ser excluído. Ele já está inativo.', 'aviso');
                return;
            }
            Nexo.ui.confirmar('Não é possível excluir', 'O cliente "' + c.nome + '" possui ' + qtd + ' pedido(s) no histórico. Deseja inativá-lo em vez de excluir?', { textoOk: 'Inativar cliente' }).then(function (ok) {
                if (!ok) return;
                Nexo.db.atualizar('clientes', id, { status: 'Inativo' });
                Nexo.registrarAtividade('cliente', 'Cliente ' + c.nome + ' inativado', 'clientes.html?id=' + id);
                Nexo.ui.toast('Cliente inativado.');
                desenhar();
                if (aposExcluir) aposExcluir(false);
            });
            return;
        }
        Nexo.ui.confirmar('Excluir cliente?', 'O cliente "' + c.nome + '" será removido permanentemente.', { textoOk: 'Excluir', perigo: true }).then(function (ok) {
            if (!ok) return;
            Nexo.db.remover('clientes', id);
            Nexo.registrarAtividade('cliente', 'Cliente ' + c.nome + ' excluído', 'clientes.html');
            Nexo.ui.toast('Cliente excluído.');
            desenhar();
            if (aposExcluir) aposExcluir(true);
        });
    }

    /* ------------------------------------------------------------------ */
    /* Detalhes                                                            */
    /* ------------------------------------------------------------------ */
    function campo(rotulo, valor) {
        return '<div><p class="text-xs font-semibold text-gray-400">' + rotulo + '</p><p class="text-sm text-gray-800 break-words">' + (valor || '<span class="text-gray-400">-</span>') + '</p></div>';
    }

    function htmlDetalhe(c) {
        var e = c.endereco || {};
        var pj = c.tipo === 'PJ';
        var pedidos = pedidosDoCliente(c.id);
        var validos = pedidos.filter(function (p) { return p.status !== 'Cancelado'; });
        var total = validos.reduce(function (s, p) { return s + (Number(p.total) || 0); }, 0);
        var rev = c.revendedorId ? Nexo.db.obter('revendedores', c.revendedorId) : null;

        /* produto mais comprado (por quantidade) */
        var qtdProd = {};
        validos.forEach(function (p) {
            (p.itens || []).forEach(function (it) {
                var x = qtdProd[it.produtoId] || (qtdProd[it.produtoId] = { nome: it.nome, q: 0 });
                x.q += Number(it.quantidade) || 0;
            });
        });
        var topo = Object.keys(qtdProd).sort(function (a, b) { return qtdProd[b].q - qtdProd[a].q; })[0];
        var topoHtml = topo ? (Nexo.db.obter('produtos', topo)
            ? '<a href="produtos.html?id=' + esc(topo) + '" class="text-brand-purple hover:underline">' + esc(qtdProd[topo].nome) + '</a>'
            : esc(qtdProd[topo].nome)) + ' <span class="text-xs text-gray-400">(' + qtdProd[topo].q + ' un.)</span>' : '-';

        var tel = digitos(c.telefone), wpp = digitos(c.whatsapp);
        var enderecoTxt = [e.logradouro ? e.logradouro + (e.numero ? ', ' + e.numero : '') : '', e.complemento, e.bairro].filter(Boolean).join(' - ');

        var linhasPedidos = pedidos.length ? pedidos.map(function (p) {
            var itens = (p.itens || []).map(function (it) { return it.quantidade + 'x ' + it.nome; }).join(', ');
            return '<tr class="hover:bg-gray-50">' +
                '<td class="px-4 py-2.5 whitespace-nowrap"><a href="pedidos.html?id=' + esc(p.id) + '" class="font-bold text-brand-purple hover:underline">#' + esc(p.numero) + '</a></td>' +
                '<td class="px-4 py-2.5 whitespace-nowrap">' + Nexo.fmt.data(p.data) + '</td>' +
                '<td class="px-4 py-2.5 text-gray-600 max-w-[260px] truncate" title="' + esc(itens) + '">' + esc(itens) + '</td>' +
                '<td class="px-4 py-2.5 text-right whitespace-nowrap">' + Nexo.fmt.moeda(p.total) + '</td>' +
                '<td class="px-4 py-2.5 whitespace-nowrap">' + esc((p.pagamento || {}).forma) + ' ' + Nexo.ui.badgeStatus((p.pagamento || {}).status || 'Pendente') + '</td>' +
                '<td class="px-4 py-2.5">' + Nexo.ui.badgeStatus(p.status) + '</td></tr>';
        }).join('') : '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-500">Este cliente ainda não fez pedidos.</td></tr>';

        var comentarios = (c.comentarios || []).slice().sort(function (a, b) { return a.data < b.data ? 1 : -1; });
        var htmlComentarios = comentarios.length ? comentarios.map(function (m) {
            return '<div class="border border-gray-100 rounded-xl p-3 bg-gray-50 flex items-start justify-between gap-3">' +
                '<div class="min-w-0"><p class="text-sm text-gray-800 whitespace-pre-line break-words">' + esc(m.texto) + '</p>' +
                '<p class="text-xs text-gray-400 mt-1">' + esc(m.autor) + ' em ' + Nexo.fmt.dataHora(m.data) + '</p></div>' +
                '<button type="button" data-det="del-coment" data-cid="' + esc(m.id) + '" title="Excluir comentário" class="text-gray-400 hover:text-red-500 shrink-0"><i class="fa-solid fa-trash text-xs"></i></button></div>';
        }).join('') : '<p class="text-sm text-gray-400">Nenhum comentário ainda.</p>';

        var card = 'border border-gray-100 rounded-2xl p-4';
        var titulo = function (icone, t) { return '<h3 class="text-sm font-bold text-gray-900 mb-3"><i class="fa-solid ' + icone + ' text-brand-purple mr-2"></i>' + t + '</h3>'; };

        return '' +
            '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">' +
            '  <div class="flex items-center gap-3 min-w-0">' +
            '    <div class="w-12 h-12 rounded-full bg-purple-100 text-brand-purple flex items-center justify-center font-bold shrink-0">' + esc(iniciais(c.nome)) + '</div>' +
            '    <div class="min-w-0"><p class="text-lg font-extrabold text-gray-900 truncate">' + esc(c.nome) + '</p>' +
            '    <p class="text-xs text-gray-500">' + (pj ? 'Pessoa Jurídica' : 'Pessoa Física') + ' &middot; ' + esc(c.documento) + ' &middot; ' + Nexo.ui.badgeStatus(c.status || 'Ativo') + '</p></div></div>' +
            '  <div class="flex flex-wrap gap-2">' +
            '    <a href="pedidos.html" class="nexo-btn nexo-btn-primario"><i class="fa-solid fa-cart-plus"></i> Novo pedido</a>' +
            '    <button type="button" data-det="editar" class="nexo-btn nexo-btn-secundario"><i class="fa-solid fa-pen"></i> Editar</button>' +
            '    <button type="button" data-det="excluir" class="nexo-btn nexo-btn-secundario text-red-600"><i class="fa-solid fa-trash"></i> Excluir</button>' +
            '  </div></div>' +

            '<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">' +
            '  <div class="bg-brand-purpleLight rounded-xl p-3"><p class="text-xs font-semibold text-gray-500">Total comprado</p><p class="text-lg font-extrabold text-gray-900">' + Nexo.fmt.moeda(total) + '</p></div>' +
            '  <div class="bg-brand-purpleLight rounded-xl p-3"><p class="text-xs font-semibold text-gray-500">Pedidos</p><p class="text-lg font-extrabold text-gray-900">' + validos.length + '</p></div>' +
            '  <div class="bg-brand-purpleLight rounded-xl p-3"><p class="text-xs font-semibold text-gray-500">Ticket médio</p><p class="text-lg font-extrabold text-gray-900">' + Nexo.fmt.moeda(validos.length ? total / validos.length : 0) + '</p></div>' +
            '  <div class="bg-brand-purpleLight rounded-xl p-3"><p class="text-xs font-semibold text-gray-500">Produto mais comprado</p><p class="text-sm font-bold text-gray-900">' + topoHtml + '</p></div>' +
            '</div>' +

            '<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">' +
            '  <div class="' + card + '">' + titulo('fa-id-card', pj ? 'Dados empresariais' : 'Dados pessoais') + '<div class="grid grid-cols-2 gap-3">' +
            (pj ? campo('Razão social', esc(c.razaoSocial || c.nome)) + campo('Nome fantasia', esc(c.nomeFantasia)) + campo('CNPJ', esc(c.documento)) + campo('Responsável', esc(c.responsavel))
                : campo('Nome', esc(c.nome)) + campo('CPF', esc(c.documento)) + campo('Nascimento', c.dataNascimento ? Nexo.fmt.data(c.dataNascimento) : '')) +
            campo('Cliente desde', c.criadoEm ? Nexo.fmt.data(c.criadoEm) : '') + '</div></div>' +

            '  <div class="' + card + '">' + titulo('fa-phone', 'Contato') + '<div class="grid grid-cols-1 gap-3">' +
            campo('E-mail', c.email ? '<a href="mailto:' + esc(c.email) + '" class="text-brand-purple hover:underline">' + esc(c.email) + '</a>' : '') +
            campo('Telefone', tel ? '<a href="tel:+55' + tel + '" class="text-brand-purple hover:underline">' + esc(c.telefone) + '</a>' : '') +
            campo('WhatsApp', wpp ? '<a href="https://wa.me/55' + wpp + '" target="_blank" rel="noopener" class="text-green-600 hover:underline"><i class="fa-brands fa-whatsapp"></i> ' + esc(c.whatsapp) + '</a>'
                : (tel ? '<span class="text-gray-400">Não informado (<a href="https://wa.me/55' + tel + '" target="_blank" rel="noopener" class="text-green-600 hover:underline">tentar o telefone</a>)</span>' : '')) +
            '</div></div>' +

            '  <div class="' + card + '">' + titulo('fa-location-dot', 'Endereço') + '<div class="grid grid-cols-2 gap-3">' +
            '<div class="col-span-2">' + campo('Logradouro', esc(enderecoTxt)) + '</div>' +
            campo('Cidade/UF', e.cidade ? esc(e.cidade + (e.uf ? ' - ' + e.uf : '')) : '') + campo('CEP', esc(e.cep)) + '</div></div>' +

            '  <div class="' + card + '">' + titulo('fa-handshake', 'Revendedor vinculado') +
            (rev ? '<p class="text-sm"><a href="revendedores.html?id=' + esc(rev.id) + '" class="font-bold text-brand-purple hover:underline">' + esc(rev.nome) + '</a> ' + Nexo.ui.badgeStatus(rev.status) + '</p>' +
                '<p class="text-xs text-gray-500 mt-1">Desconto: ' + esc(rev.desconto) + '% &middot; Condição: ' + esc(rev.condicaoPagamento) + '</p>'
                : '<p class="text-sm text-gray-400">Nenhum revendedor vinculado.</p>') + '</div>' +
            '</div>' +

            '<div class="' + card + ' mb-5 overflow-hidden">' + titulo('fa-clock-rotate-left', 'Histórico de pedidos (' + pedidos.length + ')') +
            '<div class="overflow-x-auto -mx-4"><table class="w-full text-left text-xs min-w-[640px]"><thead class="bg-gray-50 text-gray-500"><tr>' +
            '<th class="px-4 py-2 font-bold">Pedido</th><th class="px-4 py-2 font-bold">Data</th><th class="px-4 py-2 font-bold">Itens</th><th class="px-4 py-2 font-bold text-right">Total</th><th class="px-4 py-2 font-bold">Pagamento</th><th class="px-4 py-2 font-bold">Status</th></tr></thead>' +
            '<tbody class="divide-y divide-gray-100">' + linhasPedidos + '</tbody></table></div></div>' +

            '<div class="' + card + '">' + titulo('fa-comments', 'Observações e comentários') +
            '<p class="text-xs font-semibold text-gray-400 mb-1">Observações gerais</p>' +
            '<p class="text-sm text-gray-800 whitespace-pre-line mb-4">' + (c.observacoes ? esc(c.observacoes) : '<span class="text-gray-400">Nenhuma observação.</span>') + '</p>' +
            '<div class="space-y-2 mb-3">' + htmlComentarios + '</div>' +
            '<div class="flex flex-col sm:flex-row gap-2"><textarea data-det-texto rows="2" class="nexo-input" placeholder="Escreva um comentário sobre este cliente..."></textarea>' +
            '<button type="button" data-det="add-coment" class="nexo-btn nexo-btn-primario sm:self-start"><i class="fa-solid fa-paper-plane"></i> Adicionar</button></div></div>';
    }

    function abrirDetalhe(id) {
        if (!Nexo.db.obter('clientes', id)) { Nexo.ui.toast('Cliente não encontrado.', 'erro'); return; }

        var modal = Nexo.ui.abrirModal({
            titulo: 'Detalhes do Cliente',
            largura: 'max-w-4xl',
            html: '',
            botoes: [{ texto: 'Fechar', classe: 'nexo-btn-secundario', acao: 'fechar' }],
            aoFechar: function () {
                /* limpa o ?id= da URL (ignora erro em file://) */
                try { if (Nexo.ui.parametro('id')) history.replaceState(null, '', location.pathname); } catch (e) { /* ignora */ }
            }
        });

        function redesenhar() {
            var c = Nexo.db.obter('clientes', id);
            if (!c) { modal.fechar(); return; }
            modal.el.innerHTML = htmlDetalhe(c);
        }

        modal.el.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-det]');
            if (!btn) return;
            var acao = btn.getAttribute('data-det');
            var c = Nexo.db.obter('clientes', id);

            if (acao === 'editar') { modal.fechar(); abrirFormulario(id, true); }
            if (acao === 'excluir') {
                excluirCliente(id, function (excluiu) { if (excluiu) modal.fechar(); else redesenhar(); });
            }
            if (acao === 'add-coment') {
                var area = modal.el.querySelector('[data-det-texto]');
                var texto = area.value.trim();
                if (!texto) { Nexo.ui.toast('Escreva o comentário antes de adicionar.', 'aviso'); area.focus(); return; }
                var lista = (c.comentarios || []).concat([{ id: Nexo.gerarId('com'), texto: texto, autor: (Nexo.auth.usuarioAtual() || {}).nome || 'Sistema', data: new Date().toISOString() }]);
                Nexo.db.atualizar('clientes', id, { comentarios: lista });
                Nexo.registrarAtividade('cliente', 'Comentário adicionado ao cliente ' + c.nome, 'clientes.html?id=' + id);
                Nexo.ui.toast('Comentário adicionado.');
                redesenhar();
            }
            if (acao === 'del-coment') {
                var cid = btn.getAttribute('data-cid');
                Nexo.ui.confirmar('Excluir comentário?', 'Esta ação não pode ser desfeita.', { textoOk: 'Excluir', perigo: true }).then(function (ok) {
                    if (!ok) return;
                    var atual = Nexo.db.obter('clientes', id);
                    Nexo.db.atualizar('clientes', id, { comentarios: (atual.comentarios || []).filter(function (m) { return m.id !== cid; }) });
                    Nexo.ui.toast('Comentário excluído.');
                    redesenhar();
                });
            }
        });
        redesenhar();
    }
})();
