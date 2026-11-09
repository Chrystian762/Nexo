/*
 * NEXO ERP - Relatorios: funcoes comuns
 * --------------------------------------------------------------
 * Usado por todas as telas de relatorio (telas/relatorios*.html).
 * Depende de nexo-data.js, nexo-layout.js e (para graficos) Chart.js.
 *
 * Tudo fica em window.Rel:
 *   Rel.iniciar(fn)                      monta o layout e chama fn() se o usuario puder acessar
 *   Rel.filtros(el, opcoes)              barra de filtros (periodo + filtros extras)
 *   Rel.cabecalho({subtitulo, filtros})  subtitulo da tela e cabecalho de impressao
 *   Rel.kpis(el, lista, opcoes)          cards de indicadores
 *   Rel.variacao(atual, anterior)        html "+12% vs periodo anterior"
 *   Rel.grafico(idCanvas, config)        cria/recria um grafico Chart.js (paleta roxa)
 *   Rel.tabela(el, opcoes)               tabela com ordenacao por coluna e linha de total
 *   Rel.ligarBotoes({nome, tabelas})     botoes Exportar CSV e Imprimir/PDF
 *   Rel.contexto(), Rel.pedidos(), Rel.itens(), Rel.resumo()   consultas aos dados reais
 *   Rel.serie(), Rel.saldoEm() ...       agrupamento por tempo e estoque historico
 */
