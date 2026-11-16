-- =====================================================================
-- NEXO ERP · Esquema inicial (PostgreSQL)
-- Modelo físico gerado a partir do modelo lógico em docs/banco-de-dados.md
-- Convenções: tabelas no singular, snake_case, chave primária "id",
-- chave estrangeira "<tabela>_id", valores monetários em NUMERIC(12,2).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Empresa (uma linha só) e configurações
-- ---------------------------------------------------------------------
CREATE TABLE empresa (
    id                   SMALLINT     PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    razao_social         VARCHAR(150) NOT NULL,
    nome_fantasia        VARCHAR(150),
    cnpj                 VARCHAR(18)  NOT NULL,
    inscricao_estadual   VARCHAR(20),
    inscricao_municipal  VARCHAR(20),
    regime_tributario    VARCHAR(40),
    cnae                 VARCHAR(150),
    data_abertura        DATE,
    email                VARCHAR(120),
    email_financeiro     VARCHAR(120),
    telefone             VARCHAR(20),
    whatsapp             VARCHAR(20),
    site                 VARCHAR(120),
    responsavel          VARCHAR(100),
    cep                  VARCHAR(9),
    logradouro           VARCHAR(150),
    numero               VARCHAR(10),
    complemento          VARCHAR(60),
    bairro               VARCHAR(80),
    cidade               VARCHAR(80),
    uf                   CHAR(2)
);

CREATE TABLE configuracao (
    chave  VARCHAR(40) PRIMARY KEY,          -- notificacoes, preferencias, geral
    valor  JSONB       NOT NULL
);

-- ---------------------------------------------------------------------
-- Usuários e permissões
-- ---------------------------------------------------------------------
CREATE TABLE usuario (
    id             BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome           VARCHAR(100) NOT NULL,
    email          VARCHAR(120) NOT NULL UNIQUE,
    senha_hash     VARCHAR(100) NOT NULL,     -- BCrypt, nunca a senha pura
    perfil         VARCHAR(20)  NOT NULL CHECK (perfil IN ('Administrador', 'Vendedor', 'Estoquista', 'Financeiro')),
    ativo          BOOLEAN      NOT NULL DEFAULT TRUE,
    ultimo_acesso  TIMESTAMPTZ,
    criado_em      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    atualizado_em  TIMESTAMPTZ
);

-- Quais módulos cada perfil (menos o Administrador, que acessa tudo) pode abrir.
-- Revendedores fica de fora por regra: é exclusivo do Administrador.
CREATE TABLE permissao_perfil (
    perfil  VARCHAR(20) NOT NULL CHECK (perfil IN ('Vendedor', 'Estoquista', 'Financeiro')),
    modulo  VARCHAR(20) NOT NULL CHECK (modulo IN ('inicio', 'empresa', 'pedidos', 'produtos', 'estoque', 'fornecedores',
                                                   'clientes', 'financeiro', 'relatorios', 'configuracoes')),
    PRIMARY KEY (perfil, modulo)
);

-- ---------------------------------------------------------------------
-- Catálogo: categoria, marca, fornecedor, produto
-- ---------------------------------------------------------------------
CREATE TABLE categoria (
    id     BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome   VARCHAR(60) NOT NULL UNIQUE,
    icone  VARCHAR(40)
);

CREATE TABLE marca (
    id    BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome  VARCHAR(60) NOT NULL UNIQUE
);

CREATE TABLE fornecedor (
    id                  BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    razao_social        VARCHAR(150) NOT NULL,
    nome_fantasia       VARCHAR(150),
    cnpj                VARCHAR(18)  NOT NULL UNIQUE,
    contato             VARCHAR(100),
    email               VARCHAR(120),
    telefone            VARCHAR(20),
    cep                 VARCHAR(9),
    logradouro          VARCHAR(150),
    numero              VARCHAR(10),
    complemento         VARCHAR(60),
    bairro              VARCHAR(80),
    cidade              VARCHAR(80),
    uf                  CHAR(2),
    prazo_entrega_dias  INTEGER      CHECK (prazo_entrega_dias >= 0),
    condicao_pagamento  VARCHAR(40),
    status              VARCHAR(10)  NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
    observacoes         TEXT,
    criado_em           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    atualizado_em       TIMESTAMPTZ
);

-- Um fornecedor trabalha com várias marcas e uma marca pode vir de vários fornecedores (N:N)
CREATE TABLE fornecedor_marca (
    fornecedor_id  BIGINT NOT NULL REFERENCES fornecedor (id) ON DELETE CASCADE,
    marca_id       BIGINT NOT NULL REFERENCES marca (id),
    PRIMARY KEY (fornecedor_id, marca_id)
);

