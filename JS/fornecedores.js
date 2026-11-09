/*
 * NEXO ERP - Tela de Fornecedores
 * Lista, busca/filtros, cadastro/edição (com marcas em tags), detalhes com
 * produtos fornecidos e histórico de compras, nova compra e recebimento.
 * Dados vêm de Nexo.db (localStorage); compras usam Nexo.ops.
 */
(function () {
    'use strict';

    var UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
    var esc = Nexo.esc;
    var $ = function (id) { return document.getElementById(id); };

    /* Estado: página atual, estatísticas por fornecedor, lista filtrada e detalhe aberto */
    var estado = { pagina: 1, stats: {}, lista: [], detalhe: null };

    if (Nexo.layout.montar('fornecedores')) { iniciar(); }

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
    function nomeForn(f) { return f.nomeFantasia || f.razaoSocial || 'Fornecedor'; }
    function cidadeUF(f) { return f.cidade ? f.cidade + (f.uf ? ' - ' + f.uf : '') : '-'; }
    function produtosDoFornecedor(id) {
        return Nexo.db.listar('produtos').filter(function (p) { return p.fornecedorId === id; });
    }
    function comprasDoFornecedor(id) {
        return Nexo.db.listar('compras').filter(function (c) { return c.fornecedorId === id; })
            .sort(function (a, b) { return a.data < b.data ? 1 : -1; });
    }
    function chips(marcas) {
        if (!marcas || !marcas.length) return '<span class="text-gray-400">-</span>';
        return marcas.map(function (m) {
            return '<span class="inline-block bg-brand-purpleLight text-brand-purple border border-purple-100 px-2 py-0.5 rounded-md font-semibold mr-1 mb-1">' + esc(m) + '</span>';
        }).join('');
    }
    function selectUF(valor) {
        return '<option value="">UF</option>' + UFS.map(function (u) {
            return '<option value="' + u + '"' + (u === valor ? ' selected' : '') + '>' + u + '</option>';
        }).join('');
    }

    /* Total comprado e nº de compras por fornecedor */
    function calcularStats() {
        var s = {};
        Nexo.db.listar('compras').forEach(function (c) {
            var x = s[c.fornecedorId] || (s[c.fornecedorId] = { compras: 0, total: 0 });
            x.compras++;
            x.total += Number(c.total) || 0;
        });
        Nexo.db.listar('produtos').forEach(function (p) {
            if (!p.fornecedorId) return;
            var x = s[p.fornecedorId] || (s[p.fornecedorId] = { compras: 0, total: 0 });
            x.produtos = (x.produtos || 0) + 1;
        });
        return s;
    }
    function statDe(id) {
        var x = estado.stats[id] || {};
        return { compras: x.compras || 0, total: x.total || 0, produtos: x.produtos || 0 };
    }

    /* ------------------------------------------------------------------ */
    /* Inicialização                                                       */
    /* ------------------------------------------------------------------ */
    function iniciar() {
        $('fBusca').addEventListener('input', function () { estado.pagina = 1; desenhar(); });
        ['fStatus', 'fUf', 'fMarca'].forEach(function (id) {
            $(id).addEventListener('change', function () { estado.pagina = 1; desenhar(); });
        });
        $('btnLimpar').addEventListener('click', function () {
            $('fBusca').value = '';
            ['fStatus', 'fUf', 'fMarca'].forEach(function (id) { $(id).value = ''; });
            estado.pagina = 1;
            desenhar();
        });
        $('btnCadastrar').addEventListener('click', function () { abrirFormulario(null); });
        $('btnExportar').addEventListener('click', exportar);

        $('tabelaFornecedores').addEventListener('click', function (e) {
            var btn = e.target.closest('[data-acao]');
            if (btn) {
                e.stopPropagation();
                var id = btn.getAttribute('data-id');
                var acao = btn.getAttribute('data-acao');
                if (acao === 'ver') abrirDetalhe(id);
                if (acao === 'editar') abrirFormulario(id);
                if (acao === 'excluir') excluirFornecedor(id);
                return;
            }
            var linha = e.target.closest('tr[data-id]');
            if (linha) abrirDetalhe(linha.getAttribute('data-id'));
        });

        window.fornecedoresIrPagina = function (n) { estado.pagina = n; desenhar(); };

        desenhar();

        /* fornecedores.html?id=XYZ abre direto o detalhe */
        var idUrl = Nexo.ui.parametro('id');
        if (idUrl) {
            if (Nexo.db.obter('fornecedores', idUrl)) abrirDetalhe(idUrl);
            else Nexo.ui.toast('Fornecedor não encontrado.', 'erro');
        }
    }

    /* ------------------------------------------------------------------ */
    /* Lista, métricas e filtros                                           */
    /* ------------------------------------------------------------------ */
    function preencherFiltros(fornecedores) {
        var ufAtual = $('fUf').value, marcaAtual = $('fMarca').value;
        var ufs = {}, marcas = {};
        fornecedores.forEach(function (f) {
            if (f.uf) ufs[f.uf] = true;
            (f.marcas || []).forEach(function (m) { marcas[m] = true; });
        });
        $('fUf').innerHTML = '<option value="">Todos</option>' + Object.keys(ufs).sort().map(function (u) {
            return '<option value="' + esc(u) + '"' + (u === ufAtual ? ' selected' : '') + '>' + esc(u) + '</option>';
        }).join('');
        $('fMarca').innerHTML = '<option value="">Todas</option>' + Object.keys(marcas).sort().map(function (m) {
            return '<option value="' + esc(m) + '"' + (m === marcaAtual ? ' selected' : '') + '>' + esc(m) + '</option>';
        }).join('');
    }

    function filtrar(fornecedores) {
        var busca = semAcento($('fBusca').value.trim());
        var buscaNum = digitos(busca);
        var status = $('fStatus').value, uf = $('fUf').value, marca = $('fMarca').value;
        return fornecedores.filter(function (f) {
            if (status && f.status !== status) return false;
            if (uf && f.uf !== uf) return false;
            if (marca && (f.marcas || []).indexOf(marca) === -1) return false;
            if (busca) {
                var texto = semAcento([f.razaoSocial, f.nomeFantasia, f.cnpj, f.contato, f.email].join(' '));
                var achou = texto.indexOf(busca) !== -1 || (buscaNum.length >= 3 && digitos(f.cnpj).indexOf(buscaNum) !== -1);
                if (!achou) return false;
            }
            return true;
        }).sort(function (a, b) { return semAcento(nomeForn(a)).localeCompare(semAcento(nomeForn(b))); });
    }

    function desenhar() {
        var fornecedores = Nexo.db.listar('fornecedores');
        estado.stats = calcularStats();
        preencherFiltros(fornecedores);

        var comprado = 0;
        Object.keys(estado.stats).forEach(function (id) { comprado += estado.stats[id].total || 0; });
        $('mTotal').textContent = Nexo.fmt.numero(fornecedores.length);
        $('mAtivos').textContent = Nexo.fmt.numero(fornecedores.filter(function (f) { return f.status === 'Ativo'; }).length);
        $('mInativos').textContent = Nexo.fmt.numero(fornecedores.filter(function (f) { return f.status === 'Inativo'; }).length);
        $('mComprado').textContent = Nexo.fmt.moeda(comprado);

        estado.lista = filtrar(fornecedores);
        var info = Nexo.ui.paginar(estado.lista, estado.pagina);
        estado.pagina = info.pagina;

        if (!info.itens.length) {
            $('tabelaFornecedores').innerHTML = '<tr><td colspan="11" class="px-5 py-12 text-center text-gray-500">' +
                '<i class="fa-solid fa-magnifying-glass text-2xl mb-2"></i><p class="font-semibold">Nenhum fornecedor encontrado.</p>' +
                '<p class="text-xs mt-1">Ajuste os filtros ou cadastre um novo fornecedor.</p></td></tr>';
            $('paginacao').innerHTML = '';
            return;
        }

        $('tabelaFornecedores').innerHTML = info.itens.map(function (f) {
            var st = statDe(f.id);
            return '<tr class="hover:bg-gray-50 transition cursor-pointer" data-id="' + esc(f.id) + '">' +
                '<td class="px-4 py-3"><div class="flex items-center gap-3">' +
                '<div class="w-8 h-8 rounded-full bg-purple-100 text-brand-purple flex items-center justify-center font-bold text-xs shrink-0">' + esc(iniciais(nomeForn(f))) + '</div>' +
                '<div class="min-w-0"><p class="font-bold text-gray-900">' + esc(nomeForn(f)) + '</p>' +
                '<p class="text-gray-400 truncate max-w-[240px]" title="' + esc(f.razaoSocial) + '">' + esc(f.razaoSocial) + '</p></div></div></td>' +
                '<td class="px-4 py-3 text-gray-600 whitespace-nowrap">' + esc(f.cnpj) + '</td>' +
                '<td class="px-4 py-3 text-gray-600">' + esc(f.contato) + '</td>' +
                '<td class="px-4 py-3 text-gray-600 whitespace-nowrap">' + esc(f.telefone) + '</td>' +
                '<td class="px-4 py-3 text-gray-600">' + esc(cidadeUF(f)) + '</td>' +
                '<td class="px-4 py-3 max-w-[220px]">' + chips(f.marcas) + '</td>' +
                '<td class="px-4 py-3 text-center whitespace-nowrap">' + (f.prazoEntrega !== undefined && f.prazoEntrega !== '' ? esc(f.prazoEntrega) + ' dias' : '-') + '</td>' +
                '<td class="px-4 py-3 text-center">' + st.produtos + '</td>' +
                '<td class="px-4 py-3 text-right whitespace-nowrap">' + Nexo.fmt.moeda(st.total) + '</td>' +
                '<td class="px-4 py-3 text-center">' + Nexo.ui.badgeStatus(f.status || 'Ativo') + '</td>' +
                '<td class="px-4 py-3"><div class="flex justify-center gap-1">' +
                '<button type="button" data-acao="ver" data-id="' + esc(f.id) + '" title="Visualizar" class="w-7 h-7 rounded-full text-brand-purple hover:bg-brand-purpleLight"><i class="fa-regular fa-eye"></i></button>' +
                '<button type="button" data-acao="editar" data-id="' + esc(f.id) + '" title="Editar" class="w-7 h-7 rounded-full text-blue-600 hover:bg-blue-50"><i class="fa-solid fa-pen"></i></button>' +
                '<button type="button" data-acao="excluir" data-id="' + esc(f.id) + '" title="Excluir" class="w-7 h-7 rounded-full text-red-500 hover:bg-red-50"><i class="fa-solid fa-trash"></i></button>' +
                '</div></td></tr>';
        }).join('');
        $('paginacao').innerHTML = Nexo.ui.htmlPaginacao(info, 'fornecedoresIrPagina');
    }

    function exportar() {
        if (!estado.lista.length) { Nexo.ui.toast('Não há fornecedores para exportar.', 'aviso'); return; }
        var linhas = estado.lista.map(function (f) {
            var st = statDe(f.id);
            return [f.razaoSocial, f.nomeFantasia, f.cnpj, f.contato, f.email, f.telefone, f.cidade || '', f.uf || '',
                (f.marcas || []).join(', '), f.prazoEntrega, f.condicaoPagamento || '', st.produtos, st.total, f.status];
        });
        Nexo.exportarCSV('fornecedores', ['Razão social', 'Nome fantasia', 'CNPJ', 'Contato', 'E-mail', 'Telefone', 'Cidade', 'UF', 'Marcas', 'Prazo de entrega (dias)', 'Condição de pagamento', 'Produtos', 'Total comprado', 'Status'], linhas);
        Nexo.ui.toast('Exportação concluída (' + linhas.length + ' fornecedores).');
    }

    /* ------------------------------------------------------------------ */
    /* Cadastro e edição                                                   */
    /* ------------------------------------------------------------------ */
    function htmlFormulario(f) {
        f = f || { status: 'Ativo' };
        var v = function (x) { return esc(x === undefined || x === null ? '' : x); };
        return '<form novalidate class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
            '<div><label class="nexo-label">Razão social *</label><input name="razaoSocial" class="nexo-input" value="' + v(f.razaoSocial) + '"></div>' +
            '<div><label class="nexo-label">Nome fantasia</label><input name="nomeFantasia" class="nexo-input" value="' + v(f.nomeFantasia) + '"></div>' +
            '<div><label class="nexo-label">CNPJ *</label><input name="cnpj" class="nexo-input" inputmode="numeric" placeholder="00.000.000/0000-00" value="' + v(f.cnpj) + '"></div>' +
            '<div><label class="nexo-label">Pessoa de contato *</label><input name="contato" class="nexo-input" value="' + v(f.contato) + '"></div>' +
            '<div><label class="nexo-label">E-mail *</label><input type="email" name="email" class="nexo-input" value="' + v(f.email) + '"></div>' +
            '<div><label class="nexo-label">Telefone *</label><input name="telefone" class="nexo-input" inputmode="tel" placeholder="(00) 00000-0000" value="' + v(f.telefone) + '"></div>' +
            '<div><label class="nexo-label">Cidade *</label><input name="cidade" class="nexo-input" value="' + v(f.cidade) + '"></div>' +
            '<div><label class="nexo-label">UF *</label><select name="uf" class="nexo-input">' + selectUF(f.uf) + '</select></div>' +
            '<div class="sm:col-span-2"><label class="nexo-label">Marcas fornecidas</label>' +
            '<div data-tags class="flex flex-wrap gap-2 mb-2"></div>' +
            '<div class="flex gap-2"><input data-nova-marca class="nexo-input" placeholder="Digite a marca e pressione Enter"><button type="button" data-add-marca class="nexo-btn nexo-btn-secundario shrink-0"><i class="fa-solid fa-plus"></i> Adicionar</button></div></div>' +
            '<div><label class="nexo-label">Prazo de entrega (dias) *</label><input type="number" min="0" step="1" name="prazoEntrega" class="nexo-input" value="' + v(f.prazoEntrega) + '"></div>' +
            '<div><label class="nexo-label">Condição de pagamento</label><input name="condicaoPagamento" class="nexo-input" placeholder="Ex.: 30/60 dias" value="' + v(f.condicaoPagamento) + '"></div>' +
            '<div><label class="nexo-label">Status</label><select name="status" class="nexo-input"><option value="Ativo"' + (f.status !== 'Inativo' ? ' selected' : '') + '>Ativo</option><option value="Inativo"' + (f.status === 'Inativo' ? ' selected' : '') + '>Inativo</option></select></div>' +
            '<div class="sm:col-span-2"><label class="nexo-label">Observações</label><textarea name="observacoes" rows="3" class="nexo-input">' + v(f.observacoes) + '</textarea></div>' +
            '</form>';
    }

    /* Editor de marcas (tags). Retorna objeto com a lista atual. */
    function ligarMarcas(el, marcasIniciais) {
        var marcas = (marcasIniciais || []).slice();
        var area = el.querySelector('[data-tags]');
        var campoMarca = el.querySelector('[data-nova-marca]');

        function desenharTags() {
            area.innerHTML = marcas.length ? marcas.map(function (m, i) {
                return '<span class="inline-flex items-center gap-2 bg-brand-purpleLight text-brand-purple border border-purple-100 px-2.5 py-1 rounded-full text-xs font-semibold">' + esc(m) +
                    '<button type="button" data-rm="' + i + '" class="hover:text-red-500" aria-label="Remover ' + esc(m) + '"><i class="fa-solid fa-xmark"></i></button></span>';
            }).join('') : '<span class="text-xs text-gray-400">Nenhuma marca adicionada.</span>';
        }
        function adicionar() {
            var texto = campoMarca.value.trim();
            if (!texto) return;
            var existe = marcas.some(function (m) { return semAcento(m) === semAcento(texto); });
            if (!existe) marcas.push(texto);
            campoMarca.value = '';
            desenharTags();
        }
        area.addEventListener('click', function (e) {
            var b = e.target.closest('[data-rm]');
            if (!b) return;
            marcas.splice(Number(b.getAttribute('data-rm')), 1);
            desenharTags();
        });
        el.querySelector('[data-add-marca]').addEventListener('click', adicionar);
        campoMarca.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); adicionar(); }
        });
        desenharTags();
        return { obter: function () { adicionar(); return marcas.slice(); } };
    }

    function validarFornecedor(d, idAtual) {
        var erros = {};
        if (!d.razaoSocial) erros.razaoSocial = 'Informe a razão social.';
        if (!d.cnpj) erros.cnpj = 'Informe o CNPJ.';
        else if (!Nexo.validar.cnpj(d.cnpj)) erros.cnpj = 'CNPJ inválido.';
        else {
            var dig = digitos(d.cnpj);
            var repetido = Nexo.db.listar('fornecedores').some(function (f) { return f.id !== idAtual && digitos(f.cnpj) === dig; });
            if (repetido) erros.cnpj = 'Já existe um fornecedor com este CNPJ.';
        }
        if (!d.contato) erros.contato = 'Informe a pessoa de contato.';
        if (!d.email) erros.email = 'Informe o e-mail.';
        else if (!Nexo.validar.email(d.email)) erros.email = 'E-mail inválido.';
        if (!d.telefone) erros.telefone = 'Informe o telefone.';
        else if (!Nexo.validar.telefone(d.telefone)) erros.telefone = 'Telefone inválido (use DDD + número).';
        if (!d.cidade) erros.cidade = 'Informe a cidade.';
        if (!d.uf) erros.uf = 'Selecione a UF.';
        if (d.prazoEntrega === '') erros.prazoEntrega = 'Informe o prazo de entrega.';
        else if (isNaN(Number(d.prazoEntrega)) || Number(d.prazoEntrega) < 0) erros.prazoEntrega = 'O prazo deve ser um número maior ou igual a 0.';
        return erros;
    }

    function abrirFormulario(id, voltarAoDetalhe) {
        var forn = id ? Nexo.db.obter('fornecedores', id) : null;
        if (id && !forn) { Nexo.ui.toast('Fornecedor não encontrado.', 'erro'); return; }
        var editorMarcas;

        Nexo.ui.abrirModal({
            titulo: forn ? 'Editar Fornecedor' : 'Cadastrar Fornecedor',
            largura: 'max-w-3xl',
            html: htmlFormulario(forn),
            aoAbrir: function (el) {
                var form = el.querySelector('form');
                Nexo.mascara.aplicar(form.elements.cnpj, 'cnpj');
                Nexo.mascara.aplicar(form.elements.telefone, 'telefone');
                editorMarcas = ligarMarcas(el, forn ? forn.marcas : []);
            },
            botoes: [
                { texto: 'Cancelar', classe: 'nexo-btn-secundario', acao: function () { if (voltarAoDetalhe) abrirDetalhe(id); } },
                {
                    texto: forn ? 'Salvar alterações' : 'Cadastrar', classe: 'nexo-btn-primario', icone: 'fa-check',
                    acao: function (modal, corpo) {
                        var form = corpo.querySelector('form');
                        var d = Nexo.ui.lerFormulario(form);
                        var erros = validarFornecedor(d, id);
                        if (!Nexo.ui.mostrarErros(form, erros)) return false;

                        var dados = {
                            razaoSocial: d.razaoSocial,
                            nomeFantasia: d.nomeFantasia,
                            cnpj: Nexo.mascara.cnpj(d.cnpj),
                            contato: d.contato,
                            email: d.email,
                            telefone: d.telefone,
                            cidade: d.cidade,
                            uf: d.uf,
                            endereco: { cidade: d.cidade, uf: d.uf },
                            marcas: editorMarcas.obter(),
                            prazoEntrega: Math.round(Number(d.prazoEntrega)),
                            condicaoPagamento: d.condicaoPagamento,
                            status: d.status,
                            observacoes: d.observacoes
                        };
                        var salvo;
                        if (forn) {
                            salvo = Nexo.db.atualizar('fornecedores', forn.id, dados);
                            Nexo.registrarAtividade('fornecedor', 'Fornecedor ' + nomeForn(salvo) + ' atualizado', 'fornecedores.html?id=' + salvo.id);
                            Nexo.ui.toast('Fornecedor atualizado com sucesso.');
                        } else {
                            salvo = Nexo.db.inserir('fornecedores', dados);
                            Nexo.registrarAtividade('fornecedor', 'Fornecedor ' + nomeForn(salvo) + ' cadastrado', 'fornecedores.html?id=' + salvo.id);
                            Nexo.ui.toast('Fornecedor cadastrado com sucesso.');
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
    function excluirFornecedor(id, aposExcluir) {
        var f = Nexo.db.obter('fornecedores', id);
        if (!f) return;
        var nProd = produtosDoFornecedor(id).length;
        var nCompras = comprasDoFornecedor(id).length;
        if (nProd > 0 || nCompras > 0) {
            var motivos = [];
            if (nProd) motivos.push(nProd + ' produto(s) vinculado(s)');
            if (nCompras) motivos.push(nCompras + ' compra(s) registrada(s)');
            if (f.status === 'Inativo') {
                Nexo.ui.toast('Não é possível excluir: ' + motivos.join(' e ') + '. Ele já está inativo.', 'aviso');
                return;
            }
            Nexo.ui.confirmar('Não é possível excluir', 'O fornecedor "' + nomeForn(f) + '" possui ' + motivos.join(' e ') + '. Deseja inativá-lo em vez de excluir?', { textoOk: 'Inativar fornecedor' }).then(function (ok) {
                if (!ok) return;
                Nexo.db.atualizar('fornecedores', id, { status: 'Inativo' });
                Nexo.registrarAtividade('fornecedor', 'Fornecedor ' + nomeForn(f) + ' inativado', 'fornecedores.html?id=' + id);
                Nexo.ui.toast('Fornecedor inativado.');
                desenhar();
                if (aposExcluir) aposExcluir(false);
            });
            return;
        }
        Nexo.ui.confirmar('Excluir fornecedor?', 'O fornecedor "' + nomeForn(f) + '" será removido permanentemente.', { textoOk: 'Excluir', perigo: true }).then(function (ok) {
            if (!ok) return;
            Nexo.db.remover('fornecedores', id);
            Nexo.registrarAtividade('fornecedor', 'Fornecedor ' + nomeForn(f) + ' excluído', 'fornecedores.html');
            Nexo.ui.toast('Fornecedor excluído.');
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

    function htmlDetalhe(f) {
        var produtos = produtosDoFornecedor(f.id);
        var compras = comprasDoFornecedor(f.id);
        var total = compras.reduce(function (s, c) { return s + (Number(c.total) || 0); }, 0);
        var tel = digitos(f.telefone);
        var card = 'border border-gray-100 rounded-2xl p-4';
        var titulo = function (icone, t) { return '<h3 class="text-sm font-bold text-gray-900 mb-3"><i class="fa-solid ' + icone + ' text-brand-purple mr-2"></i>' + t + '</h3>'; };

        var linhasProdutos = produtos.length ? produtos.map(function (p) {
            var estoque = Number(p.estoque) || 0;
            return '<tr class="hover:bg-gray-50">' +
                '<td class="px-4 py-2.5"><a href="produtos.html?id=' + esc(p.id) + '" class="font-bold text-brand-purple hover:underline">' + esc(p.nome) + '</a><p class="text-gray-400">' + esc(p.sku) + '</p></td>' +
                '<td class="px-4 py-2.5">' + esc(p.marca) + '</td>' +
                '<td class="px-4 py-2.5 text-right">' + estoque + ' un.</td>' +
                '<td class="px-4 py-2.5 text-right whitespace-nowrap">' + Nexo.fmt.moeda(p.custo) + '</td>' +
                '<td class="px-4 py-2.5">' + Nexo.ui.badgeStatus(p.status || 'Ativo') + '</td></tr>';
        }).join('') : '<tr><td colspan="5" class="px-4 py-8 text-center text-gray-500">Nenhum produto vinculado a este fornecedor.</td></tr>';

        var linhasCompras = compras.length ? compras.map(function (c) {
            var itens = (c.itens || []).map(function (it) { return it.quantidade + 'x ' + it.nome; }).join(', ');
            var acao = c.status === 'Pendente'
                ? '<button type="button" data-det="receber" data-cid="' + esc(c.id) + '" class="nexo-btn nexo-btn-secundario !py-1 !px-2 text-xs whitespace-nowrap"><i class="fa-solid fa-box-open"></i> Marcar como recebida</button>'
                : '<span class="text-gray-400">' + (c.dataRecebimento ? Nexo.fmt.data(c.dataRecebimento) : '') + '</span>';
            return '<tr class="hover:bg-gray-50">' +
                '<td class="px-4 py-2.5 font-bold whitespace-nowrap">#' + esc(c.numero) + '</td>' +
                '<td class="px-4 py-2.5 whitespace-nowrap">' + Nexo.fmt.data(c.data) + '</td>' +
                '<td class="px-4 py-2.5 whitespace-nowrap">' + esc(c.notaFiscal || '-') + '</td>' +
                '<td class="px-4 py-2.5 text-gray-600 max-w-[240px] truncate" title="' + esc(itens) + '">' + esc(itens) + '</td>' +
                '<td class="px-4 py-2.5 text-right whitespace-nowrap">' + Nexo.fmt.moeda(c.total) + '</td>' +
                '<td class="px-4 py-2.5">' + Nexo.ui.badgeStatus(c.status) + '</td>' +
                '<td class="px-4 py-2.5">' + acao + '</td></tr>';
        }).join('') : '<tr><td colspan="7" class="px-4 py-8 text-center text-gray-500">Nenhuma compra registrada com este fornecedor.</td></tr>';

        return '' +
            '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">' +
            '  <div class="flex items-center gap-3 min-w-0">' +
            '    <div class="w-12 h-12 rounded-full bg-purple-100 text-brand-purple flex items-center justify-center font-bold shrink-0">' + esc(iniciais(nomeForn(f))) + '</div>' +
            '    <div class="min-w-0"><p class="text-lg font-extrabold text-gray-900 truncate">' + esc(nomeForn(f)) + '</p>' +
            '    <p class="text-xs text-gray-500 truncate">' + esc(f.razaoSocial) + ' &middot; ' + esc(f.cnpj) + ' &middot; ' + Nexo.ui.badgeStatus(f.status || 'Ativo') + '</p></div></div>' +
            '  <div class="flex flex-wrap gap-2">' +
            '    <button type="button" data-det="nova-compra" class="nexo-btn nexo-btn-primario"><i class="fa-solid fa-cart-plus"></i> Nova compra</button>' +
            '    <button type="button" data-det="editar" class="nexo-btn nexo-btn-secundario"><i class="fa-solid fa-pen"></i> Editar</button>' +
            '    <button type="button" data-det="excluir" class="nexo-btn nexo-btn-secundario text-red-600"><i class="fa-solid fa-trash"></i> Excluir</button>' +
            '  </div></div>' +

            '<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">' +
            '  <div class="bg-brand-purpleLight rounded-xl p-3"><p class="text-xs font-semibold text-gray-500">Total comprado</p><p class="text-lg font-extrabold text-gray-900">' + Nexo.fmt.moeda(total) + '</p></div>' +
            '  <div class="bg-brand-purpleLight rounded-xl p-3"><p class="text-xs font-semibold text-gray-500">Compras</p><p class="text-lg font-extrabold text-gray-900">' + compras.length + '</p></div>' +
            '  <div class="bg-brand-purpleLight rounded-xl p-3"><p class="text-xs font-semibold text-gray-500">Produtos fornecidos</p><p class="text-lg font-extrabold text-gray-900">' + produtos.length + '</p></div>' +
            '  <div class="bg-brand-purpleLight rounded-xl p-3"><p class="text-xs font-semibold text-gray-500">Prazo de entrega</p><p class="text-lg font-extrabold text-gray-900">' + (f.prazoEntrega !== undefined && f.prazoEntrega !== '' ? esc(f.prazoEntrega) + ' dias' : '-') + '</p></div>' +
            '</div>' +

            '<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">' +
            '  <div class="' + card + '">' + titulo('fa-address-book', 'Dados de contato') + '<div class="grid grid-cols-2 gap-3">' +
            campo('Contato', esc(f.contato)) +
            campo('Telefone', tel ? '<a href="tel:+55' + tel + '" class="text-brand-purple hover:underline">' + esc(f.telefone) + '</a>' : '') +
            '<div class="col-span-2">' + campo('E-mail', f.email ? '<a href="mailto:' + esc(f.email) + '" class="text-brand-purple hover:underline">' + esc(f.email) + '</a>' : '') + '</div>' +
            campo('Cidade/UF', f.cidade ? esc(cidadeUF(f)) : '') + campo('Condição de pagamento', esc(f.condicaoPagamento)) +
            '</div></div>' +
            '  <div class="' + card + '">' + titulo('fa-tags', 'Marcas fornecidas') + '<div>' + chips(f.marcas) + '</div>' +
            '<p class="text-xs font-semibold text-gray-400 mt-3 mb-1">Observações</p><p class="text-sm text-gray-800 whitespace-pre-line">' + (f.observacoes ? esc(f.observacoes) : '<span class="text-gray-400">Nenhuma observação.</span>') + '</p></div>' +
            '</div>' +

            '<div class="' + card + ' mb-5 overflow-hidden">' + titulo('fa-bottle-droplet', 'Produtos fornecidos (' + produtos.length + ')') +
            '<div class="overflow-x-auto -mx-4"><table class="w-full text-left text-xs min-w-[520px]"><thead class="bg-gray-50 text-gray-500"><tr>' +
            '<th class="px-4 py-2 font-bold">Produto</th><th class="px-4 py-2 font-bold">Marca</th><th class="px-4 py-2 font-bold text-right">Estoque</th><th class="px-4 py-2 font-bold text-right">Custo</th><th class="px-4 py-2 font-bold">Status</th></tr></thead>' +
            '<tbody class="divide-y divide-gray-100">' + linhasProdutos + '</tbody></table></div></div>' +

            '<div class="' + card + ' overflow-hidden">' + titulo('fa-clock-rotate-left', 'Histórico de compras (' + compras.length + ')') +
            '<div class="overflow-x-auto -mx-4"><table class="w-full text-left text-xs min-w-[760px]"><thead class="bg-gray-50 text-gray-500"><tr>' +
            '<th class="px-4 py-2 font-bold">Compra</th><th class="px-4 py-2 font-bold">Data</th><th class="px-4 py-2 font-bold">Nota fiscal</th><th class="px-4 py-2 font-bold">Itens</th><th class="px-4 py-2 font-bold text-right">Total</th><th class="px-4 py-2 font-bold">Status</th><th class="px-4 py-2 font-bold">Ação</th></tr></thead>' +
            '<tbody class="divide-y divide-gray-100">' + linhasCompras + '</tbody></table></div></div>';
    }

    function abrirDetalhe(id) {
        if (!Nexo.db.obter('fornecedores', id)) { Nexo.ui.toast('Fornecedor não encontrado.', 'erro'); return; }

        var modal = Nexo.ui.abrirModal({
            titulo: 'Detalhes do Fornecedor',
            largura: 'max-w-4xl',
            html: '',
            botoes: [{ texto: 'Fechar', classe: 'nexo-btn-secundario', acao: 'fechar' }],
            aoFechar: function () {
                estado.detalhe = null;
                /* limpa o ?id= da URL (ignora erro em file://) */
                try { if (Nexo.ui.parametro('id')) history.replaceState(null, '', location.pathname); } catch (e) { /* ignora */ }
            }
        });

        function redesenhar() {
            var f = Nexo.db.obter('fornecedores', id);
            if (!f) { modal.fechar(); return; }
            modal.el.innerHTML = htmlDetalhe(f);
        }
        estado.detalhe = { id: id, redesenhar: redesenhar };

        modal.el.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-det]');
            if (!btn) return;
            var acao = btn.getAttribute('data-det');

            if (acao === 'editar') { modal.fechar(); abrirFormulario(id, true); }
            if (acao === 'excluir') {
                excluirFornecedor(id, function (excluiu) { if (excluiu) modal.fechar(); else redesenhar(); });
            }
            if (acao === 'nova-compra') abrirNovaCompra(id);
            if (acao === 'receber') {
                var cid = btn.getAttribute('data-cid');
                var compra = Nexo.db.obter('compras', cid);
                if (!compra) return;
                Nexo.ui.confirmar('Marcar como recebida?', 'A compra #' + compra.numero + ' dará entrada no estoque dos itens.', { textoOk: 'Confirmar recebimento' }).then(function (ok) {
                    if (!ok) return;
                    var r = Nexo.ops.receberCompra(cid);
                    if (!r.ok) { Nexo.ui.toast(r.erro, 'erro'); return; }
                    Nexo.registrarAtividade('compra', 'Compra #' + compra.numero + ' recebida de ' + nomeForn(Nexo.db.obter('fornecedores', id)), 'fornecedores.html?id=' + id);
                    Nexo.ui.toast('Compra #' + compra.numero + ' recebida. Estoque atualizado.');
                    desenhar();
                    redesenhar();
                });
            }
        });
        redesenhar();
    }

    /* ------------------------------------------------------------------ */
    /* Nova compra                                                         */
    /* ------------------------------------------------------------------ */
    function abrirNovaCompra(fornecedorId) {
        var f = Nexo.db.obter('fornecedores', fornecedorId);
        if (!f) return;
        if (f.status === 'Inativo') { Nexo.ui.toast('Fornecedor inativo: ative-o para registrar compras.', 'aviso'); return; }
        var produtos = produtosDoFornecedor(fornecedorId);
        if (!produtos.length) { Nexo.ui.toast('Este fornecedor não possui produtos vinculados para comprar.', 'aviso'); return; }

        var linhas = produtos.map(function (p) {
            return '<tr data-produto="' + esc(p.id) + '">' +
                '<td class="px-3 py-2"><p class="font-semibold text-gray-800">' + esc(p.nome) + '</p><p class="text-xs text-gray-400">Estoque: ' + (Number(p.estoque) || 0) + ' un.</p></td>' +
                '<td class="px-3 py-2"><input type="number" min="0" step="1" value="0" data-qtd class="nexo-input !w-24" aria-label="Quantidade de ' + esc(p.nome) + '"></td>' +
                '<td class="px-3 py-2"><input type="number" min="0" step="0.01" value="' + (Number(p.custo) || 0) + '" data-custo class="nexo-input !w-28" aria-label="Custo unitário de ' + esc(p.nome) + '"></td>' +
                '<td class="px-3 py-2 text-right whitespace-nowrap" data-sub>R$ 0,00</td></tr>';
        }).join('');

        var html = '<form novalidate class="space-y-4">' +
            '<p class="text-sm text-gray-600">Fornecedor: <b>' + esc(nomeForn(f)) + '</b>. Informe a quantidade dos produtos que deseja comprar (deixe 0 para ignorar).</p>' +
            '<div class="overflow-x-auto border border-gray-100 rounded-xl"><table class="w-full text-sm min-w-[480px]"><thead class="bg-gray-50 text-xs text-gray-500"><tr>' +
            '<th class="px-3 py-2 text-left font-bold">Produto</th><th class="px-3 py-2 text-left font-bold">Quantidade</th><th class="px-3 py-2 text-left font-bold">Custo unit. (R$)</th><th class="px-3 py-2 text-right font-bold">Subtotal</th></tr></thead>' +
            '<tbody class="divide-y divide-gray-100">' + linhas + '</tbody></table></div>' +
            '<p data-erro-itens class="text-xs text-red-600 hidden"></p>' +
            '<p class="text-right text-sm font-bold text-gray-900">Total da compra: <span data-total>R$ 0,00</span></p>' +
            '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
            '<div><label class="nexo-label">Nota fiscal</label><input name="notaFiscal" class="nexo-input" placeholder="Ex.: NF 12345"></div>' +
            '<div><label class="nexo-label">Vencimento do pagamento *</label><input type="date" name="vencimento" class="nexo-input" value="' + Nexo.consultas.diasAtras(-30) + '"></div>' +
            '<div class="sm:col-span-2"><label class="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" name="recebida" class="w-4 h-4"> Já recebida (dá entrada no estoque agora)</label></div>' +
            '</div></form>';

        Nexo.ui.abrirModal({
            titulo: 'Nova compra',
            largura: 'max-w-3xl',
            html: html,
            aoAbrir: function (el) {
                function recalcular() {
                    var total = 0;
                    el.querySelectorAll('tr[data-produto]').forEach(function (tr) {
                        var q = Number(tr.querySelector('[data-qtd]').value) || 0;
                        var c = Number(tr.querySelector('[data-custo]').value) || 0;
                        tr.querySelector('[data-sub]').textContent = Nexo.fmt.moeda(q * c);
                        total += q * c;
                    });
                    el.querySelector('[data-total]').textContent = Nexo.fmt.moeda(total);
                }
                el.addEventListener('input', recalcular);
            },
            botoes: [
                { texto: 'Cancelar', classe: 'nexo-btn-secundario', acao: 'fechar' },
                {
                    texto: 'Registrar compra', classe: 'nexo-btn-primario', icone: 'fa-check',
                    acao: function (modal, corpo) {
                        var form = corpo.querySelector('form');
                        var d = Nexo.ui.lerFormulario(form);
                        var erros = {};
                        if (!d.vencimento) erros.vencimento = 'Informe o vencimento.';
                        var ok = Nexo.ui.mostrarErros(form, erros); /* limpa marcas antigas antes de marcar os itens */
                        var itens = [], erroItens = '';
                        corpo.querySelectorAll('tr[data-produto]').forEach(function (tr) {
                            var qtd = tr.querySelector('[data-qtd]').value, custo = tr.querySelector('[data-custo]').value;
                            tr.querySelector('[data-qtd]').classList.remove('erro');
                            tr.querySelector('[data-custo]').classList.remove('erro');
                            if (qtd === '' || Number(qtd) === 0) return;
                            if (isNaN(Number(qtd)) || Number(qtd) < 0 || Math.floor(Number(qtd)) !== Number(qtd)) {
                                tr.querySelector('[data-qtd]').classList.add('erro'); erroItens = 'Quantidade deve ser um número inteiro maior que 0.'; return;
                            }
                            if (custo === '' || isNaN(Number(custo)) || Number(custo) < 0) {
                                tr.querySelector('[data-custo]').classList.add('erro'); erroItens = 'Custo unitário deve ser maior ou igual a 0.'; return;
                            }
                            itens.push({ produtoId: tr.getAttribute('data-produto'), quantidade: Number(qtd), custoUnitario: Number(custo) });
                        });
                        if (!erroItens && !itens.length) erroItens = 'Informe a quantidade de pelo menos um produto.';
                        var pErro = corpo.querySelector('[data-erro-itens]');
                        pErro.textContent = erroItens;
                        pErro.classList.toggle('hidden', !erroItens);
                        if (!ok || erroItens) return false;

                        var r = Nexo.ops.registrarCompra({
                            fornecedorId: fornecedorId, itens: itens, notaFiscal: d.notaFiscal,
                            vencimento: d.vencimento, recebida: d.recebida
                        });
                        if (!r.ok) { Nexo.ui.toast(r.erro, 'erro'); return false; }
                        Nexo.ui.toast('Compra #' + r.compra.numero + ' registrada' + (d.recebida ? ' e recebida no estoque.' : '.'));
                        desenhar();
                        if (estado.detalhe && estado.detalhe.id === fornecedorId) estado.detalhe.redesenhar();
                        return true;
                    }
                }
            ]
        });
    }
})();
