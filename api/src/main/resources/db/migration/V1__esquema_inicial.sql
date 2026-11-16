-- =====================================================================
-- NEXO ERP · Esquema inicial (PostgreSQL)
-- Modelo físico. Modelos conceitual e lógico em docs/banco-de-dados.md
-- e em docs/brmodelo/ (arquivos do brModelo).
--
-- Padrão de nomes: tabelas no singular; colunas com prefixo mnemônico
-- e sufixo com o nome da tabela (ex.: nm_produto, vl_preco_produto).
--   id_  identificador (chave primária; na chave estrangeira mantém o nome da PK de origem)
--   cd_  código ou documento (SKU, CPF/CNPJ, CEP, telefone)
--   nm_  nome ou texto curto        ds_  descrição ou texto longo
--   nr_  número                      sg_  sigla (UF, PF/PJ)
--   vl_  valor em reais              pc_  percentual
--   qt_  quantidade                  dt_  data ou data e hora
--   tp_  tipo (lista fechada)        fl_  situação ou flag (status, ativo)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Empresa (uma linha só) e configurações
-- ---------------------------------------------------------------------
CREATE TABLE empresa (
    id_empresa                      SMALLINT     PRIMARY KEY DEFAULT 1 CHECK (id_empresa = 1),
    nm_razao_social_empresa         VARCHAR(150) NOT NULL,
    nm_fantasia_empresa             VARCHAR(150),
    cd_cnpj_empresa                 VARCHAR(18)  NOT NULL,
    cd_inscricao_estadual_empresa   VARCHAR(20),
    cd_inscricao_municipal_empresa  VARCHAR(20),
    nm_regime_tributario_empresa    VARCHAR(40),
    ds_cnae_empresa                 VARCHAR(150),
    dt_abertura_empresa             DATE,
    nm_email_empresa                VARCHAR(120),
    nm_email_financeiro_empresa     VARCHAR(120),
    cd_telefone_empresa             VARCHAR(20),
    cd_whatsapp_empresa             VARCHAR(20),
    nm_site_empresa                 VARCHAR(120),
    nm_responsavel_empresa          VARCHAR(100),
    cd_cep_empresa                  VARCHAR(9),
    nm_logradouro_empresa           VARCHAR(150),
    nr_endereco_empresa             VARCHAR(10),
    ds_complemento_empresa          VARCHAR(60),
    nm_bairro_empresa               VARCHAR(80),
    nm_cidade_empresa               VARCHAR(80),
    sg_uf_empresa                   CHAR(2)
);

CREATE TABLE configuracao (
    nm_chave_configuracao  VARCHAR(40) PRIMARY KEY,   -- notificacoes, preferencias, geral
    ds_valor_configuracao  JSONB       NOT NULL
);

-- ---------------------------------------------------------------------
-- Catálogo: categoria, marca, fornecedor, produto
-- ---------------------------------------------------------------------
CREATE TABLE categoria (
    id_categoria        BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nm_categoria        VARCHAR(60) NOT NULL UNIQUE,
    nm_icone_categoria  VARCHAR(40)
);

CREATE TABLE marca (
    id_marca  BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nm_marca  VARCHAR(60) NOT NULL UNIQUE
);

CREATE TABLE fornecedor (
    id_fornecedor                     BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nm_razao_social_fornecedor        VARCHAR(150) NOT NULL,
    nm_fantasia_fornecedor            VARCHAR(150),
    cd_cnpj_fornecedor                VARCHAR(18)  NOT NULL UNIQUE,
    nm_contato_fornecedor             VARCHAR(100),
    nm_email_fornecedor               VARCHAR(120),
    cd_telefone_fornecedor            VARCHAR(20),
    cd_cep_fornecedor                 VARCHAR(9),
    nm_logradouro_fornecedor          VARCHAR(150),
    nr_endereco_fornecedor            VARCHAR(10),
    ds_complemento_fornecedor         VARCHAR(60),
    nm_bairro_fornecedor              VARCHAR(80),
    nm_cidade_fornecedor              VARCHAR(80),
    sg_uf_fornecedor                  CHAR(2),
    qt_prazo_entrega_fornecedor       INTEGER      CHECK (qt_prazo_entrega_fornecedor >= 0),   -- em dias
    ds_condicao_pagamento_fornecedor  VARCHAR(40),
    fl_status_fornecedor              VARCHAR(10)  NOT NULL DEFAULT 'Ativo' CHECK (fl_status_fornecedor IN ('Ativo', 'Inativo')),
    ds_observacao_fornecedor          TEXT,
    dt_criacao_fornecedor             TIMESTAMPTZ  NOT NULL DEFAULT now(),
    dt_atualizacao_fornecedor         TIMESTAMPTZ
);

