# Gerador dos diagramas do brModelo

Monta `nexo-modelo-conceitual.brM3` e `nexo-modelo-logico.brM3` usando as classes do próprio brModelo 3.3.1, então os arquivos abrem no programa como se tivessem sido desenhados nele.

- `layout.js`: entidades, atributos, relacionamentos, cardinalidades e posições do modelo conceitual.
- `gerar.js`: lê `api/src/main/resources/db/migration/V1__esquema_inicial.sql` e o `layout.js` e escreve `ModeloNexo.java`. O modelo lógico sai direto do SQL (tabelas, tipos, PK, UNIQUE e FK), então ele sempre bate com o banco.
- `Construtor.java`: cria entidades, atributos, ligações, tabelas, campos e chaves pelos comandos do brModelo e salva `.brM3` e `.png`.
- `Verificar.java`: reabre os `.brM3` pelo carregador do brModelo e exporta um PNG a partir do arquivo reaberto.

## Como regenerar (depois de mudar o banco)

Precisa do JDK e do brModelo 3.3.1 (`brModelo.zip` da página de releases de `chcandido/brModelo`, pasta `brModelo/dist`).

```bash
cd docs/brmodelo/gerador
node gerar.js ../../../api/src/main/resources/db/migration/V1__esquema_inicial.sql layout.js
javac -encoding UTF-8 -cp <dist>/brModelo.jar -d classes Construtor.java ModeloNexo.java Verificar.java
java -cp "<dist>/brModelo.jar;<dist>/lib/AbsoluteLayout.jar;classes" ModeloNexo ..
java -cp "<dist>/brModelo.jar;<dist>/lib/AbsoluteLayout.jar;classes" Verificar ../nexo-modelo-conceitual.brM3 ../nexo-modelo-logico.brM3
```

No Linux ou macOS, troque `;` por `:` no classpath. O brModelo abre a janela durante a geração e fecha sozinho no fim.

Atributo ou coluna nova no conceitual: acrescentar no `layout.js`. Tabela ou coluna nova no lógico: basta a migração SQL.