CREATE TABLE produto (
    id              BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sku             VARCHAR(30)   NOT NULL UNIQUE,
    codigo_barras   VARCHAR(14)   UNIQUE,
    nome            VARCHAR(150)  NOT NULL,
    descricao       TEXT,
    categoria_id    BIGINT        NOT NULL REFERENCES categoria (id),
    marca_id        BIGINT        NOT NULL REFERENCES marca (id),
    fornecedor_id   BIGINT        REFERENCES fornecedor (id),
    volume          VARCHAR(20),
    preco           NUMERIC(12,2) NOT NULL CHECK (preco >= 0),
    custo           NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (custo >= 0),
    estoque         INTEGER       NOT NULL DEFAULT 0,
    estoque_minimo  INTEGER       NOT NULL DEFAULT 0 CHECK (estoque_minimo >= 0),
    validade        DATE,
    lote            VARCHAR(20),
    status          VARCHAR(10)   NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
    criado_em       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    atualizado_em   TIMESTAMPTZ
);
CREATE INDEX ix_produto_categoria ON produto (categoria_id);
CREATE INDEX ix_produto_marca ON produto (marca_id);

-- ---------------------------------------------------------------------
-- Revendedor e cliente
-- ---------------------------------------------------------------------
CREATE TABLE revendedor (
    id                  BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome                VARCHAR(150)  NOT NULL,
    documento           VARCHAR(18)   NOT NULL UNIQUE,      -- CPF ou CNPJ
    email               VARCHAR(120),
    telefone            VARCHAR(20),
    cep                 VARCHAR(9),
    logradouro          VARCHAR(150),
    numero              VARCHAR(10),
    complemento         VARCHAR(60),
    bairro              VARCHAR(80),
    cidade              VARCHAR(80),
    uf                  CHAR(2),
    desconto_pct        NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (desconto_pct BETWEEN 0 AND 100),
    comissao_pct        NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (comissao_pct BETWEEN 0 AND 100),
    condicao_pagamento  VARCHAR(40),
    limite_credito      NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (limite_credito >= 0),
    status              VARCHAR(10)   NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
    observacoes         TEXT,
    criado_em           TIMESTAMPTZ   NOT NULL DEFAULT now(),
    atualizado_em       TIMESTAMPTZ
);

CREATE TABLE cliente (
    id               BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tipo             CHAR(2)      NOT NULL CHECK (tipo IN ('PF', 'PJ')),
    nome             VARCHAR(150) NOT NULL,
    razao_social     VARCHAR(150),                          -- só PJ
    documento        VARCHAR(18)  NOT NULL UNIQUE,          -- CPF (PF) ou CNPJ (PJ)
    email            VARCHAR(120),
    telefone         VARCHAR(20),
    data_nascimento  DATE,                                  -- só PF
    responsavel      VARCHAR(100),                          -- só PJ
    cep              VARCHAR(9),
    logradouro       VARCHAR(150),
    numero           VARCHAR(10),
    complemento      VARCHAR(60),
    bairro           VARCHAR(80),
    cidade           VARCHAR(80),
    uf               CHAR(2),
    revendedor_id    BIGINT       REFERENCES revendedor (id), -- cada cliente tem no máximo 1 revendedor
    status           VARCHAR(10)  NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
    observacoes      TEXT,
    criado_em        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    atualizado_em    TIMESTAMPTZ
);
CREATE INDEX ix_cliente_revendedor ON cliente (revendedor_id);

