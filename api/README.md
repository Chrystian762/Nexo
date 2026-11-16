# Nexo API (Spring Boot + PostgreSQL)

API do Nexo ERP. O modelo do banco (conceitual, lógico e decisões) está em [`../docs/banco-de-dados.md`](../docs/banco-de-dados.md).

## Requisitos

- JDK 25 ou mais novo
- Docker Desktop (para o PostgreSQL local e para os testes)
- Maven não precisa ser instalado: o projeto usa o wrapper (`mvnw`)

## Rodar

```bash
cd api
docker compose up -d        # sobe o PostgreSQL 17 em localhost:5432 (banco, usuário e senha: nexo)
./mvnw spring-boot:run      # no Windows (cmd/PowerShell): mvnw.cmd spring-boot:run
```

Ao subir, o Flyway cria as tabelas a partir de `src/main/resources/db/migration`. Mudança no banco = novo arquivo `V2__descricao.sql`; nunca editar uma migração que já rodou.

Para apontar para outro banco (por exemplo, na nuvem), definir as variáveis `NEXO_DB_URL`, `NEXO_DB_USER` e `NEXO_DB_PASSWORD`.

## Testes

```bash
./mvnw test
```

Os testes sobem um PostgreSQL temporário pelo Testcontainers (precisa do Docker aberto).

## Situação

- [x] Projeto Spring Boot 4.1.2 (Java 25), PostgreSQL 17 e Flyway
- [x] Esquema inicial com 20 tabelas (`V1__esquema_inicial.sql`)
- [ ] Entidades JPA e repositórios
- [ ] Login com JWT e senha em BCrypt, permissões por perfil no servidor
- [ ] Endpoints REST de cada módulo
- [ ] Dados de exemplo
- [ ] Trocar o localStorage do `JS/nexo-data.js` por chamadas à API
