# NEXO ERP

Sistema web de gestão (ERP) para uma distribuidora de cosméticos capilares: pedidos, produtos, estoque, clientes, revendedores, fornecedores, financeiro, relatórios e configurações.

Feito em HTML, Tailwind CSS (CDN) e JavaScript puro. Não precisa instalar nada nem rodar servidor.

## Como rodar

1. Abra `telas/login.html` no navegador (Chrome, Edge ou Firefox), com internet ligada, porque o Tailwind, as fontes, os ícones e o Chart.js vêm de CDN.
2. Entre com um dos usuários de demonstração:

| Perfil | E-mail | Senha |
|---|---|---|
| Administrador (acesso total) | admin@nexo.com | admin123 |
| Vendedor | ana@nexo.com | ana123 |
| Estoquista | julia@nexo.com | julia123 |

Os acessos de cada perfil podem ser alterados em **Configurações > Permissões**.

## Onde ficam os dados

Os dados ficam salvos no próprio navegador (`localStorage`). Tudo que for cadastrado ou editado continua lá depois de recarregar a página, mas não é compartilhado entre computadores ou navegadores.

Na primeira vez que o sistema abre, ele gera dados de exemplo coerentes: 25 produtos, 22 clientes, 5 revendedores, 5 fornecedores, cerca de 6 meses de pedidos, compras, movimentações de estoque e lançamentos financeiros. Para voltar aos dados de exemplo: **Configurações > Gerais > Zona de perigo > Restaurar dados de exemplo**. No mesmo lugar dá para exportar e importar um backup em JSON.

## Telas

| Tela | Arquivo | O que faz |
|---|---|---|
| Login | `telas/login.html` | Usuário e senha, mostrar/ocultar senha, lembrar acesso, recuperação de senha, mensagens de erro e carregamento |
| Início | `telas/home.html` | Dashboard com faturamento, pedidos, clientes, vendas, estoque, atividades recentes, notificações e filtros de período |
| Empresa | `telas/empresa.html` | Dados cadastrais, fiscais, contato e endereço, com modo de edição e busca de CEP |
| Pedidos | `telas/pedidos.html` | Lista com busca e filtros, detalhes (cliente, produtos e valores, pagamento e entrega), novo pedido e alteração de status |
| Produtos | `telas/produtos.html` | Categorias, lista, cadastro, edição, preço e custo, informações técnicas e resumo de vendas (`produto.html` redireciona para cá) |
| Estoque | `telas/estoque.html` | Posição de estoque, entradas, saídas, ajustes, histórico e reposição de estoque baixo |
| Fornecedores | `telas/fornecedores.html` | Cadastro, contato, marcas e produtos fornecidos, histórico e registro de compras |
| Clientes | `telas/clientes.html` | Cadastro PF/PJ, endereço e contato, revendedor vinculado, histórico de pedidos e comentários |
| Revendedores | `telas/revendedores.html` | Dados comerciais, descontos, condições de pagamento, crédito, clientes vinculados e histórico de compras |
| Financeiro | `telas/financeiro.html` | Dashboard, contas a receber e a pagar, baixa de pagamentos e fluxo de caixa com filtro de período |
| Relatórios | `telas/relatorios2.html` | Central com 10 relatórios (vendas, estoque, clientes e financeiro), filtros, gráficos, tabelas, exportação CSV e impressão/PDF |
| Configurações | `telas/configuracoes.html` | Perfil do usuário, usuários, permissões, notificações, preferências e configurações gerais |

## Como o código está organizado

- `JS/nexo-data.js`: camada de dados (`Nexo.db`), dados de exemplo e regras de negócio (`Nexo.ops`). Exemplos: criar um pedido baixa o estoque e gera a receita no financeiro, e cancelar um pedido devolve os itens ao estoque e cancela a receita.
- `JS/nexo-layout.js`: menu lateral único, verificação de login e permissão, notificações, avisos (toast), modais e paginação. Cada tela chama `Nexo.layout.montar('<modulo>')`.
- `JS/nexo-tailwind.js`: cores da marca usadas no Tailwind.
- `JS/<tela>.js`: a lógica de cada tela. Os relatórios usam `JS/relatorios-comum.js` mais um `JS/rel-<nome>.js` por página.

Arquivos antigos que não são mais usados pelas telas: `css/CSSclientes.css`, `css/relatorios.css`, `telas/relatorios.js` e `telas/relaórios nao usar.html`.
