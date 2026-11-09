/*
 * NEXO ERP - Camada de dados (localStorage)
 * --------------------------------------------------------------
 * Todas as telas usam este arquivo para ler e gravar dados.
 * Os dados ficam salvos no navegador (localStorage), entao o que for
 * cadastrado ou editado continua la depois de recarregar a pagina.
 *
 * Na primeira vez que o sistema abre, sao gerados dados de exemplo
 * (produtos, clientes, pedidos dos ultimos 6 meses, financeiro etc.).
 * Para voltar aos dados de exemplo: Configuracoes > Restaurar dados
 * ou, no console do navegador, Nexo.resetar().
 *
 * Uso basico:
 *   Nexo.db.listar('produtos')            -> array
 *   Nexo.db.obter('produtos', id)         -> objeto ou null
 *   Nexo.db.inserir('produtos', {...})    -> objeto com id
 *   Nexo.db.atualizar('produtos', id, {}) -> objeto atualizado
 *   Nexo.db.remover('produtos', id)
 *   Nexo.db.lerObjeto('empresa') / Nexo.db.gravarObjeto('empresa', {...})
 */
(function (global) {
    'use strict';

    var PREFIXO = 'nexo_';
    var VERSAO_DADOS = '3';

    var COLECOES = [
        'categorias', 'produtos', 'clientes', 'revendedores', 'fornecedores',
        'pedidos', 'compras', 'movimentacoes', 'lancamentos', 'usuarios', 'atividades'
    ];

    /* ------------------------------------------------------------------ */
    /* Armazenamento                                                       */
    /* ------------------------------------------------------------------ */
    /* Durante a geracao dos dados de exemplo, tudo fica em memoria (lote) e e salvo uma vez no final */
    var lote = null;

    function ler(chave, padrao) {
        if (lote && Object.prototype.hasOwnProperty.call(lote, chave)) return lote[chave];
        try {
            var bruto = localStorage.getItem(PREFIXO + chave);
            return bruto === null ? padrao : JSON.parse(bruto);
        } catch (e) {
            return padrao;
        }
    }

    function gravar(chave, valor) {
        if (lote) { lote[chave] = valor; return; }
        try {
            localStorage.setItem(PREFIXO + chave, JSON.stringify(valor));
        } catch (e) {
            console.error('Nexo: nao foi possivel salvar', chave, e);
        }
    }

    function gerarId(prefixo) {
        return (prefixo || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    function agoraISO() {
        return new Date().toISOString();
    }

    function copiar(obj) {
        return obj === undefined ? undefined : JSON.parse(JSON.stringify(obj));
    }

    var db = {
        listar: function (colecao) {
            return ler(colecao, []);
        },
        obter: function (colecao, id) {
            var lista = ler(colecao, []);
            for (var i = 0; i < lista.length; i++) {
                if (lista[i].id === id) return lista[i];
            }
            return null;
        },
        inserir: function (colecao, obj) {
            var lista = ler(colecao, []);
            var novo = copiar(obj) || {};
            if (!novo.id) novo.id = gerarId(colecao.slice(0, 3));
            if (!novo.criadoEm) novo.criadoEm = agoraISO();
            lista.push(novo);
            gravar(colecao, lista);
            return novo;
        },
        atualizar: function (colecao, id, alteracoes) {
            var lista = ler(colecao, []);
            for (var i = 0; i < lista.length; i++) {
                if (lista[i].id === id) {
                    var mudancas = copiar(alteracoes) || {};
                    for (var k in mudancas) {
                        if (Object.prototype.hasOwnProperty.call(mudancas, k)) lista[i][k] = mudancas[k];
                    }
                    lista[i].atualizadoEm = agoraISO();
                    gravar(colecao, lista);
                    return lista[i];
                }
            }
            return null;
        },
        remover: function (colecao, id) {
            var lista = ler(colecao, []);
            var filtrada = lista.filter(function (x) { return x.id !== id; });
            gravar(colecao, filtrada);
            return filtrada.length !== lista.length;
        },
        substituir: function (colecao, lista) {
            gravar(colecao, lista);
        },
        lerObjeto: function (chave, padrao) {
            return ler(chave, padrao === undefined ? {} : padrao);
        },
        gravarObjeto: function (chave, valor) {
            gravar(chave, valor);
            return valor;
        }
    };

    /* ------------------------------------------------------------------ */
    /* Formatacao                                                          */
    /* ------------------------------------------------------------------ */
    var fmtMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    var fmtNumero = new Intl.NumberFormat('pt-BR');

    var fmt = {
        moeda: function (v) { return fmtMoeda.format(Number(v) || 0); },
        numero: function (v) { return fmtNumero.format(Number(v) || 0); },
        porcentagem: function (v, casas) {
            return (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: casas || 1, maximumFractionDigits: casas || 1 }) + '%';
        },
        data: function (iso) {
            if (!iso) return '-';
            var d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
            return isNaN(d) ? '-' : d.toLocaleDateString('pt-BR');
        },
        dataHora: function (iso) {
            if (!iso) return '-';
            var d = new Date(iso);
            return isNaN(d) ? '-' : d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        },
        /* Data relativa: "agora", "ha 5 min", "ha 2 h", "ontem", "ha 3 dias" */
        relativo: function (iso) {
            var diff = (Date.now() - new Date(iso).getTime()) / 1000;
            if (diff < 60) return 'agora';
            if (diff < 3600) return 'há ' + Math.floor(diff / 60) + ' min';
            if (diff < 86400) return 'há ' + Math.floor(diff / 3600) + ' h';
            if (diff < 172800) return 'ontem';
            return 'há ' + Math.floor(diff / 86400) + ' dias';
        },
        /* Converte "1.234,56" ou "1234.56" em numero */
        paraNumero: function (texto) {
            if (typeof texto === 'number') return texto;
            if (!texto) return 0;
            var t = String(texto).replace(/[^\d,.-]/g, '');
            if (t.indexOf(',') !== -1) t = t.replace(/\./g, '').replace(',', '.');
            var n = parseFloat(t);
            return isNaN(n) ? 0 : n;
        },
        /* Para inputs type="date": "YYYY-MM-DD" */
        dataInput: function (iso) {
            if (!iso) return '';
            var s = String(iso);
            if (s.length <= 10) return s;
            /* data com hora (ISO em UTC): converte para o dia no fuso local */
            var d = new Date(s);
            if (isNaN(d)) return s.slice(0, 10);
            return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        },
        hojeInput: function () {
            var d = new Date();
            return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        }
    };

    /* Escapa texto antes de colocar em innerHTML */
    function esc(texto) {
        return String(texto === undefined || texto === null ? '' : texto)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    /* ------------------------------------------------------------------ */
    /* Mascaras e validacoes                                               */
    /* ------------------------------------------------------------------ */
    var mascara = {
        cpf: function (v) {
            return String(v).replace(/\D/g, '').slice(0, 11)
                .replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        },
        cnpj: function (v) {
            return String(v).replace(/\D/g, '').slice(0, 14)
                .replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
                .replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
        },
        documento: function (v) {
            var d = String(v).replace(/\D/g, '');
            return d.length <= 11 ? mascara.cpf(d) : mascara.cnpj(d);
        },
        telefone: function (v) {
            var d = String(v).replace(/\D/g, '').slice(0, 11);
            if (d.length <= 10) return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
            return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
        },
        cep: function (v) {
            return String(v).replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
        },
        /* Liga a mascara a um input: Nexo.mascara.aplicar(input, 'cpf') */
        aplicar: function (input, tipo) {
            if (!input || !mascara[tipo]) return;
            input.addEventListener('input', function () { input.value = mascara[tipo](input.value); });
        }
    };

    var validar = {
        email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim()); },
        cpf: function (v) {
            var c = String(v || '').replace(/\D/g, '');
            if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
            var s = 0, r, i;
            for (i = 0; i < 9; i++) s += +c[i] * (10 - i);
            r = (s * 10) % 11; if (r === 10) r = 0; if (r !== +c[9]) return false;
            s = 0;
            for (i = 0; i < 10; i++) s += +c[i] * (11 - i);
            r = (s * 10) % 11; if (r === 10) r = 0;
            return r === +c[10];
        },
        cnpj: function (v) {
            var c = String(v || '').replace(/\D/g, '');
            if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
            function dig(base) {
                var pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
                var s = 0;
                for (var i = 0; i < pesos.length; i++) s += +base[i] * pesos[i];
                var r = s % 11;
                return r < 2 ? 0 : 11 - r;
            }
            return dig(c.slice(0, 12)) === +c[12] && dig(c.slice(0, 13)) === +c[13];
        },
        documento: function (v) {
            var d = String(v || '').replace(/\D/g, '');
            return d.length === 11 ? validar.cpf(d) : validar.cnpj(d);
        },
        telefone: function (v) {
            var d = String(v || '').replace(/\D/g, '');
            return d.length === 10 || d.length === 11;
        },
        obrigatorio: function (v) { return String(v === undefined || v === null ? '' : v).trim() !== ''; }
    };


    /* Gera CPF/CNPJ com digitos verificadores validos a partir de uma base numerica */
    function gerarCPF(base9) {
        var c = String(base9).padStart(9, "0").slice(0, 9);
        for (var t = 9; t < 11; t++) {
            var s = 0;
            for (var i = 0; i < t; i++) s += +c[i] * (t + 1 - i);
            var r = (s * 10) % 11;
            c += r === 10 ? 0 : r;
        }
        return mascara.cpf(c);
    }
    function gerarCNPJ(base8) {
        var c = String(base8).padStart(8, "0").slice(0, 8) + "0001";
        [[5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]].forEach(function (pesos) {
            var s = 0;
            for (var i = 0; i < pesos.length; i++) s += +c[i] * pesos[i];
            var r = s % 11;
            c += r < 2 ? 0 : 11 - r;
        });
        return mascara.cnpj(c);
    }

    /* ------------------------------------------------------------------ */
    /* Sessao e usuarios                                                   */
    /* ------------------------------------------------------------------ */
    var MODULOS = [
        { id: 'inicio', nome: 'Início' },
        { id: 'empresa', nome: 'Empresa' },
        { id: 'pedidos', nome: 'Pedidos' },
        { id: 'produtos', nome: 'Produtos' },
        { id: 'estoque', nome: 'Estoque' },
        { id: 'fornecedores', nome: 'Fornecedores' },
        { id: 'clientes', nome: 'Clientes' },
        { id: 'revendedores', nome: 'Revendedores' },
        { id: 'financeiro', nome: 'Financeiro' },
        { id: 'relatorios', nome: 'Relatórios' },
        { id: 'configuracoes', nome: 'Configurações' }
    ];

    var PERFIS = ['Administrador', 'Vendedor', 'Estoquista', 'Financeiro'];

    var auth = {
        /* Retorna {ok:true, usuario} ou {ok:false, erro:'...'} */
        login: function (email, senha, lembrar) {
            var em = String(email || '').trim().toLowerCase();
            var usuarios = db.listar('usuarios');
            var u = usuarios.filter(function (x) { return String(x.email).toLowerCase() === em; })[0];
            if (!u || u.senha !== senha) return { ok: false, erro: 'E-mail ou senha incorretos.' };
            if (!u.ativo) return { ok: false, erro: 'Usuário desativado. Fale com o administrador.' };
            var sessao = { usuarioId: u.id, inicio: agoraISO() };
            var texto = JSON.stringify(sessao);
            try {
                if (lembrar) {
                    localStorage.setItem(PREFIXO + 'sessao', texto);
                    sessionStorage.removeItem(PREFIXO + 'sessao');
                } else {
                    sessionStorage.setItem(PREFIXO + 'sessao', texto);
                    localStorage.removeItem(PREFIXO + 'sessao');
                }
                if (lembrar) localStorage.setItem(PREFIXO + 'lembrar_email', u.email);
                else localStorage.removeItem(PREFIXO + 'lembrar_email');
            } catch (e) { /* navegador sem storage */ }
            db.atualizar('usuarios', u.id, { ultimoAcesso: agoraISO() });
            registrarAtividade('login', u.nome + ' entrou no sistema', null, u.nome);
            return { ok: true, usuario: u };
        },
        logout: function () {
            try {
                localStorage.removeItem(PREFIXO + 'sessao');
                sessionStorage.removeItem(PREFIXO + 'sessao');
            } catch (e) { /* ignora */ }
        },
        sessao: function () {
            try {
                var s = sessionStorage.getItem(PREFIXO + 'sessao') || localStorage.getItem(PREFIXO + 'sessao');
                return s ? JSON.parse(s) : null;
            } catch (e) { return null; }
        },
        usuarioAtual: function () {
            var s = auth.sessao();
            if (!s) return null;
            var u = db.obter('usuarios', s.usuarioId);
            return u && u.ativo ? u : null;
        },
        emailLembrado: function () {
            try { return localStorage.getItem(PREFIXO + 'lembrar_email') || ''; } catch (e) { return ''; }
        },
        /* Perfil do usuario pode acessar o modulo? */
        podeAcessar: function (modulo, usuario) {
            var u = usuario || auth.usuarioAtual();
            if (!u) return false;
            if (u.perfil === 'Administrador') return true;
            /* Inicio e Configuracoes (perfil e senha do proprio usuario) ficam sempre liberados */
            if (modulo === 'inicio' || modulo === 'configuracoes') return true;
            var perm = db.lerObjeto('permissoes', {});
            var lista = perm[u.perfil] || [];
            return lista.indexOf(modulo) !== -1;
        },
        /* Simula envio de recuperacao de senha. Retorna true se o e-mail existe. */
        recuperarSenha: function (email) {
            var em = String(email || '').trim().toLowerCase();
            var existe = db.listar('usuarios').some(function (x) { return String(x.email).toLowerCase() === em; });
            if (existe) registrarAtividade('seguranca', 'Recuperação de senha solicitada para ' + em, null, 'Sistema');
            return existe;
        }
    };

    /* ------------------------------------------------------------------ */
    /* Atividades (log usado no Inicio)                                    */
    /* ------------------------------------------------------------------ */
    function registrarAtividade(tipo, texto, link, usuarioNome, data) {
        var u = usuarioNome || (auth.usuarioAtual() || {}).nome || 'Sistema';
        var lista = db.listar('atividades');
        lista.unshift({ id: gerarId('atv'), tipo: tipo, texto: texto, link: link || null, usuario: u, data: data || agoraISO() });
        if (lista.length > 300) lista.length = 300;
        db.substituir('atividades', lista);
    }

    /* ------------------------------------------------------------------ */
    /* Regras de negocio                                                   */
    /* ------------------------------------------------------------------ */
    var STATUS_PEDIDO = ['Novo', 'Em separação', 'Enviado', 'Entregue', 'Cancelado'];
    var FORMAS_PAGAMENTO = ['Pix', 'Cartão de crédito', 'Cartão de débito', 'Boleto', 'Dinheiro'];

    function proximoNumero(chave, inicial) {
        var cont = db.lerObjeto('contadores', {});
        var n = (cont[chave] || inicial || 1000) + 1;
        cont[chave] = n;
        db.gravarObjeto('contadores', cont);
        return n;
    }

    function totalItens(itens) {
        return (itens || []).reduce(function (s, it) { return s + (Number(it.quantidade) || 0) * (Number(it.precoUnitario) || 0); }, 0);
    }

    function totalPedido(p) {
        return Math.max(0, totalItens(p.itens) - (Number(p.desconto) || 0) + (Number(p.frete) || 0));
    }

    /* Status financeiro calculado: Pago, Pendente, Atrasado ou Cancelado */
    function statusLancamento(l) {
        if (l.status === 'Cancelado') return 'Cancelado';
        if (l.dataPagamento) return 'Pago';
        if (l.vencimento && l.vencimento < fmt.hojeInput()) return 'Atrasado';
        return 'Pendente';
    }

    var ops = {
        /*
         * Movimenta estoque e registra a movimentacao.
         * tipo: 'Entrada' | 'Saída' | 'Ajuste'
         * Em 'Ajuste', quantidade e o NOVO saldo do produto.
         * Retorna {ok:true, movimentacao} ou {ok:false, erro}
         */
        movimentarEstoque: function (produtoId, tipo, quantidade, motivo, referencia, opcoes) {
            var p = db.obter('produtos', produtoId);
            if (!p) return { ok: false, erro: 'Produto não encontrado.' };
            var q = Math.round(Number(quantidade));
            if (isNaN(q) || q < 0 || (tipo !== 'Ajuste' && q === 0)) return { ok: false, erro: 'Quantidade inválida.' };
            var anterior = Number(p.estoque) || 0;
            var novo;
            if (tipo === 'Entrada') novo = anterior + q;
            else if (tipo === 'Saída') {
                if (q > anterior && !(opcoes && opcoes.permitirNegativo)) return { ok: false, erro: 'Estoque insuficiente de "' + p.nome + '" (disponível: ' + anterior + ').' };
                novo = anterior - q;
            } else if (tipo === 'Ajuste') novo = q;
            else return { ok: false, erro: 'Tipo de movimentação inválido.' };

            db.atualizar('produtos', produtoId, { estoque: novo });
            var mov = db.inserir('movimentacoes', {
                produtoId: produtoId,
                tipo: tipo,
                quantidade: tipo === 'Ajuste' ? novo - anterior : q,
                saldoAnterior: anterior,
                saldoAtual: novo,
                motivo: motivo || '',
                referencia: referencia || '',
                usuario: (opcoes && opcoes.usuario) || (auth.usuarioAtual() || {}).nome || 'Sistema',
                data: (opcoes && opcoes.data) || agoraISO()
            });
            if (!(opcoes && opcoes.silencioso)) {
                registrarAtividade('estoque', tipo + ' de ' + Math.abs(mov.quantidade) + ' un. em ' + p.nome, 'estoque.html');
                var min = Number(p.estoqueMinimo) || 0;
                if (novo <= min && anterior > min) {
                    registrarAtividade('alerta', 'Estoque baixo: ' + p.nome + ' (' + novo + ' un.)', 'estoque.html');
                }
            }
            return { ok: true, movimentacao: mov };
        },

        /*
         * Cria um pedido completo: valida estoque, baixa estoque e gera a receita no financeiro.
         * dados: {clienteId, revendedorId?, vendedor, itens:[{produtoId, quantidade, precoUnitario}],
         *         desconto, frete, pagamento:{forma, parcelas, vencimento?, pago:boolean},
         *         entrega:{tipo, endereco, transportadora, previsao}, observacoes}
         */
        criarPedido: function (dados, opcoes) {
            opcoes = opcoes || {};
            if (!dados.clienteId) return { ok: false, erro: 'Selecione o cliente.' };
            if (!dados.itens || !dados.itens.length) return { ok: false, erro: 'Adicione pelo menos um produto.' };
            var i, it, p;
            /* agrega quantidades por produto para validar */
            var porProduto = {};
            for (i = 0; i < dados.itens.length; i++) {
                it = dados.itens[i];
                if (!(Number(it.quantidade) > 0)) return { ok: false, erro: 'Quantidade inválida no item ' + (i + 1) + '.' };
                porProduto[it.produtoId] = (porProduto[it.produtoId] || 0) + Number(it.quantidade);
            }
            /* Configuracoes > Gerais > "Permitir venda sem estoque" */
            var semEstoque = !!((db.lerObjeto('configuracoes', {}).geral || {}).permitirVendaSemEstoque);
            for (var pid in porProduto) {
                p = db.obter('produtos', pid);
                if (!p) return { ok: false, erro: 'Produto não encontrado.' };
                if (!semEstoque && porProduto[pid] > (Number(p.estoque) || 0)) {
                    return { ok: false, erro: 'Estoque insuficiente de "' + p.nome + '" (disponível: ' + (p.estoque || 0) + ').' };
                }
            }
            var data = opcoes.data || agoraISO();
            var usuario = opcoes.usuario || (auth.usuarioAtual() || {}).nome || 'Sistema';
            var itens = dados.itens.map(function (x) {
                var prod = db.obter('produtos', x.produtoId);
                return {
                    produtoId: x.produtoId,
                    nome: prod.nome,
                    sku: prod.sku,
                    quantidade: Number(x.quantidade),
                    precoUnitario: Number(x.precoUnitario !== undefined ? x.precoUnitario : prod.preco),
                    custoUnitario: Number(prod.custo) || 0
                };
            });
            var pag = dados.pagamento || {};
            var pedido = {
                numero: proximoNumero('pedido', 1000),
                data: data,
                clienteId: dados.clienteId,
                revendedorId: dados.revendedorId || null,
                vendedor: dados.vendedor || usuario,
                itens: itens,
                desconto: Number(dados.desconto) || 0,
                frete: Number(dados.frete) || 0,
                pagamento: {
                    forma: pag.forma || 'Pix',
                    parcelas: Number(pag.parcelas) || 1,
                    status: pag.pago ? 'Pago' : 'Pendente'
                },
                entrega: dados.entrega || { tipo: 'Transportadora' },
                status: opcoes.status || 'Novo',
                historico: [{ status: 'Novo', data: data, usuario: usuario, observacao: 'Pedido criado' }],
                observacoes: dados.observacoes || ''
            };
            pedido.total = totalPedido(pedido);
            pedido = db.inserir('pedidos', pedido);

            for (i = 0; i < itens.length; i++) {
                ops.movimentarEstoque(itens[i].produtoId, 'Saída', itens[i].quantidade, 'Venda', 'Pedido #' + pedido.numero,
                    { silencioso: !!opcoes.silencioso, data: data, usuario: usuario, permitirNegativo: semEstoque });
            }

            var cli = db.obter('clientes', dados.clienteId) || {};
            var venc = pag.vencimento || fmt.dataInput(data);
            var lanc = db.inserir('lancamentos', {
                tipo: 'Receita',
                descricao: 'Pedido #' + pedido.numero + ' - ' + (cli.nome || 'Cliente'),
                categoria: 'Vendas',
                valor: pedido.total,
                vencimento: venc,
                dataPagamento: pag.pago ? fmt.dataInput(data) : null,
                formaPagamento: pedido.pagamento.forma,
                pedidoId: pedido.id,
                status: 'Ativo'
            });
            db.atualizar('pedidos', pedido.id, { lancamentoId: lanc.id });
            pedido.lancamentoId = lanc.id;

            if (!opcoes.silencioso) registrarAtividade('pedido', 'Novo pedido #' + pedido.numero + ' de ' + (cli.nome || 'cliente') + ' (' + fmt.moeda(pedido.total) + ')', 'pedidos.html?id=' + pedido.id);
            return { ok: true, pedido: pedido };
        },

        /*
         * Muda o status do pedido e registra no historico.
         * Cancelar devolve os itens ao estoque e cancela a receita.
         */
        alterarStatusPedido: function (pedidoId, novoStatus, observacao, opcoes) {
            opcoes = opcoes || {};
            var p = db.obter('pedidos', pedidoId);
            if (!p) return { ok: false, erro: 'Pedido não encontrado.' };
            if (STATUS_PEDIDO.indexOf(novoStatus) === -1) return { ok: false, erro: 'Status inválido.' };
            if (p.status === 'Cancelado') return { ok: false, erro: 'Pedido cancelado não pode mudar de status.' };
            if (p.status === novoStatus) return { ok: false, erro: 'O pedido já está como "' + novoStatus + '".' };
            var usuario = opcoes.usuario || (auth.usuarioAtual() || {}).nome || 'Sistema';
            var data = opcoes.data || agoraISO();
            var hist = (p.historico || []).concat([{ status: novoStatus, data: data, usuario: usuario, observacao: observacao || '' }]);
            var mudancas = { status: novoStatus, historico: hist };

            if (novoStatus === 'Cancelado') {
                p.itens.forEach(function (it) {
                    ops.movimentarEstoque(it.produtoId, 'Entrada', it.quantidade, 'Cancelamento', 'Pedido #' + p.numero,
                        { silencioso: !!opcoes.silencioso, data: data, usuario: usuario });
                });
                if (p.lancamentoId) db.atualizar('lancamentos', p.lancamentoId, { status: 'Cancelado' });
                mudancas.pagamento = Object.assign({}, p.pagamento, { status: 'Cancelado' });
            }
            if (novoStatus === 'Entregue' && p.entrega) {
                mudancas.entrega = Object.assign({}, p.entrega, { dataEntrega: data });
            }
            var atualizado = db.atualizar('pedidos', pedidoId, mudancas);
            if (!opcoes.silencioso) registrarAtividade('pedido', 'Pedido #' + p.numero + ' alterado para "' + novoStatus + '"', 'pedidos.html?id=' + p.id);
            return { ok: true, pedido: atualizado };
        },

        /* Marca o pagamento do pedido (e a receita) como pago */
        registrarPagamentoPedido: function (pedidoId, dataPagamento) {
            var p = db.obter('pedidos', pedidoId);
            if (!p) return { ok: false, erro: 'Pedido não encontrado.' };
            if (p.status === 'Cancelado') return { ok: false, erro: 'Pedido cancelado.' };
            var dia = dataPagamento || fmt.hojeInput();
            db.atualizar('pedidos', pedidoId, { pagamento: Object.assign({}, p.pagamento, { status: 'Pago' }) });
            if (p.lancamentoId) db.atualizar('lancamentos', p.lancamentoId, { dataPagamento: dia });
            registrarAtividade('financeiro', 'Pagamento do pedido #' + p.numero + ' recebido', 'financeiro.html');
            return { ok: true };
        },

        /*
         * Registra compra de fornecedor.
         * dados: {fornecedorId, itens:[{produtoId, quantidade, custoUnitario}], notaFiscal, vencimento, recebida:boolean}
         * Compra recebida da entrada no estoque. Sempre gera a despesa no financeiro.
         */
        registrarCompra: function (dados, opcoes) {
            opcoes = opcoes || {};
            if (!dados.fornecedorId) return { ok: false, erro: 'Selecione o fornecedor.' };
            if (!dados.itens || !dados.itens.length) return { ok: false, erro: 'Adicione pelo menos um produto.' };
            var data = opcoes.data || agoraISO();
            var itens = dados.itens.map(function (x) {
                var prod = db.obter('produtos', x.produtoId) || {};
                return { produtoId: x.produtoId, nome: prod.nome || '', quantidade: Number(x.quantidade), custoUnitario: Number(x.custoUnitario) };
            });
            var total = itens.reduce(function (s, x) { return s + x.quantidade * x.custoUnitario; }, 0);
            var compra = db.inserir('compras', {
                numero: proximoNumero('compra', 500),
                fornecedorId: dados.fornecedorId,
                data: data,
                itens: itens,
                total: total,
                notaFiscal: dados.notaFiscal || '',
                status: 'Pendente'
            });
            var forn = db.obter('fornecedores', dados.fornecedorId) || {};
            var lanc = db.inserir('lancamentos', {
                tipo: 'Despesa',
                descricao: 'Compra #' + compra.numero + ' - ' + (forn.nomeFantasia || forn.razaoSocial || 'Fornecedor'),
                categoria: 'Compra de mercadorias',
                valor: total,
                vencimento: dados.vencimento || fmt.dataInput(data),
                dataPagamento: dados.paga ? fmt.dataInput(data) : null,
                formaPagamento: 'Boleto',
                compraId: compra.id,
                status: 'Ativo'
            });
            db.atualizar('compras', compra.id, { lancamentoId: lanc.id });
            if (dados.recebida) ops.receberCompra(compra.id, { silencioso: opcoes.silencioso, data: data, usuario: opcoes.usuario });
            if (!opcoes.silencioso) registrarAtividade('compra', 'Compra #' + compra.numero + ' registrada com ' + (forn.nomeFantasia || 'fornecedor') + ' (' + fmt.moeda(total) + ')', 'fornecedores.html');
            return { ok: true, compra: db.obter('compras', compra.id) };
        },

        receberCompra: function (compraId, opcoes) {
            opcoes = opcoes || {};
            var c = db.obter('compras', compraId);
            if (!c) return { ok: false, erro: 'Compra não encontrada.' };
            if (c.status === 'Recebida') return { ok: false, erro: 'Compra já recebida.' };
            c.itens.forEach(function (it) {
                ops.movimentarEstoque(it.produtoId, 'Entrada', it.quantidade, 'Compra de fornecedor', 'Compra #' + c.numero,
                    { silencioso: !!opcoes.silencioso, data: opcoes.data, usuario: opcoes.usuario });
                /* atualiza custo do produto com o ultimo custo de compra */
                db.atualizar('produtos', it.produtoId, { custo: it.custoUnitario });
            });
            db.atualizar('compras', compraId, { status: 'Recebida', dataRecebimento: opcoes.data || agoraISO() });
            return { ok: true };
        },

        /* Baixa (pagamento/recebimento) de um lancamento financeiro */
        baixarLancamento: function (id, dataPagamento) {
            var l = db.obter('lancamentos', id);
            if (!l) return { ok: false, erro: 'Lançamento não encontrado.' };
            if (l.status === 'Cancelado') return { ok: false, erro: 'Lançamento cancelado.' };
            var dia = dataPagamento || fmt.hojeInput();
            db.atualizar('lancamentos', id, { dataPagamento: dia });
            if (l.pedidoId) {
                var p = db.obter('pedidos', l.pedidoId);
                if (p) db.atualizar('pedidos', p.id, { pagamento: Object.assign({}, p.pagamento, { status: 'Pago' }) });
            }
            registrarAtividade('financeiro', (l.tipo === 'Receita' ? 'Recebimento' : 'Pagamento') + ' registrado: ' + l.descricao + ' (' + fmt.moeda(l.valor) + ')', 'financeiro.html');
            return { ok: true };
        },

        estornarLancamento: function (id) {
            var l = db.obter('lancamentos', id);
            if (!l) return { ok: false, erro: 'Lançamento não encontrado.' };
            db.atualizar('lancamentos', id, { dataPagamento: null });
            if (l.pedidoId) {
                var p = db.obter('pedidos', l.pedidoId);
                if (p && p.status !== 'Cancelado') db.atualizar('pedidos', p.id, { pagamento: Object.assign({}, p.pagamento, { status: 'Pendente' }) });
            }
            return { ok: true };
        }
    };

    /* ------------------------------------------------------------------ */
    /* Consultas prontas (usadas por varias telas)                         */
    /* ------------------------------------------------------------------ */
    var consultas = {
        totalPedido: totalPedido,
        statusLancamento: statusLancamento,
        STATUS_PEDIDO: STATUS_PEDIDO,
        FORMAS_PAGAMENTO: FORMAS_PAGAMENTO,
        MODULOS: MODULOS,
        PERFIS: PERFIS,

        /* Pedidos validos (nao cancelados) entre duas datas ISO (inclusive). Datas opcionais. */
        pedidosNoPeriodo: function (inicio, fim, incluirCancelados) {
            return db.listar('pedidos').filter(function (p) {
                if (!incluirCancelados && p.status === 'Cancelado') return false;
                var d = fmt.dataInput(p.data);
                if (inicio && d < fmt.dataInput(inicio)) return false;
                if (fim && d > fmt.dataInput(fim)) return false;
                return true;
            });
        },
        lancamentosNoPeriodo: function (inicio, fim, campo) {
            var c = campo || 'vencimento';
            return db.listar('lancamentos').filter(function (l) {
                if (l.status === 'Cancelado') return false;
                var d = fmt.dataInput(l[c]);
                if (!d) return false;
                if (inicio && d < fmt.dataInput(inicio)) return false;
                if (fim && d > fmt.dataInput(fim)) return false;
                return true;
            });
        },
        produtosEstoqueBaixo: function () {
            return db.listar('produtos').filter(function (p) {
                return p.status === 'Ativo' && (Number(p.estoque) || 0) <= (Number(p.estoqueMinimo) || 0);
            });
        },
        /* Mapa id -> objeto para lookup rapido */
        mapa: function (colecao) {
            var m = {};
            db.listar(colecao).forEach(function (x) { m[x.id] = x; });
            return m;
        },
        /* Lucro bruto de um pedido (preco - custo dos itens - desconto) */
        lucroPedido: function (p) {
            var custo = (p.itens || []).reduce(function (s, it) { return s + it.quantidade * (it.custoUnitario || 0); }, 0);
            return totalItens(p.itens) - (Number(p.desconto) || 0) - custo;
        },
        /* Primeiro dia (YYYY-MM-DD) de N dias atras */
        diasAtras: function (n) {
            var d = new Date();
            d.setDate(d.getDate() - n);
            return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        }
    };

    /* ------------------------------------------------------------------ */
    /* Exportacao CSV (abre no Excel em pt-BR)                             */
    /* ------------------------------------------------------------------ */
    /* cabecalho: ['Nome','Valor'], linhas: [['A', 10.5], ...] */
    function exportarCSV(nomeArquivo, cabecalho, linhas) {
        function cel(v) {
            if (typeof v === 'number') return String(v).replace('.', ',');
            var s = String(v === undefined || v === null ? '' : v);
            return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        }
        var conteudo = [cabecalho].concat(linhas).map(function (l) { return l.map(cel).join(';'); }).join('\r\n');
        var blob = new Blob(['﻿' + conteudo], { type: 'text/csv;charset=utf-8' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = nomeArquivo.replace(/\.csv$/i, '') + '.csv';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    }

    /* ------------------------------------------------------------------ */
    /* Dados de exemplo                                                    */
    /* ------------------------------------------------------------------ */
    function semear() {
        /* gerador pseudoaleatorio com semente fixa: os dados de exemplo sao sempre os mesmos */
        var semente = 20260928;
        function rnd() {
            semente = (semente * 1664525 + 1013904223) % 4294967296;
            return semente / 4294967296;
        }
        function inteiro(a, b) { return a + Math.floor(rnd() * (b - a + 1)); }
        function escolher(lista) { return lista[Math.floor(rnd() * lista.length)]; }
        function diaISO(diasAtras, hora) {
            var d = new Date();
            d.setDate(d.getDate() - diasAtras);
            d.setHours(hora === undefined ? inteiro(8, 18) : hora, inteiro(0, 59), 0, 0);
            return d.toISOString();
        }
        function diaInput(diasAtras) { return consultas.diasAtras(diasAtras); }

        lote = {};
        COLECOES.forEach(function (c) { gravar(c, []); });
        gravar('contadores', {});

        /* Empresa */
        db.gravarObjeto('empresa', {
            razaoSocial: 'Nexo Gestão e Recursos Empresariais LTDA',
            nomeFantasia: 'Nexo ERP',
            cnpj: gerarCNPJ(12345678),
            inscricaoEstadual: '123.456.789.123',
            inscricaoMunicipal: '9.876.543-2',
            regimeTributario: 'Simples Nacional',
            cnae: '4772-5/00 - Comércio varejista de cosméticos, produtos de perfumaria e de higiene pessoal',
            dataAbertura: '2021-03-15',
            email: 'contato@nexo.com.br',
            emailFinanceiro: 'financeiro@nexo.com.br',
            telefone: '(11) 4002-8922',
            whatsapp: '(11) 98765-4321',
            site: 'www.nexo.com.br',
            responsavel: 'Admin User',
            endereco: { cep: '01001-000', logradouro: 'Praça da Sé', numero: 'S/N', complemento: '', bairro: 'Sé', cidade: 'São Paulo', uf: 'SP' }
        });

        /* Usuarios e permissoes */
        var usuarios = [
            { id: 'usr_admin', nome: 'Admin User', email: 'admin@nexo.com', senha: 'admin123', perfil: 'Administrador', ativo: true },
            { id: 'usr_ana', nome: 'Ana', email: 'ana@nexo.com', senha: 'ana123', perfil: 'Vendedor', ativo: true },
            { id: 'usr_carlos', nome: 'Carlos', email: 'carlos@nexo.com', senha: 'carlos123', perfil: 'Vendedor', ativo: true },
            { id: 'usr_mariana', nome: 'Mariana', email: 'mariana@nexo.com', senha: 'mariana123', perfil: 'Vendedor', ativo: true },
            { id: 'usr_pedro', nome: 'Pedro', email: 'pedro@nexo.com', senha: 'pedro123', perfil: 'Vendedor', ativo: true },
            { id: 'usr_julia', nome: 'Júlia Estoque', email: 'julia@nexo.com', senha: 'julia123', perfil: 'Estoquista', ativo: true },
            { id: 'usr_roberto', nome: 'Roberto Financeiro', email: 'roberto@nexo.com', senha: 'roberto123', perfil: 'Financeiro', ativo: false }
        ];
        usuarios.forEach(function (u) { u.criadoEm = diaISO(400); u.ultimoAcesso = diaISO(inteiro(0, 20)); db.inserir('usuarios', u); });
        db.gravarObjeto('permissoes', {
            Vendedor: ['inicio', 'pedidos', 'produtos', 'clientes', 'revendedores', 'relatorios'],
            Estoquista: ['inicio', 'produtos', 'estoque', 'fornecedores', 'relatorios'],
            Financeiro: ['inicio', 'pedidos', 'financeiro', 'relatorios', 'fornecedores', 'clientes']
        });
        db.gravarObjeto('configuracoes', {
            notificacoes: { estoqueBaixo: true, novoPedido: true, contasVencer: true, resumoEmail: false, diasAvisoVencimento: 3 },
            preferencias: { itensPorPagina: 10, paginaInicial: 'home.html', formatoData: 'dd/mm/aaaa', moeda: 'BRL' },
            geral: { estoqueMinimoPadrao: 10, prazoEntregaPadrao: 5, freteGratisAcima: 500, permitirVendaSemEstoque: false }
        });

        /* Categorias (mesmas da tela de produtos) */
        var categorias = [
            ['cat_shampoo', 'Shampoo', 'fa-pump-soap'],
            ['cat_condicionador', 'Condicionador', 'fa-bottle-droplet'],
            ['cat_mascara', 'Máscara', 'fa-jar'],
            ['cat_spray', 'Spray', 'fa-spray-can'],
            ['cat_progressiva', 'Progressiva', 'fa-wand-magic-sparkles'],
            ['cat_botox', 'Botox Capilar', 'fa-flask'],
            ['cat_oleo', 'Óleo Capilar', 'fa-droplet'],
            ['cat_ampola', 'Ampola', 'fa-vial'],
            ['cat_acessorios', 'Acessórios', 'fa-scissors']
        ];
        categorias.forEach(function (c) { db.inserir('categorias', { id: c[0], nome: c[1], icone: c[2] }); });

        /* Fornecedores (marcas usadas nos relatorios) */
        var fornecedores = [
            { id: 'for_loreal', razaoSocial: "L'Oréal Brasil Comercial de Cosméticos LTDA", nomeFantasia: "L'Oréal Profissional", cnpj: gerarCNPJ('33000167'), contato: 'Fernanda Lima', email: 'vendas@loreal-distrib.com.br', telefone: '(21) 3984-1000', cidade: 'Rio de Janeiro', uf: 'RJ', marcas: ["L'Oréal", 'Kérastase', 'Redken', 'Matrix'], prazoEntrega: 7, condicaoPagamento: '30/60 dias', status: 'Ativo' },
            { id: 'for_wella', razaoSocial: 'Wella Brasil Distribuidora LTDA', nomeFantasia: 'Wella Professionals', cnpj: gerarCNPJ('61585865'), contato: 'Ricardo Alves', email: 'comercial@wella-distrib.com.br', telefone: '(11) 3048-2200', cidade: 'São Paulo', uf: 'SP', marcas: ['Wella'], prazoEntrega: 5, condicaoPagamento: '28 dias', status: 'Ativo' },
            { id: 'for_beauty', razaoSocial: 'Beauty Hair Atacado de Cosméticos LTDA', nomeFantasia: 'Beauty Hair Atacado', cnpj: gerarCNPJ('07526557'), contato: 'Patrícia Souza', email: 'pedidos@beautyhair.com.br', telefone: '(13) 3471-5500', cidade: 'Santos', uf: 'SP', marcas: ['Wella', "L'Oréal", 'Matrix'], prazoEntrega: 3, condicaoPagamento: 'À vista', status: 'Ativo' },
            { id: 'for_acess', razaoSocial: 'Pro Acessórios para Salão EIRELI', nomeFantasia: 'Pro Acessórios', cnpj: gerarCNPJ('11222333'), contato: 'Marcos Tavares', email: 'contato@proacessorios.com.br', telefone: '(11) 2296-7788', cidade: 'Guarulhos', uf: 'SP', marcas: ['Pro Acessórios'], prazoEntrega: 10, condicaoPagamento: '30 dias', status: 'Ativo' },
            { id: 'for_capilar', razaoSocial: 'Capilar Sul Distribuidora LTDA', nomeFantasia: 'Capilar Sul', cnpj: gerarCNPJ('45997418'), contato: 'Juliana Prado', email: 'vendas@capilarsul.com.br', telefone: '(51) 3221-4040', cidade: 'Porto Alegre', uf: 'RS', marcas: ['Redken', 'Kérastase'], prazoEntrega: 12, condicaoPagamento: '30/60/90 dias', status: 'Inativo' }
        ];
        fornecedores.forEach(function (f) { f.observacoes = ''; f.endereco = { cidade: f.cidade, uf: f.uf }; db.inserir('fornecedores', f); });

        /* Produtos */
        var catalogo = [
            ['Shampoo Reconstrutor', 'cat_shampoo', 'Kérastase', 'for_loreal', '250ml', 89.9, 41.5],
            ['Shampoo Hidratante', 'cat_shampoo', "L'Oréal", 'for_loreal', '300ml', 59.9, 26.0],
            ['Shampoo Antirresíduo', 'cat_shampoo', 'Wella', 'for_wella', '1L', 74.9, 33.0],
            ['Shampoo Matizador', 'cat_shampoo', 'Matrix', 'for_beauty', '300ml', 69.9, 30.5],
            ['Condicionador Nutritivo', 'cat_condicionador', 'Kérastase', 'for_loreal', '200ml', 94.9, 44.0],
            ['Condicionador Hidratante', 'cat_condicionador', "L'Oréal", 'for_loreal', '200ml', 54.9, 23.9],
            ['Condicionador Color', 'cat_condicionador', 'Redken', 'for_loreal', '300ml', 79.9, 36.0],
            ['Máscara Hidratação Intensa', 'cat_mascara', 'Kérastase', 'for_loreal', '200g', 159.9, 72.0],
            ['Máscara Reconstrutora', 'cat_mascara', 'Wella', 'for_wella', '150ml', 119.9, 52.0],
            ['Máscara Nutrição', 'cat_mascara', "L'Oréal", 'for_loreal', '250g', 99.9, 43.0],
            ['Máscara Matizadora', 'cat_mascara', 'Matrix', 'for_beauty', '500g', 109.9, 48.0],
            ['Spray Fixador', 'cat_spray', 'Wella', 'for_wella', '400ml', 49.9, 21.0],
            ['Spray Protetor Térmico', 'cat_spray', 'Redken', 'for_loreal', '250ml', 84.9, 37.5],
            ['Leave-in Spray 10 em 1', 'cat_spray', "L'Oréal", 'for_beauty', '150ml', 64.9, 27.0],
            ['Progressiva Orgânica', 'cat_progressiva', 'Matrix', 'for_beauty', '1L', 249.9, 118.0],
            ['Progressiva Sem Formol', 'cat_progressiva', 'Wella', 'for_wella', '500ml', 199.9, 92.0],
            ['Botox Capilar Redutor', 'cat_botox', "L'Oréal", 'for_loreal', '1kg', 189.9, 86.0],
            ['Botox Capilar Matizador', 'cat_botox', 'Matrix', 'for_beauty', '500g', 149.9, 67.0],
            ['Óleo Reparador de Pontas', 'cat_oleo', 'Kérastase', 'for_loreal', '100ml', 179.9, 81.0],
            ['Óleo de Argan', 'cat_oleo', 'Wella', 'for_wella', '100ml', 99.9, 44.0],
            ['Ampola Reconstrução', 'cat_ampola', 'Redken', 'for_loreal', '15ml', 29.9, 12.5],
            ['Ampola Brilho Intenso', 'cat_ampola', "L'Oréal", 'for_loreal', '12ml', 24.9, 10.0],
            ['Escova Térmica Profissional', 'cat_acessorios', 'Pro Acessórios', 'for_acess', '32mm', 79.9, 35.0],
            ['Kit Pentes Antiestáticos', 'cat_acessorios', 'Pro Acessórios', 'for_acess', '6 un.', 39.9, 15.0],
            ['Touca Térmica', 'cat_acessorios', 'Pro Acessórios', 'for_acess', 'Única', 119.9, 54.0]
        ];
        var produtos = catalogo.map(function (c, i) {
            var cat = c[1].replace('cat_', '').slice(0, 3).toUpperCase();
            var validade = new Date();
            validade.setMonth(validade.getMonth() + inteiro(4, 30));
            return db.inserir('produtos', {
                id: 'prd_' + (i + 1),
                nome: c[0],
                sku: 'NX-' + cat + '-' + String(i + 1).padStart(3, '0'),
                codigoBarras: '789' + String(1000000000 + i * 7919 + 12345).slice(0, 10),
                categoriaId: c[1],
                marca: c[2],
                fornecedorId: c[3],
                volume: c[4],
                preco: c[5],
                custo: c[6],
                estoque: 0,
                estoqueMinimo: c[1] === 'cat_ampola' ? 30 : 10,
                validade: fmt.dataInput(validade.toISOString()),
                lote: 'L' + inteiro(2400, 2699),
                status: i === 24 ? 'Inativo' : 'Ativo',
                descricao: c[0] + ' ' + c[2] + ' ' + c[4] + ' para uso profissional e home care.',
                criadoEm: diaISO(380)
            });
        });

        /* Revendedores */
        var revendedores = [
            { id: 'rev_1', nome: 'Studio Bella Hair', documento: gerarCNPJ('23456789'), email: 'compras@studiobella.com.br', telefone: '(13) 99812-3344', cidade: 'Praia Grande', uf: 'SP', desconto: 15, condicaoPagamento: '30 dias', limiteCredito: 15000, comissao: 5, status: 'Ativo' },
            { id: 'rev_2', nome: 'Salão Charme & Cia', documento: gerarCNPJ('34567890'), email: 'charme@charmecia.com.br', telefone: '(13) 99711-2299', cidade: 'Santos', uf: 'SP', desconto: 12, condicaoPagamento: '28 dias', limiteCredito: 10000, comissao: 4, status: 'Ativo' },
            { id: 'rev_3', nome: 'Distribuidora Litoral Beauty', documento: gerarCNPJ('45678901'), email: 'pedidos@litoralbeauty.com.br', telefone: '(13) 3301-4455', cidade: 'São Vicente', uf: 'SP', desconto: 20, condicaoPagamento: '30/60 dias', limiteCredito: 40000, comissao: 6, status: 'Ativo' },
            { id: 'rev_4', nome: 'Espaço Cachos', documento: gerarCNPJ('56789012'), email: 'espacocachos@gmail.com', telefone: '(11) 98234-5566', cidade: 'São Paulo', uf: 'SP', desconto: 10, condicaoPagamento: 'À vista', limiteCredito: 5000, comissao: 3, status: 'Ativo' },
            { id: 'rev_5', nome: 'Marina Revendas', documento: gerarCPF('123456789'), email: 'marina.revendas@gmail.com', telefone: '(13) 99123-8877', cidade: 'Mongaguá', uf: 'SP', desconto: 8, condicaoPagamento: 'À vista', limiteCredito: 3000, comissao: 3, status: 'Inativo' }
        ];
        revendedores.forEach(function (r) { r.observacoes = ''; r.criadoEm = diaISO(inteiro(200, 400)); db.inserir('revendedores', r); });

        /* Clientes */
        var nomesPF = ['Mariana Costa', 'Juliana Ferreira', 'Camila Rodrigues', 'Fernanda Almeida', 'Beatriz Santos', 'Larissa Oliveira',
            'Patrícia Gomes', 'Amanda Ribeiro', 'Renata Carvalho', 'Gabriela Martins', 'Letícia Barbosa', 'Vanessa Rocha',
            'Carolina Dias', 'Aline Monteiro', 'Tatiane Freitas', 'Priscila Moura'];
        var nomesPJ = ['Salão Glamour LTDA', 'Barbearia Vintage ME', 'Estética Bem Estar LTDA', 'Hair Design Studio ME', 'Clínica Capilar Renova LTDA', 'Beleza Pura Cosméticos ME'];
        var cidades = [['Praia Grande', 'SP', 'Boqueirão'], ['Santos', 'SP', 'Gonzaga'], ['São Vicente', 'SP', 'Centro'], ['São Paulo', 'SP', 'Moema'], ['Guarujá', 'SP', 'Pitangueiras'], ['Mongaguá', 'SP', 'Centro']];
        var ruas = ['Av. Presidente Kennedy', 'Rua Tupi', 'Av. Ana Costa', 'Rua Frei Gaspar', 'Av. Ibirapuera', 'Rua Marechal Deodoro', 'Av. Castelo Branco'];
        
        
        var clientes = [];
        nomesPF.forEach(function (n, i) {
            var c = escolher(cidades);
            var slug = n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '.');
            clientes.push(db.inserir('clientes', {
                id: 'cli_' + (i + 1), tipo: 'PF', nome: n, documento: gerarCPF(String(100000000 + i * 37719113)), email: slug + '@email.com',
                telefone: '(13) 9' + inteiro(8000, 9999) + '-' + inteiro(1000, 9999), dataNascimento: (1975 + inteiro(0, 28)) + '-' + String(inteiro(1, 12)).padStart(2, '0') + '-' + String(inteiro(1, 28)).padStart(2, '0'),
                endereco: { cep: '117' + inteiro(0, 9) + inteiro(0, 9) + '-' + inteiro(100, 999), logradouro: escolher(ruas), numero: String(inteiro(10, 2500)), complemento: rnd() < 0.3 ? 'Apto ' + inteiro(11, 154) : '', bairro: c[2], cidade: c[0], uf: c[1] },
                revendedorId: rnd() < 0.55 ? escolher(['rev_1', 'rev_2', 'rev_3', 'rev_4']) : null,
                observacoes: i === 2 ? 'Prefere entrega no período da tarde.' : (i === 5 ? 'Cliente alérgica a produtos com formol.' : ''),
                status: i === 15 ? 'Inativo' : 'Ativo',
                criadoEm: diaISO(inteiro(190, 420))
            }));
        });
        nomesPJ.forEach(function (n, i) {
            var c = escolher(cidades);
            clientes.push(db.inserir('clientes', {
                id: 'cli_pj' + (i + 1), tipo: 'PJ', nome: n, razaoSocial: n, documento: gerarCNPJ(String(20000000 + i * 3917311)), email: 'compras@' + n.toLowerCase().split(' ')[1].normalize('NFD').replace(/[̀-ͯ]/g, '') + '.com.br',
                telefone: '(13) 3' + inteiro(200, 499) + '-' + inteiro(1000, 9999), responsavel: escolher(['Cláudia', 'Roberto', 'Sandra', 'Eduardo']),
                endereco: { cep: '113' + inteiro(10, 99) + '-' + inteiro(100, 999), logradouro: escolher(ruas), numero: String(inteiro(10, 2500)), complemento: 'Loja ' + inteiro(1, 20), bairro: c[2], cidade: c[0], uf: c[1] },
                revendedorId: rnd() < 0.4 ? escolher(['rev_1', 'rev_3']) : null,
                observacoes: i === 0 ? 'Compra mensal, sempre no início do mês.' : '',
                status: 'Ativo',
                criadoEm: diaISO(inteiro(190, 420))
            }));
        });

        /* Estoque inicial (entrada ha 200 dias) */
        produtos.forEach(function (p) {
            ops.movimentarEstoque(p.id, 'Entrada', inteiro(120, 260), 'Estoque inicial', 'Implantação', { silencioso: true, data: diaISO(200, 9), usuario: 'Júlia Estoque' });
        });

        /* Compras de fornecedores a cada ~30 dias (reposicao) */
        var vendedores = ['Ana', 'Carlos', 'Mariana', 'Pedro'];
        for (var dc = 175; dc >= 5; dc -= 30) {
            var fornId = escolher(['for_loreal', 'for_wella', 'for_beauty', 'for_acess']);
            var prodsForn = produtos.filter(function (p) { return p.fornecedorId === fornId; });
            var itensCompra = prodsForn.slice(0, Math.min(4, prodsForn.length)).map(function (p) {
                return { produtoId: p.id, quantidade: inteiro(30, 80), custoUnitario: p.custo };
            });
            ops.registrarCompra({
                fornecedorId: fornId, itens: itensCompra, notaFiscal: 'NF ' + inteiro(10000, 99999),
                vencimento: diaInput(dc - 30), paga: dc > 35, recebida: dc > 8
            }, { silencioso: true, data: diaISO(dc, 10), usuario: 'Júlia Estoque' });
        }

        /* Pedidos dos ultimos 180 dias (mais pedidos nos meses recentes) */
        var produtosAtivos = produtos.filter(function (p) { return p.status === 'Ativo'; });
        var clientesAtivos = clientes.filter(function (c) { return c.status === 'Ativo'; });
        var formas = ['Pix', 'Pix', 'Cartão de crédito', 'Cartão de crédito', 'Boleto', 'Cartão de débito', 'Dinheiro'];
        for (var dia = 180; dia >= 0; dia--) {
            var qtdDia = rnd() < 0.9 ? inteiro(1, dia < 7 ? 4 : 3) + (rnd() < 0.3 ? 1 : 0) : 0;
            for (var k = 0; k < qtdDia; k++) {
                var cli = escolher(clientesAtivos);
                var nItens = inteiro(1, 4);
                var usados = {};
                var itens = [];
                for (var j = 0; j < nItens; j++) {
                    var prod = escolher(produtosAtivos);
                    /* produtos parados para o relatorio de produtos sem saida */
                    if (prod.id === 'prd_24' || (prod.id === 'prd_13' && dia < 75)) continue;
                    if (usados[prod.id]) continue;
                    usados[prod.id] = true;
                    var atual = db.obter('produtos', prod.id);
                    var q = inteiro(1, cli.tipo === 'PJ' ? 8 : 3);
                    if (atual.estoque < q + 5) continue;
                    var rev = cli.revendedorId ? db.obter('revendedores', cli.revendedorId) : null;
                    var preco = rev ? Math.round(prod.preco * (1 - rev.desconto / 100) * 100) / 100 : prod.preco;
                    itens.push({ produtoId: prod.id, quantidade: q, precoUnitario: preco });
                }
                if (!itens.length) continue;
                var forma = escolher(formas);
                var hora = inteiro(8, 19);
                var dataPedido = diaISO(dia, hora);
                var pago = dia > 12 ? rnd() < 0.93 : rnd() < 0.55;
                var subtotal = itens.reduce(function (s, x) { return s + x.quantidade * x.precoUnitario; }, 0);
                var r = ops.criarPedido({
                    clienteId: cli.id,
                    revendedorId: cli.revendedorId,
                    vendedor: escolher(vendedores),
                    itens: itens,
                    desconto: rnd() < 0.2 ? Math.round(subtotal * 0.05 * 100) / 100 : 0,
                    frete: subtotal >= 500 ? 0 : escolher([0, 15, 18.9, 25]),
                    pagamento: { forma: forma, parcelas: forma === 'Cartão de crédito' ? inteiro(1, 3) : 1, pago: pago, vencimento: forma === 'Boleto' ? diaInput(dia - 7) : diaInput(dia) },
                    entrega: {
                        tipo: rnd() < 0.2 ? 'Retirada na loja' : 'Transportadora',
                        transportadora: escolher(['Correios SEDEX', 'Jadlog', 'Loggi', 'Entrega própria']),
                        endereco: cli.endereco ? (cli.endereco.logradouro + ', ' + cli.endereco.numero + ' - ' + cli.endereco.bairro + ', ' + cli.endereco.cidade + '/' + cli.endereco.uf) : '',
                        codigoRastreio: '',
                        previsao: diaInput(dia - 5)
                    },
                    observacoes: ''
                }, { silencioso: true, data: dataPedido, usuario: 'Sistema' });
                if (!r.ok) continue;
                var ped = r.pedido;
                /* evolui o status conforme a idade do pedido */
                var sorte = rnd();
                function passo(st, dDepois, obs) {
                    var dt = new Date(dataPedido);
                    dt.setHours(dt.getHours() + dDepois * 24);
                    if (dt > new Date()) return false;
                    ops.alterarStatusPedido(ped.id, st, obs || '', { silencioso: true, data: dt.toISOString(), usuario: escolher(['Júlia Estoque', 'Admin User']) });
                    return true;
                }
                if (sorte < 0.05 && dia > 2) {
                    passo('Cancelado', 1, 'Cancelado a pedido do cliente');
                } else if (dia >= 1) {
                    if (passo('Em separação', 0.3)) {
                        if (dia >= 2 && passo('Enviado', 1, 'Despachado')) {
                            if (ped.entrega.tipo !== 'Retirada na loja') {
                                db.atualizar('pedidos', ped.id, { entrega: Object.assign({}, db.obter('pedidos', ped.id).entrega, { codigoRastreio: 'BR' + inteiro(100000000, 999999999) + 'BR' }) });
                            }
                            if (dia >= 5) passo('Entregue', inteiro(2, 4));
                        }
                    }
                }
            }
        }

        /* Despesas fixas mensais (6 meses + mes seguinte) */
        var hoje = new Date();
        for (var m = 5; m >= -1; m--) {
            var ref = new Date(hoje.getFullYear(), hoje.getMonth() - m, 1);
            var anoMes = ref.getFullYear() + '-' + String(ref.getMonth() + 1).padStart(2, '0');
            var nomeMes = ref.toLocaleDateString('pt-BR', { month: 'long' });
            var fixas = [
                ['Aluguel do galpão', 'Aluguel', 1800, '05'],
                ['Folha de pagamento', 'Salários', 5200, '05'],
                ['Energia elétrica', 'Contas de consumo', 320 + inteiro(0, 140), '10'],
                ['Internet e telefonia', 'Contas de consumo', 149.9, '12'],
                ['Simples Nacional (DAS)', 'Impostos', 1300 + inteiro(0, 500), '20'],
                ['Marketing digital', 'Marketing', 600, '15'],
                ['Sistema e hospedagem', 'Tecnologia', 189, '08']
            ];
            fixas.forEach(function (f) {
                var venc = anoMes + '-' + f[3];
                var jaPassou = venc < fmt.hojeInput();
                db.inserir('lancamentos', {
                    tipo: 'Despesa', descricao: f[0] + ' (' + nomeMes + ')', categoria: f[1], valor: f[2],
                    vencimento: venc,
                    dataPagamento: jaPassou && !(m === 0 && f[1] === 'Impostos') ? venc : null,
                    formaPagamento: f[1] === 'Salários' ? 'Transferência' : 'Boleto',
                    status: 'Ativo', criadoEm: new Date(ref.getFullYear(), ref.getMonth(), 1).toISOString()
                });
            });
        }
        /* Outras receitas */
        db.inserir('lancamentos', { tipo: 'Receita', descricao: 'Treinamento para salão parceiro', categoria: 'Serviços', valor: 1800, vencimento: diaInput(40), dataPagamento: diaInput(38), formaPagamento: 'Pix', status: 'Ativo' });
        db.inserir('lancamentos', { tipo: 'Receita', descricao: 'Bonificação de fornecedor', categoria: 'Outras receitas', valor: 950, vencimento: diaInput(-10), dataPagamento: null, formaPagamento: 'Transferência', status: 'Ativo' });

        /* Ajustes de estoque e atividades recentes */
        ops.movimentarEstoque('prd_21', 'Ajuste', Math.max(0, (db.obter('produtos', 'prd_21').estoque || 0) - 3), 'Inventário: 3 ampolas quebradas', 'Inventário', { silencioso: true, data: diaISO(20), usuario: 'Júlia Estoque' });
        /* deixa alguns produtos com estoque baixo para os alertas */
        ['prd_8', 'prd_15', 'prd_19'].forEach(function (id, i) {
            ops.movimentarEstoque(id, 'Ajuste', [6, 4, 8][i], 'Inventário mensal', 'Inventário', { silencioso: true, data: diaISO(3, 17), usuario: 'Júlia Estoque' });
        });

        var ultimos = db.listar('pedidos').sort(function (a, b) { return b.data < a.data ? -1 : 1; }).slice(0, 8);
        var cliMap = consultas.mapa('clientes');
        var atividades = [];
        ultimos.forEach(function (p) {
            atividades.push({ id: gerarId('atv'), tipo: 'pedido', texto: 'Novo pedido #' + p.numero + ' de ' + (cliMap[p.clienteId] || {}).nome + ' (' + fmt.moeda(p.total) + ')', link: 'pedidos.html?id=' + p.id, usuario: p.vendedor, data: p.data });
        });
        atividades.push({ id: gerarId('atv'), tipo: 'alerta', texto: 'Estoque baixo: Máscara Hidratação Intensa (6 un.)', link: 'estoque.html', usuario: 'Sistema', data: diaISO(3, 17) });
        atividades.push({ id: gerarId('atv'), tipo: 'alerta', texto: 'Estoque baixo: Progressiva Orgânica (4 un.)', link: 'estoque.html', usuario: 'Sistema', data: diaISO(3, 17) });
        atividades.push({ id: gerarId('atv'), tipo: 'cliente', texto: 'Cliente Priscila Moura cadastrada', link: 'clientes.html', usuario: 'Ana', data: diaISO(6, 11) });
        atividades.push({ id: gerarId('atv'), tipo: 'compra', texto: 'Compra recebida de fornecedor', link: 'fornecedores.html', usuario: 'Júlia Estoque', data: diaISO(5, 10) });
        atividades.sort(function (a, b) { return b.data < a.data ? -1 : 1; });
        db.substituir('atividades', atividades);

        gravar('versao', VERSAO_DADOS);
        var pronto = lote;
        lote = null;
        Object.keys(pronto).forEach(function (k) { gravar(k, pronto[k]); });
    }

    function iniciar() {
        if (ler('versao', null) !== VERSAO_DADOS) semear();
    }

    function resetar() {
        try {
            Object.keys(localStorage).forEach(function (k) {
                if (k.indexOf(PREFIXO) === 0 && k !== PREFIXO + 'sessao' && k !== PREFIXO + 'lembrar_email') localStorage.removeItem(k);
            });
        } catch (e) { /* ignora */ }
        semear();
    }

    iniciar();

    global.Nexo = {
        db: db,
        fmt: fmt,
        esc: esc,
        mascara: mascara,
        validar: validar,
        auth: auth,
        ops: ops,
        consultas: consultas,
        registrarAtividade: registrarAtividade,
        exportarCSV: exportarCSV,
        gerarId: gerarId,
        resetar: resetar
    };
})(window);