-- Um fornecedor trabalha com várias marcas e uma marca pode vir de vários fornecedores (N:N)
CREATE TABLE fornecedor_marca (
    id_fornecedor  BIGINT NOT NULL REFERENCES fornecedor (id_fornecedor) ON DELETE CASCADE,
    id_marca       BIGINT NOT NULL REFERENCES marca (id_marca),
    PRIMARY KEY (id_fornecedor, id_marca)
);

CREATE TABLE produto (
    id_produto                 BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cd_sku_produto             VARCHAR(30)   NOT NULL UNIQUE,
    cd_barras_produto          VARCHAR(14)   UNIQUE,
    nm_produto                 VARCHAR(150)  NOT NULL,
    ds_produto                 TEXT,
    id_categoria               BIGINT        NOT NULL REFERENCES categoria (id_categoria),
    id_marca                   BIGINT        NOT NULL REFERENCES marca (id_marca),
    id_fornecedor              BIGINT        REFERENCES fornecedor (id_fornecedor),
    ds_volume_produto          VARCHAR(20),
    vl_preco_produto           NUMERIC(12,2) NOT NULL CHECK (vl_preco_produto >= 0),
    vl_custo_produto           NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (vl_custo_produto >= 0),
    qt_estoque_produto         INTEGER       NOT NULL DEFAULT 0,   -- soma dos saldos dos lotes (atualizada a cada movimentação)
    qt_estoque_minimo_produto  INTEGER       NOT NULL DEFAULT 0 CHECK (qt_estoque_minimo_produto >= 0),
    fl_status_produto          VARCHAR(10)   NOT NULL DEFAULT 'Ativo' CHECK (fl_status_produto IN ('Ativo', 'Inativo')),
    dt_criacao_produto         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    dt_atualizacao_produto     TIMESTAMPTZ
);
CREATE INDEX ix_produto_categoria ON produto (id_categoria);
CREATE INDEX ix_produto_marca ON produto (id_marca);

-- ---------------------------------------------------------------------
-- Revendedor e cliente
-- ---------------------------------------------------------------------
CREATE TABLE revendedor (
    id_revendedor                     BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nm_revendedor                     VARCHAR(150)  NOT NULL,
    cd_documento_revendedor           VARCHAR(18)   NOT NULL UNIQUE,      -- CPF ou CNPJ
    nm_email_revendedor               VARCHAR(120),
    cd_telefone_revendedor            VARCHAR(20),
    cd_cep_revendedor                 VARCHAR(9),
    nm_logradouro_revendedor          VARCHAR(150),
    nr_endereco_revendedor            VARCHAR(10),
    ds_complemento_revendedor         VARCHAR(60),
    nm_bairro_revendedor              VARCHAR(80),
    nm_cidade_revendedor              VARCHAR(80),
    sg_uf_revendedor                  CHAR(2),
    pc_desconto_revendedor            NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (pc_desconto_revendedor BETWEEN 0 AND 100),
    pc_comissao_revendedor            NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (pc_comissao_revendedor BETWEEN 0 AND 100),
    ds_condicao_pagamento_revendedor  VARCHAR(40),
    vl_limite_credito_revendedor      NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (vl_limite_credito_revendedor >= 0),
    fl_status_revendedor              VARCHAR(10)   NOT NULL DEFAULT 'Ativo' CHECK (fl_status_revendedor IN ('Ativo', 'Inativo')),
    ds_observacao_revendedor          TEXT,
    dt_criacao_revendedor             TIMESTAMPTZ   NOT NULL DEFAULT now(),
    dt_atualizacao_revendedor         TIMESTAMPTZ
);

