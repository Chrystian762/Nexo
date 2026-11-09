/*
 * NEXO ERP - Layout comum (menu lateral, login, notificacoes, toast e modais)
 * --------------------------------------------------------------
 * Depende de nexo-data.js (carregar antes).
 *
 * Em cada tela:
 *   <body ...>
 *     <aside id="nexo-sidebar"></aside>
 *     <main> ... </main>
 *     <script> Nexo.layout.montar('pedidos'); </script>
 *
 * montar(modulo):
 *   - exige login (senao vai para login.html)
 *   - verifica a permissao do perfil para o modulo
 *   - desenha o menu lateral com o item ativo, o usuario logado e as notificacoes
 *   - cria o menu para celular
 *
 * Utilitarios:
 *   Nexo.ui.toast('Salvo!', 'sucesso' | 'erro' | 'aviso' | 'info')
 *   Nexo.ui.confirmar('Excluir?', 'Texto', {textoOk:'Excluir', perigo:true}).then(function(ok){...})
 *   Nexo.ui.abrirModal({titulo, html, largura:'max-w-2xl', aoAbrir:function(el){}, botoes:[...]}) -> {fechar, el}
 *   Nexo.ui.parametro('id')  -> valor do ?id= da URL
 *   Nexo.ui.paginar(lista, pagina, porPagina) -> {itens, total, paginas, pagina}
 *   Nexo.ui.htmlPaginacao(info, 'nomeDaFuncaoGlobal') -> html dos botoes de pagina
 *   Nexo.ui.badgeStatus('Entregue') -> html do selo colorido
 */
