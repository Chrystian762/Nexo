/*
 * NEXO ERP - Tela Configurações
 * --------------------------------------------------------------
 * Seções (abertas pela âncora da URL): #perfil, #usuarios, #permissoes,
 * #notificacoes, #preferencias, #geral.
 *
 * Dados usados:
 *   coleção 'usuarios', objeto 'permissoes' ({Perfil: [idsDeModulos]})
 *   objeto 'configuracoes' ({notificacoes, preferencias, geral})
 */
(function () {
    'use strict';

    var esc = Nexo.esc;
    var fmt = Nexo.fmt;

    var eu = Nexo.layout.montar('configuracoes');   // usuário logado (ou null)
    if (!eu) return;
    var ehAdmin = eu.perfil === 'Administrador';

    var SECOES = ['perfil', 'usuarios', 'permissoes', 'notificacoes', 'preferencias', 'geral'];
    var PREFIXO = 'nexo_';
    var CHAVES_DE_SESSAO = ['sessao', 'lembrar_email'];   // não entram no backup nem são apagadas ao importar
    var COLECOES_OBRIGATORIAS = ['produtos', 'clientes', 'pedidos', 'lancamentos', 'usuarios'];

    /* ------------------------------------------------------------------ */
    /* Utilitários                                                         */
    /* ------------------------------------------------------------------ */
    function porId(id) { return document.getElementById(id); }

    function lerConfig() {
        var c = Nexo.db.lerObjeto('configuracoes', {});
        c.notificacoes = Object.assign({ estoqueBaixo: true, novoPedido: true, contasVencer: true, resumoEmail: false, diasAvisoVencimento: 3 }, c.notificacoes);
        c.preferencias = Object.assign({ itensPorPagina: 10, paginaInicial: 'home.html', formatoData: 'dd/mm/aaaa', moeda: 'BRL' }, c.preferencias);
        c.geral = Object.assign({ estoqueMinimoPadrao: 10, prazoEntregaPadrao: 5, freteGratisAcima: 500, permitirVendaSemEstoque: false }, c.geral);
        return c;
    }

    /* Grava uma seção do objeto 'configuracoes' sem apagar as outras */
    function salvarConfig(secao, valores) {
        var c = lerConfig();
        c[secao] = Object.assign({}, c[secao], valores);
        Nexo.db.gravarObjeto('configuracoes', c);
    }

    function emailEmUso(email, ignorarId) {
        var em = String(email).trim().toLowerCase();
        return Nexo.db.listar('usuarios').some(function (u) { return u.id !== ignorarId && String(u.email).toLowerCase() === em; });
    }

    function ehInteiro(texto) { return /^\d+$/.test(String(texto).trim()); }

    function avisoRestrito(texto) {
        return '<div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">' +
            '<div class="w-14 h-14 mx-auto mb-3 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center text-xl"><i class="fa-solid fa-lock"></i></div>' +
            '<p class="font-bold text-gray-900">Acesso restrito a administradores</p>' +
            '<p class="text-sm text-gray-500 mt-1">' + esc(texto) + '</p></div>';
    }

    function cartao(titulo, descricao, corpo) {
        return '<div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-6 mb-6">' +
            '<h2 class="text-lg font-bold text-gray-900">' + titulo + '</h2>' +
            (descricao ? '<p class="text-sm text-gray-500 mt-1 mb-5">' + descricao + '</p>' : '<div class="mb-5"></div>') + corpo + '</div>';
    }

    /* Linha com interruptor (checkbox) e descrição */
    function linhaOpcao(name, titulo, descricao, marcado) {
        return '<label class="flex items-start justify-between gap-4 py-3 border-b border-gray-100 last:border-0 cursor-pointer">' +
            '<span><span class="block text-sm font-semibold text-gray-800">' + titulo + '</span>' +
            '<span class="block text-xs text-gray-500 mt-0.5">' + descricao + '</span></span>' +
            '<input type="checkbox" name="' + name + '" class="w-5 h-5 mt-1 shrink-0 accent-purple-600"' + (marcado ? ' checked' : '') + '></label>';
    }

    function rodapeSalvar(rotulo) {
        return '<div class="flex justify-end mt-5"><button type="submit" class="nexo-btn nexo-btn-primario"><i class="fa-solid fa-floppy-disk"></i> ' + (rotulo || 'Salvar') + '</button></div>';
    }

    /* ------------------------------------------------------------------ */
    /* Navegação entre seções (âncora da URL)                              */
    /* ------------------------------------------------------------------ */
    function mostrarSecao() {
        var alvo = location.hash.replace('#', '');
        if (SECOES.indexOf(alvo) === -1) alvo = 'perfil';
        SECOES.forEach(function (s) { porId('sec-' + s).classList.toggle('hidden', s !== alvo); });
        document.querySelectorAll('.item-secao').forEach(function (a) {
            var ativo = a.getAttribute('data-secao') === alvo;
            a.className = 'item-secao flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm whitespace-nowrap transition ' +
                (ativo ? 'bg-brand-purple text-white font-semibold shadow-sm' : 'text-gray-600 hover:bg-gray-50 font-medium');
            if (ativo) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
        });
    }

    /* ------------------------------------------------------------------ */
    /* Perfil do usuário logado                                            */
    /* ------------------------------------------------------------------ */
    function renderPerfil() {
        eu = Nexo.db.obter('usuarios', eu.id) || eu;
        porId('sec-perfil').innerHTML =
            cartao('Meu perfil', 'Seus dados de acesso ao sistema.',
                '<form id="form-perfil" novalidate>' +
                '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">' +
                '<div><label class="nexo-label" for="pf-nome">Nome *</label><input type="text" id="pf-nome" name="nome" class="nexo-input" maxlength="80" value="' + esc(eu.nome) + '"></div>' +
                '<div><label class="nexo-label" for="pf-email">E-mail *</label><input type="email" id="pf-email" name="email" class="nexo-input" maxlength="120" value="' + esc(eu.email) + '"></div>' +
                '<div><label class="nexo-label" for="pf-perfil">Perfil de acesso</label><input type="text" id="pf-perfil" class="nexo-input" value="' + esc(eu.perfil) + '" readonly></div>' +
                '<div><label class="nexo-label" for="pf-acesso">Último acesso</label><input type="text" id="pf-acesso" class="nexo-input" value="' + esc(fmt.dataHora(eu.ultimoAcesso)) + '" readonly></div>' +
                '</div>' + rodapeSalvar('Salvar perfil') + '</form>') +
            cartao('Alterar senha', 'Use pelo menos 6 caracteres.',
                '<form id="form-senha" novalidate>' +
                '<div class="grid grid-cols-1 md:grid-cols-3 gap-4">' +
                '<div><label class="nexo-label" for="sn-atual">Senha atual *</label><input type="password" id="sn-atual" name="atual" class="nexo-input" autocomplete="current-password"></div>' +
                '<div><label class="nexo-label" for="sn-nova">Nova senha *</label><input type="password" id="sn-nova" name="nova" class="nexo-input" autocomplete="new-password"></div>' +
                '<div><label class="nexo-label" for="sn-conf">Confirmar nova senha *</label><input type="password" id="sn-conf" name="confirmacao" class="nexo-input" autocomplete="new-password"></div>' +
                '</div>' + rodapeSalvar('Alterar senha') + '</form>');

        porId('form-perfil').addEventListener('submit', salvarPerfil);
        porId('form-senha').addEventListener('submit', trocarSenha);
    }

    function salvarPerfil(e) {
        e.preventDefault();
        var form = e.currentTarget, d = Nexo.ui.lerFormulario(form), erros = {};
        if (d.nome.length < 2) erros.nome = 'Informe o nome (mínimo 2 caracteres).';
        if (!d.email) erros.email = 'Informe o e-mail.';
        else if (!Nexo.validar.email(d.email)) erros.email = 'E-mail inválido.';
        else if (emailEmUso(d.email, eu.id)) erros.email = 'Este e-mail já está em uso por outro usuário.';
        if (!Nexo.ui.mostrarErros(form, erros)) return;
        var mudouNome = d.nome !== eu.nome;
        Nexo.db.atualizar('usuarios', eu.id, { nome: d.nome, email: d.email });
        Nexo.registrarAtividade('configuracao', 'Perfil atualizado: ' + d.nome, 'configuracoes.html#perfil');
        Nexo.ui.toast('Perfil atualizado.', 'sucesso');
        renderPerfil();
        if (ehAdmin) renderUsuarios();
        // o menu lateral mostra o nome: recarrega a página para atualizá-lo
        if (mudouNome) setTimeout(function () { location.reload(); }, 900);
    }

    function trocarSenha(e) {
        e.preventDefault();
        var form = e.currentTarget, erros = {};
        var atual = Nexo.db.obter('usuarios', eu.id);
        // as senhas não passam por trim: pega o valor bruto dos campos
        var bruto = {
            atual: form.querySelector('[name=atual]').value,
            nova: form.querySelector('[name=nova]').value,
            confirmacao: form.querySelector('[name=confirmacao]').value
        };
        if (!bruto.atual) erros.atual = 'Informe a senha atual.';
        else if (bruto.atual !== atual.senha) erros.atual = 'Senha atual incorreta.';
        if (!bruto.nova) erros.nova = 'Informe a nova senha.';
        else if (bruto.nova.length < 6) erros.nova = 'A nova senha precisa ter pelo menos 6 caracteres.';
        else if (bruto.nova === bruto.atual) erros.nova = 'A nova senha deve ser diferente da atual.';
        if (!bruto.confirmacao) erros.confirmacao = 'Confirme a nova senha.';
        else if (bruto.confirmacao !== bruto.nova) erros.confirmacao = 'A confirmação não confere com a nova senha.';
        if (!Nexo.ui.mostrarErros(form, erros)) return;
        Nexo.db.atualizar('usuarios', eu.id, { senha: bruto.nova });
        Nexo.registrarAtividade('seguranca', eu.nome + ' alterou a própria senha', 'configuracoes.html#perfil');
        Nexo.ui.toast('Senha alterada com sucesso.', 'sucesso');
        form.reset();
    }

    /* ------------------------------------------------------------------ */
    /* Gerenciamento de usuários (somente administrador)                   */
    /* ------------------------------------------------------------------ */
    function administradoresAtivos() {
        return Nexo.db.listar('usuarios').filter(function (u) { return u.perfil === 'Administrador' && u.ativo; });
    }
    function ehUltimoAdminAtivo(u) {
        return u.perfil === 'Administrador' && u.ativo && administradoresAtivos().length <= 1;
    }
    /* Motivo pelo qual o usuário não pode ser desativado/excluído ('' = pode) */
    function motivoBloqueio(u) {
        if (u.id === eu.id) return 'Você não pode desativar ou excluir o seu próprio usuário.';
        if (ehUltimoAdminAtivo(u)) return 'Não é possível desativar ou excluir o último administrador ativo.';
        return '';
    }

    function renderUsuarios() {
        var alvo = porId('sec-usuarios');
        if (!ehAdmin) { alvo.innerHTML = avisoRestrito('Somente administradores podem ver e editar os usuários do sistema.'); return; }
        var lista = Nexo.db.listar('usuarios').slice().sort(function (a, b) { return String(a.nome).localeCompare(String(b.nome), 'pt-BR'); });

        var linhas = lista.map(function (u) {
            var bloqueio = u.ativo ? motivoBloqueio(u) : '';
            var bloqExcluir = motivoBloqueio(u);
            function btn(acao, icone, titulo, cor, desab) {
                return '<button type="button" data-acao="' + acao + '" data-id="' + esc(u.id) + '" title="' + esc(desab || titulo) + '" aria-label="' + esc(titulo) + '"' + (desab ? ' disabled' : '') +
                    ' class="w-8 h-8 rounded-lg text-gray-400 transition ' + (desab ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-100 ' + cor) + '"><i class="fa-solid ' + icone + '"></i></button>';
            }
            return '<tr class="hover:bg-gray-50/60">' +
                '<td class="px-4 py-3"><p class="font-semibold text-gray-900">' + esc(u.nome) + (u.id === eu.id ? ' <span class="text-xs text-brand-purple font-semibold">(você)</span>' : '') + '</p></td>' +
                '<td class="px-4 py-3 text-gray-600">' + esc(u.email) + '</td>' +
                '<td class="px-4 py-3 text-gray-600 whitespace-nowrap">' + esc(u.perfil) + '</td>' +
                '<td class="px-4 py-3">' + Nexo.ui.badgeStatus(u.ativo ? 'Ativo' : 'Inativo') + '</td>' +
                '<td class="px-4 py-3 text-gray-600 whitespace-nowrap">' + fmt.dataHora(u.ultimoAcesso) + '</td>' +
                '<td class="px-4 py-3 whitespace-nowrap text-right">' +
                btn('editar', 'fa-pen', 'Editar usuário', 'hover:text-brand-purple') +
                btn('senha', 'fa-key', 'Redefinir senha', 'hover:text-amber-600') +
                btn('alternar', u.ativo ? 'fa-user-slash' : 'fa-user-check', u.ativo ? 'Desativar usuário' : 'Ativar usuário', u.ativo ? 'hover:text-red-600' : 'hover:text-emerald-600', bloqueio) +
                btn('excluir', 'fa-trash', 'Excluir usuário', 'hover:text-red-600', bloqExcluir) +
                '</td></tr>';
        }).join('');

        alvo.innerHTML = cartao('Usuários',
            'Quem pode entrar no sistema. O perfil define as telas liberadas (veja a seção Permissões).',
            '<div class="flex justify-end mb-4"><button type="button" id="btn-novo-usuario" class="nexo-btn nexo-btn-primario"><i class="fa-solid fa-user-plus"></i> Novo usuário</button></div>' +
            '<div class="overflow-x-auto -mx-5 md:-mx-6"><table class="w-full text-sm text-left min-w-[820px]">' +
            '<thead class="bg-gray-50 text-xs uppercase text-gray-500"><tr>' +
            '<th class="px-4 py-3 font-semibold">Nome</th><th class="px-4 py-3 font-semibold">E-mail</th><th class="px-4 py-3 font-semibold">Perfil</th>' +
            '<th class="px-4 py-3 font-semibold">Status</th><th class="px-4 py-3 font-semibold">Último acesso</th><th class="px-4 py-3 font-semibold text-right">Ações</th></tr></thead>' +
            '<tbody class="divide-y divide-gray-100">' + linhas + '</tbody></table></div>');

        porId('btn-novo-usuario').addEventListener('click', function () { abrirFormUsuario(null); });
        alvo.querySelector('tbody').addEventListener('click', function (e) {
            var b = e.target.closest('[data-acao]');
            if (!b || b.disabled) return;
            var u = Nexo.db.obter('usuarios', b.getAttribute('data-id'));
            if (!u) return;
            var acao = b.getAttribute('data-acao');
            if (acao === 'editar') abrirFormUsuario(u);
            else if (acao === 'senha') abrirRedefinirSenha(u);
            else if (acao === 'alternar') alternarAtivo(u);
            else if (acao === 'excluir') excluirUsuario(u);
        });
    }

    function abrirFormUsuario(u) {
        var editando = !!u, proprio = editando && u.id === eu.id;
        u = u || { ativo: true, perfil: 'Vendedor' };
        var html = '<form novalidate class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
            '<div><label class="nexo-label" for="us-nome">Nome *</label><input type="text" id="us-nome" name="nome" class="nexo-input" maxlength="80" value="' + esc(u.nome || '') + '"></div>' +
            '<div><label class="nexo-label" for="us-email">E-mail *</label><input type="email" id="us-email" name="email" class="nexo-input" maxlength="120" value="' + esc(u.email || '') + '"></div>' +
            '<div><label class="nexo-label" for="us-perfil">Perfil *</label><select id="us-perfil" name="perfil" class="nexo-input"' + (proprio ? ' disabled' : '') + '>' +
            Nexo.consultas.PERFIS.map(function (p) { return '<option' + (p === u.perfil ? ' selected' : '') + '>' + esc(p) + '</option>'; }).join('') + '</select></div>' +
            (editando ? '' : '<div><label class="nexo-label" for="us-senha">Senha inicial * (mínimo 6)</label><input type="password" id="us-senha" name="senha" class="nexo-input" autocomplete="new-password"></div>') +
            '<div class="sm:col-span-2"><label class="flex items-center gap-2 text-sm font-semibold text-gray-700"><input type="checkbox" name="ativo" class="w-4 h-4 accent-purple-600"' + (u.ativo ? ' checked' : '') + (proprio ? ' disabled' : '') + '> Usuário ativo (pode entrar no sistema)</label>' +
            (proprio ? '<p class="text-xs text-gray-500 mt-1">Você não pode alterar o seu próprio perfil nem se desativar.</p>' : '') + '</div></form>';

        Nexo.ui.abrirModal({
            titulo: editando ? 'Editar usuário' : 'Novo usuário',
            largura: 'max-w-xl',
            html: html,
            botoes: [
                { texto: 'Cancelar', classe: 'nexo-btn-secundario', acao: 'fechar' },
                { texto: editando ? 'Salvar alterações' : 'Cadastrar', classe: 'nexo-btn-primario', icone: 'fa-check', acao: function (modal, corpo) {
                    var form = corpo.querySelector('form'), d = Nexo.ui.lerFormulario(form), erros = {};
                    if (d.nome.length < 2) erros.nome = 'Informe o nome (mínimo 2 caracteres).';
                    if (!d.email) erros.email = 'Informe o e-mail.';
                    else if (!Nexo.validar.email(d.email)) erros.email = 'E-mail inválido.';
                    else if (emailEmUso(d.email, editando ? u.id : null)) erros.email = 'Este e-mail já está em uso por outro usuário.';
                    if (Nexo.consultas.PERFIS.indexOf(d.perfil) === -1) erros.perfil = 'Escolha um perfil válido.';
                    if (!editando) {
                        var senha = form.querySelector('[name=senha]').value;
                        if (!senha) erros.senha = 'Informe a senha inicial.';
                        else if (senha.length < 6) erros.senha = 'A senha precisa ter pelo menos 6 caracteres.';
                    }
                    // não deixar o sistema sem administrador ativo
                    if (editando && ehUltimoAdminAtivo(u) && (d.perfil !== 'Administrador' || !d.ativo)) {
                        erros.perfil = 'Este é o último administrador ativo: ele precisa continuar como Administrador e ativo.';
                    }
                    if (!Nexo.ui.mostrarErros(form, erros)) return false;

                    if (editando) {
                        Nexo.db.atualizar('usuarios', u.id, { nome: d.nome, email: d.email, perfil: d.perfil, ativo: d.ativo });
                        Nexo.registrarAtividade('configuracao', 'Usuário atualizado: ' + d.nome + ' (' + d.perfil + ')', 'configuracoes.html#usuarios');
                        Nexo.ui.toast('Usuário atualizado.', 'sucesso');
                        if (proprio && d.nome !== u.nome) setTimeout(function () { location.reload(); }, 900);
                    } else {
                        Nexo.db.inserir('usuarios', { nome: d.nome, email: d.email, perfil: d.perfil, senha: form.querySelector('[name=senha]').value, ativo: d.ativo, ultimoAcesso: null });
                        Nexo.registrarAtividade('configuracao', 'Usuário criado: ' + d.nome + ' (' + d.perfil + ')', 'configuracoes.html#usuarios');
                        Nexo.ui.toast('Usuário cadastrado.', 'sucesso');
                    }
                    renderUsuarios();
                    if (proprio) renderPerfil();
                    return true;
                } }
            ]
        });
    }

    function abrirRedefinirSenha(u) {
        Nexo.ui.abrirModal({
            titulo: 'Redefinir senha',
            largura: 'max-w-md',
            html: '<form novalidate><p class="text-sm text-gray-600 mb-4">Defina uma nova senha para <b>' + esc(u.nome) + '</b>.</p>' +
                '<div class="mb-4"><label class="nexo-label" for="rs-nova">Nova senha * (mínimo 6)</label><input type="password" id="rs-nova" name="nova" class="nexo-input" autocomplete="new-password"></div>' +
                '<div><label class="nexo-label" for="rs-conf">Confirmar senha *</label><input type="password" id="rs-conf" name="confirmacao" class="nexo-input" autocomplete="new-password"></div></form>',
            botoes: [
                { texto: 'Cancelar', classe: 'nexo-btn-secundario', acao: 'fechar' },
                { texto: 'Redefinir', classe: 'nexo-btn-primario', icone: 'fa-key', acao: function (modal, corpo) {
                    var form = corpo.querySelector('form'), erros = {};
                    var nova = form.querySelector('[name=nova]').value, conf = form.querySelector('[name=confirmacao]').value;
                    if (!nova) erros.nova = 'Informe a nova senha.';
                    else if (nova.length < 6) erros.nova = 'A senha precisa ter pelo menos 6 caracteres.';
                    if (!conf) erros.confirmacao = 'Confirme a senha.';
                    else if (conf !== nova) erros.confirmacao = 'A confirmação não confere.';
                    if (!Nexo.ui.mostrarErros(form, erros)) return false;
                    Nexo.db.atualizar('usuarios', u.id, { senha: nova });
                    Nexo.registrarAtividade('seguranca', 'Senha redefinida para o usuário ' + u.nome, 'configuracoes.html#usuarios');
                    Nexo.ui.toast('Senha redefinida.', 'sucesso');
                    return true;
                } }
            ]
        });
    }

    function alternarAtivo(u) {
        if (u.ativo) {
            var motivo = motivoBloqueio(u);
            if (motivo) { Nexo.ui.toast(motivo, 'erro'); return; }
            Nexo.ui.confirmar('Desativar usuário?', u.nome + ' não poderá mais entrar no sistema.', { textoOk: 'Desativar', perigo: true }).then(function (ok) {
                if (!ok) return;
                Nexo.db.atualizar('usuarios', u.id, { ativo: false });
                Nexo.registrarAtividade('configuracao', 'Usuário desativado: ' + u.nome, 'configuracoes.html#usuarios');
                Nexo.ui.toast('Usuário desativado.', 'sucesso');
                renderUsuarios();
            });
        } else {
            Nexo.db.atualizar('usuarios', u.id, { ativo: true });
            Nexo.registrarAtividade('configuracao', 'Usuário ativado: ' + u.nome, 'configuracoes.html#usuarios');
            Nexo.ui.toast('Usuário ativado.', 'sucesso');
            renderUsuarios();
        }
    }

    function excluirUsuario(u) {
        var motivo = motivoBloqueio(u);
        if (motivo) { Nexo.ui.toast(motivo, 'erro'); return; }
        Nexo.ui.confirmar('Excluir usuário?', 'O usuário "' + u.nome + '" será removido de forma permanente. Para apenas bloquear o acesso, prefira desativar.', { textoOk: 'Excluir', perigo: true }).then(function (ok) {
            if (!ok) return;
            Nexo.db.remover('usuarios', u.id);
            Nexo.registrarAtividade('configuracao', 'Usuário excluído: ' + u.nome, 'configuracoes.html#usuarios');
            Nexo.ui.toast('Usuário excluído.', 'sucesso');
            renderUsuarios();
        });
    }

    /* ------------------------------------------------------------------ */
    /* Permissões (matriz perfil x módulo)                                 */
    /* ------------------------------------------------------------------ */
    function renderPermissoes() {
        var alvo = porId('sec-permissoes');
        if (!ehAdmin) { alvo.innerHTML = avisoRestrito('Somente administradores podem alterar as permissões dos perfis.'); return; }
        var perm = Nexo.db.lerObjeto('permissoes', {});
        var perfis = Nexo.consultas.PERFIS.filter(function (p) { return p !== 'Administrador'; });

        var cabecalho = '<th class="px-4 py-3 font-semibold">Módulo</th>' +
            '<th class="px-4 py-3 font-semibold text-center">Administrador <i class="fa-solid fa-lock text-gray-400 ml-1" title="Sempre tem acesso total"></i></th>' +
            perfis.map(function (p) { return '<th class="px-4 py-3 font-semibold text-center">' + esc(p) + '</th>'; }).join('');

        var linhas = Nexo.consultas.MODULOS.map(function (m) {
            var fixo = m.id === 'inicio';
            var celulas = perfis.map(function (p) {
                var marcado = fixo || (perm[p] || []).indexOf(m.id) !== -1;
                return '<td class="px-4 py-3 text-center"><input type="checkbox" data-perfil="' + esc(p) + '" data-modulo="' + esc(m.id) + '" class="w-5 h-5 accent-purple-600"' +
                    (marcado ? ' checked' : '') + (fixo ? ' disabled title="O Início está sempre liberado"' : '') + ' aria-label="' + esc(p + ': ' + m.nome) + '"></td>';
            }).join('');
            return '<tr class="hover:bg-gray-50/60"><td class="px-4 py-3 font-semibold text-gray-800">' + esc(m.nome) + '</td>' +
                '<td class="px-4 py-3 text-center"><input type="checkbox" checked disabled class="w-5 h-5 accent-purple-600 opacity-60" aria-label="Administrador: ' + esc(m.nome) + '"></td>' + celulas + '</tr>';
        }).join('');

        alvo.innerHTML = cartao('Permissões por perfil',
            'Marque os módulos que cada perfil pode acessar. O Administrador sempre tem acesso a tudo e o Início está sempre liberado.',
            '<form id="form-permissoes"><div class="overflow-x-auto -mx-5 md:-mx-6"><table class="w-full text-sm min-w-[620px]">' +
            '<thead class="bg-gray-50 text-xs uppercase text-gray-500"><tr>' + cabecalho + '</tr></thead>' +
            '<tbody class="divide-y divide-gray-100">' + linhas + '</tbody></table></div>' +
            '<p class="text-xs text-gray-500 mt-4"><i class="fa-solid fa-circle-info mr-1"></i> A alteração vale no próximo carregamento de tela de cada usuário.</p>' +
            rodapeSalvar('Salvar permissões') + '</form>');

        porId('form-permissoes').addEventListener('submit', function (e) {
            e.preventDefault();
            var novo = {};
            perfis.forEach(function (p) { novo[p] = ['inicio']; });
            e.currentTarget.querySelectorAll('input[data-perfil]').forEach(function (c) {
                var p = c.getAttribute('data-perfil'), m = c.getAttribute('data-modulo');
                if (c.checked && novo[p].indexOf(m) === -1) novo[p].push(m);
            });
            // mantém a ordem oficial dos módulos
            var ordem = Nexo.consultas.MODULOS.map(function (m) { return m.id; });
            perfis.forEach(function (p) { novo[p].sort(function (a, b) { return ordem.indexOf(a) - ordem.indexOf(b); }); });
            Nexo.db.gravarObjeto('permissoes', novo);
            Nexo.registrarAtividade('configuracao', 'Permissões dos perfis atualizadas', 'configuracoes.html#permissoes');
            Nexo.ui.toast('Permissões salvas.', 'sucesso');
        });
    }

    /* ------------------------------------------------------------------ */
    /* Notificações                                                        */
    /* ------------------------------------------------------------------ */
    function renderNotificacoes() {
        /* configuracao do sistema inteiro: so administrador altera */
        if (!ehAdmin) { porId('sec-notificacoes').innerHTML = avisoRestrito('Somente administradores podem alterar as notificações do sistema.'); return; }
        var n = lerConfig().notificacoes;
        porId('sec-notificacoes').innerHTML = cartao('Notificações',
            'Escolha quais avisos aparecem no sino do menu lateral.',
            '<form id="form-notificacoes" novalidate>' +
            linhaOpcao('estoqueBaixo', 'Estoque baixo', 'Avisa quando um produto ativo chega ao estoque mínimo.', n.estoqueBaixo !== false) +
            linhaOpcao('novoPedido', 'Novo pedido', 'Avisa sobre pedidos novos aguardando separação.', n.novoPedido !== false) +
            linhaOpcao('contasVencer', 'Contas a vencer', 'Avisa sobre despesas atrasadas e perto do vencimento.', n.contasVencer !== false) +
            linhaOpcao('resumoEmail', 'Resumo por e-mail', 'Preferência de receber um resumo diário por e-mail (o envio é simulado neste projeto).', !!n.resumoEmail) +
            '<div class="mt-5 sm:w-72"><label class="nexo-label" for="nt-dias">Dias de antecedência do aviso de vencimento *</label>' +
            '<input type="number" id="nt-dias" name="diasAvisoVencimento" class="nexo-input" min="1" max="30" step="1" value="' + esc(n.diasAvisoVencimento) + '">' +
            '<p class="text-xs text-gray-500 mt-1">De 1 a 30 dias.</p></div>' +
            rodapeSalvar('Salvar notificações') + '</form>');

        porId('form-notificacoes').addEventListener('submit', function (e) {
            e.preventDefault();
            var form = e.currentTarget, d = Nexo.ui.lerFormulario(form), erros = {};
            var dias = Number(d.diasAvisoVencimento);
            if (!ehInteiro(d.diasAvisoVencimento) || dias < 1 || dias > 30) erros.diasAvisoVencimento = 'Informe um número inteiro de 1 a 30.';
            if (!Nexo.ui.mostrarErros(form, erros)) return;
            salvarConfig('notificacoes', { estoqueBaixo: d.estoqueBaixo, novoPedido: d.novoPedido, contasVencer: d.contasVencer, resumoEmail: d.resumoEmail, diasAvisoVencimento: dias });
            Nexo.registrarAtividade('configuracao', 'Preferências de notificação atualizadas', 'configuracoes.html#notificacoes');
            Nexo.ui.toast('Notificações salvas.', 'sucesso');
        });
    }

    /* ------------------------------------------------------------------ */
    /* Preferências do sistema                                             */
    /* ------------------------------------------------------------------ */
    var FORMATOS_DATA = [['dd/mm/aaaa', 'dd/mm/aaaa (31/12/2026)'], ['aaaa-mm-dd', 'aaaa-mm-dd (2026-12-31)'], ['mm/dd/aaaa', 'mm/dd/aaaa (12/31/2026)']];
    var MOEDAS = [['BRL', 'Real (R$)', 'pt-BR'], ['USD', 'Dólar (US$)', 'en-US'], ['EUR', 'Euro (€)', 'de-DE']];

    function exemploData(formato) {
        var d = new Date(), dd = String(d.getDate()).padStart(2, '0'), mm = String(d.getMonth() + 1).padStart(2, '0'), aa = d.getFullYear();
        if (formato === 'aaaa-mm-dd') return aa + '-' + mm + '-' + dd;
        if (formato === 'mm/dd/aaaa') return mm + '/' + dd + '/' + aa;
        return dd + '/' + mm + '/' + aa;
    }
    function exemploMoeda(codigo) {
        var m = MOEDAS.filter(function (x) { return x[0] === codigo; })[0] || MOEDAS[0];
        return new Intl.NumberFormat(m[2], { style: 'currency', currency: m[0] }).format(1234.56);
    }

    function renderPreferencias() {
        if (!ehAdmin) { porId('sec-preferencias').innerHTML = avisoRestrito('Somente administradores podem alterar as preferências do sistema.'); return; }
        var p = lerConfig().preferencias;
        var paginas = Nexo.layout.MENU.filter(function (m) { return Nexo.auth.podeAcessar(m.id, eu); });
        porId('sec-preferencias').innerHTML = cartao('Preferências do sistema',
            'Ajustes de funcionamento. Itens por página vale para todas as listas paginadas.',
            '<form id="form-preferencias" novalidate><div class="grid grid-cols-1 md:grid-cols-2 gap-4">' +
            '<div><label class="nexo-label" for="pr-itens">Itens por página</label><select id="pr-itens" name="itensPorPagina" class="nexo-input">' +
            [10, 20, 50].map(function (n) { return '<option value="' + n + '"' + (Number(p.itensPorPagina) === n ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></div>' +
            '<div><label class="nexo-label" for="pr-inicial">Página inicial após o login</label><select id="pr-inicial" name="paginaInicial" class="nexo-input">' +
            paginas.map(function (m) { return '<option value="' + esc(m.href) + '"' + (m.href === p.paginaInicial ? ' selected' : '') + '>' + esc(m.nome) + '</option>'; }).join('') + '</select></div>' +
            '<div><label class="nexo-label" for="pr-data">Formato de data</label><select id="pr-data" name="formatoData" class="nexo-input">' +
            FORMATOS_DATA.map(function (f) { return '<option value="' + f[0] + '"' + (f[0] === p.formatoData ? ' selected' : '') + '>' + f[1] + '</option>'; }).join('') + '</select></div>' +
            '<div><label class="nexo-label" for="pr-moeda">Moeda</label><select id="pr-moeda" name="moeda" class="nexo-input">' +
            MOEDAS.map(function (m) { return '<option value="' + m[0] + '"' + (m[0] === p.moeda ? ' selected' : '') + '>' + m[1] + '</option>'; }).join('') + '</select></div>' +
            '</div>' +
            '<div class="mt-4 bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm text-gray-600">' +
            '<p class="font-semibold text-gray-700 mb-1">Pré-visualização</p>' +
            '<p>Data de hoje: <b id="pv-data"></b> &middot; Valor de exemplo: <b id="pv-moeda"></b></p>' +
            '<p class="text-xs text-gray-500 mt-1">Formato de data e moeda são preferências de exibição e ficam registradas na configuração.</p></div>' +
            rodapeSalvar('Salvar preferências') + '</form>');

        var form = porId('form-preferencias');
        function atualizarPrevia() {
            porId('pv-data').textContent = exemploData(form.querySelector('[name=formatoData]').value);
            porId('pv-moeda').textContent = exemploMoeda(form.querySelector('[name=moeda]').value);
        }
        form.addEventListener('change', atualizarPrevia);
        atualizarPrevia();

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var d = Nexo.ui.lerFormulario(form), erros = {};
            if ([10, 20, 50].indexOf(Number(d.itensPorPagina)) === -1) erros.itensPorPagina = 'Escolha 10, 20 ou 50.';
            if (!paginas.some(function (m) { return m.href === d.paginaInicial; })) erros.paginaInicial = 'Escolha uma página válida.';
            if (!FORMATOS_DATA.some(function (f) { return f[0] === d.formatoData; })) erros.formatoData = 'Formato inválido.';
            if (!MOEDAS.some(function (m) { return m[0] === d.moeda; })) erros.moeda = 'Moeda inválida.';
            if (!Nexo.ui.mostrarErros(form, erros)) return;
            salvarConfig('preferencias', { itensPorPagina: Number(d.itensPorPagina), paginaInicial: d.paginaInicial, formatoData: d.formatoData, moeda: d.moeda });
            Nexo.registrarAtividade('configuracao', 'Preferências do sistema atualizadas', 'configuracoes.html#preferencias');
            Nexo.ui.toast('Preferências salvas.', 'sucesso');
        });
    }

    /* ------------------------------------------------------------------ */
    /* Configurações gerais + zona de perigo                               */
    /* ------------------------------------------------------------------ */
    function renderGeral() {
        if (!ehAdmin) { porId('sec-geral').innerHTML = avisoRestrito('Somente administradores podem alterar as configurações gerais.'); return; }
        var g = lerConfig().geral;
        var html = cartao('Configurações gerais',
            'Valores padrão usados nas rotinas de estoque, entrega e vendas.',
            '<form id="form-geral" novalidate><div class="grid grid-cols-1 md:grid-cols-3 gap-4">' +
            '<div><label class="nexo-label" for="ge-min">Estoque mínimo padrão (un.) *</label><input type="number" id="ge-min" name="estoqueMinimoPadrao" class="nexo-input" min="0" step="1" value="' + esc(g.estoqueMinimoPadrao) + '"></div>' +
            '<div><label class="nexo-label" for="ge-prazo">Prazo de entrega padrão (dias) *</label><input type="number" id="ge-prazo" name="prazoEntregaPadrao" class="nexo-input" min="0" step="1" value="' + esc(g.prazoEntregaPadrao) + '"></div>' +
            '<div><label class="nexo-label" for="ge-frete">Frete grátis acima de (R$) *</label><input type="text" inputmode="decimal" id="ge-frete" name="freteGratisAcima" class="nexo-input" value="' + esc((Number(g.freteGratisAcima) || 0).toFixed(2).replace('.', ',')) + '"></div>' +
            '</div><div class="mt-4">' +
            linhaOpcao('permitirVendaSemEstoque', 'Permitir venda sem estoque', 'Quando ligado, pedidos podem ser criados mesmo com saldo insuficiente.', !!g.permitirVendaSemEstoque) +
            '</div>' + rodapeSalvar('Salvar configurações') + '</form>');

        if (ehAdmin) {
            html += '<div class="bg-white rounded-2xl border border-red-200 shadow-sm p-5 md:p-6 mb-6">' +
                '<h2 class="text-lg font-bold text-red-700"><i class="fa-solid fa-triangle-exclamation mr-2"></i>Zona de perigo</h2>' +
                '<p class="text-sm text-gray-500 mt-1 mb-5">Ações que afetam todos os dados guardados neste navegador.</p>' +
                '<div class="space-y-4">' +
                '<div class="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-gray-100"><div><p class="font-semibold text-gray-800">Exportar backup</p><p class="text-xs text-gray-500">Baixa um arquivo JSON com todos os dados do sistema (menos a sessão de login).</p></div>' +
                '<button type="button" id="btn-backup" class="nexo-btn nexo-btn-secundario shrink-0"><i class="fa-solid fa-download"></i> Exportar backup JSON</button></div>' +
                '<div class="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-gray-100"><div><p class="font-semibold text-gray-800">Importar backup</p><p class="text-xs text-gray-500">Substitui todos os dados atuais pelos do arquivo escolhido.</p></div>' +
                '<div class="shrink-0"><input type="file" id="arq-backup" accept=".json,application/json" class="hidden">' +
                '<button type="button" id="btn-importar" class="nexo-btn nexo-btn-secundario"><i class="fa-solid fa-upload"></i> Importar backup JSON</button></div></div>' +
                '<div class="flex flex-col md:flex-row md:items-center justify-between gap-3"><div><p class="font-semibold text-gray-800">Restaurar dados de exemplo</p><p class="text-xs text-gray-500">Apaga tudo o que foi cadastrado e volta aos dados iniciais de demonstração.</p></div>' +
                '<button type="button" id="btn-restaurar" class="nexo-btn nexo-btn-perigo shrink-0"><i class="fa-solid fa-rotate-left"></i> Restaurar dados de exemplo</button></div>' +
                '</div></div>';
        } else {
            html += avisoRestrito('Backup, importação e restauração de dados são exclusivos de administradores.');
        }
        porId('sec-geral').innerHTML = html;

        porId('form-geral').addEventListener('submit', function (e) {
            e.preventDefault();
            var form = e.currentTarget, d = Nexo.ui.lerFormulario(form), erros = {};
            if (!ehInteiro(d.estoqueMinimoPadrao)) erros.estoqueMinimoPadrao = 'Informe um número inteiro maior ou igual a 0.';
            if (!ehInteiro(d.prazoEntregaPadrao)) erros.prazoEntregaPadrao = 'Informe um número inteiro maior ou igual a 0.';
            var frete = fmt.paraNumero(d.freteGratisAcima);
            if (d.freteGratisAcima === '' || !/\d/.test(d.freteGratisAcima) || frete < 0) erros.freteGratisAcima = 'Informe um valor maior ou igual a 0.';
            if (!Nexo.ui.mostrarErros(form, erros)) return;
            salvarConfig('geral', {
                estoqueMinimoPadrao: Number(d.estoqueMinimoPadrao),
                prazoEntregaPadrao: Number(d.prazoEntregaPadrao),
                freteGratisAcima: frete,
                permitirVendaSemEstoque: d.permitirVendaSemEstoque
            });
            Nexo.registrarAtividade('configuracao', 'Configurações gerais atualizadas', 'configuracoes.html#geral');
            Nexo.ui.toast('Configurações salvas.', 'sucesso');
        });

        if (ehAdmin) {
            porId('btn-backup').addEventListener('click', exportarBackup);
            porId('btn-importar').addEventListener('click', function () { porId('arq-backup').click(); });
            porId('arq-backup').addEventListener('change', lerArquivoBackup);
            porId('btn-restaurar').addEventListener('click', restaurarExemplo);
        }
    }

    /* Restaura os dados de exemplo, exigindo que a pessoa digite RESTAURAR */
    function restaurarExemplo() {
        Nexo.ui.abrirModal({
            titulo: 'Restaurar dados de exemplo',
            largura: 'max-w-md',
            html: '<form novalidate><p class="text-sm text-gray-600 mb-4">Todos os produtos, clientes, pedidos, lançamentos, usuários e configurações cadastrados serão <b class="text-red-600">apagados</b> e substituídos pelos dados de exemplo. Esta ação não pode ser desfeita.</p>' +
                '<label class="nexo-label" for="rt-conf">Para confirmar, digite RESTAURAR</label><input type="text" id="rt-conf" name="confirmacao" class="nexo-input" autocomplete="off"></form>',
            botoes: [
                { texto: 'Cancelar', classe: 'nexo-btn-secundario', acao: 'fechar' },
                { texto: 'Apagar e restaurar', classe: 'nexo-btn-perigo', icone: 'fa-rotate-left', acao: function (modal, corpo) {
                    var form = corpo.querySelector('form'), d = Nexo.ui.lerFormulario(form);
                    if (d.confirmacao !== 'RESTAURAR') { Nexo.ui.mostrarErros(form, { confirmacao: 'Digite RESTAURAR (em maiúsculas) para confirmar.' }); return false; }
                    Nexo.resetar();
                    Nexo.registrarAtividade('sistema', 'Dados de exemplo restaurados', 'configuracoes.html#geral');
                    Nexo.ui.toast('Dados de exemplo restaurados. Recarregando...', 'sucesso');
                    setTimeout(function () { location.reload(); }, 900);
                    return true;
                } }
            ]
        });
    }

    /* ------------------------------------------------------------------ */
    /* Backup JSON                                                         */
    /* ------------------------------------------------------------------ */
    function chavesDoSistema() {
        var chaves = [];
        try {
            for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i);
                if (k && k.indexOf(PREFIXO) === 0 && CHAVES_DE_SESSAO.indexOf(k.slice(PREFIXO.length)) === -1) chaves.push(k);
            }
        } catch (e) { /* storage indisponível */ }
        return chaves;
    }

    function exportarBackup() {
        var dados = {};
        chavesDoSistema().forEach(function (k) {
            try { dados[k.slice(PREFIXO.length)] = JSON.parse(localStorage.getItem(k)); } catch (e) { /* ignora chave ilegível */ }
        });
        var pacote = { formato: 'nexo-backup', versao: 1, geradoEm: new Date().toISOString(), dados: dados };
        var blob = new Blob([JSON.stringify(pacote, null, 2)], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'nexo-backup-' + fmt.hojeInput() + '.json';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
        Nexo.registrarAtividade('sistema', 'Backup dos dados exportado', 'configuracoes.html#geral');
        Nexo.ui.toast('Backup gerado (' + Object.keys(dados).length + ' grupos de dados).', 'sucesso');
    }

    /* Valida o conteúdo do arquivo. Retorna texto de erro ou '' se estiver ok. */
    function validarBackup(pacote) {
        if (!pacote || typeof pacote !== 'object' || pacote.formato !== 'nexo-backup') return 'O arquivo não é um backup do Nexo (formato desconhecido).';
        var dados = pacote.dados;
        if (!dados || typeof dados !== 'object' || Array.isArray(dados)) return 'O backup está sem a seção de dados.';
        if (typeof dados.versao !== 'string') return 'O backup não informa a versão dos dados.';
        for (var i = 0; i < COLECOES_OBRIGATORIAS.length; i++) {
            if (!Array.isArray(dados[COLECOES_OBRIGATORIAS[i]])) return 'O backup está incompleto: falta a lista "' + COLECOES_OBRIGATORIAS[i] + '".';
        }
        var ok = dados.usuarios.some(function (u) { return u && u.perfil === 'Administrador' && u.ativo && u.email && u.senha; });
        if (!ok) return 'O backup não tem nenhum administrador ativo. Importar assim bloquearia o acesso ao sistema.';
        if (CHAVES_DE_SESSAO.some(function (c) { return Object.prototype.hasOwnProperty.call(dados, c); })) return 'O backup contém dados de sessão, o que não é permitido.';
        return '';
    }

    function lerArquivoBackup(e) {
        var input = e.target, arquivo = input.files && input.files[0];
        input.value = '';
        if (!arquivo) return;
        if (arquivo.size > 8 * 1024 * 1024) { Nexo.ui.toast('Arquivo muito grande (máximo 8 MB).', 'erro'); return; }
        var leitor = new FileReader();
        leitor.onerror = function () { Nexo.ui.toast('Não foi possível ler o arquivo.', 'erro'); };
        leitor.onload = function () {
            var pacote;
            try { pacote = JSON.parse(leitor.result); } catch (err) { Nexo.ui.toast('O arquivo não é um JSON válido.', 'erro'); return; }
            var erro = validarBackup(pacote);
            if (erro) { Nexo.ui.toast(erro, 'erro'); return; }
            var aviso = 'Backup de ' + fmt.dataHora(pacote.geradoEm) + ' com ' + pacote.dados.produtos.length + ' produtos, ' + pacote.dados.clientes.length + ' clientes e ' + pacote.dados.pedidos.length +
                ' pedidos. TODOS os dados atuais serão substituídos. Se o seu usuário não existir no backup, você será desconectado.';
            Nexo.ui.confirmar('Importar backup?', aviso, { textoOk: 'Substituir dados', perigo: true }).then(function (ok) {
                if (ok) aplicarBackup(pacote.dados);
            });
        };
        leitor.readAsText(arquivo);
    }

    /* Grava o backup; se algo falhar no meio, devolve os dados antigos */
    function aplicarBackup(dados) {
        var antigos = {};
        chavesDoSistema().forEach(function (k) { antigos[k] = localStorage.getItem(k); });
        try {
            Object.keys(antigos).forEach(function (k) { localStorage.removeItem(k); });
            Object.keys(dados).forEach(function (chave) { localStorage.setItem(PREFIXO + chave, JSON.stringify(dados[chave])); });
        } catch (err) {
            try {
                chavesDoSistema().forEach(function (k) { localStorage.removeItem(k); });
                Object.keys(antigos).forEach(function (k) { localStorage.setItem(k, antigos[k]); });
            } catch (e2) { /* sem o que fazer */ }
            Nexo.ui.toast('Falha ao gravar o backup. Os dados anteriores foram mantidos.', 'erro');
            return;
        }
        Nexo.registrarAtividade('sistema', 'Backup importado: dados substituídos', 'configuracoes.html#geral');
        Nexo.ui.toast('Backup importado. Recarregando...', 'sucesso');
        setTimeout(function () { location.reload(); }, 900);
    }

    /* ------------------------------------------------------------------ */
    /* Início                                                              */
    /* ------------------------------------------------------------------ */
    renderPerfil();
    renderUsuarios();
    renderPermissoes();
    renderNotificacoes();
    renderPreferencias();
    renderGeral();
    mostrarSecao();
    window.addEventListener('hashchange', mostrarSecao);
})();
