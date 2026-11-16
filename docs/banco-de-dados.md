# Banco de dados do Nexo ERP

Banco: **PostgreSQL**. API: **Java com Spring Boot** (pasta `api/`).

| Modelo | Arquivo |
|---|---|
| Conceitual (brModelo) | [`brmodelo/nexo-modelo-conceitual.brM3`](brmodelo/nexo-modelo-conceitual.brM3) |
| Lógico (brModelo) | [`brmodelo/nexo-modelo-logico.brM3`](brmodelo/nexo-modelo-logico.brM3) |
| Físico (SQL) | [`../api/src/main/resources/db/migration/V1__esquema_inicial.sql`](../api/src/main/resources/db/migration/V1__esquema_inicial.sql) |

Os `.brM3` abrem no **brModelo 3.3** (Arquivo > Abrir). O lógico é gerado a partir do SQL, então os três modelos sempre batem. Para regenerar depois de mudar o banco, ver [`brmodelo/gerador/README.md`](brmodelo/gerador/README.md).

---

## 1. Modelo conceitual

![Modelo conceitual](brmodelo/nexo-modelo-conceitual.png)

17 entidades e 19 relacionamentos. Atributo com círculo preenchido é identificador.

Leitura das principais regras (a cardinalidade fica junto da entidade a que se refere):

- Um **cliente** tem no máximo 1 revendedor; um **revendedor** atende vários clientes (1:N, relacionamento *atende*).
- **Pedido** e **produto** são N:N pelo relacionamento *contém*, com os atributos quantidade, preço unitário e custo do momento da venda.
- **Compra** e **produto** são N:N pelo relacionamento *inclui*, com quantidade e custo.
- **Fornecedor** e **marca** são N:N (*trabalha com*).
- Cada pedido gera no máximo 1 lançamento de receita (*gera receita*) e cada compra gera no máximo 1 lançamento de despesa (*gera despesa*). Há lançamentos avulsos (aluguel, salários).
- Toda entrada, saída ou ajuste de estoque vira uma **movimentação** do produto (*movimenta*), feita por um usuário (*opera*).
- **Usuário** vende pedidos, escreve comentários de cliente e realiza atividades (log).
- **Empresa**, **configuração** e **permissão do perfil** são entidades isoladas (dados do sistema).

## 2. Modelo lógico

![Modelo lógico](brmodelo/nexo-modelo-logico.png)

20 tabelas, 200 colunas e 22 chaves estrangeiras. As N:N viraram as tabelas associativas `fornecedor_marca`, `item_compra` e `item_pedido`, com chave primária composta.

---

## 3. Padrão de nomes (mnemônicos)

Tabelas no singular. Colunas com prefixo mnemônico e sufixo com o nome da tabela (ex.: `nm_produto`, `vl_preco_produto`). A chave estrangeira mantém o nome da chave primária de origem (ex.: `produto.id_categoria`).

| Prefixo | Significado | Exemplo |
|---|---|---|
| `id_` | identificador (chave) | `id_produto` |
| `cd_` | código ou documento | `cd_sku_produto`, `cd_cnpj_fornecedor`, `cd_cep_cliente` |
| `nm_` | nome ou texto curto | `nm_cliente`, `nm_email_usuario` |
| `ds_` | descrição ou texto longo | `ds_observacao_pedido` |
| `nr_` | número | `nr_pedido`, `nr_endereco_cliente` |
| `sg_` | sigla | `sg_uf_cliente`, `sg_tipo_pessoa_cliente` |
| `vl_` | valor em reais | `vl_preco_produto` |
| `pc_` | percentual | `pc_desconto_revendedor` |
| `qt_` | quantidade | `qt_estoque_produto` |
| `dt_` | data ou data e hora | `dt_pedido` |
| `tp_` | tipo (lista fechada) | `tp_movimentacao`, `tp_forma_pagamento_pedido` |
| `fl_` | situação ou flag | `fl_status_pedido`, `fl_ativo_usuario` |

## 4. Decisões de modelagem

| Decisão | Motivo |
|---|---|
| Categoria e marca viraram tabelas | Evita "Shampoo" e "shampoo" como categorias diferentes e permite agrupar nos relatórios |
| Cliente com no máximo 1 revendedor (FK `cliente.id_revendedor`) | É como o sistema funciona: na tela de cliente se escolhe um revendedor ou nenhum |
| Produto ligado ao pedido, não direto ao revendedor | O revendedor vende produtos por meio dos pedidos; a ligação direta duplicaria informação |
| Preço e custo copiados no item do pedido | O preço do produto muda; o pedido antigo precisa manter o valor da venda |
| Estoque atual em `produto.qt_estoque_produto` e histórico em `movimentacao_estoque` | Consulta rápida do saldo e rastreio de cada entrada e saída |
| Movimentação guarda a origem como texto (`ds_referencia_movimentacao`, ex.: "Pedido #1023") | É o que o sistema já faz e evita duas chaves estrangeiras opcionais |
| Histórico do pedido guarda o nome de quem mudou o status | Registro histórico: continua certo mesmo se o usuário for renomeado ou desativado |
| Endereço em colunas na própria tabela | Cada cliente, revendedor, fornecedor e a empresa têm um endereço só |
| Senha guardada como hash BCrypt (`ds_senha_hash_usuario`) | Hoje a senha fica em texto puro no navegador |
| Revendedores fora de `permissao_perfil` | Regra do grupo: o módulo é exclusivo do Administrador |