(function (global) {
    'use strict';
    var Nexo = global.Nexo;
    if (!Nexo) { console.error('Carregue JS/nexo-data.js antes de JS/nexo-layout.js'); return; }
    var esc = Nexo.esc;

    var MENU = [
        { id: 'inicio', nome: 'Início', href: 'home.html', icone: 'fa-house' },
        { id: 'empresa', nome: 'Empresa', href: 'empresa.html', icone: 'fa-building' },
        { id: 'pedidos', nome: 'Pedidos', href: 'pedidos.html', icone: 'fa-cart-shopping' },
        { id: 'produtos', nome: 'Produtos', href: 'produtos.html', icone: 'fa-bottle-droplet' },
        { id: 'estoque', nome: 'Estoque', href: 'estoque.html', icone: 'fa-boxes-stacked' },
        { id: 'fornecedores', nome: 'Fornecedores', href: 'fornecedores.html', icone: 'fa-truck' },
        { id: 'clientes', nome: 'Clientes', href: 'clientes.html', icone: 'fa-users' },
        { id: 'revendedores', nome: 'Revendedores', href: 'revendedores.html', icone: 'fa-handshake' },
        { id: 'financeiro', nome: 'Financeiro', href: 'financeiro.html', icone: 'fa-wallet' },
        { id: 'relatorios', nome: 'Relatórios', href: 'relatorios2.html', icone: 'fa-file-lines' },
        { id: 'configuracoes', nome: 'Configurações', href: 'configuracoes.html', icone: 'fa-gear' }
    ];

    /* ------------------------------------------------------------------ */
    /* Estilos auxiliares (scrollbar, animacao, toast)                     */
    /* ------------------------------------------------------------------ */
    function injetarEstilos() {
        if (document.getElementById('nexo-estilos')) return;
        var st = document.createElement('style');
        st.id = 'nexo-estilos';
        st.textContent =
            '::-webkit-scrollbar{width:8px;height:8px}::-webkit-scrollbar-track{background:transparent}' +
            '::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:4px}' +
            '.fade-in{animation:nexoFade .3s ease-in-out}' +
            '@keyframes nexoFade{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}' +
            '.nexo-toast{animation:nexoToast .25s ease-out}' +
            '@keyframes nexoToast{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}' +
            '.nexo-input{width:100%;border:1px solid #e2e8f0;border-radius:.6rem;padding:.6rem .85rem;font-size:.875rem;background:#fff;outline:none;transition:border-color .15s,box-shadow .15s}' +
            '.nexo-input:focus{border-color:#7c3aed;box-shadow:0 0 0 3px rgba(124,58,237,.15)}' +
            '.nexo-input.erro{border-color:#ef4444;box-shadow:0 0 0 3px rgba(239,68,68,.12)}' +
            '.nexo-input:disabled,.nexo-input[readonly]{background:#f8fafc;color:#475569}' +
            '.nexo-label{display:block;font-size:.75rem;font-weight:600;color:#475569;margin-bottom:.35rem}' +
            '.nexo-btn{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;padding:.6rem 1.1rem;border-radius:.6rem;font-size:.875rem;font-weight:600;transition:all .15s;cursor:pointer}' +
            '.nexo-btn:disabled{opacity:.55;cursor:not-allowed}' +
            '.nexo-btn-primario{background:#7c3aed;color:#fff;box-shadow:0 1px 2px rgba(0,0,0,.08)}.nexo-btn-primario:hover:not(:disabled){background:#6d28d9}' +
            '.nexo-btn-secundario{background:#fff;color:#374151;border:1px solid #e2e8f0}.nexo-btn-secundario:hover:not(:disabled){background:#f8fafc}' +
            '.nexo-btn-perigo{background:#ef4444;color:#fff}.nexo-btn-perigo:hover:not(:disabled){background:#dc2626}' +
            /* elementos absolutos (ex.: .sr-only) dentro de tabelas roláveis nao vazam para fora no celular */
            '.overflow-x-auto,.overflow-auto{position:relative}' +
            '.nexo-card{background:#fff;border:1px solid #f1f5f9;border-radius:1rem;box-shadow:0 1px 3px rgba(0,0,0,.04)}' +
            '@media print{#nexo-sidebar,#nexo-topo-mobile,.nao-imprimir{display:none!important}main{overflow:visible!important}}';
        document.head.appendChild(st);
    }

    /* ------------------------------------------------------------------ */
    /* Notificacoes (calculadas a partir dos dados + configuracoes)        */
    /* ------------------------------------------------------------------ */
    function notificacoes() {
        var cfg = (Nexo.db.lerObjeto('configuracoes', {}).notificacoes) || {};
        var lidas = Nexo.db.lerObjeto('notificacoes_lidas', {});
        var lista = [];
        if (cfg.estoqueBaixo !== false) {
            Nexo.consultas.produtosEstoqueBaixo().forEach(function (p) {
                lista.push({ id: 'est_' + p.id + '_' + p.estoque, icone: 'fa-triangle-exclamation', cor: 'text-amber-500', texto: 'Estoque baixo: ' + p.nome + ' (' + p.estoque + ' un.)', link: 'estoque.html?produto=' + p.id });
            });
        }
        if (cfg.novoPedido !== false) {
            Nexo.db.listar('pedidos').filter(function (p) { return p.status === 'Novo'; }).forEach(function (p) {
                lista.push({ id: 'ped_' + p.id, icone: 'fa-cart-shopping', cor: 'text-brand-purple', texto: 'Pedido #' + p.numero + ' aguardando separação', link: 'pedidos.html?id=' + p.id });
            });
        }
        if (cfg.contasVencer !== false) {
            var dias = Number(cfg.diasAvisoVencimento) || 3;
            var limite = Nexo.consultas.diasAtras(-dias);
            var hoje = Nexo.fmt.hojeInput();
            Nexo.db.listar('lancamentos').forEach(function (l) {
                var st = Nexo.consultas.statusLancamento(l);
                if (l.tipo === 'Despesa' && st === 'Atrasado') {
                    lista.push({ id: 'lan_' + l.id + '_atr', icone: 'fa-circle-exclamation', cor: 'text-red-500', texto: 'Conta atrasada: ' + l.descricao + ' (' + Nexo.fmt.moeda(l.valor) + ')', link: 'financeiro.html' });
                } else if (l.tipo === 'Despesa' && st === 'Pendente' && l.vencimento >= hoje && l.vencimento <= limite) {
                    lista.push({ id: 'lan_' + l.id, icone: 'fa-calendar-day', cor: 'text-blue-500', texto: 'Vence ' + Nexo.fmt.data(l.vencimento) + ': ' + l.descricao + ' (' + Nexo.fmt.moeda(l.valor) + ')', link: 'financeiro.html' });
                }
            });
        }
        /* so mostra avisos de telas que o perfil do usuario pode abrir */
        var modPorPagina = {};
        MENU.forEach(function (m) { modPorPagina[m.href] = m.id; });
        lista = lista.filter(function (n) {
            var mod = modPorPagina[n.link.split('?')[0]];
            return !mod || Nexo.auth.podeAcessar(mod);
        });
        lista.forEach(function (n) { n.lida = !!lidas[n.id]; });
        return lista;
    }

    function marcarTodasLidas() {
        var lidas = Nexo.db.lerObjeto('notificacoes_lidas', {});
        notificacoes().forEach(function (n) { lidas[n.id] = true; });
        Nexo.db.gravarObjeto('notificacoes_lidas', lidas);
    }

    /* ------------------------------------------------------------------ */
    /* Menu lateral                                                        */
    /* ------------------------------------------------------------------ */
    function htmlMenu(modulo, usuario) {
        var links = MENU.filter(function (m) { return Nexo.auth.podeAcessar(m.id, usuario); }).map(function (m) {
            var ativo = m.id === modulo;
            return '<a href="' + m.href + '" class="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left text-sm transition ' +
                (ativo ? 'bg-brand-purple text-white font-semibold shadow-sm' : 'text-gray-600 hover:bg-gray-50 font-medium') + '"' +
                (ativo ? ' aria-current="page"' : '') + '>' +
                '<i class="fa-solid ' + m.icone + ' w-5 text-center ' + (ativo ? 'text-white' : 'text-gray-500') + '"></i> ' + m.nome + '</a>';
        }).join('');
        var nNaoLidas = notificacoes().filter(function (n) { return !n.lida; }).length;
        var inicial = esc((usuario.nome || '?').charAt(0).toUpperCase());
        return '' +
            '<div class="flex flex-col h-full overflow-hidden">' +
            '  <div class="px-8 pt-8 pb-6 flex items-center justify-between">' +
            '    <a href="home.html"><img src="../assets/img/logoNexo.png" alt="Logo Nexo" class="w-32 h-auto object-contain"></a>' +
            '    <button type="button" class="md:hidden text-gray-500 hover:text-gray-800 text-xl" data-nexo-fechar-menu aria-label="Fechar menu"><i class="fa-solid fa-xmark"></i></button>' +
            '  </div>' +
            '  <nav class="px-4 space-y-1 mt-2 overflow-y-auto flex-1 pb-4">' + links + '</nav>' +
            '</div>' +
            '<div class="p-4 mb-2 shrink-0 border-t border-gray-100 relative">' +
            '  <div class="border border-gray-200 rounded-2xl p-3 flex items-center justify-between gap-2">' +
            '    <a href="configuracoes.html#perfil" class="flex items-center gap-3 min-w-0" title="Meu perfil">' +
            '      <div class="w-9 h-9 bg-brand-purple text-white rounded-full flex items-center justify-center font-bold text-sm shrink-0">' + inicial + '</div>' +
            '      <div class="leading-tight min-w-0">' +
            '        <p class="text-sm font-bold text-gray-800 truncate">' + esc(usuario.nome) + '</p>' +
            '        <p class="text-xs text-gray-500 truncate">' + esc(usuario.perfil) + '</p>' +
            '      </div>' +
            '    </a>' +
            '    <div class="flex items-center gap-1 shrink-0">' +
            '      <button type="button" data-nexo-notif class="relative w-8 h-8 rounded-lg text-gray-400 hover:text-brand-purple hover:bg-purple-50 transition" aria-label="Notificações">' +
            '        <i class="fa-solid fa-bell"></i>' +
            (nNaoLidas ? '<span class="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">' + (nNaoLidas > 9 ? '9+' : nNaoLidas) + '</span>' : '') +
            '      </button>' +
            '      <button type="button" data-nexo-sair class="w-8 h-8 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition" aria-label="Sair" title="Sair"><i class="fa-solid fa-right-from-bracket"></i></button>' +
            '    </div>' +
            '  </div>' +
            '  <div data-nexo-painel-notif class="hidden absolute bottom-full left-4 right-4 md:left-4 md:right-auto md:w-[340px] mb-2 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 overflow-hidden"></div>' +
            '</div>';
    }

    function desenharPainelNotif(painel) {
        var lista = notificacoes();
        var corpo = lista.length ? lista.slice(0, 15).map(function (n) {
            return '<a href="' + n.link + '" class="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-50 ' + (n.lida ? 'opacity-60' : '') + '">' +
                '<i class="fa-solid ' + n.icone + ' ' + n.cor + ' mt-0.5"></i>' +
                '<span class="text-sm text-gray-700 leading-snug">' + esc(n.texto) + '</span></a>';
        }).join('') : '<p class="px-4 py-6 text-sm text-gray-500 text-center">Nenhuma notificação.</p>';
        painel.innerHTML =
            '<div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">' +
            '  <span class="font-bold text-gray-900 text-sm">Notificações (' + lista.length + ')</span>' +
            '  <button type="button" data-nexo-ler-todas class="text-xs font-semibold text-brand-purple hover:underline">Marcar como lidas</button>' +
            '</div><div class="max-h-[360px] overflow-y-auto">' + corpo + '</div>' +
            '<a href="configuracoes.html#notificacoes" class="block text-center text-xs font-semibold text-gray-500 hover:text-brand-purple py-2 border-t border-gray-100">Configurar notificações</a>';
    }

    function montar(modulo) {
        injetarEstilos();
        var usuario = Nexo.auth.usuarioAtual();
        if (!usuario) {
            var volta = location.pathname.split('/').pop() + location.search + location.hash;
            location.replace('login.html?volta=' + encodeURIComponent(volta));
            return null;
        }

        var aside = document.getElementById('nexo-sidebar');
        if (!aside) {
            aside = document.createElement('aside');
            aside.id = 'nexo-sidebar';
            document.body.insertBefore(aside, document.body.firstChild);
        }
        aside.className = 'fixed md:static inset-y-0 left-0 w-[260px] bg-white flex flex-col justify-between shrink-0 h-screen ' +
            'shadow-[1px_0_5px_rgba(0,0,0,0.02)] z-40 border-r border-gray-100 -translate-x-full md:translate-x-0 transition-transform duration-200';
        aside.innerHTML = htmlMenu(modulo, usuario);

        /* fundo escuro e barra superior no celular */
        var fundo = document.createElement('div');
        fundo.className = 'fixed inset-0 bg-black/40 z-30 hidden md:hidden';
        document.body.appendChild(fundo);

        var topo = document.getElementById('nexo-topo-mobile');
        if (!topo) {
            topo = document.createElement('div');
            topo.id = 'nexo-topo-mobile';
            topo.className = 'md:hidden flex items-center justify-between bg-white border-b border-gray-100 px-4 h-14 shrink-0 w-full';
            topo.innerHTML = '<button type="button" class="text-gray-700 text-xl w-10 h-10 -ml-2" aria-label="Abrir menu"><i class="fa-solid fa-bars"></i></button>' +
                '<img src="../assets/img/logoNexo.png" alt="Logo Nexo" class="h-7 w-auto">' +
                '<span class="w-10"></span>';
            var main = document.querySelector('main');
            if (main && main.parentNode) main.parentNode.insertBefore(topo, main);
            else document.body.insertBefore(topo, aside.nextSibling);
        }
        function abrirMenu() { aside.classList.remove('-translate-x-full'); fundo.classList.remove('hidden'); }
        function fecharMenu() { aside.classList.add('-translate-x-full'); fundo.classList.add('hidden'); }
        topo.querySelector('button').addEventListener('click', abrirMenu);
        fundo.addEventListener('click', fecharMenu);

        aside.addEventListener('click', function (e) {
            var alvo = e.target.closest('[data-nexo-fechar-menu],[data-nexo-sair],[data-nexo-notif],[data-nexo-ler-todas]');
            if (!alvo) return;
            if (alvo.hasAttribute('data-nexo-fechar-menu')) fecharMenu();
            if (alvo.hasAttribute('data-nexo-sair')) {
                confirmar('Sair do sistema?', 'Você precisará entrar novamente.', { textoOk: 'Sair' }).then(function (ok) {
                    if (!ok) return;
                    Nexo.auth.logout();
                    location.href = 'login.html';
                });
            }
            var painel = aside.querySelector('[data-nexo-painel-notif]');
            if (alvo.hasAttribute('data-nexo-notif')) {
                e.stopPropagation();
                if (painel.classList.contains('hidden')) { desenharPainelNotif(painel); painel.classList.remove('hidden'); }
                else painel.classList.add('hidden');
            }
            if (alvo.hasAttribute('data-nexo-ler-todas')) {
                e.stopPropagation();
                marcarTodasLidas();
                aside.innerHTML = htmlMenu(modulo, usuario);
                var p2 = aside.querySelector('[data-nexo-painel-notif]');
                desenharPainelNotif(p2);
                p2.classList.remove('hidden');
            }
        });
        document.addEventListener('click', function (e) {
            var painel = aside.querySelector('[data-nexo-painel-notif]');
            if (painel && !painel.classList.contains('hidden') && !e.target.closest('[data-nexo-painel-notif]')) painel.classList.add('hidden');
        });

        /* permissao do perfil */
        if (!Nexo.auth.podeAcessar(modulo, usuario)) {
            var main2 = document.querySelector('main');
            if (main2) {
                main2.innerHTML = '<div class="h-full flex items-center justify-center p-8"><div class="text-center max-w-md">' +
                    '<div class="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 text-red-500 flex items-center justify-center text-2xl"><i class="fa-solid fa-lock"></i></div>' +
                    '<h1 class="text-2xl font-extrabold text-gray-900 mb-2">Acesso restrito</h1>' +
                    '<p class="text-gray-500 mb-6">O perfil <b>' + esc(usuario.perfil) + '</b> não tem permissão para esta tela. Fale com um administrador.</p>' +
                    '<a href="home.html" class="nexo-btn nexo-btn-primario">Voltar ao início</a></div></div>';
            }
            return null;
        }
        return usuario;
    }

    /* ------------------------------------------------------------------ */
    /* Toast                                                               */
    /* ------------------------------------------------------------------ */
    function toast(mensagem, tipo) {
        injetarEstilos();
        var cores = {
            sucesso: ['bg-emerald-600', 'fa-circle-check'],
            erro: ['bg-red-600', 'fa-circle-xmark'],
            aviso: ['bg-amber-500', 'fa-triangle-exclamation'],
            info: ['bg-gray-900', 'fa-circle-info']
        };
        var c = cores[tipo] || cores.sucesso;
        var area = document.getElementById('nexo-toasts');
        if (!area) {
            area = document.createElement('div');
            area.id = 'nexo-toasts';
            area.className = 'fixed top-4 right-4 left-4 sm:left-auto z-[100] flex flex-col gap-2 items-end pointer-events-none';
            area.setAttribute('role', 'status');
            area.setAttribute('aria-live', 'polite');
            document.body.appendChild(area);
        }
        var el = document.createElement('div');
        el.className = 'nexo-toast pointer-events-auto ' + c[0] + ' text-white text-sm font-medium px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 max-w-sm';
        el.innerHTML = '<i class="fa-solid ' + c[1] + '"></i><span>' + esc(mensagem) + '</span>';
        area.appendChild(el);
        setTimeout(function () { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(function () { el.remove(); }, 300); }, 3200);
    }

    /* ------------------------------------------------------------------ */
    /* Modal generico                                                      */
    /* ------------------------------------------------------------------ */
    /*
     * opcoes: {
     *   titulo: 'Novo pedido',
     *   html: '<form>...</form>',          conteudo do corpo
     *   largura: 'max-w-2xl',              classe Tailwind
     *   botoes: [{texto:'Cancelar', classe:'nexo-btn-secundario', acao:'fechar'},
     *            {texto:'Salvar', classe:'nexo-btn-primario', acao:function(modal){ ... return false para nao fechar }}],
     *   aoAbrir: function(elCorpo, modal) {}
     *   aoFechar: function() {}
     * }
     */
    function abrirModal(opcoes) {
        injetarEstilos();
        var fundo = document.createElement('div');
        fundo.className = 'fixed inset-0 z-[90] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4';
        fundo.setAttribute('data-nexo-modal', '');
        var botoes = (opcoes.botoes || [{ texto: 'Fechar', classe: 'nexo-btn-secundario', acao: 'fechar' }]);
        fundo.innerHTML =
            '<div class="fade-in bg-white w-full ' + (opcoes.largura || 'max-w-2xl') + ' rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh]" role="dialog" aria-modal="true">' +
            '  <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">' +
            '    <h2 class="text-lg font-bold text-gray-900">' + esc(opcoes.titulo || '') + '</h2>' +
            '    <button type="button" data-fechar class="w-9 h-9 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100" aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button>' +
            '  </div>' +
            '  <div data-corpo class="px-6 py-5 overflow-y-auto flex-1">' + (opcoes.html || '') + '</div>' +
            (botoes.length ? '  <div class="px-6 py-4 border-t border-gray-100 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 shrink-0">' +
                botoes.map(function (b, i) { return '<button type="button" data-botao="' + i + '" class="nexo-btn ' + (b.classe || 'nexo-btn-secundario') + '">' + (b.icone ? '<i class="fa-solid ' + b.icone + '"></i>' : '') + esc(b.texto) + '</button>'; }).join('') +
                '  </div>' : '') +
            '</div>';
        document.body.appendChild(fundo);
        var corpo = fundo.querySelector('[data-corpo]');
        var modal = {
            el: corpo,
            fechar: function () {
                document.removeEventListener('keydown', teclas);
                fundo.remove();
                if (opcoes.aoFechar) opcoes.aoFechar();
            }
        };
        /* Esc fecha so o modal que esta por cima (modais podem ficar empilhados) */
        function teclas(e) {
            if (e.key !== 'Escape') return;
            var abertos = document.querySelectorAll('[data-nexo-modal]');
            if (abertos[abertos.length - 1] === fundo) modal.fechar();
        }
        document.addEventListener('keydown', teclas);
        fundo.addEventListener('mousedown', function (e) { if (e.target === fundo) modal.fechar(); });
        fundo.querySelector('[data-fechar]').addEventListener('click', modal.fechar);
        fundo.querySelectorAll('[data-botao]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var b = botoes[Number(btn.getAttribute('data-botao'))];
                if (b.acao === 'fechar' || !b.acao) { modal.fechar(); return; }
                var r = b.acao(modal, corpo);
                if (r !== false) modal.fechar();
            });
        });
        /* Enter dentro de um form do modal aciona o ultimo botao (principal) */
        var form = corpo.querySelector('form');
        if (form) {
            form.addEventListener('submit', function (e) {
                e.preventDefault();
                var ultimo = fundo.querySelector('[data-botao="' + (botoes.length - 1) + '"]');
                if (ultimo) ultimo.click();
            });
        }
        if (opcoes.aoAbrir) opcoes.aoAbrir(corpo, modal);
        var primeiro = corpo.querySelector('input:not([type=hidden]):not([readonly]),select,textarea');
        if (primeiro) setTimeout(function () { primeiro.focus(); }, 50);
        return modal;
    }

    function confirmar(titulo, texto, opcoes) {
        opcoes = opcoes || {};
        return new Promise(function (resolve) {
            var respondeu = false;
            abrirModal({
                titulo: titulo,
                largura: 'max-w-md',
                html: '<p class="text-sm text-gray-600">' + esc(texto || '') + '</p>',
                botoes: [
                    { texto: opcoes.textoCancelar || 'Cancelar', classe: 'nexo-btn-secundario', acao: 'fechar' },
                    { texto: opcoes.textoOk || 'Confirmar', classe: opcoes.perigo ? 'nexo-btn-perigo' : 'nexo-btn-primario', acao: function () { respondeu = true; resolve(true); } }
                ],
                aoFechar: function () { if (!respondeu) resolve(false); }
            });
        });
    }

    /* ------------------------------------------------------------------ */
    /* Outros utilitarios                                                  */
    /* ------------------------------------------------------------------ */
    function parametro(nome) {
        return new URLSearchParams(location.search).get(nome);
    }

    function paginar(lista, pagina, porPagina) {
        var pp = porPagina || Number(((Nexo.db.lerObjeto('configuracoes', {}).preferencias) || {}).itensPorPagina) || 10;
        var paginas = Math.max(1, Math.ceil(lista.length / pp));
        var p = Math.min(Math.max(1, pagina || 1), paginas);
        return { itens: lista.slice((p - 1) * pp, p * pp), total: lista.length, paginas: paginas, pagina: p, porPagina: pp };
    }

    /* fn: nome de funcao global que recebe o numero da pagina */
    function htmlPaginacao(info, fn) {
        if (info.total === 0) return '';
        var ini = (info.pagina - 1) * info.porPagina + 1;
        var fim = Math.min(info.total, info.pagina * info.porPagina);
        var botoes = '';
        function btn(n, rotulo, ativo, desab) {
            return '<button type="button" ' + (desab ? 'disabled' : 'onclick="' + fn + '(' + n + ')"') +
                ' class="min-w-[34px] h-[34px] px-2 rounded-lg text-sm font-semibold transition ' +
                (ativo ? 'bg-brand-purple text-white' : 'text-gray-600 hover:bg-gray-100') + (desab ? ' opacity-40 cursor-not-allowed' : '') + '">' + rotulo + '</button>';
        }
        botoes += btn(info.pagina - 1, '<i class="fa-solid fa-chevron-left text-xs"></i>', false, info.pagina === 1);
        for (var i = 1; i <= info.paginas; i++) {
            if (i === 1 || i === info.paginas || Math.abs(i - info.pagina) <= 1) botoes += btn(i, i, i === info.pagina, false);
            else if (Math.abs(i - info.pagina) === 2) botoes += '<span class="px-1 text-gray-400">…</span>';
        }
        botoes += btn(info.pagina + 1, '<i class="fa-solid fa-chevron-right text-xs"></i>', false, info.pagina === info.paginas);
        return '<div class="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-gray-100">' +
            '<span class="text-sm text-gray-500">Mostrando ' + ini + ' a ' + fim + ' de ' + info.total + '</span>' +
            '<div class="flex items-center gap-1">' + botoes + '</div></div>';
    }

    var CORES_STATUS = {
        'Novo': 'bg-blue-50 text-blue-700 border-blue-200',
        'Em separação': 'bg-amber-50 text-amber-700 border-amber-200',
        'Enviado': 'bg-indigo-50 text-indigo-700 border-indigo-200',
        'Entregue': 'bg-emerald-50 text-emerald-700 border-emerald-200',
        'Cancelado': 'bg-red-50 text-red-700 border-red-200',
        'Pago': 'bg-emerald-50 text-emerald-700 border-emerald-200',
        'Pendente': 'bg-amber-50 text-amber-700 border-amber-200',
        'Atrasado': 'bg-red-50 text-red-700 border-red-200',
        'Ativo': 'bg-emerald-50 text-emerald-700 border-emerald-200',
        'Inativo': 'bg-gray-100 text-gray-600 border-gray-200',
        'Recebida': 'bg-emerald-50 text-emerald-700 border-emerald-200',
        'Entrada': 'bg-emerald-50 text-emerald-700 border-emerald-200',
        'Saída': 'bg-red-50 text-red-700 border-red-200',
        'Ajuste': 'bg-blue-50 text-blue-700 border-blue-200',
        'Receita': 'bg-emerald-50 text-emerald-700 border-emerald-200',
        'Despesa': 'bg-red-50 text-red-700 border-red-200',
        'Estoque baixo': 'bg-amber-50 text-amber-700 border-amber-200',
        'Sem estoque': 'bg-red-50 text-red-700 border-red-200',
        'Normal': 'bg-emerald-50 text-emerald-700 border-emerald-200'
    };
    function badgeStatus(status) {
        var cls = CORES_STATUS[status] || 'bg-gray-100 text-gray-600 border-gray-200';
        return '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ' + cls + '">' + esc(status) + '</span>';
    }

    /* Le os campos de um form em objeto: {name: value}. Checkbox vira boolean. */
    function lerFormulario(form) {
        var dados = {};
        form.querySelectorAll('input[name],select[name],textarea[name]').forEach(function (el) {
            if (el.type === 'checkbox') dados[el.name] = el.checked;
            else if (el.type === 'radio') { if (el.checked) dados[el.name] = el.value; }
            else dados[el.name] = el.value.trim();
        });
        return dados;
    }

    /* Marca campos com erro. erros: {nomeDoCampo: 'mensagem'}. Retorna true se nao ha erros. */
    function mostrarErros(form, erros) {
        form.querySelectorAll('.nexo-input').forEach(function (el) { el.classList.remove('erro'); });
        form.querySelectorAll('[data-erro-de]').forEach(function (el) { el.remove(); });
        var chaves = Object.keys(erros || {});
        chaves.forEach(function (nome) {
            var el = form.querySelector('[name="' + nome + '"]');
            if (!el) return;
            el.classList.add('erro');
            var msg = document.createElement('p');
            msg.setAttribute('data-erro-de', nome);
            msg.className = 'text-xs text-red-600 mt-1';
            msg.textContent = erros[nome];
            el.insertAdjacentElement('afterend', msg);
        });
        if (chaves.length) {
            var primeiro = form.querySelector('[name="' + chaves[0] + '"]');
            if (primeiro) primeiro.focus();
        }
        return chaves.length === 0;
    }

    Nexo.layout = { montar: montar, MENU: MENU, notificacoes: notificacoes };
    Nexo.ui = {
        toast: toast,
        abrirModal: abrirModal,
        confirmar: confirmar,
        parametro: parametro,
        paginar: paginar,
        htmlPaginacao: htmlPaginacao,
        badgeStatus: badgeStatus,
        lerFormulario: lerFormulario,
        mostrarErros: mostrarErros,
        injetarEstilos: injetarEstilos
    };
})(window);