(function (global) {
    'use strict';
    var Nexo = global.Nexo;
    if (!Nexo) { console.error('Carregue JS/nexo-data.js antes de JS/relatorios-comum.js'); return; }
    var esc = Nexo.esc;
    var fmt = Nexo.fmt;

    var COMISSAO_PERCENTUAL = 5; // comissao estimada dos vendedores (%)
    var PALETA = ['#7c3aed', '#a78bfa', '#6366f1', '#3b82f6', '#14b8a6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#64748b'];
    var MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    var MESES_LONGOS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    /* ------------------------------------------------------------------ */
    /* Datas (sempre como texto YYYY-MM-DD no fuso local)                  */
    /* ------------------------------------------------------------------ */
    function pad(n) { return String(n).padStart(2, '0'); }
    function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
    function hoje() { return iso(new Date()); }
    function dataDe(dia) { return new Date(dia + 'T12:00:00'); }
    function somarDias(dia, n) { var d = dataDe(dia); d.setDate(d.getDate() + n); return iso(d); }
    function diasEntre(a, b) { return Math.round((dataDe(b) - dataDe(a)) / 86400000); }
    function inicioMes(dia) { return dia.slice(0, 8) + '01'; }
    function fimMes(dia) { var d = dataDe(inicioMes(dia)); d.setMonth(d.getMonth() + 1); d.setDate(0); return iso(d); }
    function somarMeses(dia, n) { var d = dataDe(inicioMes(dia)); d.setMonth(d.getMonth() + n); return iso(d); }
    function min(a, b) { return a < b ? a : b; }
    function max(a, b) { return a > b ? a : b; }
    /* Converte uma data ISO com hora (UTC) para o dia local */
    function diaLocal(valor) {
        if (!valor) return '';
        var s = String(valor);
        if (s.length === 10) return s;
        var d = new Date(s);
        return isNaN(d) ? s.slice(0, 10) : iso(d);
    }
    function nomeMesCurto(dia) { return MESES_CURTOS[Number(dia.slice(5, 7)) - 1] + '/' + dia.slice(2, 4); }
    function nomeMesLongo(dia) { return MESES_LONGOS[Number(dia.slice(5, 7)) - 1] + ' de ' + dia.slice(0, 4); }
    function ddmm(dia) { return dia.slice(8, 10) + '/' + dia.slice(5, 7); }

    /* ------------------------------------------------------------------ */
    /* Periodos                                                            */
    /* ------------------------------------------------------------------ */
    var ROTULOS_PERIODO = {
        '7d': 'Últimos 7 dias', '30d': 'Últimos 30 dias', '90d': 'Últimos 90 dias',
        'mes': 'Este mês', 'mes_passado': 'Mês passado', 'ano': 'Este ano', 'ano_passado': 'Ano passado',
        'personalizado': 'Personalizado...'
    };

    /*
     * Resolve o periodo escolhido. Retorna:
     * {chave, inicio, fim, fimEfetivo (nao passa de hoje), dias, rotulo, anterior:{inicio, fim}}
     * O periodo anterior tem o mesmo tamanho (ou os mesmos dias do mes/ano anterior).
     */
    function resolverPeriodo(chave, ini, fim) {
        var h = hoje(), i, f, y;
        switch (chave) {
            case '7d': i = somarDias(h, -6); f = h; break;
            case '30d': i = somarDias(h, -29); f = h; break;
            case '90d': i = somarDias(h, -89); f = h; break;
            case 'mes': i = inicioMes(h); f = fimMes(h); break;
            case 'mes_passado': i = somarMeses(h, -1); f = fimMes(i); break;
            case 'ano': i = h.slice(0, 4) + '-01-01'; f = h.slice(0, 4) + '-12-31'; break;
            case 'ano_passado': y = Number(h.slice(0, 4)) - 1; i = y + '-01-01'; f = y + '-12-31'; break;
            default: i = ini || somarDias(h, -29); f = fim || h; chave = 'personalizado';
        }
        var fe = min(f, h);
        if (fe < i) fe = i;
        var len = diasEntre(i, fe) + 1;
        var aI, aF;
        if (chave === 'mes') {
            aI = somarMeses(i, -1); aF = min(somarDias(aI, len - 1), fimMes(aI));
        } else if (chave === 'mes_passado') {
            aI = somarMeses(i, -1); aF = fimMes(aI);
        } else if (chave === 'ano' || chave === 'ano_passado') {
            y = Number(i.slice(0, 4)) - 1;
            aI = y + '-01-01';
            aF = chave === 'ano' ? y + '-' + fe.slice(5) : y + '-12-31';
        } else {
            aF = somarDias(i, -1); aI = somarDias(aF, -(len - 1));
        }
        return {
            chave: chave, inicio: i, fim: f, fimEfetivo: fe, dias: diasEntre(i, f) + 1,
            rotulo: fmt.data(i) + ' a ' + fmt.data(f),
            anterior: { inicio: aI, fim: aF }
        };
    }

    /* ------------------------------------------------------------------ */
    /* Barra de filtros                                                    */
    /* ------------------------------------------------------------------ */
    var CLASSE_SELECT = 'w-full bg-white border border-gray-200 text-gray-700 text-sm rounded-xl px-4 py-2.5 outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple cursor-pointer';

    /*
     * opcoes: {
     *   periodos: ['7d','30d',...]  (padrao: 7d,30d,90d,mes,mes_passado,ano,personalizado)
     *   periodoPadrao: '30d',
     *   semPeriodo: true  (nao mostra o periodo),
     *   extras: [{id:'categoria', rotulo:'Categoria', opcoes:[['', 'Todas'], ['cat_1','Shampoo']], padrao:''}],
     *   aoMudar: function(f) {}
     * }
     * Retorna {ler(), definirOpcoes(id, lista), el}.
     * ler() devolve {periodo, v:{id:valor}, texto:{id:rotulo}, descricao:'Periodo: ... | Categoria: ...'}
     */
    function filtros(el, opcoes) {
        opcoes = opcoes || {};
        var permitidos = opcoes.periodos || ['7d', '30d', '90d', 'mes', 'mes_passado', 'ano', 'personalizado'];
        var padraoPeriodo = opcoes.periodoPadrao || permitidos[0];
        var extras = (opcoes.extras || []).map(function (x) { return { id: x.id, rotulo: x.rotulo, opcoes: x.opcoes.slice(), padrao: x.padrao === undefined ? x.opcoes[0][0] : x.padrao }; });
        var padraoPers = { ini: somarDias(hoje(), -29), fim: hoje() };

        function htmlOpcoes(lista, atual) {
            return lista.map(function (o) {
                return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(atual) ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
            }).join('');
        }
        function desenharExtras() {
            extras.forEach(function (x) {
                var sel = el.querySelector('[data-f="' + x.id + '"]');
                if (sel) sel.innerHTML = htmlOpcoes(x.opcoes, sel.value || x.padrao);
            });
        }

        var blocoPeriodo = '';
        if (!opcoes.semPeriodo) {
            blocoPeriodo =
                '<div><label class="block text-xs font-semibold text-gray-500 mb-1.5">Período</label>' +
                '<select data-f="periodo" class="' + CLASSE_SELECT + '">' +
                htmlOpcoes(permitidos.map(function (p) { return [p, ROTULOS_PERIODO[p]]; }), padraoPeriodo) + '</select></div>' +
                '<div data-bloco-pers class="hidden"><label class="block text-xs font-semibold text-gray-500 mb-1.5">Data inicial</label>' +
                '<input type="date" data-f="ini" value="' + padraoPers.ini + '" class="' + CLASSE_SELECT + '"></div>' +
                '<div data-bloco-pers class="hidden"><label class="block text-xs font-semibold text-gray-500 mb-1.5">Data final</label>' +
                '<input type="date" data-f="fim" value="' + padraoPers.fim + '" class="' + CLASSE_SELECT + '"></div>';
        }
        var blocoExtras = extras.map(function (x) {
            return '<div><label class="block text-xs font-semibold text-gray-500 mb-1.5">' + esc(x.rotulo) + '</label>' +
                '<select data-f="' + esc(x.id) + '" class="' + CLASSE_SELECT + '">' + htmlOpcoes(x.opcoes, x.padrao) + '</select></div>';
        }).join('');

        el.innerHTML =
            '<div class="nao-imprimir bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-gray-200 mb-6">' +
            '  <div class="px-5 py-4 border-b border-gray-100 flex justify-between items-center gap-3">' +
            '    <div class="flex items-center gap-2 text-brand-purple font-semibold text-sm"><i class="fa-solid fa-filter"></i> Filtros</div>' +
            '    <button type="button" data-limpar class="flex items-center gap-2 border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition">' +
            '      <i class="fa-solid fa-rotate-right text-xs"></i> Limpar filtros</button>' +
            '  </div>' +
            '  <div class="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">' + blocoPeriodo + blocoExtras + '</div>' +
            '</div>';

        var seletorPeriodo = el.querySelector('[data-f="periodo"]');
        function atualizarPersonalizado() {
            var mostrar = seletorPeriodo && seletorPeriodo.value === 'personalizado';
            el.querySelectorAll('[data-bloco-pers]').forEach(function (b) { b.classList.toggle('hidden', !mostrar); });
        }

        function ler() {
            var v = {}, texto = {};
            extras.forEach(function (x) {
                var sel = el.querySelector('[data-f="' + x.id + '"]');
                v[x.id] = sel ? sel.value : x.padrao;
                var achada = x.opcoes.filter(function (o) { return String(o[0]) === String(v[x.id]); })[0];
                texto[x.id] = achada ? achada[1] : '';
            });
            var per = null;
            if (!opcoes.semPeriodo) {
                var chave = seletorPeriodo.value;
                var ini = el.querySelector('[data-f="ini"]').value;
                var fim = el.querySelector('[data-f="fim"]').value;
                per = resolverPeriodo(chave, ini, fim);
            }
            var partes = [];
            if (per) partes.push('Período: ' + per.rotulo);
            extras.forEach(function (x) { if (texto[x.id]) partes.push(x.rotulo + ': ' + texto[x.id]); });
            return { periodo: per, v: v, texto: texto, descricao: partes.join(' | ') };
        }

        /* Valida o intervalo personalizado antes de avisar a tela */
        function mudou() {
            atualizarPersonalizado();
            if (seletorPeriodo && seletorPeriodo.value === 'personalizado') {
                var iniEl = el.querySelector('[data-f="ini"]');
                var fimEl = el.querySelector('[data-f="fim"]');
                if (!iniEl.value || !fimEl.value || iniEl.value > fimEl.value) {
                    iniEl.classList.add('border-red-400'); fimEl.classList.add('border-red-400');
                    Nexo.ui.toast('Informe um intervalo válido: a data inicial não pode ser maior que a final.', 'erro');
                    return;
                }
                iniEl.classList.remove('border-red-400'); fimEl.classList.remove('border-red-400');
            }
            if (opcoes.aoMudar) opcoes.aoMudar(ler());
        }

        el.addEventListener('change', function (e) { if (e.target.closest('[data-f]')) mudou(); });
        el.querySelector('[data-limpar]').addEventListener('click', function () {
            if (seletorPeriodo) {
                seletorPeriodo.value = padraoPeriodo;
                el.querySelector('[data-f="ini"]').value = padraoPers.ini;
                el.querySelector('[data-f="fim"]').value = padraoPers.fim;
            }
            extras.forEach(function (x) {
                var sel = el.querySelector('[data-f="' + x.id + '"]');
                if (sel) sel.value = x.padrao;
            });
            mudou();
        });
        atualizarPersonalizado();

        return {
            el: el,
            ler: ler,
            /* troca a lista de opcoes de um filtro extra (ex.: lista de marcas) */
            definirOpcoes: function (id, lista) {
                extras.forEach(function (x) { if (x.id === id) x.opcoes = lista.slice(); });
                var sel = el.querySelector('[data-f="' + id + '"]');
                if (sel) { var atual = sel.value; sel.innerHTML = htmlOpcoes(lista, atual); }
            }
        };
    }

    /* ------------------------------------------------------------------ */
    /* Cabecalho, estilos de impressao e botoes                            */
    /* ------------------------------------------------------------------ */
    function injetarEstilos() {
        if (document.getElementById('rel-estilos')) return;
        var st = document.createElement('style');
        st.id = 'rel-estilos';
        st.textContent =
            '.so-impressao{display:none}' +
            '.rel-th-ordenavel{cursor:pointer;user-select:none}.rel-th-ordenavel:hover{color:#7c3aed}' +
            '@media print{' +
            '@page{margin:12mm}' +
            'html,body{height:auto!important;overflow:visible!important;background:#fff!important}' +
            'body{display:block!important}' +
            'main{height:auto!important;overflow:visible!important;position:static!important}' +
            '.nao-imprimir,#nexo-toasts{display:none!important}' +
            '.so-impressao{display:block!important}' +
            '.fade-in{animation:none!important}' +
            '.shadow-sm,[class*="shadow-"]{box-shadow:none!important}' +
            '.overflow-x-auto{overflow:visible!important}' +
            'canvas{max-width:100%!important}' +
            'tr,.break-inside-avoid{break-inside:avoid}' +
            '*{-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
            '}';
        document.head.appendChild(st);
    }

    function cabecalho(op) {
        op = op || {};
        var sub = document.getElementById('rel-subtitulo');
        if (sub && op.subtitulo !== undefined) sub.textContent = op.subtitulo;
        var imp = document.getElementById('rel-impressao');
        if (imp) {
            var titulo = (document.querySelector('h1') || {}).textContent || 'Relatório';
            var empresa = (Nexo.db.lerObjeto('empresa', {}).nomeFantasia) || 'Nexo ERP';
            var usuario = (Nexo.auth.usuarioAtual() || {}).nome || '';
            imp.innerHTML =
                '<div style="border-bottom:2px solid #7c3aed;padding-bottom:8px;margin-bottom:16px">' +
                '<p style="font-size:12px;color:#6b7280">' + esc(empresa) + ' - Relatório</p>' +
                '<h2 style="font-size:20px;font-weight:800">' + esc(titulo) + '</h2>' +
                (op.filtros ? '<p style="font-size:12px;color:#374151">' + esc(op.filtros) + '</p>' : '') +
                '<p style="font-size:11px;color:#6b7280">Gerado em ' + esc(fmt.dataHora(new Date().toISOString())) + (usuario ? ' por ' + esc(usuario) : '') + '</p>' +
                '</div>';
        }
    }

    /*
     * opcoes: {nome:'vendas-por-periodo', tabelas:{idDaTabela: function(){ return ctlTabela; }}}
     * #btn-csv exporta todas as tabelas; [data-csv="id"] exporta so aquela; #btn-imprimir abre a impressao.
     */
    function ligarBotoes(opcoes) {
        var btnCsv = document.getElementById('btn-csv');
        if (btnCsv) btnCsv.addEventListener('click', function () {
            exportar(opcoes.nome, Object.keys(opcoes.tabelas).map(function (k) { return opcoes.tabelas[k](); }));
        });
        document.querySelectorAll('[data-csv]').forEach(function (b) {
            b.addEventListener('click', function () {
                var id = b.getAttribute('data-csv');
                if (opcoes.tabelas[id]) exportar(opcoes.nome + '-' + id, [opcoes.tabelas[id]()]);
            });
        });
        var btnImp = document.getElementById('btn-imprimir');
        if (btnImp) btnImp.addEventListener('click', function () { window.print(); });
    }

    /* Gera o CSV (uma tabela = CSV simples; varias = secoes separadas por linha em branco) */
    function exportar(nome, ctls) {
        var comDados = ctls.filter(function (c) { return c && c.linhas().length; });
        if (!comDados.length) { Nexo.ui.toast('Não há dados para exportar com os filtros atuais.', 'aviso'); return; }
        var arquivo = nome + '-' + hoje();
        if (comDados.length === 1) {
            var d = comDados[0].csv();
            Nexo.exportarCSV(arquivo, d.cabecalho, d.linhas);
        } else {
            var linhas = [];
            comDados.forEach(function (c) {
                var d2 = c.csv();
                linhas.push([c.titulo || 'Tabela']);
                linhas.push(d2.cabecalho);
                d2.linhas.forEach(function (l) { linhas.push(l); });
                linhas.push([]);
            });
            Nexo.exportarCSV(arquivo, ['Relatório', nome, 'Gerado em', fmt.hojeInput()], linhas);
        }
        Nexo.ui.toast('Arquivo CSV gerado.', 'sucesso');
    }

    /* ------------------------------------------------------------------ */
    /* Indicadores (cards)                                                 */
    /* ------------------------------------------------------------------ */
    var CORES_TEXTO = { roxo: 'text-brand-purple', laranja: 'text-orange-500', vermelho: 'text-red-600', verde: 'text-green-600', normal: 'text-gray-900' };

    function variacao(atual, anterior, opcoes) {
        atual = Number(atual) || 0; anterior = Number(anterior) || 0;
        if (!anterior) return '<span class="text-gray-500 font-medium">Sem base de comparação no período anterior</span>';
        var pct = (atual - anterior) / Math.abs(anterior) * 100;
        var bom = opcoes && opcoes.inverso ? pct <= 0 : pct >= 0;
        var icone = pct > 0 ? 'fa-arrow-trend-up' : (pct < 0 ? 'fa-arrow-trend-down' : 'fa-minus');
        return '<span class="' + (bom ? 'text-green-600' : 'text-red-500') + ' font-semibold"><i class="fa-solid ' + icone + '"></i> ' +
            (pct > 0 ? '+' : '') + fmt.porcentagem(pct) + ' vs período anterior</span>';
    }

    /*
     * lista: [{titulo, valor (texto pronto), cor:'roxo|laranja|vermelho|verde', sub (html seguro), variacao:{atual, anterior, inverso}, truncar:true}]
     * opcoes.lateral: empilha os cards (usado ao lado do grafico)
     */
    function kpis(el, lista, opcoes) {
        opcoes = opcoes || {};
        var colunas = lista.length === 5 ? 'md:grid-cols-3 xl:grid-cols-5' : (lista.length === 3 ? 'md:grid-cols-3' : (lista.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-4'));
        var cards = lista.map(function (k) {
            var sub = k.variacao ? variacao(k.variacao.atual, k.variacao.anterior, k.variacao) : (k.sub || '');
            return '<div class="bg-white p-5 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-gray-200 ' + (opcoes.lateral ? 'flex-1' : '') + ' break-inside-avoid">' +
                '<h3 class="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">' + esc(k.titulo) + '</h3>' +
                '<p class="text-2xl font-extrabold ' + (CORES_TEXTO[k.cor] || CORES_TEXTO.normal) + (k.truncar ? ' truncate' : '') + '"' + (k.truncar ? ' title="' + esc(k.valor) + '"' : '') + '>' + esc(k.valor) + '</p>' +
                '<p class="text-xs text-gray-500 font-medium mt-1">' + sub + '</p></div>';
        }).join('');
        el.className = opcoes.lateral ? 'flex flex-col gap-4' : 'grid grid-cols-1 sm:grid-cols-2 ' + colunas + ' gap-5 mb-6';
        el.innerHTML = cards;
    }

    /* ------------------------------------------------------------------ */
    /* Graficos (Chart.js)                                                 */
    /* ------------------------------------------------------------------ */
    var graficos = {};

    function mesclar(base, extra) {
        if (!extra) return base;
        Object.keys(extra).forEach(function (k) {
            if (extra[k] && typeof extra[k] === 'object' && !Array.isArray(extra[k]) && base[k] && typeof base[k] === 'object') mesclar(base[k], extra[k]);
            else base[k] = extra[k];
        });
        return base;
    }

    function formatadorValor(tipo) {
        if (tipo === 'moeda') return function (v) { return fmt.moeda(v); };
        if (tipo === 'percentual') return function (v) { return fmt.porcentagem(v); };
        return function (v) { return fmt.numero(Math.round(v * 100) / 100); };
    }

    /*
     * config: {tipo:'bar'|'line'|'doughnut', labels:[], datasets:[{label, data, ...}],
     *          formato:'moeda'|'numero'|'percentual', horizontal, empilhado, legenda, eixoSecundario:'percentual', opcoes:{}}
     * Destroi o grafico anterior do mesmo canvas. Sem dados, mostra um aviso no lugar.
     */
    function grafico(id, config) {
        var canvas = document.getElementById(id);
        if (!canvas) return null;
        if (graficos[id]) { graficos[id].destroy(); delete graficos[id]; }
        var pai = canvas.parentNode;
        var aviso = pai.querySelector('.rel-vazio');
        if (aviso) aviso.remove();

        var vazio = !config.datasets.some(function (ds) { return ds.data.some(function (v) { return Number(v); }); });
        if (typeof Chart === 'undefined' || vazio) {
            canvas.style.display = 'none';
            aviso = document.createElement('div');
            aviso.className = 'rel-vazio absolute inset-0 flex flex-col items-center justify-center text-center text-sm text-gray-400 gap-2';
            aviso.innerHTML = '<i class="fa-solid fa-chart-simple text-2xl"></i><span>' +
                (typeof Chart === 'undefined' ? 'Gráfico indisponível (biblioteca Chart.js não carregou).' : 'Sem dados para os filtros selecionados.') + '</span>';
            pai.appendChild(aviso);
            return null;
        }
        canvas.style.display = '';

        var tipo = config.tipo || 'bar';
        var circular = tipo === 'doughnut' || tipo === 'pie';
        var fm = formatadorValor(config.formato);
        var ctx = canvas.getContext('2d');

        var datasets = config.datasets.map(function (origem, i) {
            var ds = Object.assign({}, origem);
            var tipoDs = ds.type || tipo;
            if (circular) {
                ds.backgroundColor = ds.backgroundColor || PALETA.slice(0, config.labels.length);
                ds.borderColor = ds.borderColor || '#ffffff';
                ds.borderWidth = ds.borderWidth === undefined ? 2 : ds.borderWidth;
            } else if (tipoDs === 'line') {
                var cor = ds.borderColor || PALETA[i % PALETA.length];
                ds.borderColor = cor;
                ds.borderWidth = ds.borderWidth || 3;
                ds.pointBackgroundColor = ds.pointBackgroundColor || '#ffffff';
                ds.pointBorderColor = ds.pointBorderColor || cor;
                ds.pointBorderWidth = 2;
                ds.pointRadius = ds.pointRadius === undefined ? 3 : ds.pointRadius;
                ds.tension = ds.tension === undefined ? 0.35 : ds.tension;
                if (ds.fill && !ds.backgroundColor) {
                    var g = ctx.createLinearGradient(0, 0, 0, 300);
                    g.addColorStop(0, 'rgba(124,58,237,0.35)');
                    g.addColorStop(1, 'rgba(124,58,237,0)');
                    ds.backgroundColor = g;
                }
            } else {
                ds.backgroundColor = ds.backgroundColor || PALETA[i % PALETA.length];
                ds.borderRadius = ds.borderRadius === undefined ? 6 : ds.borderRadius;
                ds.maxBarThickness = ds.maxBarThickness || 46;
            }
            return ds;
        });

        var opcoes = {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: config.horizontal ? 'y' : 'x',
            plugins: {
                legend: {
                    display: !!config.legenda || circular,
                    position: 'bottom',
                    labels: { boxWidth: 12, font: { family: 'Inter', size: 11 }, color: '#4b5563', padding: 12 }
                },
                tooltip: {
                    backgroundColor: '#111827', padding: 12,
                    titleFont: { family: 'Inter', size: 13 }, bodyFont: { family: 'Inter', size: 13, weight: 'bold' },
                    callbacks: {
                        label: function (c) {
                            var valor = c.parsed && typeof c.parsed === 'object' ? (config.horizontal ? c.parsed.x : c.parsed.y) : c.parsed;
                            var nome = circular ? c.label : c.dataset.label;
                            var txt = ' ' + (nome ? nome + ': ' : '') + (c.dataset.yAxisID === 'y1' ? fmt.porcentagem(valor) : fm(valor));
                            if (circular) {
                                var soma = c.dataset.data.reduce(function (s, x) { return s + (Number(x) || 0); }, 0);
                                if (soma > 0) txt += ' (' + fmt.porcentagem(valor / soma * 100) + ')';
                            }
                            return txt;
                        }
                    }
                }
            }
        };
        if (circular) {
            opcoes.cutout = tipo === 'doughnut' ? '65%' : 0;
        } else {
            var eixoValor = {
                beginAtZero: true,
                grid: { color: '#f1f5f9' },
                ticks: { font: { family: 'Inter', size: 11 }, color: '#94a3b8', callback: function (v) { return config.formato === 'moeda' ? 'R$ ' + fmt.numero(v) : (config.formato === 'percentual' ? v + '%' : fmt.numero(v)); } },
                stacked: !!config.empilhado
            };
            var eixoCategoria = {
                grid: { display: false },
                ticks: { font: { family: 'Inter', size: 11 }, color: '#94a3b8', maxRotation: 0, autoSkip: true },
                stacked: !!config.empilhado
            };
            opcoes.scales = config.horizontal ? { x: eixoValor, y: eixoCategoria } : { x: eixoCategoria, y: eixoValor };
            if (config.eixoSecundario) {
                opcoes.scales.y1 = {
                    position: 'right', grid: { display: false },
                    ticks: { font: { family: 'Inter', size: 11 }, color: '#94a3b8', callback: function (v) { return v + '%'; } }
                };
            }
        }
        mesclar(opcoes, config.opcoes);

        graficos[id] = new Chart(ctx, { type: tipo, data: { labels: config.labels, datasets: datasets }, options: opcoes });
        return graficos[id];
    }

    /* ------------------------------------------------------------------ */
    /* Tabela generica com ordenacao e total                               */
    /* ------------------------------------------------------------------ */
    /*
     * opcoes: {
     *   titulo: 'Nome usado na exportacao com varias tabelas',
     *   colunas: [{chave, titulo, alinhar:'left|center|right', valor:fn(linha), formatar:fn(v), render:fn(linha, i)->html,
     *              total:'soma'|fn(linhas)->valor|'texto', formatarTotal:fn, csv:fn(linha), semOrdem:true, semCsv:true}],
     *   linhas: [], ordem: {chave, dir:'asc|desc'}, total: true, rotuloTotal: 'Total',
     *   vazio: 'Mensagem amigavel', limite: N (mostra so as N primeiras linhas, o CSV leva todas)
     * }
     * Retorna {linhas(), atualizar(linhas), ordenarPor(chave, dir), csv(), titulo}
     */
    function tabela(el, op) {
        var colunas = op.colunas;
        var linhas = op.linhas || [];
        var estado = { chave: op.ordem ? op.ordem.chave : null, dir: op.ordem ? (op.ordem.dir || 'desc') : 'desc' };

        function valorDe(c, l) { return c.valor ? c.valor(l) : l[c.chave]; }
        function alinhar(c) { return c.alinhar === 'right' ? 'text-right' : (c.alinhar === 'center' ? 'text-center' : 'text-left'); }

        function ordenadas() {
            var copia = linhas.slice();
            var col = colunas.filter(function (c) { return c.chave === estado.chave; })[0];
            if (!col) return copia;
            var sinal = estado.dir === 'asc' ? 1 : -1;
            copia.sort(function (a, b) {
                var va = valorDe(col, a), vb = valorDe(col, b);
                var na = va === null || va === undefined || va === '', nb = vb === null || vb === undefined || vb === '';
                if (na && nb) return 0;
                if (na) return 1;
                if (nb) return -1;
                if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sinal;
                return String(va).localeCompare(String(vb), 'pt-BR', { numeric: true }) * sinal;
            });
            return copia;
        }

        function desenhar() {
            if (!linhas.length) {
                el.innerHTML = '<div class="p-10 text-center text-gray-400"><i class="fa-regular fa-folder-open text-3xl mb-3"></i>' +
                    '<p class="text-sm">' + esc(op.vazio || 'Nenhum registro encontrado para os filtros selecionados.') + '</p></div>';
                return;
            }
            var lista = ordenadas();
            var visiveis = op.limite ? lista.slice(0, op.limite) : lista;
            var cab = colunas.map(function (c, i) {
                var ativo = c.chave === estado.chave;
                var icone = c.semOrdem ? '' : ' <i class="fa-solid ' + (ativo ? (estado.dir === 'asc' ? 'fa-sort-up text-brand-purple' : 'fa-sort-down text-brand-purple') : 'fa-sort text-gray-300') + ' ml-1 nao-imprimir"></i>';
                return '<th data-col="' + i + '" class="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap ' + alinhar(c) + (c.semOrdem ? '' : ' rel-th-ordenavel') + '">' + esc(c.titulo) + icone + '</th>';
            }).join('');
            var corpo = visiveis.map(function (l, n) {
                return '<tr class="border-b border-gray-50 hover:bg-gray-50 transition">' + colunas.map(function (c) {
                    var v = valorDe(c, l);
                    var conteudo = c.render ? c.render(l, n, v) : esc(c.formatar ? c.formatar(v) : (v === undefined || v === null || v === '' ? '-' : v));
                    return '<td class="p-4 text-sm text-gray-700 ' + alinhar(c) + (c.classe ? ' ' + c.classe : '') + '">' + conteudo + '</td>';
                }).join('') + '</tr>';
            }).join('');
            var rodape = '';
            if (op.total !== false && colunas.some(function (c) { return c.total; })) {
                rodape = '<tfoot><tr class="bg-gray-50 border-t border-gray-200">' + colunas.map(function (c, i) {
                    var txt = '';
                    if (c.total === 'soma') {
                        var soma = lista.reduce(function (s, l) { return s + (Number(valorDe(c, l)) || 0); }, 0);
                        txt = (c.formatarTotal || c.formatar || fmt.numero)(soma);
                    } else if (typeof c.total === 'function') {
                        var r = c.total(lista);
                        txt = (c.formatarTotal || c.formatar || String)(r);
                    } else if (typeof c.total === 'string') {
                        txt = c.total;
                    } else if (i === 0) {
                        txt = op.rotuloTotal || 'Total';
                    }
                    return '<td class="p-4 text-sm font-bold text-gray-900 ' + alinhar(c) + '">' + esc(txt) + '</td>';
                }).join('') + '</tr></tfoot>';
            }
            var aviso = op.limite && lista.length > op.limite ? '<p class="px-5 py-3 text-xs text-gray-500 border-t border-gray-100">Mostrando as ' + op.limite + ' primeiras de ' + lista.length + ' linhas. A exportação CSV inclui todas.</p>' : '';
            el.innerHTML = '<div class="overflow-x-auto"><table class="w-full text-left border-collapse"><thead><tr class="bg-white border-b border-gray-100">' + cab + '</tr></thead><tbody>' + corpo + '</tbody>' + rodape + '</table></div>' + aviso;
        }

        /* Clique no cabecalho ordena (alterna asc/desc) */
        el.addEventListener('click', function (e) {
            var th = e.target.closest('th[data-col]');
            if (!th || !el.contains(th)) return;
            var c = colunas[Number(th.getAttribute('data-col'))];
            if (c.semOrdem) return;
            if (estado.chave === c.chave) estado.dir = estado.dir === 'asc' ? 'desc' : 'asc';
            else { estado.chave = c.chave; estado.dir = c.alinhar === 'left' || !c.alinhar ? 'asc' : 'desc'; }
            desenhar();
        });

        desenhar();

        var ctl = {
            titulo: op.titulo || '',
            linhas: function () { return ordenadas(); },
            atualizar: function (novas) { linhas = novas || []; desenhar(); },
            ordenarPor: function (chave, dir) { estado.chave = chave; estado.dir = dir || 'desc'; desenhar(); },
            /* dados prontos para Nexo.exportarCSV (respeita filtros e ordenacao atuais) */
            csv: function () {
                var cols = colunas.filter(function (c) { return !c.semCsv; });
                var lista = ordenadas();
                function num(v) { return typeof v === 'number' ? Math.round(v * 100) / 100 : v; }
                var corpo = lista.map(function (l) {
                    return cols.map(function (c) { return num(c.csv ? c.csv(l) : valorDe(c, l)); });
                });
                if (op.total !== false && cols.some(function (c) { return c.total; })) {
                    corpo.push(cols.map(function (c, i) {
                        if (c.total === 'soma') return num(lista.reduce(function (s, l) { return s + (Number(valorDe(c, l)) || 0); }, 0));
                        if (typeof c.total === 'function') return num(c.total(lista));
                        if (typeof c.total === 'string') return c.total;
                        return i === 0 ? (op.rotuloTotal || 'Total') : '';
                    }));
                }
                return { cabecalho: cols.map(function (c) { return c.titulo; }), linhas: corpo };
            }
        };
        return ctl;
    }

    /* ------------------------------------------------------------------ */
    /* Consultas aos dados reais                                           */
    /* ------------------------------------------------------------------ */
    function mapa(lista) { var m = {}; lista.forEach(function (x) { m[x.id] = x; }); return m; }

    /* Le todas as colecoes uma vez */
    function contexto() {
        var c = {
            produtos: Nexo.db.listar('produtos'), categorias: Nexo.db.listar('categorias'), clientes: Nexo.db.listar('clientes'),
            revendedores: Nexo.db.listar('revendedores'), fornecedores: Nexo.db.listar('fornecedores'), pedidos: Nexo.db.listar('pedidos'),
            movimentacoes: Nexo.db.listar('movimentacoes'), lancamentos: Nexo.db.listar('lancamentos'), usuarios: Nexo.db.listar('usuarios')
        };
        c.prod = mapa(c.produtos); c.cat = mapa(c.categorias); c.cli = mapa(c.clientes); c.rev = mapa(c.revendedores);
        return c;
    }

    /* Nomes de vendedores (quem tem pedido + usuarios com perfil Vendedor) */
    function vendedores(ctx) {
        var nomes = {};
        ctx.pedidos.forEach(function (p) { if (p.vendedor) nomes[p.vendedor] = true; });
        ctx.usuarios.forEach(function (u) { if (u.perfil === 'Vendedor' && u.ativo) nomes[u.nome] = true; });
        return Object.keys(nomes).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
    }

    /* Marcas distintas dos produtos */
    function marcas(ctx) {
        var m = {};
        ctx.produtos.forEach(function (p) { if (p.marca) m[p.marca] = true; });
        return Object.keys(m).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
    }

    /*
     * Pedidos entre duas datas (inclusive). f.status vazio = todos menos cancelados;
     * f.status = 'Cancelado' (ou outro) mostra so aquele status. f.vendedor filtra o vendedor.
     */
    function pedidos(ctx, ini, fim, f) {
        f = f || {};
        return ctx.pedidos.filter(function (p) {
            var d = diaLocal(p.data);
            if (d < ini || d > fim) return false;
            if (f.status) { if (p.status !== f.status) return false; }
            else if (p.status === 'Cancelado') return false;
            if (f.vendedor && p.vendedor !== f.vendedor) return false;
            return true;
        });
    }

    function totalPedido(p) { return Nexo.consultas.totalPedido(p); }

    /*
     * Itens vendidos (uma linha por item de pedido). A receita ja desconta o desconto do pedido
     * rateado entre os itens (nao inclui frete). f.categoriaId e f.marca filtram os itens.
     */
    function itens(ctx, listaPedidos, f) {
        f = f || {};
        var saida = [];
        listaPedidos.forEach(function (p) {
            var sub = (p.itens || []).reduce(function (s, it) { return s + (Number(it.quantidade) || 0) * (Number(it.precoUnitario) || 0); }, 0);
            var fator = sub > 0 ? Math.max(0, sub - (Number(p.desconto) || 0)) / sub : 1;
            (p.itens || []).forEach(function (it) {
                var pr = ctx.prod[it.produtoId] || {};
                var catId = pr.categoriaId || '';
                if (f.categoriaId && catId !== f.categoriaId) return;
                if (f.marca && (pr.marca || '') !== f.marca) return;
                var q = Number(it.quantidade) || 0;
                saida.push({
                    pedido: p, dia: diaLocal(p.data), produtoId: it.produtoId,
                    nome: it.nome || pr.nome || 'Produto removido',
                    categoriaId: catId, categoria: (ctx.cat[catId] || {}).nome || 'Sem categoria',
                    marca: pr.marca || 'Sem marca', quantidade: q,
                    receita: q * (Number(it.precoUnitario) || 0) * fator,
                    custo: q * (Number(it.custoUnitario) || 0)
                });
            });
        });
        return saida;
    }

    /*
     * Agrupa itens vendidos por um campo ('categoria', 'marca', 'produtoId').
     * Retorna linhas {chave, nome, unidades, pedidos, faturamento, custo, lucro, margem, part, item}
     */
    function agruparItens(lista, campo) {
        var g = {}, ordem = [], total = 0;
        lista.forEach(function (it) {
            var k = it[campo];
            if (!g[k]) { g[k] = { chave: k, nome: campo === 'produtoId' ? it.nome : k, unidades: 0, faturamento: 0, custo: 0, pedidosIds: {}, item: it }; ordem.push(k); }
            var x = g[k];
            x.unidades += it.quantidade; x.faturamento += it.receita; x.custo += it.custo; x.pedidosIds[it.pedido.id] = true;
            total += it.receita;
        });
        return ordem.map(function (k) {
            var x = g[k];
            x.pedidos = Object.keys(x.pedidosIds).length;
            x.lucro = x.faturamento - x.custo;
            x.margem = x.faturamento ? x.lucro / x.faturamento * 100 : 0;
            x.part = total ? x.faturamento / total * 100 : 0;
            return x;
        });
    }

    /* Totais de vendas de um periodo: faturamento (total dos pedidos), CMV, lucro bruto, ticket */
    function resumo(ctx, ini, fim, f) {
        var lista = pedidos(ctx, ini, fim, f);
        var fat = 0, cmv = 0, qtdItens = 0;
        lista.forEach(function (p) {
            fat += totalPedido(p);
            (p.itens || []).forEach(function (it) {
                cmv += (Number(it.quantidade) || 0) * (Number(it.custoUnitario) || 0);
                qtdItens += Number(it.quantidade) || 0;
            });
        });
        return { pedidos: lista.length, lista: lista, faturamento: fat, cmv: cmv, lucroBruto: fat - cmv, itens: qtdItens, ticket: lista.length ? fat / lista.length : 0 };
    }

    /* Agrupamento automatico conforme o tamanho do periodo */
    function agrupamentoAuto(dias) { return dias <= 31 ? 'dia' : (dias <= 120 ? 'semana' : 'mes'); }

    /*
     * Divide [ini, fim] em baldes por 'dia' | 'semana' | 'mes'.
     * Retorna {buckets:[{rotulo, rotuloLongo, ini, fim}], indiceDe(dia)}.
     */
    function serie(ini, fim, agrup) {
        var b = [];
        var s, e;
        if (agrup === 'mes') {
            s = inicioMes(ini);
            while (s <= fim) {
                b.push({ rotulo: nomeMesCurto(s), rotuloLongo: nomeMesLongo(s), chave: s.slice(0, 7), ini: max(s, ini), fim: min(fimMes(s), fim) });
                s = somarMeses(s, 1);
            }
        } else if (agrup === 'semana') {
            s = ini;
            while (s <= fim) {
                e = min(somarDias(s, 6), fim);
                b.push({ rotulo: ddmm(s), rotuloLongo: fmt.data(s) + ' a ' + fmt.data(e), ini: s, fim: e });
                s = somarDias(s, 7);
            }
        } else {
            s = ini;
            while (s <= fim) {
                b.push({ rotulo: ddmm(s), rotuloLongo: fmt.data(s), ini: s, fim: s });
                s = somarDias(s, 1);
            }
        }
        return {
            buckets: b,
            indiceDe: function (dia) {
                if (dia < ini || dia > fim) return -1;
                if (agrup === 'mes') { for (var i = 0; i < b.length; i++) { if (dia >= b[i].ini && dia <= b[i].fim) return i; } return -1; }
                return Math.floor(diasEntre(ini, dia) / (agrup === 'semana' ? 7 : 1));
            }
        };
    }

    /* Historico de movimentacoes por produto (ordenado) para calcular saldos em qualquer data */
    function movimentosPorProduto(ctx) {
        var m = {};
        ctx.movimentacoes.forEach(function (mv) {
            (m[mv.produtoId] = m[mv.produtoId] || []).push({ t: new Date(mv.data).getTime(), saldoAnterior: mv.saldoAnterior, saldoAtual: mv.saldoAtual });
        });
        Object.keys(m).forEach(function (k) { m[k].sort(function (a, b) { return a.t - b.t; }); });
        return m;
    }

    /* Saldo do produto ao fim do dia indicado, a partir do historico de movimentacoes */
    function saldoEm(movs, produto, dia) {
        var lista = movs[produto.id] || [];
        if (!lista.length) return Number(produto.estoque) || 0;
        var limite = new Date(dia + 'T23:59:59.999').getTime();
        var saldo = lista[0].saldoAnterior || 0;
        for (var i = 0; i < lista.length; i++) {
            if (lista[i].t <= limite) saldo = lista[i].saldoAtual; else break;
        }
        return saldo;
    }

    /* ------------------------------------------------------------------ */
    /* Utilitarios                                                         */
    /* ------------------------------------------------------------------ */
    function somar(lista, fn) { return lista.reduce(function (s, x) { return s + (Number(fn(x)) || 0); }, 0); }

    function iniciais(nome) {
        var p = String(nome || '?').trim().split(/\s+/);
        return esc((p[0].charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : '')).toUpperCase());
    }

    /* Monta o layout (login + permissao) e chama a funcao da tela */
    function iniciar(fn) {
        injetarEstilos();
        if (Nexo.layout.montar('relatorios')) fn();
    }

    global.Rel = {
        COMISSAO_PERCENTUAL: COMISSAO_PERCENTUAL, PALETA: PALETA, MESES_CURTOS: MESES_CURTOS,
        iniciar: iniciar, filtros: filtros, cabecalho: cabecalho, kpis: kpis, variacao: variacao,
        grafico: grafico, tabela: tabela, ligarBotoes: ligarBotoes, exportar: exportar,
        contexto: contexto, vendedores: vendedores, marcas: marcas, pedidos: pedidos, itens: itens, agruparItens: agruparItens, resumo: resumo,
        totalPedido: totalPedido, agrupamentoAuto: agrupamentoAuto, serie: serie,
        movimentosPorProduto: movimentosPorProduto, saldoEm: saldoEm, somar: somar, iniciais: iniciais,
        resolverPeriodo: resolverPeriodo,
        data: {
            hoje: hoje, somarDias: somarDias, diasEntre: diasEntre, inicioMes: inicioMes, fimMes: fimMes, somarMeses: somarMeses,
            diaLocal: diaLocal, nomeMesCurto: nomeMesCurto, nomeMesLongo: nomeMesLongo, ddmm: ddmm
        }
    };
})(window);
