// Layout do modelo do Nexo para o brModelo.
// Conceitual: atributos ficam à direita da entidade ('*' = identificador).
// lig: [entidade, lado da entidade (T/B/L/R), posição 0..1 no lado, lado do losango, cardinalidade junto à entidade]
// Lógico: tabela na posição da entidade (ou do relacionamento N:N), com escalaLogico e ajusteTabelas.
module.exports = { "entidades": [
  { "nome": "CATEGORIA", "x": 40, "y": 40, "extra": 0, "attrs": [ "*id_categoria", "nm_categoria", "nm_icone_categoria" ]
  },
  { "nome": "MARCA", "x": 600, "y": 40, "extra": 0, "attrs": [ "*id_marca", "nm_marca" ]
  },
  { "nome": "FORNECEDOR", "x": 1160, "y": 40, "extra": 40, "attrs": [ "*id_fornecedor", "nm_razao_social_fornecedor", "nm_fantasia_fornecedor", "cd_cnpj_fornecedor", "nm_contato_fornecedor", "nm_email_fornecedor", "cd_telefone_fornecedor", "cd_cep_fornecedor", "nm_logradouro_fornecedor", "nr_endereco_fornecedor", "ds_complemento_fornecedor", "nm_bairro_fornecedor", "nm_cidade_fornecedor", "sg_uf_fornecedor", "qt_prazo_entrega_fornecedor", "ds_condicao_pagamento_fornecedor", "fl_status_fornecedor", "ds_observacao_fornecedor" ]
  },
  { "nome": "COMPRA", "x": 1800, "y": 40, "extra": 50, "attrs": [ "*id_compra", "nr_compra", "dt_compra", "cd_nota_fiscal_compra", "vl_total_compra", "fl_status_compra", "dt_recebimento_compra" ]
  },
  { "nome": "LANCAMENTO", "x": 2440, "y": 40, "extra": 30, "attrs": [ "*id_lancamento", "tp_lancamento", "ds_lancamento", "nm_categoria_lancamento", "vl_lancamento", "dt_vencimento_lancamento", "dt_pagamento_lancamento", "tp_forma_pagamento_lancamento", "fl_status_lancamento" ]
  },
  { "nome": "PRODUTO", "x": 1160, "y": 640, "extra": 60, "attrs": [ "*id_produto", "cd_sku_produto", "cd_barras_produto", "nm_produto", "ds_produto", "ds_volume_produto", "vl_preco_produto", "vl_custo_produto", "qt_estoque_produto", "qt_estoque_minimo_produto", "dt_validade_produto", "cd_lote_produto", "fl_status_produto" ]
  },
  { "nome": "PEDIDO", "x": 2440, "y": 640, "extra": 40, "attrs": [ "*id_pedido", "nr_pedido", "dt_pedido", "fl_status_pedido", "vl_subtotal_pedido", "vl_desconto_pedido", "vl_frete_pedido", "vl_total_pedido", "tp_forma_pagamento_pedido", "qt_parcelas_pedido", "tp_entrega_pedido", "nm_transportadora_pedido", "ds_endereco_entrega_pedido", "cd_rastreio_pedido", "dt_previsao_entrega_pedido", "ds_observacao_pedido" ]
  },
  { "nome": "HISTORICO_PEDIDO", "x": 3080, "y": 640, "extra": 0, "attrs": [ "*id_historico_pedido", "fl_status_historico_pedido", "nm_usuario_historico_pedido", "ds_observacao_historico_pedido", "dt_historico_pedido" ]
  },
  { "nome": "MOVIMENTACAO_ESTOQUE", "x": 700, "y": 1150, "extra": 40, "attrs": [ "*id_movimentacao", "tp_movimentacao", "qt_movimentacao", "qt_saldo_anterior_movimentacao", "qt_saldo_atual_movimentacao", "ds_motivo_movimentacao", "ds_referencia_movimentacao", "dt_movimentacao" ]
  },
  { "nome": "USUARIO", "x": 1800, "y": 1400, "extra": 40, "attrs": [ "*id_usuario", "nm_usuario", "nm_email_usuario", "ds_senha_hash_usuario", "nm_perfil_usuario", "fl_ativo_usuario", "dt_ultimo_acesso_usuario" ]
  },
  { "nome": "CLIENTE", "x": 2440, "y": 1500, "extra": 40, "attrs": [ "*id_cliente", "sg_tipo_pessoa_cliente", "nm_cliente", "nm_razao_social_cliente", "cd_documento_cliente", "nm_email_cliente", "cd_telefone_cliente", "dt_nascimento_cliente", "nm_responsavel_cliente", "cd_cep_cliente", "nm_logradouro_cliente", "nr_endereco_cliente", "ds_complemento_cliente", "nm_bairro_cliente", "nm_cidade_cliente", "sg_uf_cliente", "fl_status_cliente", "ds_observacao_cliente" ]
  },
  { "nome": "REVENDEDOR", "x": 3080, "y": 1500, "extra": 40, "attrs": [ "*id_revendedor", "nm_revendedor", "cd_documento_revendedor", "nm_email_revendedor", "cd_telefone_revendedor", "cd_cep_revendedor", "nm_logradouro_revendedor", "nr_endereco_revendedor", "ds_complemento_revendedor", "nm_bairro_revendedor", "nm_cidade_revendedor", "sg_uf_revendedor", "pc_desconto_revendedor", "pc_comissao_revendedor", "ds_condicao_pagamento_revendedor", "vl_limite_credito_revendedor", "fl_status_revendedor", "ds_observacao_revendedor" ]
  },
  { "nome": "COMENTARIO_CLIENTE", "x": 2440, "y": 2050, "extra": 0, "attrs": [ "*id_comentario", "nm_autor_comentario", "ds_comentario", "dt_comentario" ]
  },
  { "nome": "ATIVIDADE", "x": 1160, "y": 1700, "extra": 0, "attrs": [ "*id_atividade", "tp_atividade", "ds_atividade", "ds_link_atividade", "dt_atividade" ]
  },
  { "nome": "EMPRESA", "x": 40, "y": 1500, "extra": 0, "attrs": [ "*id_empresa", "nm_razao_social_empresa", "nm_fantasia_empresa", "cd_cnpj_empresa", "cd_inscricao_estadual_empresa", "cd_inscricao_municipal_empresa", "nm_regime_tributario_empresa", "ds_cnae_empresa", "dt_abertura_empresa", "nm_email_empresa", "nm_email_financeiro_empresa", "cd_telefone_empresa", "cd_whatsapp_empresa", "nm_site_empresa", "nm_responsavel_empresa", "cd_cep_empresa", "nm_logradouro_empresa", "nr_endereco_empresa", "ds_complemento_empresa", "nm_bairro_empresa", "nm_cidade_empresa", "sg_uf_empresa" ]
  },
  { "nome": "CONFIGURACAO", "x": 600, "y": 1500, "extra": 0, "attrs": [ "*nm_chave_configuracao", "ds_valor_configuracao" ]
  },
  { "nome": "PERMISSAO_PERFIL", "x": 600, "y": 1650, "extra": 0, "attrs": [ "*nm_perfil_permissao", "*nm_modulo_permissao" ]
  } ], "relacionamentos": [
  { "nome": "classifica", "x": 300, "y": 775, "ligs": [
    [ "CATEGORIA", "B", 0.5, "L", "11" ],
    [ "PRODUTO", "L", 0.516, "R", "0n" ] ]
  },
  { "nome": "identifica", "x": 900, "y": 640, "ligs": [
    [ "MARCA", "B", 0.5, "T", "11" ],
    [ "PRODUTO", "L", 0.08, "R", "0n" ] ]
  },
  { "nome": "trabalha_com", "x": 800, "y": 200, "ligs": [
    [ "MARCA", "B", 0.9, "T", "1n" ],
    [ "FORNECEDOR", "L", 0.45, "R", "0n" ] ]
  },
  { "nome": "fornece", "x": 1160, "y": 480, "ligs": [
    [ "FORNECEDOR", "B", 0.5, "T", "01" ],
    [ "PRODUTO", "T", 0.5, "B", "0n" ] ]
  },
  { "nome": "recebe", "x": 1600, "y": 375, "ligs": [
    [ "FORNECEDOR", "R", 0.947, "L", "11" ],
    [ "COMPRA", "L", 0.9, "R", "0n" ] ]
  },
  { "nome": "inclui", "x": 1800, "y": 330, "attrs": [ "qt_item_compra", "vl_custo_item_compra" ], "ligs": [
    [ "COMPRA", "B", 0.5, "T", "0n" ],
    [ "PRODUTO", "R", 0.84, "B", "1n" ] ]
  },
  { "nome": "gera_despesa", "x": 2240, "y": 192, "ligs": [
    [ "COMPRA", "R", 0.92, "L", "01" ],
    [ "LANCAMENTO", "L", 0.85, "R", "01" ] ]
  },
  { "nome": "gera_receita", "x": 2440, "y": 420, "ligs": [
    [ "PEDIDO", "T", 0.5, "B", "01" ],
    [ "LANCAMENTO", "B", 0.5, "T", "01" ] ]
  },
  { "nome": "contem", "x": 1775, "y": 1060, "attrs": [ "qt_item_pedido", "vl_unitario_item_pedido", "vl_custo_item_pedido" ], "ligs": [
    [ "PRODUTO", "B", 0.8, "L", "1n" ],
    [ "PEDIDO", "L", 0.93, "T", "0n" ] ]
  },
  { "nome": "movimenta", "x": 700, "y": 1000, "ligs": [
    [ "PRODUTO", "B", 0.2, "R", "11" ],
    [ "MOVIMENTACAO_ESTOQUE", "T", 0.5, "B", "0n" ] ]
  },
  { "nome": "registra", "x": 2880, "y": 949, "ligs": [
    [ "PEDIDO", "R", 0.97, "L", "11" ],
    [ "HISTORICO_PEDIDO", "B", 0.5, "R", "1n" ] ]
  },
  { "nome": "comenta", "x": 2440, "y": 1950, "ligs": [
    [ "CLIENTE", "B", 0.5, "T", "11" ],
    [ "COMENTARIO_CLIENTE", "T", 0.5, "B", "0n" ] ]
  },
  { "nome": "realiza", "x": 1450, "y": 1466, "ligs": [
    [ "USUARIO", "L", 0.5, "R", "01" ],
    [ "ATIVIDADE", "T", 0.5, "L", "0n" ] ]
  },
  { "nome": "opera", "x": 1300, "y": 1300, "ligs": [
    [ "MOVIMENTACAO_ESTOQUE", "R", 0.9, "L", "0n" ],
    [ "USUARIO", "L", 0.2, "R", "01" ] ]
  },
  { "nome": "solicita", "x": 2440, "y": 1200, "ligs": [
    [ "CLIENTE", "T", 0.5, "B", "11" ],
    [ "PEDIDO", "B", 0.5, "T", "0n" ] ]
  },
  { "nome": "lanca", "x": 3080, "y": 1150, "ligs": [
    [ "REVENDEDOR", "T", 0.5, "B", "11" ],
    [ "PEDIDO", "B", 0.85, "L", "0n" ] ]
  },
  { "nome": "atende", "x": 2880, "y": 1835, "ligs": [
    [ "CLIENTE", "R", 0.947, "L", "0n" ],
    [ "REVENDEDOR", "L", 0.947, "R", "11" ] ]
  },
  { "nome": "acessa", "x": 1800, "y": 2150, "ligs": [
    [ "USUARIO", "B", 0.5, "T", "01" ],
    [ "REVENDEDOR", "B", 0.5, "R", "01" ] ]
  } ], "escalaLogico": [ 1, 1.3 ], "ajusteTabelas": { "categoria": [ 0, 500 ], "fornecedor_marca": [ -150, 0 ], "usuario": [ 1280, 840 ], "comentario_cliente": [ 0, 240 ]
 }
};
