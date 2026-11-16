# Banco de dados do Nexo ERP

Banco: **PostgreSQL**. API: **Java com Spring Boot** (pasta `api/`).
O esquema real fica em `api/src/main/resources/db/migration/V1__esquema_inicial.sql` (modelo físico) e é criado pelo Flyway quando a API sobe.

Os diagramas abaixo são desenhados pelo GitHub (Mermaid). Para a apresentação, dá para refazer os dois no brModelo seguindo exatamente estas entidades e cardinalidades.

---

## 1. Modelo conceitual

Entidades (retângulos), relacionamentos (losangos) e cardinalidades (mínima, máxima).

```mermaid
flowchart LR
    CATEGORIA[CATEGORIA]
    MARCA[MARCA]
    FORNECEDOR[FORNECEDOR]
    PRODUTO[PRODUTO]
    REVENDEDOR[REVENDEDOR]
    CLIENTE[CLIENTE]
    PEDIDO[PEDIDO]
    COMPRA[COMPRA]
    MOV[MOVIMENTAÇÃO DE ESTOQUE]
    LANC[LANÇAMENTO FINANCEIRO]
    USUARIO[USUÁRIO]

    CATEGORIA ---|"(1,1)"| r1{classifica} ---|"(0,n)"| PRODUTO
    MARCA ---|"(1,1)"| r2{identifica} ---|"(0,n)"| PRODUTO
    FORNECEDOR ---|"(0,1)"| r3{fornece} ---|"(0,n)"| PRODUTO
    FORNECEDOR ---|"(0,n)"| r4{trabalha com} ---|"(1,n)"| MARCA
    REVENDEDOR ---|"(0,1)"| r5{atende} ---|"(0,n)"| CLIENTE
    CLIENTE ---|"(1,1)"| r6{faz} ---|"(0,n)"| PEDIDO
    REVENDEDOR ---|"(0,1)"| r7{intermedia} ---|"(0,n)"| PEDIDO
    USUARIO ---|"(0,1)"| r8{vende} ---|"(0,n)"| PEDIDO
    PEDIDO ---|"(0,n)"| r9{contém<br/>qtd, preço, custo} ---|"(1,n)"| PRODUTO
    FORNECEDOR ---|"(1,1)"| r10{recebe} ---|"(0,n)"| COMPRA
    COMPRA ---|"(0,n)"| r11{inclui<br/>qtd, custo} ---|"(1,n)"| PRODUTO
    PRODUTO ---|"(1,1)"| r12{movimenta} ---|"(0,n)"| MOV
    PEDIDO ---|"(0,1)"| r13{gera receita} ---|"(0,1)"| LANC
    COMPRA ---|"(0,1)"| r14{gera despesa} ---|"(0,1)"| LANC
```

Leitura das principais regras:

- Um **cliente** tem no máximo 1 revendedor; um **revendedor** atende vários clientes (1:N).
- **Pedido** e **produto** são N:N, resolvido pela entidade associativa **item do pedido** (quantidade, preço e custo do momento da venda).
- **Compra** e **produto** também são N:N, resolvido por **item da compra**.
- Fornecedor e marca são N:N (um fornecedor vende várias marcas e uma marca pode vir de vários fornecedores).
- Cada pedido gera 1 lançamento de receita; cada compra gera 1 lançamento de despesa. Existem lançamentos avulsos (aluguel, salários).
- Toda venda, compra recebida ou ajuste vira uma **movimentação de estoque**, com saldo anterior e atual (rastreabilidade).

Entidades de apoio (fora do diagrama para não poluir): EMPRESA (uma linha), CONFIGURAÇÃO, PERMISSÃO DO PERFIL, COMENTÁRIO DO CLIENTE, HISTÓRICO DO PEDIDO e ATIVIDADE (log).

---

## 2. Modelo lógico

PK = chave primária, FK = chave estrangeira, UK = valor único. Endereço aparece como colunas (cep, logradouro, numero, complemento, bairro, cidade, uf) nas tabelas que têm endereço.