-- ---------------------------------------------------------------------
-- Usuários e permissões
-- ---------------------------------------------------------------------
CREATE TABLE usuario (
    id_usuario                BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nm_usuario                VARCHAR(100) NOT NULL,
    nm_email_usuario          VARCHAR(120) NOT NULL UNIQUE,
    ds_senha_hash_usuario     VARCHAR(100) NOT NULL,     -- BCrypt, nunca a senha pura
    nm_perfil_usuario         VARCHAR(20)  NOT NULL
                              CHECK (nm_perfil_usuario IN ('Administrador', 'Revendedor', 'Estoquista', 'Financeiro')),
    id_revendedor             BIGINT       UNIQUE REFERENCES revendedor (id_revendedor),  -- conta do revendedor (1:1)
    fl_ativo_usuario          BOOLEAN      NOT NULL DEFAULT TRUE,
    dt_ultimo_acesso_usuario  TIMESTAMPTZ,
    dt_criacao_usuario        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    dt_atualizacao_usuario    TIMESTAMPTZ,
    -- perfil Revendedor exige o vínculo com o cadastro do revendedor; os outros perfis não têm vínculo
    CHECK ((nm_perfil_usuario = 'Revendedor') = (id_revendedor IS NOT NULL))
);

-- Quais módulos cada perfil (menos o Administrador, que acessa tudo) pode abrir.
-- Revendedores fica de fora por regra: é exclusivo do Administrador.
CREATE TABLE permissao_perfil (
    nm_perfil_permissao  VARCHAR(20) NOT NULL CHECK (nm_perfil_permissao IN ('Revendedor', 'Estoquista', 'Financeiro')),
    nm_modulo_permissao  VARCHAR(20) NOT NULL
                         CHECK (nm_modulo_permissao IN ('inicio', 'empresa', 'pedidos', 'produtos', 'estoque', 'fornecedores',
                                                        'clientes', 'financeiro', 'relatorios', 'configuracoes')),
    PRIMARY KEY (nm_perfil_permissao, nm_modulo_permissao)
);

CREATE TABLE cliente (
    id_cliente               BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sg_tipo_pessoa_cliente   CHAR(2)      NOT NULL CHECK (sg_tipo_pessoa_cliente IN ('PF', 'PJ')),
    nm_cliente               VARCHAR(150) NOT NULL,
    nm_razao_social_cliente  VARCHAR(150),                        -- só PJ
    cd_documento_cliente     VARCHAR(18)  NOT NULL,               -- CPF (PF) ou CNPJ (PJ)
    nm_email_cliente         VARCHAR(120),
    cd_telefone_cliente      VARCHAR(20),
    dt_nascimento_cliente    DATE,                                -- só PF
    nm_responsavel_cliente   VARCHAR(100),                        -- só PJ
    cd_cep_cliente           VARCHAR(9),
    nm_logradouro_cliente    VARCHAR(150),
    nr_endereco_cliente      VARCHAR(10),
    ds_complemento_cliente   VARCHAR(60),
    nm_bairro_cliente        VARCHAR(80),
    nm_cidade_cliente        VARCHAR(80),
    sg_uf_cliente            CHAR(2),
    id_revendedor            BIGINT       NOT NULL REFERENCES revendedor (id_revendedor),  -- carteira: o cliente pertence a 1 revendedor
    fl_status_cliente        VARCHAR(10)  NOT NULL DEFAULT 'Ativo' CHECK (fl_status_cliente IN ('Ativo', 'Inativo')),
    ds_observacao_cliente    TEXT,
    dt_criacao_cliente       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    dt_atualizacao_cliente   TIMESTAMPTZ,
    UNIQUE (id_revendedor, cd_documento_cliente)   -- o mesmo CPF/CNPJ pode estar na carteira de revendedores diferentes
);

