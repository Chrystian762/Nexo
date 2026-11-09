/*
 * NEXO ERP - Tela Empresa
 * Mostra os dados cadastrais em modo leitura. O botão "Editar" libera os campos;
 * "Salvar alterações" valida e grava em Nexo.db (objeto 'empresa'); "Cancelar" restaura os valores.
 */
(function () {
    'use strict';

    var fmt = Nexo.fmt;
    var form = document.getElementById('formEmpresa');
    var editando = false;

    var CAMPOS_EMPRESA = ['razaoSocial', 'nomeFantasia', 'cnpj', 'inscricaoEstadual', 'inscricaoMunicipal', 'regimeTributario',
        'cnae', 'dataAbertura', 'responsavel', 'email', 'emailFinanceiro', 'telefone', 'whatsapp', 'site'];
    var CAMPOS_ENDERECO = ['cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf'];

    function campo(nome) { return form.elements[nome]; }

    /* Preenche o formulário com os dados gravados (usado ao abrir e ao cancelar) */
    function preencher(emp) {
        var end = emp.endereco || {};
        CAMPOS_EMPRESA.forEach(function (n) { campo(n).value = emp[n] || ''; });
        CAMPOS_ENDERECO.forEach(function (n) { campo(n).value = end[n] || ''; });
        /* aplica máscara nos valores antigos */
        campo('cnpj').value = Nexo.mascara.cnpj(campo('cnpj').value);
        campo('telefone').value = Nexo.mascara.telefone(campo('telefone').value);
        campo('whatsapp').value = Nexo.mascara.telefone(campo('whatsapp').value);
        campo('cep').value = Nexo.mascara.cep(campo('cep').value);
        if (!campo('regimeTributario').value) campo('regimeTributario').value = 'Simples Nacional';
    }

    /* Liga/desliga o modo de edição */
    function definirEdicao(ligado) {
        editando = ligado;
        Array.prototype.forEach.call(form.elements, function (el) {
            if (el.tagName === 'SELECT') el.disabled = !ligado;
            else el.readOnly = !ligado;
        });
        document.getElementById('btnEditar').style.display = ligado ? 'none' : 'inline-flex';
        document.getElementById('btnSalvar').style.display = ligado ? 'inline-flex' : 'none';
        document.getElementById('btnCancelar').style.display = ligado ? 'inline-flex' : 'none';
        if (!ligado) {
            Nexo.ui.mostrarErros(form, {});
            mensagemCep('');
        }
    }

    /* ------------------------------------------------------------------ */
    /* Resumo do topo                                                      */
    /* ------------------------------------------------------------------ */
    function tempoDeEmpresa(dataAbertura) {
        if (!dataAbertura) return '-';
        var ini = new Date(dataAbertura + 'T12:00:00');
        var hoje = new Date();
        if (isNaN(ini) || ini > hoje) return '-';
        var meses = (hoje.getFullYear() - ini.getFullYear()) * 12 + (hoje.getMonth() - ini.getMonth());
        if (hoje.getDate() < ini.getDate()) meses--;
        var anos = Math.floor(meses / 12);
        var resto = meses % 12;
        var partes = [];
        if (anos) partes.push(anos + (anos === 1 ? ' ano' : ' anos'));
        if (resto) partes.push(resto + (resto === 1 ? ' mês' : ' meses'));
        return partes.length ? partes.join(' e ') : 'menos de 1 mês';
    }

    function desenharResumo(emp) {
        var end = emp.endereco || {};
        function texto(id, valor) { document.getElementById(id).textContent = valor; }
        texto('resNome', emp.nomeFantasia || emp.razaoSocial || 'Empresa');
        texto('resRazao', emp.razaoSocial || '');
        texto('resCnpj', emp.cnpj ? Nexo.mascara.cnpj(emp.cnpj) : '-');
        texto('resCidade', end.cidade ? end.cidade + (end.uf ? '/' + end.uf : '') : '-');
        texto('resTempo', tempoDeEmpresa(emp.dataAbertura));
        texto('resAtualizacao', emp.atualizadoEm ? fmt.dataHora(emp.atualizadoEm) : 'Sem alterações registradas');
    }

    /* ------------------------------------------------------------------ */
    /* Validação e gravação                                                */
    /* ------------------------------------------------------------------ */
    function validarDados(d) {
        var erros = {};
        var V = Nexo.validar;
        if (!V.obrigatorio(d.razaoSocial)) erros.razaoSocial = 'Informe a razão social.';
        if (!V.obrigatorio(d.nomeFantasia)) erros.nomeFantasia = 'Informe o nome fantasia.';
        if (!V.cnpj(d.cnpj)) erros.cnpj = 'CNPJ inválido.';
        if (!V.email(d.email)) erros.email = 'Informe um e-mail válido.';
        if (d.emailFinanceiro && !V.email(d.emailFinanceiro)) erros.emailFinanceiro = 'E-mail financeiro inválido.';
        if (!V.telefone(d.telefone)) erros.telefone = 'Informe um telefone com DDD (10 ou 11 dígitos).';
        if (d.whatsapp && !V.telefone(d.whatsapp)) erros.whatsapp = 'WhatsApp inválido (10 ou 11 dígitos com DDD).';
        if (d.dataAbertura && d.dataAbertura > fmt.hojeInput()) erros.dataAbertura = 'A data de abertura não pode ser futura.';
        if (d.cep.replace(/\D/g, '').length !== 8) erros.cep = 'O CEP deve ter 8 dígitos.';
        if (!V.obrigatorio(d.logradouro)) erros.logradouro = 'Informe o logradouro.';
        if (!V.obrigatorio(d.numero)) erros.numero = 'Informe o número (ou S/N).';
        if (!V.obrigatorio(d.bairro)) erros.bairro = 'Informe o bairro.';
        if (!V.obrigatorio(d.cidade)) erros.cidade = 'Informe a cidade.';
        if (!d.uf) erros.uf = 'Selecione o estado.';
        return erros;
    }

    function salvar() {
        var dados = Nexo.ui.lerFormulario(form);
        var erros = validarDados(dados);
        if (!Nexo.ui.mostrarErros(form, erros)) {
            Nexo.ui.toast('Corrija os campos destacados.', 'erro');
            return;
        }
        var atual = Nexo.db.lerObjeto('empresa');
        var novo = Object.assign({}, atual);
        CAMPOS_EMPRESA.forEach(function (n) { novo[n] = dados[n]; });
        novo.endereco = Object.assign({}, atual.endereco);
        CAMPOS_ENDERECO.forEach(function (n) { novo.endereco[n] = dados[n]; });
        novo.atualizadoEm = new Date().toISOString();
        Nexo.db.gravarObjeto('empresa', novo);
        Nexo.registrarAtividade('empresa', 'Dados da empresa atualizados', 'empresa.html');
        preencher(novo);
        desenharResumo(novo);
        definirEdicao(false);
        Nexo.ui.toast('Dados da empresa salvos com sucesso.');
    }

    function cancelar() {
        var emp = Nexo.db.lerObjeto('empresa');
        preencher(emp);
        definirEdicao(false);
        Nexo.ui.toast('Alterações descartadas.', 'info');
    }

    /* ------------------------------------------------------------------ */
    /* Busca de endereço pelo CEP (ViaCEP). Falha de rede não quebra a tela */
    /* ------------------------------------------------------------------ */
    function mensagemCep(texto, erro) {
        var el = document.getElementById('msgCep');
        el.textContent = texto;
        el.className = 'text-xs mt-1 ' + (erro ? 'text-amber-600' : 'text-gray-500') + (texto ? '' : ' hidden');
    }

    function buscarCep() {
        var cep = campo('cep').value.replace(/\D/g, '');
        if (!editando || cep.length !== 8 || typeof fetch !== 'function') return;
        mensagemCep('Buscando endereço...');
        fetch('https://viacep.com.br/ws/' + cep + '/json/')
            .then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); })
            .then(function (j) {
                if (j.erro) { mensagemCep('CEP não encontrado. Preencha o endereço manualmente.', true); return; }
                if (j.logradouro) campo('logradouro').value = j.logradouro;
                if (j.bairro) campo('bairro').value = j.bairro;
                if (j.localidade) campo('cidade').value = j.localidade;
                if (j.uf) campo('uf').value = j.uf;
                mensagemCep('Endereço preenchido pelo CEP.');
            })
            .catch(function () {
                mensagemCep('Não foi possível consultar o CEP agora. Preencha o endereço manualmente.', true);
            });
    }

    /* ------------------------------------------------------------------ */
    /* Início                                                              */
    /* ------------------------------------------------------------------ */
    function iniciar() {
        var emp = Nexo.db.lerObjeto('empresa');
        preencher(emp);
        desenharResumo(emp);
        definirEdicao(false);

        Nexo.mascara.aplicar(campo('cnpj'), 'cnpj');
        Nexo.mascara.aplicar(campo('telefone'), 'telefone');
        Nexo.mascara.aplicar(campo('whatsapp'), 'telefone');
        Nexo.mascara.aplicar(campo('cep'), 'cep');
        campo('cep').addEventListener('input', buscarCep);

        document.getElementById('btnEditar').addEventListener('click', function () {
            definirEdicao(true);
            campo('razaoSocial').focus();
        });
        document.getElementById('btnCancelar').addEventListener('click', cancelar);
        document.getElementById('btnSalvar').addEventListener('click', salvar);
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            if (editando) salvar();
        });
    }

    if (Nexo.layout.montar('empresa')) iniciar();
})();