```mermaid
erDiagram
    CATEGORIA ||--o{ PRODUTO : classifica
    MARCA ||--o{ PRODUTO : identifica
    FORNECEDOR |o--o{ PRODUTO : fornece
    FORNECEDOR ||--o{ FORNECEDOR_MARCA : ""
    MARCA ||--o{ FORNECEDOR_MARCA : ""
    REVENDEDOR |o--o{ CLIENTE : atende
    CLIENTE ||--o{ COMENTARIO_CLIENTE : tem
    CLIENTE ||--o{ PEDIDO : faz
    REVENDEDOR |o--o{ PEDIDO : intermedia
    USUARIO |o--o{ PEDIDO : vende
    PEDIDO ||--|{ ITEM_PEDIDO : contem
    PRODUTO ||--o{ ITEM_PEDIDO : ""
    PEDIDO ||--o{ HISTORICO_PEDIDO : registra
    FORNECEDOR ||--o{ COMPRA : recebe
    COMPRA ||--|{ ITEM_COMPRA : inclui
    PRODUTO ||--o{ ITEM_COMPRA : ""
    PRODUTO ||--o{ MOVIMENTACAO_ESTOQUE : movimenta
    PEDIDO |o--o| LANCAMENTO : "gera receita"
    COMPRA |o--o| LANCAMENTO : "gera despesa"
    USUARIO |o--o{ ATIVIDADE : registra

    CATEGORIA {
        bigint id PK
        varchar nome UK
        varchar icone
    }
    MARCA {
        bigint id PK
        varchar nome UK
    }
    FORNECEDOR {
        bigint id PK
        varchar razao_social
        varchar nome_fantasia
        varchar cnpj UK
        varchar contato
        varchar email
        varchar telefone
        int prazo_entrega_dias
        varchar condicao_pagamento
        varchar status
    }
    FORNECEDOR_MARCA {
        bigint fornecedor_id PK,FK
        bigint marca_id PK,FK
    }
    PRODUTO {
        bigint id PK
        varchar sku UK
        varchar codigo_barras UK
        varchar nome
        bigint categoria_id FK
        bigint marca_id FK
        bigint fornecedor_id FK
        varchar volume
        numeric preco
        numeric custo
        int estoque
        int estoque_minimo
        date validade
        varchar lote
        varchar status
    }
    REVENDEDOR {
        bigint id PK
        varchar nome
        varchar documento UK
        varchar email
        varchar telefone
        numeric desconto_pct
        numeric comissao_pct
        varchar condicao_pagamento
        numeric limite_credito
        varchar status
    }
    CLIENTE {
        bigint id PK
        char tipo "PF ou PJ"
        varchar nome
        varchar razao_social
        varchar documento UK
        varchar email
        varchar telefone
        date data_nascimento
        varchar responsavel
        bigint revendedor_id FK
        varchar status
    }
    COMENTARIO_CLIENTE {
        bigint id PK
        bigint cliente_id FK
        bigint usuario_id FK
        text texto
        timestamptz criado_em
    }
    USUARIO {
        bigint id PK
        varchar nome
        varchar email UK
        varchar senha_hash
        varchar perfil
        boolean ativo
    }
    PEDIDO {
        bigint id PK
        int numero UK
        timestamptz data
        bigint cliente_id FK
        bigint revendedor_id FK
        bigint vendedor_id FK
        varchar status
        numeric subtotal
        numeric desconto
        numeric frete
        numeric total
        varchar forma_pagamento
        smallint parcelas
        varchar tipo_entrega
        varchar codigo_rastreio
    }
    ITEM_PEDIDO {
        bigint pedido_id PK,FK
        bigint produto_id PK,FK
        int quantidade
        numeric preco_unitario
        numeric custo_unitario
    }
    HISTORICO_PEDIDO {
        bigint id PK
        bigint pedido_id FK
        varchar status
        bigint usuario_id FK
        timestamptz data
    }
    COMPRA {
        bigint id PK
        int numero UK
        bigint fornecedor_id FK
        timestamptz data
        varchar nota_fiscal
        numeric total
        varchar status
    }
    ITEM_COMPRA {
        bigint compra_id PK,FK
        bigint produto_id PK,FK
        int quantidade
        numeric custo_unitario
    }
    MOVIMENTACAO_ESTOQUE {
        bigint id PK
        bigint produto_id FK
        varchar tipo
        int quantidade
        int saldo_anterior
        int saldo_atual
        varchar motivo
        bigint usuario_id FK
        timestamptz data
    }
    LANCAMENTO {
        bigint id PK
        varchar tipo "Receita ou Despesa"
        varchar descricao
        varchar categoria
        numeric valor
        date vencimento
        date data_pagamento
        bigint pedido_id FK,UK
        bigint compra_id FK,UK
        varchar status
    }
    ATIVIDADE {
        bigint id PK
        varchar tipo
        varchar texto
        bigint usuario_id FK
        timestamptz data
    }
```

Tabelas de apoio sem relacionamento no diagrama: `empresa` (uma linha só), `configuracao` (chave e valor JSON) e `permissao_perfil` (perfil, módulo).

---

## 3. Decisões de modelagem

| Decisão | Motivo |
|---|---|
| Categoria e marca viraram tabelas | Evita "Shampoo" e "shampoo" como categorias diferentes e permite filtrar e agrupar nos relatórios |
| Cliente com no máximo 1 revendedor (FK em `cliente`) | É como o sistema funciona hoje: na tela de cliente se escolhe um revendedor ou nenhum |
| Produto ligado ao pedido, não direto ao revendedor | O revendedor vende produtos por meio dos pedidos; a ligação direta duplicaria informação |
| Preço e custo copiados no item do pedido | O preço do produto muda; o pedido antigo precisa manter o valor da venda |
| Estoque atual em `produto.estoque` e histórico em `movimentacao_estoque` | Consulta rápida do saldo e rastreio de cada entrada e saída |
| Senha guardada como hash BCrypt | Hoje a senha fica em texto puro no navegador |
| Revendedores fora de `permissao_perfil` | Regra do grupo: o módulo é exclusivo do Administrador |