CREATE TABLE comentario_cliente (
    id_comentario  BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_cliente     BIGINT      NOT NULL REFERENCES cliente (id_cliente) ON DELETE CASCADE,
    nm_autor_comentario  VARCHAR(100),   -- nome de quem escreveu (registro histórico)
    ds_comentario  TEXT        NOT NULL,
    dt_comentario  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Vendas: o cliente pede ao revendedor por fora do sistema (WhatsApp etc.)
-- e o revendedor lança o pedido no site, escolhendo o cliente e os produtos
-- ---------------------------------------------------------------------
CREATE TABLE pedido (
    id_pedido                   BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nr_pedido                   INTEGER       NOT NULL UNIQUE,
    dt_pedido                   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    id_cliente                  BIGINT        NOT NULL REFERENCES cliente (id_cliente),
    id_revendedor               BIGINT        NOT NULL REFERENCES revendedor (id_revendedor),  -- quem lançou o pedido
    fl_status_pedido            VARCHAR(20)   NOT NULL DEFAULT 'Novo'
                                CHECK (fl_status_pedido IN ('Novo', 'Em separação', 'Enviado', 'Entregue', 'Cancelado')),
    vl_subtotal_pedido          NUMERIC(12,2) NOT NULL DEFAULT 0,
    vl_desconto_pedido          NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (vl_desconto_pedido >= 0),
    vl_frete_pedido             NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (vl_frete_pedido >= 0),
    vl_total_pedido             NUMERIC(12,2) NOT NULL DEFAULT 0,
    tp_forma_pagamento_pedido   VARCHAR(20)   NOT NULL
                                CHECK (tp_forma_pagamento_pedido IN ('Pix', 'Cartão de crédito', 'Cartão de débito', 'Boleto', 'Dinheiro')),
    qt_parcelas_pedido          SMALLINT      NOT NULL DEFAULT 1 CHECK (qt_parcelas_pedido BETWEEN 1 AND 24),
    tp_entrega_pedido           VARCHAR(20)   NOT NULL DEFAULT 'Transportadora'
                                CHECK (tp_entrega_pedido IN ('Transportadora', 'Retirada na loja')),
    nm_transportadora_pedido    VARCHAR(60),
    ds_endereco_entrega_pedido  VARCHAR(250),
    cd_rastreio_pedido          VARCHAR(40),
    dt_previsao_entrega_pedido  DATE,
    ds_observacao_pedido        TEXT,
    dt_criacao_pedido           TIMESTAMPTZ   NOT NULL DEFAULT now(),
    dt_atualizacao_pedido       TIMESTAMPTZ
);
CREATE INDEX ix_pedido_cliente ON pedido (id_cliente);
CREATE INDEX ix_pedido_data ON pedido (dt_pedido);

-- Itens guardam preço e custo do momento da venda (o preço do produto pode mudar depois)
CREATE TABLE item_pedido (
    id_pedido                BIGINT        NOT NULL REFERENCES pedido (id_pedido) ON DELETE CASCADE,
    id_produto               BIGINT        NOT NULL REFERENCES produto (id_produto),
    qt_item_pedido           INTEGER       NOT NULL CHECK (qt_item_pedido > 0),
    vl_unitario_item_pedido  NUMERIC(12,2) NOT NULL CHECK (vl_unitario_item_pedido >= 0),
    vl_custo_item_pedido     NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (vl_custo_item_pedido >= 0),
    PRIMARY KEY (id_pedido, id_produto)
);

CREATE TABLE historico_pedido (
    id_historico_pedido             BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_pedido                       BIGINT      NOT NULL REFERENCES pedido (id_pedido) ON DELETE CASCADE,
    fl_status_historico_pedido      VARCHAR(20) NOT NULL,
    nm_usuario_historico_pedido     VARCHAR(100),                -- nome de quem mudou o status (registro histórico)
    ds_observacao_historico_pedido  TEXT,
    dt_historico_pedido             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Compras de fornecedores
-- ---------------------------------------------------------------------
CREATE TABLE compra (
    id_compra              BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nr_compra              INTEGER       NOT NULL UNIQUE,
    id_fornecedor          BIGINT        NOT NULL REFERENCES fornecedor (id_fornecedor),
    dt_compra              TIMESTAMPTZ   NOT NULL DEFAULT now(),
    cd_nota_fiscal_compra  VARCHAR(30),
    vl_total_compra        NUMERIC(12,2) NOT NULL DEFAULT 0,
    fl_status_compra       VARCHAR(10)   NOT NULL DEFAULT 'Pendente' CHECK (fl_status_compra IN ('Pendente', 'Recebida')),
    dt_recebimento_compra  TIMESTAMPTZ,
    dt_criacao_compra      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE item_compra (
    id_compra             BIGINT        NOT NULL REFERENCES compra (id_compra) ON DELETE CASCADE,
    id_produto            BIGINT        NOT NULL REFERENCES produto (id_produto),
    qt_item_compra        INTEGER       NOT NULL CHECK (qt_item_compra > 0),
    vl_custo_item_compra  NUMERIC(12,2) NOT NULL CHECK (vl_custo_item_compra >= 0),
    PRIMARY KEY (id_compra, id_produto)
);

-- ---------------------------------------------------------------------
-- Lotes: cada entrada de mercadoria forma um lote com validade e saldo próprios.
-- A venda baixa primeiro o lote que vence antes (FEFO) e o pedido é bloqueado
-- quando a soma dos lotes válidos não cobre a quantidade.
-- ---------------------------------------------------------------------
CREATE TABLE lote (
    id_lote               BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_produto            BIGINT      NOT NULL REFERENCES produto (id_produto),
    cd_lote               VARCHAR(30) NOT NULL,                  -- código impresso pelo fabricante
    dt_fabricacao_lote    DATE,
    dt_validade_lote      DATE        NOT NULL,
    qt_inicial_lote       INTEGER     NOT NULL CHECK (qt_inicial_lote > 0),
    qt_saldo_lote         INTEGER     NOT NULL CHECK (qt_saldo_lote >= 0),
    dt_entrada_lote       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (id_produto, cd_lote),
    CHECK (qt_saldo_lote <= qt_inicial_lote)
);
CREATE INDEX ix_lote_validade ON lote (id_produto, dt_validade_lote);

-- ---------------------------------------------------------------------
-- Estoque: toda entrada, saída ou ajuste vira uma movimentação
-- ---------------------------------------------------------------------
CREATE TABLE movimentacao_estoque (
    id_movimentacao                 BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tp_movimentacao                 VARCHAR(10) NOT NULL CHECK (tp_movimentacao IN ('Entrada', 'Saída', 'Ajuste')),
    qt_movimentacao                 INTEGER     NOT NULL,        -- no Ajuste pode ser negativa (diferença)
    qt_saldo_anterior_movimentacao  INTEGER     NOT NULL,
    qt_saldo_atual_movimentacao     INTEGER     NOT NULL,
    ds_motivo_movimentacao          VARCHAR(120),
    ds_referencia_movimentacao      VARCHAR(60),                 -- ex.: "Pedido #1023", "Compra #512"
    id_lote                         BIGINT      NOT NULL REFERENCES lote (id_lote),  -- lote movimentado (o produto vem do lote)
    id_usuario                      BIGINT      REFERENCES usuario (id_usuario),
    dt_movimentacao                 TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_movimentacao_lote ON movimentacao_estoque (id_lote, dt_movimentacao);

-- ---------------------------------------------------------------------
-- Financeiro: contas a receber (Receita) e a pagar (Despesa)
-- ---------------------------------------------------------------------
CREATE TABLE lancamento (
    id_lancamento                  BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tp_lancamento                  VARCHAR(10)   NOT NULL CHECK (tp_lancamento IN ('Receita', 'Despesa')),
    ds_lancamento                  VARCHAR(200)  NOT NULL,
    nm_categoria_lancamento        VARCHAR(60)   NOT NULL,
    vl_lancamento                  NUMERIC(12,2) NOT NULL CHECK (vl_lancamento > 0),
    dt_vencimento_lancamento       DATE          NOT NULL,
    dt_pagamento_lancamento        DATE,                          -- NULL = em aberto
    tp_forma_pagamento_lancamento  VARCHAR(20),
    id_pedido                      BIGINT        UNIQUE REFERENCES pedido (id_pedido),  -- receita gerada por um pedido (1:1)
    id_compra                      BIGINT        UNIQUE REFERENCES compra (id_compra),  -- despesa gerada por uma compra (1:1)
    fl_status_lancamento           VARCHAR(10)   NOT NULL DEFAULT 'Ativo' CHECK (fl_status_lancamento IN ('Ativo', 'Cancelado')),
    dt_criacao_lancamento          TIMESTAMPTZ   NOT NULL DEFAULT now(),
    dt_atualizacao_lancamento      TIMESTAMPTZ,
    CHECK (NOT (id_pedido IS NOT NULL AND id_compra IS NOT NULL))
);
CREATE INDEX ix_lancamento_vencimento ON lancamento (dt_vencimento_lancamento);

-- ---------------------------------------------------------------------
-- Log de atividades (alimenta "Atividades recentes" no Início)
-- ---------------------------------------------------------------------
CREATE TABLE atividade (
    id_atividade       BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tp_atividade       VARCHAR(20)  NOT NULL,
    ds_atividade       VARCHAR(250) NOT NULL,
    ds_link_atividade  VARCHAR(150),
    id_usuario         BIGINT       REFERENCES usuario (id_usuario),
    dt_atividade       TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX ix_atividade_data ON atividade (dt_atividade DESC);