CREATE TABLE comentario_cliente (
    id          BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cliente_id  BIGINT      NOT NULL REFERENCES cliente (id) ON DELETE CASCADE,
    usuario_id  BIGINT      REFERENCES usuario (id),
    texto       TEXT        NOT NULL,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Vendas: pedido, itens e histórico de status
-- ---------------------------------------------------------------------
CREATE TABLE pedido (
    id                BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    numero            INTEGER       NOT NULL UNIQUE,
    data              TIMESTAMPTZ   NOT NULL DEFAULT now(),
    cliente_id        BIGINT        NOT NULL REFERENCES cliente (id),
    revendedor_id     BIGINT        REFERENCES revendedor (id),
    vendedor_id       BIGINT        REFERENCES usuario (id),
    status            VARCHAR(20)   NOT NULL DEFAULT 'Novo'
                      CHECK (status IN ('Novo', 'Em separação', 'Enviado', 'Entregue', 'Cancelado')),
    subtotal          NUMERIC(12,2) NOT NULL DEFAULT 0,
    desconto          NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (desconto >= 0),
    frete             NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (frete >= 0),
    total             NUMERIC(12,2) NOT NULL DEFAULT 0,
    forma_pagamento   VARCHAR(20)   NOT NULL
                      CHECK (forma_pagamento IN ('Pix', 'Cartão de crédito', 'Cartão de débito', 'Boleto', 'Dinheiro')),
    parcelas          SMALLINT      NOT NULL DEFAULT 1 CHECK (parcelas BETWEEN 1 AND 24),
    tipo_entrega      VARCHAR(20)   NOT NULL DEFAULT 'Transportadora' CHECK (tipo_entrega IN ('Transportadora', 'Retirada na loja')),
    transportadora    VARCHAR(60),
    endereco_entrega  VARCHAR(250),
    codigo_rastreio   VARCHAR(40),
    previsao_entrega  DATE,
    observacoes       TEXT,
    criado_em         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    atualizado_em     TIMESTAMPTZ
);
CREATE INDEX ix_pedido_cliente ON pedido (cliente_id);
CREATE INDEX ix_pedido_data ON pedido (data);

-- Itens guardam preço e custo do momento da venda (o preço do produto pode mudar depois)
CREATE TABLE item_pedido (
    pedido_id       BIGINT        NOT NULL REFERENCES pedido (id) ON DELETE CASCADE,
    produto_id      BIGINT        NOT NULL REFERENCES produto (id),
    quantidade      INTEGER       NOT NULL CHECK (quantidade > 0),
    preco_unitario  NUMERIC(12,2) NOT NULL CHECK (preco_unitario >= 0),
    custo_unitario  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (custo_unitario >= 0),
    PRIMARY KEY (pedido_id, produto_id)
);

CREATE TABLE historico_pedido (
    id          BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pedido_id   BIGINT      NOT NULL REFERENCES pedido (id) ON DELETE CASCADE,
    status      VARCHAR(20) NOT NULL,
    usuario_id  BIGINT      REFERENCES usuario (id),
    observacao  TEXT,
    data        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Compras de fornecedores
-- ---------------------------------------------------------------------
CREATE TABLE compra (
    id                BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    numero            INTEGER       NOT NULL UNIQUE,
    fornecedor_id     BIGINT        NOT NULL REFERENCES fornecedor (id),
    data              TIMESTAMPTZ   NOT NULL DEFAULT now(),
    nota_fiscal       VARCHAR(30),
    total             NUMERIC(12,2) NOT NULL DEFAULT 0,
    status            VARCHAR(10)   NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Recebida')),
    data_recebimento  TIMESTAMPTZ,
    criado_em         TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE item_compra (
    compra_id       BIGINT        NOT NULL REFERENCES compra (id) ON DELETE CASCADE,
    produto_id      BIGINT        NOT NULL REFERENCES produto (id),
    quantidade      INTEGER       NOT NULL CHECK (quantidade > 0),
    custo_unitario  NUMERIC(12,2) NOT NULL CHECK (custo_unitario >= 0),
    PRIMARY KEY (compra_id, produto_id)
);

-- ---------------------------------------------------------------------
-- Estoque: toda entrada, saída ou ajuste vira uma movimentação
-- ---------------------------------------------------------------------
CREATE TABLE movimentacao_estoque (
    id              BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    produto_id      BIGINT      NOT NULL REFERENCES produto (id),
    tipo            VARCHAR(10) NOT NULL CHECK (tipo IN ('Entrada', 'Saída', 'Ajuste')),
    quantidade      INTEGER     NOT NULL,                  -- no Ajuste pode ser negativa (diferença)
    saldo_anterior  INTEGER     NOT NULL,
    saldo_atual     INTEGER     NOT NULL,
    motivo          VARCHAR(120),
    referencia      VARCHAR(60),                           -- ex.: "Pedido #1023", "Compra #512"
    pedido_id       BIGINT      REFERENCES pedido (id),
    compra_id       BIGINT      REFERENCES compra (id),
    usuario_id      BIGINT      REFERENCES usuario (id),
    data            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_movimentacao_produto ON movimentacao_estoque (produto_id, data);

-- ---------------------------------------------------------------------
-- Financeiro: contas a receber (Receita) e a pagar (Despesa)
-- ---------------------------------------------------------------------
CREATE TABLE lancamento (
    id               BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tipo             VARCHAR(10)   NOT NULL CHECK (tipo IN ('Receita', 'Despesa')),
    descricao        VARCHAR(200)  NOT NULL,
    categoria        VARCHAR(60)   NOT NULL,
    valor            NUMERIC(12,2) NOT NULL CHECK (valor > 0),
    vencimento       DATE          NOT NULL,
    data_pagamento   DATE,                                 -- NULL = em aberto
    forma_pagamento  VARCHAR(20),
    pedido_id        BIGINT        UNIQUE REFERENCES pedido (id),  -- receita gerada por um pedido (1:1)
    compra_id        BIGINT        UNIQUE REFERENCES compra (id),  -- despesa gerada por uma compra (1:1)
    status           VARCHAR(10)   NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Cancelado')),
    criado_em        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    atualizado_em    TIMESTAMPTZ,
    CHECK (NOT (pedido_id IS NOT NULL AND compra_id IS NOT NULL))
);
CREATE INDEX ix_lancamento_vencimento ON lancamento (vencimento);

-- ---------------------------------------------------------------------
-- Log de atividades (alimenta "Atividades recentes" no Início)
-- ---------------------------------------------------------------------
CREATE TABLE atividade (
    id          BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tipo        VARCHAR(20)  NOT NULL,
    texto       VARCHAR(250) NOT NULL,
    link        VARCHAR(150),
    usuario_id  BIGINT       REFERENCES usuario (id),
    data        TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX ix_atividade_data ON atividade (data DESC);
