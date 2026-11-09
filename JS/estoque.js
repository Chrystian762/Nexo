/*
 * NEXO ERP - Tela de Estoque
 * --------------------------------------------------------------
 * Abas: Posição de estoque, Movimentações e Estoque baixo.
 * Movimentações usam Nexo.ops.movimentarEstoque; pedidos de compra usam
 * Nexo.ops.registrarCompra. Aceita ?produto=<id> para abrir a movimentação direto.
 */
(function () {
    'use strict';

    if (!Nexo.layout.montar('estoque')) return;

    var esc = Nexo.esc;
    var fmt = Nexo.fmt;
    var MOTIVOS = ['Compra', 'Devolução de cliente', 'Perda/avaria', 'Vencimento', 'Uso interno', 'Inventário', 'Outro'];

    /* Estado das telas (aba atual, filtros e páginas) */
    var estado = {
        aba: 'posicao',
        pagPos: 1,
        pagMov: 1,
        grafico: null
    };

    /* ------------------------------------------------------------------ */
    /* Utilitários locais                                                  */
    /* ------------------------------------------------------------------ */
    function $(id) { return document.getElementById(id); }

    function dados() {
        return {
            produtos: Nexo.db.listar('produtos'),
            categorias: Nexo.consultas.mapa('categorias'),
            fornecedores: Nexo.consultas.mapa('fornecedores'),
            movs: Nexo.db.listar('movimentacoes')
        };
    }

    /* Situação do produto: Normal, Estoque baixo ou Sem estoque */
    function situacao(p) {
        var q = Number(p.estoque) || 0;
        if (q <= 0) return 'Sem estoque';
        if (q <= (Number(p.estoqueMinimo) || 0)) return 'Estoque baixo';
        return 'Normal';
    }

    /* Quantidade sugerida para reposição: mínimo x 2 - disponível */
    function sugestao(p) {
        return Math.max(1, (Number(p.estoqueMinimo) || 0) * 2 - (Number(p.estoque) || 0));
    }

    /* Quantidade com sinal para exibição (Saída é negativa) */
    function quantidadeComSinal(m) {
        var q = Number(m.quantidade) || 0;
        return m.tipo === 'Saída' ? -Math.abs(q) : q;
    }

    function textoQuantidade(m) {
        var q = quantidadeComSinal(m);
        var cls = q > 0 ? 'text-emerald-600' : (q < 0 ? 'text-red-600' : 'text-gray-500');
        return '<span class="font-semibold ' + cls + '">' + (q > 0 ? '+' : '') + fmt.numero(q) + '</span>';
    }

    function linkProduto(p, id) {
        if (!p) return '<span class="text-gray-400">Produto removido</span>';
        return '<a href="produtos.html?id=' + encodeURIComponent(id) + '" class="font-semibold text-gray-900 hover:text-brand-purple">' + esc(p.nome) + '</a>';
    }

    function vazio(colunas, texto, icone) {
        return '<tr><td colspan="' + colunas + '" class="px-4 py-12 text-center text-gray-500">' +
            '<i class="fa-solid ' + (icone || 'fa-box-open') + ' text-3xl text-gray-300 mb-3 block"></i>' + esc(texto) + '</td></tr>';
    }

    /* ------------------------------------------------------------------ */
    /* Cards de resumo                                                     */
    /* ------------------------------------------------------------------ */
    function desenharCards() {
        var d = dados();
        var unidades = 0, custo = 0, venda = 0, baixo = 0, sem = 0;
        d.produtos.forEach(function (p) {
            var q = Math.max(0, Number(p.estoque) || 0);
            unidades += q;
            custo += q * (Number(p.custo) || 0);
            venda += q * (Number(p.preco) || 0);
            if (p.status === 'Ativo') {
                var s = situacao(p);
                if (s === 'Sem estoque') sem++;
                else if (s === 'Estoque baixo') baixo++;
            }
        });
        var mes = fmt.hojeInput().slice(0, 7);
        var movsMes = d.movs.filter(function (m) { return fmt.dataInput(m.data).slice(0, 7) === mes; }).length;

        var cards = [
            ['Itens em estoque', fmt.numero(unidades) + ' un.', 'fa-boxes-stacked', 'bg-purple-50 text-brand-purple'],
            ['Valor a custo', fmt.moeda(custo), 'fa-coins', 'bg-blue-50 text-blue-600'],
            ['Valor a preço de venda', fmt.moeda(venda), 'fa-tags', 'bg-emerald-50 text-emerald-600'],
            ['Estoque baixo', fmt.numero(baixo), 'fa-triangle-exclamation', 'bg-amber-50 text-amber-600'],
            ['Sem estoque', fmt.numero(sem), 'fa-ban', 'bg-red-50 text-red-600'],
            ['Movimentações no mês', fmt.numero(movsMes), 'fa-right-left', 'bg-indigo-50 text-indigo-600']
        ];
        $('cards').innerHTML = cards.map(function (c) {
            return '<div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">' +
                '<div class="w-9 h-9 rounded-xl flex items-center justify-center mb-3 ' + c[3] + '"><i class="fa-solid ' + c[2] + '"></i></div>' +
                '<p class="text-xs font-medium text-brand-textMuted">' + c[0] + '</p>' +
                '<p class="text-base xl:text-lg font-extrabold text-gray-900 mt-0.5 whitespace-nowrap">' + c[1] + '</p></div>';
        }).join('');
        $('contagem-baixo').textContent = baixo + sem;
    }

    /* ------------------------------------------------------------------ */
    /* Gráfico: entradas x saídas por semana (8 semanas)                   */
    /* ------------------------------------------------------------------ */
    function desenharGrafico() {
        if (typeof Chart === 'undefined') return;
        var movs = Nexo.db.listar('movimentacoes');
        /* segunda-feira da semana atual */
        var inicio = new Date();
        inicio.setHours(0, 0, 0, 0);
        inicio.setDate(inicio.getDate() - ((inicio.getDay() + 6) % 7));
        var semanas = [];
        for (var i = 7; i >= 0; i--) {
            var ini = new Date(inicio);
            ini.setDate(ini.getDate() - i * 7);
            var fim = new Date(ini);
            fim.setDate(fim.getDate() + 7);
            semanas.push({ ini: ini, fim: fim, entradas: 0, saidas: 0 });
        }
        movs.forEach(function (m) {
            var dt = new Date(m.data);
            semanas.forEach(function (s) {
                if (dt >= s.ini && dt < s.fim) {
                    if (m.tipo === 'Entrada') s.entradas += Math.abs(Number(m.quantidade) || 0);
                    else if (m.tipo === 'Saída') s.saidas += Math.abs(Number(m.quantidade) || 0);
                }
            });
        });
        if (estado.grafico) estado.grafico.destroy();
        estado.grafico = new Chart($('grafico-semanas'), {
            type: 'bar',
            data: {
                labels: semanas.map(function (s) { return s.ini.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); }),
                datasets: [
                    { label: 'Entradas', data: semanas.map(function (s) { return s.entradas; }), backgroundColor: '#10b981', borderRadius: 4 },
                    { label: 'Saídas', data: semanas.map(function (s) { return s.saidas; }), backgroundColor: '#7c3aed', borderRadius: 4 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { title: function (it) { return 'Semana de ' + it[0].label; } } } },
                scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } }
            }
        });
    }

    /* ------------------------------------------------------------------ */
    /* Abas                                                                */
    /* ------------------------------------------------------------------ */
    function trocarAba(aba) {
        estado.aba = aba;
        ['posicao', 'movimentacoes', 'baixo'].forEach(function (a) {
            $('aba-' + a).classList.toggle('hidden', a !== aba);
        });
        document.querySelectorAll('#abas .aba').forEach(function (b) {
            var ativa = b.getAttribute('data-aba') === aba;
            b.classList.toggle('border-brand-purple', ativa);
            b.classList.toggle('text-brand-purple', ativa);
            b.classList.toggle('border-transparent', !ativa);
            b.classList.toggle('text-gray-500', !ativa);
            b.setAttribute('aria-selected', ativa ? 'true' : 'false');
        });
        if (aba === 'posicao') desenharPosicao();
        if (aba === 'movimentacoes') desenharMovimentacoes();
        if (aba === 'baixo') desenharBaixo();
    }

    /* ------------------------------------------------------------------ */
    /* Aba: Posição de estoque                                             */
    /* ------------------------------------------------------------------ */
    function preencherFiltros() {
        var d = dados();
        var cats = Object.keys(d.categorias).map(function (k) { return d.categorias[k]; });
        $('pos-categoria').innerHTML = '<option value="">Todas as categorias</option>' +
            cats.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.nome) + '</option>'; }).join('');
        var prods = d.produtos.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
        $('mov-produto').innerHTML = '<option value="">Todos os produtos</option>' +
            prods.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.nome) + ' (' + esc(p.sku) + ')</option>'; }).join('');
    }

    function produtosFiltrados() {
        var d = dados();
        var busca = $('pos-busca').value.trim().toLowerCase();
        var cat = $('pos-categoria').value;
        var sit = $('pos-situacao').value;
        return d.produtos.filter(function (p) {
            if (busca && (p.nome + ' ' + p.sku).toLowerCase().indexOf(busca) === -1) return false;
            if (cat && p.categoriaId !== cat) return false;
            if (sit && situacao(p) !== sit) return false;
            return true;
        }).sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
    }

    function desenharPosicao() {
        var d = dados();
        /* última movimentação de cada produto */
        var ultima = {};
        d.movs.forEach(function (m) {
            if (!ultima[m.produtoId] || m.data > ultima[m.produtoId]) ultima[m.produtoId] = m.data;
        });
        var lista = produtosFiltrados();
        var info = Nexo.ui.paginar(lista, estado.pagPos);
        estado.pagPos = info.pagina;
        $('pos-corpo').innerHTML = info.itens.length ? info.itens.map(function (p) {
            var sit = situacao(p);
            var destaque = sit === 'Normal' ? '' : (sit === 'Sem estoque' ? 'bg-red-50/40' : 'bg-amber-50/50');
            var cat = d.categorias[p.categoriaId];
            var id = esc(p.id);
            return '<tr class="hover:bg-gray-50 ' + destaque + '">' +
                '<td class="px-4 py-3">' + linkProduto(p, p.id) + (p.status === 'Inativo' ? ' <span class="text-xs text-gray-400">(inativo)</span>' : '') + '</td>' +
                '<td class="px-4 py-3 text-gray-600 whitespace-nowrap">' + esc(p.sku) + '</td>' +
                '<td class="px-4 py-3 text-gray-600">' + esc(cat ? cat.nome : '-') + '</td>' +
                '<td class="px-4 py-3 text-right font-bold ' + (sit === 'Normal' ? 'text-gray-900' : (sit === 'Sem estoque' ? 'text-red-600' : 'text-amber-600')) + '">' + fmt.numero(p.estoque) + '</td>' +
                '<td class="px-4 py-3 text-right text-gray-600">' + fmt.numero(p.estoqueMinimo) + '</td>' +
                '<td class="px-4 py-3">' + Nexo.ui.badgeStatus(sit) + '</td>' +
                '<td class="px-4 py-3 text-right text-gray-700 whitespace-nowrap">' + fmt.moeda(Math.max(0, Number(p.estoque) || 0) * (Number(p.custo) || 0)) + '</td>' +
                '<td class="px-4 py-3 text-gray-600 whitespace-nowrap">' + (ultima[p.id] ? fmt.data(ultima[p.id]) : '-') + '</td>' +
                '<td class="px-4 py-3 text-right whitespace-nowrap">' +
                '<button type="button" data-mov="Entrada" data-id="' + id + '" class="px-2 py-1 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100" title="Registrar entrada">Entrada</button> ' +
                '<button type="button" data-mov="Saída" data-id="' + id + '" class="px-2 py-1 rounded-lg text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100" title="Registrar saída">Saída</button> ' +
                '<button type="button" data-mov="Ajuste" data-id="' + id + '" class="px-2 py-1 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100" title="Ajustar saldo">Ajuste</button>' +
                '</td></tr>';
        }).join('') : vazio(9, 'Nenhum produto encontrado com esses filtros.');
        $('pos-pag').innerHTML = Nexo.ui.htmlPaginacao(info, 'estoquePagPos');
    }

    window.estoquePagPos = function (n) { estado.pagPos = n; desenharPosicao(); };

    /* ------------------------------------------------------------------ */
    /* Aba: Movimentações                                                  */
    /* ------------------------------------------------------------------ */
    function movimentacoesFiltradas() {
        var tipo = $('mov-tipo').value;
        var prod = $('mov-produto').value;
        var de = $('mov-de').value;
        var ate = $('mov-ate').value;
        return Nexo.db.listar('movimentacoes').filter(function (m) {
            var dia = fmt.dataInput(m.data);
            if (tipo && m.tipo !== tipo) return false;
            if (prod && m.produtoId !== prod) return false;
            if (de && dia < de) return false;
            if (ate && dia > ate) return false;
            return true;
        }).sort(function (a, b) { return a.data < b.data ? 1 : (a.data > b.data ? -1 : 0); });
    }

    function desenharMovimentacoes() {
        var mapa = Nexo.consultas.mapa('produtos');
        var lista = movimentacoesFiltradas();
        var info = Nexo.ui.paginar(lista, estado.pagMov);
        estado.pagMov = info.pagina;
        $('mov-resumo').textContent = fmt.numero(lista.length) + ' movimentação(ões) encontrada(s)';
        $('mov-corpo').innerHTML = info.itens.length ? info.itens.map(function (m) {
            var p = mapa[m.produtoId];
            return '<tr class="hover:bg-gray-50">' +
                '<td class="px-4 py-3 text-gray-600 whitespace-nowrap">' + fmt.dataHora(m.data) + '</td>' +
                '<td class="px-4 py-3">' + linkProduto(p, m.produtoId) + '</td>' +
                '<td class="px-4 py-3">' + Nexo.ui.badgeStatus(m.tipo) + '</td>' +
                '<td class="px-4 py-3 text-right">' + textoQuantidade(m) + '</td>' +
                '<td class="px-4 py-3 text-right text-gray-600 whitespace-nowrap">' + fmt.numero(m.saldoAnterior) + ' <i class="fa-solid fa-arrow-right text-[10px] text-gray-400"></i> <b class="text-gray-900">' + fmt.numero(m.saldoAtual) + '</b></td>' +
                '<td class="px-4 py-3 text-gray-700">' + esc(m.motivo || '-') + '</td>' +
                '<td class="px-4 py-3 text-gray-600">' + esc(m.referencia || '-') + '</td>' +
                '<td class="px-4 py-3 text-gray-600 whitespace-nowrap">' + esc(m.usuario || '-') + '</td></tr>';
        }).join('') : vazio(8, 'Nenhuma movimentação encontrada com esses filtros.', 'fa-right-left');
        $('mov-pag').innerHTML = Nexo.ui.htmlPaginacao(info, 'estoquePagMov');
    }

    window.estoquePagMov = function (n) { estado.pagMov = n; desenharMovimentacoes(); };

    function exportarMovimentacoes() {
        var mapa = Nexo.consultas.mapa('produtos');
        var lista = movimentacoesFiltradas();
        if (!lista.length) { Nexo.ui.toast('Não há movimentações para exportar.', 'aviso'); return; }
        var linhas = lista.map(function (m) {
            var p = mapa[m.produtoId] || {};
            return [fmt.dataHora(m.data), p.nome || '', p.sku || '', m.tipo, quantidadeComSinal(m), m.saldoAnterior, m.saldoAtual, m.motivo || '', m.referencia || '', m.usuario || ''];
        });
        Nexo.exportarCSV('movimentacoes-estoque-' + fmt.hojeInput(),
            ['Data', 'Produto', 'SKU', 'Tipo', 'Quantidade', 'Saldo anterior', 'Saldo atual', 'Motivo', 'Referência', 'Usuário'], linhas);
    }

    /* ------------------------------------------------------------------ */
    /* Modal de movimentação (Entrada, Saída, Ajuste)                      */
    /* ------------------------------------------------------------------ */
    function abrirMovimentacao(produtoId, tipo) {
        var produtos = Nexo.db.listar('produtos').sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
        var tipoInicial = tipo || 'Entrada';
        var html =
            '<form id="form-mov" novalidate class="space-y-4">' +
            '<div><label class="nexo-label" for="mv-produto">Produto *</label>' +
            '<select id="mv-produto" name="produtoId" class="nexo-input"><option value="">Selecione...</option>' +
            produtos.map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === produtoId ? ' selected' : '') + '>' + esc(p.nome) + ' (' + esc(p.sku) + ')</option>'; }).join('') +
            '</select></div>' +
            '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
            '<div><label class="nexo-label" for="mv-tipo">Tipo *</label><select id="mv-tipo" name="tipo" class="nexo-input">' +
            ['Entrada', 'Saída', 'Ajuste'].map(function (t) { return '<option' + (t === tipoInicial ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></div>' +
            '<div><label class="nexo-label" for="mv-qtd" id="mv-rotulo-qtd">Quantidade *</label>' +
            '<input id="mv-qtd" name="quantidade" type="number" min="0" step="1" inputmode="numeric" class="nexo-input" placeholder="0"></div>' +
            '</div>' +
            '<div id="mv-previa" class="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 text-sm text-gray-600">Selecione um produto.</div>' +
            '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
            '<div><label class="nexo-label" for="mv-motivo">Motivo *</label><select id="mv-motivo" name="motivo" class="nexo-input">' +
            MOTIVOS.map(function (m) { return '<option>' + m + '</option>'; }).join('') + '</select></div>' +
            '<div id="mv-outro-box" class="hidden"><label class="nexo-label" for="mv-outro">Descreva o motivo *</label>' +
            '<input id="mv-outro" name="motivoOutro" type="text" maxlength="80" class="nexo-input" placeholder="Ex.: Amostra para cliente"></div>' +
            '</div>' +
            '<div><label class="nexo-label" for="mv-ref">Referência / observação</label>' +
            '<input id="mv-ref" name="referencia" type="text" maxlength="120" class="nexo-input" placeholder="Ex.: NF 12345, Pedido #1020"></div>' +
            '<div id="mv-erro" class="hidden rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3" role="alert"></div>' +
            '</form>';

        Nexo.ui.abrirModal({
            titulo: 'Movimentação de estoque',
            largura: 'max-w-xl',
            html: html,
            botoes: [
                { texto: 'Cancelar', classe: 'nexo-btn-secundario', acao: 'fechar' },
                { texto: 'Registrar', classe: 'nexo-btn-primario', icone: 'fa-check', acao: function () { return salvarMovimentacao($('form-mov'), $('mv-erro')); } }
            ],
            aoAbrir: function (corpo) {
                var form = corpo.querySelector('form');
                var atualizar = function () { atualizarPrevia(form); };
                form.elements.produtoId.addEventListener('change', atualizar);
                form.elements.tipo.addEventListener('change', function () {
                    /* sugere um motivo coerente com o tipo */
                    var sugerido = { 'Entrada': 'Compra', 'Saída': 'Perda/avaria', 'Ajuste': 'Inventário' }[form.elements.tipo.value];
                    form.elements.motivo.value = sugerido;
                    atualizar();
                });
                form.elements.quantidade.addEventListener('input', atualizar);
                form.elements.motivo.addEventListener('change', function () {
                    $('mv-outro-box').classList.toggle('hidden', form.elements.motivo.value !== 'Outro');
                });
                var sugerido = { 'Entrada': 'Compra', 'Saída': 'Perda/avaria', 'Ajuste': 'Inventário' }[tipoInicial];
                form.elements.motivo.value = sugerido;
                atualizar();
            }
        });
    }

    /* Mostra saldo atual e o resultado da movimentação (no ajuste, a diferença) */
    function atualizarPrevia(form) {
        var previa = $('mv-previa');
        var p = Nexo.db.obter('produtos', form.elements.produtoId.value);
        var tipo = form.elements.tipo.value;
        $('mv-rotulo-qtd').textContent = tipo === 'Ajuste' ? 'Novo saldo *' : 'Quantidade *';
        if (!p) { previa.innerHTML = 'Selecione um produto.'; return; }
        var atual = Number(p.estoque) || 0;
        var bruto = form.elements.quantidade.value;
        var q = Math.round(Number(bruto));
        var texto = 'Saldo atual: <b class="text-gray-900">' + fmt.numero(atual) + ' un.</b> (mínimo: ' + fmt.numero(p.estoqueMinimo) + ')';
        if (bruto !== '' && !isNaN(q) && q >= 0) {
            if (tipo === 'Ajuste') {
                var dif = q - atual;
                texto += '<br>Diferença: <b class="' + (dif > 0 ? 'text-emerald-600' : (dif < 0 ? 'text-red-600' : 'text-gray-700')) + '">' + (dif > 0 ? '+' : '') + fmt.numero(dif) + ' un.</b> (novo saldo: ' + fmt.numero(q) + ')';
            } else {
                var novo = tipo === 'Entrada' ? atual + q : atual - q;
                texto += '<br>Saldo após a movimentação: <b class="' + (novo < 0 ? 'text-red-600' : 'text-gray-900') + '">' + fmt.numero(novo) + ' un.</b>';
            }
        }
        previa.innerHTML = texto;
    }

    function salvarMovimentacao(form, caixaErro) {
        caixaErro.classList.add('hidden');
        var v = Nexo.ui.lerFormulario(form);
        var erros = {};
        if (!v.produtoId) erros.produtoId = 'Selecione o produto.';
        var q = Number(v.quantidade);
        if (v.quantidade === '' || isNaN(q)) erros.quantidade = 'Informe a quantidade.';
        else if (q < 0 || Math.floor(q) !== q) erros.quantidade = 'Use um número inteiro maior ou igual a zero.';
        else if (v.tipo !== 'Ajuste' && q === 0) erros.quantidade = 'A quantidade deve ser maior que zero.';
        if (v.motivo === 'Outro' && !v.motivoOutro) erros.motivoOutro = 'Descreva o motivo.';
        if (!Nexo.ui.mostrarErros(form, erros)) return false;

        var motivo = v.motivo === 'Outro' ? v.motivoOutro : v.motivo;
        var r = Nexo.ops.movimentarEstoque(v.produtoId, v.tipo, q, motivo, v.referencia);
        if (!r.ok) {
            caixaErro.textContent = r.erro;
            caixaErro.classList.remove('hidden');
            return false;
        }
        Nexo.ui.toast(v.tipo + ' registrada com sucesso.');
        atualizarTudo();
        return true;
    }

    /* ------------------------------------------------------------------ */
    /* Aba: Estoque baixo (reposição)                                      */
    /* ------------------------------------------------------------------ */
    function produtosParaRepor() {
        return Nexo.db.listar('produtos').filter(function (p) {
            return p.status === 'Ativo' && situacao(p) !== 'Normal';
        });
    }

    function desenharBaixo() {
        var d = dados();
        var lista = produtosParaRepor();
        if (!lista.length) {
            $('baixo-lista').innerHTML = '<div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center text-gray-500">' +
                '<i class="fa-solid fa-circle-check text-4xl text-emerald-400 mb-3 block"></i>Nenhum produto com estoque baixo. Tudo certo por aqui!</div>';
            return;
        }
        /* agrupa por fornecedor */
        var grupos = {};
        lista.forEach(function (p) {
            var k = p.fornecedorId || '_sem';
            (grupos[k] = grupos[k] || []).push(p);
        });
        $('baixo-lista').innerHTML = Object.keys(grupos).map(function (fid) {
            var f = d.fornecedores[fid];
            var itens = grupos[fid].sort(function (a, b) { return (Number(a.estoque) || 0) - (Number(b.estoque) || 0); });
            var nomeForn = f ? (f.nomeFantasia || f.razaoSocial) : 'Sem fornecedor definido';
            var cab = f ? '<a href="fornecedores.html?id=' + encodeURIComponent(f.id) + '" class="font-bold text-gray-900 hover:text-brand-purple"><i class="fa-solid fa-truck text-brand-purple mr-2"></i>' + esc(nomeForn) + '</a>' :
                '<span class="font-bold text-gray-900"><i class="fa-solid fa-truck text-gray-400 mr-2"></i>' + esc(nomeForn) + '</span>';
            return '<div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">' +
                '<div class="px-4 py-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">' + cab +
                '<button type="button" data-compra-grupo="' + esc(fid) + '" class="nexo-btn nexo-btn-primario !py-2"><i class="fa-solid fa-file-invoice"></i> Gerar pedido de compra (' + itens.length + ')</button></div>' +
                '<div class="overflow-x-auto"><table class="w-full text-sm min-w-[760px]"><thead class="text-left text-xs uppercase text-gray-500 bg-gray-50"><tr>' +
                '<th class="px-4 py-3">Produto</th><th class="px-4 py-3">SKU</th><th class="px-4 py-3 text-right">Disponível</th><th class="px-4 py-3 text-right">Mínimo</th>' +
                '<th class="px-4 py-3">Situação</th><th class="px-4 py-3 text-right">Sugerido</th><th class="px-4 py-3 text-right">Ação</th></tr></thead><tbody class="divide-y divide-gray-50">' +
                itens.map(function (p) {
                    return '<tr class="hover:bg-gray-50">' +
                        '<td class="px-4 py-3">' + linkProduto(p, p.id) + '</td>' +
                        '<td class="px-4 py-3 text-gray-600 whitespace-nowrap">' + esc(p.sku) + '</td>' +
                        '<td class="px-4 py-3 text-right font-bold ' + (situacao(p) === 'Sem estoque' ? 'text-red-600' : 'text-amber-600') + '">' + fmt.numero(p.estoque) + '</td>' +
                        '<td class="px-4 py-3 text-right text-gray-600">' + fmt.numero(p.estoqueMinimo) + '</td>' +
                        '<td class="px-4 py-3">' + Nexo.ui.badgeStatus(situacao(p)) + '</td>' +
                        '<td class="px-4 py-3 text-right font-semibold text-brand-purple">+' + fmt.numero(sugestao(p)) + ' un.</td>' +
                        '<td class="px-4 py-3 text-right whitespace-nowrap"><button type="button" data-compra-produto="' + esc(p.id) + '" class="px-3 py-1.5 rounded-lg text-xs font-semibold text-brand-purple bg-purple-50 hover:bg-purple-100">Gerar pedido de compra</button></td></tr>';
                }).join('') + '</tbody></table></div></div>';
        }).join('');
    }

    /* ------------------------------------------------------------------ */
    /* Modal: pedido de compra (registrarCompra)                           */
    /* ------------------------------------------------------------------ */
    function abrirCompra(fornecedorId, produtoIds) {
        var fornecedores = Nexo.db.listar('fornecedores').filter(function (f) { return f.status !== 'Inativo' || f.id === fornecedorId; });
        var todosProdutos = Nexo.db.listar('produtos').filter(function (p) { return p.status === 'Ativo'; });
        /* itens do pedido, pré-preenchidos com a quantidade sugerida e o custo atual */
        var itens = produtoIds.map(function (id) {
            var p = Nexo.db.obter('produtos', id);
            return p ? { produtoId: p.id, quantidade: sugestao(p), custo: Number(p.custo) || 0 } : null;
        }).filter(Boolean);
        var venc = new Date();
        venc.setDate(venc.getDate() + 30);
        var vencPadrao = venc.getFullYear() + '-' + String(venc.getMonth() + 1).padStart(2, '0') + '-' + String(venc.getDate()).padStart(2, '0');

        var html =
            '<form id="form-compra" novalidate class="space-y-4">' +
            '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
            '<div class="sm:col-span-2"><label class="nexo-label" for="cp-forn">Fornecedor *</label><select id="cp-forn" name="fornecedorId" class="nexo-input"><option value="">Selecione...</option>' +
            fornecedores.map(function (f) { return '<option value="' + esc(f.id) + '"' + (f.id === fornecedorId ? ' selected' : '') + '>' + esc(f.nomeFantasia || f.razaoSocial) + '</option>'; }).join('') + '</select></div>' +
            '<div><label class="nexo-label" for="cp-nf">Nota fiscal / referência</label><input id="cp-nf" name="notaFiscal" type="text" maxlength="40" class="nexo-input" placeholder="Opcional"></div>' +
            '<div><label class="nexo-label" for="cp-venc">Vencimento do pagamento *</label><input id="cp-venc" name="vencimento" type="date" class="nexo-input" value="' + vencPadrao + '"></div>' +
            '</div>' +
            '<div><p class="nexo-label">Itens do pedido *</p><div id="cp-itens" class="space-y-2"></div>' +
            '<p data-erro-itens class="text-xs text-red-600 mt-1 hidden"></p>' +
            '<div class="flex gap-2 mt-3"><select id="cp-add" class="nexo-input" aria-label="Adicionar produto"><option value="">Adicionar outro produto...</option>' +
            todosProdutos.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.nome) + '</option>'; }).join('') + '</select>' +
            '<button type="button" id="cp-add-btn" class="nexo-btn nexo-btn-secundario shrink-0"><i class="fa-solid fa-plus"></i> Adicionar</button></div></div>' +
            '<div class="flex items-center justify-between rounded-xl bg-gray-50 border border-gray-100 px-4 py-3"><span class="text-sm text-gray-600">Total da compra</span><b id="cp-total" class="text-lg text-gray-900"></b></div>' +
            '<div class="space-y-2">' +
            '<label class="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" name="recebida" class="rounded"> Já recebida (dá entrada no estoque agora)</label>' +
            '<label class="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" name="paga" class="rounded"> Já paga</label></div>' +
            '<div id="cp-erro" class="hidden rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3" role="alert"></div>' +
            '</form>';

        Nexo.ui.abrirModal({
            titulo: 'Gerar pedido de compra',
            largura: 'max-w-3xl',
            html: html,
            botoes: [
                { texto: 'Cancelar', classe: 'nexo-btn-secundario', acao: 'fechar' },
                { texto: 'Registrar compra', classe: 'nexo-btn-primario', icone: 'fa-check', acao: function () { return salvarCompra($('form-compra'), itens); } }
            ],
            aoAbrir: function () {
                function total() {
                    var t = itens.reduce(function (s, it) { return s + (Number(it.quantidade) || 0) * (Number(it.custo) || 0); }, 0);
                    $('cp-total').textContent = fmt.moeda(t);
                }
                function desenharItens() {
                    var box = $('cp-itens');
                    if (!itens.length) { box.innerHTML = '<p class="text-sm text-gray-500 py-2">Nenhum item. Adicione um produto abaixo.</p>'; total(); return; }
                    box.innerHTML = itens.map(function (it, i) {
                        var p = Nexo.db.obter('produtos', it.produtoId) || {};
                        return '<div class="grid grid-cols-12 gap-2 items-end border border-gray-100 rounded-xl p-3">' +
                            '<div class="col-span-12 sm:col-span-5"><p class="text-sm font-semibold text-gray-900">' + esc(p.nome || 'Produto') + '</p>' +
                            '<p class="text-xs text-gray-500">Disponível: ' + fmt.numero(p.estoque) + ' | Mínimo: ' + fmt.numero(p.estoqueMinimo) + '</p></div>' +
                            '<div class="col-span-4 sm:col-span-2"><label class="nexo-label">Qtd.</label><input type="number" min="1" step="1" data-i="' + i + '" data-campo="quantidade" class="nexo-input" value="' + esc(it.quantidade) + '"></div>' +
                            '<div class="col-span-5 sm:col-span-3"><label class="nexo-label">Custo unit. (R$)</label><input type="number" min="0" step="0.01" data-i="' + i + '" data-campo="custo" class="nexo-input" value="' + esc(it.custo) + '"></div>' +
                            '<div class="col-span-3 sm:col-span-2 text-right"><button type="button" data-remover="' + i + '" class="w-9 h-9 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50" aria-label="Remover item"><i class="fa-solid fa-trash"></i></button></div></div>';
                    }).join('');
                    total();
                }
                desenharItens();
                $('cp-itens').addEventListener('input', function (e) {
                    var i = e.target.getAttribute('data-i');
                    if (i === null) return;
                    itens[Number(i)][e.target.getAttribute('data-campo')] = e.target.value;
                    total();
                });
                $('cp-itens').addEventListener('click', function (e) {
                    var b = e.target.closest('[data-remover]');
                    if (!b) return;
                    itens.splice(Number(b.getAttribute('data-remover')), 1);
                    desenharItens();
                });
                $('cp-add-btn').addEventListener('click', function () {
                    var id = $('cp-add').value;
                    if (!id) return;
                    if (itens.some(function (it) { return it.produtoId === id; })) { Nexo.ui.toast('Esse produto já está no pedido.', 'aviso'); return; }
                    var p = Nexo.db.obter('produtos', id);
                    itens.push({ produtoId: id, quantidade: sugestao(p), custo: Number(p.custo) || 0 });
                    $('cp-add').value = '';
                    desenharItens();
                });
            }
        });
    }

    function salvarCompra(form, itens) {
        var caixa = $('cp-erro');
        caixa.classList.add('hidden');
        var v = Nexo.ui.lerFormulario(form);
        var erros = {};
        if (!v.fornecedorId) erros.fornecedorId = 'Selecione o fornecedor.';
        if (!v.vencimento) erros.vencimento = 'Informe o vencimento.';
        var msgItens = '';
        if (!itens.length) msgItens = 'Adicione pelo menos um produto.';
        itens.forEach(function (it) {
            var q = Number(it.quantidade), c = Number(it.custo);
            if (!(q > 0) || Math.floor(q) !== q) msgItens = 'A quantidade de cada item deve ser um inteiro maior que zero.';
            else if (it.custo === '' || isNaN(c) || c < 0) msgItens = 'O custo de cada item deve ser um número maior ou igual a zero.';
        });
        var okCampos = Nexo.ui.mostrarErros(form, erros);
        var pItens = form.querySelector('[data-erro-itens]');
        pItens.textContent = msgItens;
        pItens.classList.toggle('hidden', !msgItens);
        if (!okCampos || msgItens) return false;

        var r = Nexo.ops.registrarCompra({
            fornecedorId: v.fornecedorId,
            itens: itens.map(function (it) { return { produtoId: it.produtoId, quantidade: Number(it.quantidade), custoUnitario: Number(it.custo) }; }),
            notaFiscal: v.notaFiscal,
            vencimento: v.vencimento,
            recebida: !!v.recebida,
            paga: !!v.paga
        });
        if (!r.ok) {
            caixa.textContent = r.erro;
            caixa.classList.remove('hidden');
            return false;
        }
        Nexo.ui.toast('Compra #' + r.compra.numero + ' registrada' + (v.recebida ? ' e estoque atualizado.' : '.'));
        atualizarTudo();
        return true;
    }

    /* ------------------------------------------------------------------ */
    /* Inicialização                                                       */
    /* ------------------------------------------------------------------ */
    function atualizarTudo() {
        desenharCards();
        desenharGrafico();
        trocarAba(estado.aba);
    }

    function iniciar() {
        preencherFiltros();

        document.querySelectorAll('#abas .aba').forEach(function (b) {
            b.addEventListener('click', function () { trocarAba(b.getAttribute('data-aba')); });
        });
        $('btn-nova-mov').addEventListener('click', function () { abrirMovimentacao('', 'Entrada'); });

        /* filtros: voltam para a página 1 ao mudar */
        ['pos-busca', 'pos-categoria', 'pos-situacao'].forEach(function (id) {
            $(id).addEventListener('input', function () { estado.pagPos = 1; desenharPosicao(); });
        });
        ['mov-tipo', 'mov-produto', 'mov-de', 'mov-ate'].forEach(function (id) {
            $(id).addEventListener('input', function () { estado.pagMov = 1; desenharMovimentacoes(); });
        });
        $('mov-csv').addEventListener('click', exportarMovimentacoes);

        /* botões Entrada / Saída / Ajuste por linha */
        $('pos-corpo').addEventListener('click', function (e) {
            var b = e.target.closest('[data-mov]');
            if (b) abrirMovimentacao(b.getAttribute('data-id'), b.getAttribute('data-mov'));
        });
        /* botões de pedido de compra */
        $('baixo-lista').addEventListener('click', function (e) {
            var bp = e.target.closest('[data-compra-produto]');
            if (bp) {
                var p = Nexo.db.obter('produtos', bp.getAttribute('data-compra-produto'));
                abrirCompra(p && p.fornecedorId || '', [bp.getAttribute('data-compra-produto')]);
                return;
            }
            var bg = e.target.closest('[data-compra-grupo]');
            if (bg) {
                var fid = bg.getAttribute('data-compra-grupo');
                var ids = produtosParaRepor().filter(function (x) { return (x.fornecedorId || '_sem') === fid; }).map(function (x) { return x.id; });
                abrirCompra(fid === '_sem' ? '' : fid, ids);
            }
        });

        desenharCards();
        desenharGrafico();
        trocarAba('posicao');

        /* estoque.html?produto=<id> abre a movimentação desse produto */
        var pid = Nexo.ui.parametro('produto');
        if (pid) {
            if (Nexo.db.obter('produtos', pid)) abrirMovimentacao(pid, 'Entrada');
            else Nexo.ui.toast('Produto não encontrado.', 'aviso');
        }
    }

    iniciar();
})();
