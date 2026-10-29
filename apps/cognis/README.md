# Cognis — Cognitive Assessment

Plataforma web **experimental** de avaliação de habilidades de raciocínio, em português brasileiro. Aplica 36 questões
originais em 10 categorias, corrige no servidor, calcula um **Índice de Desempenho Cognitivo (IDC)** e apresenta análise por
categoria, dificuldade e tempo, histórico, compartilhamento anônimo e um painel administrativo com estatísticas de itens.

> **Honestidade científica.** O Cognis **não** calcula QI. O IDC é o percentual de acertos na avaliação. Não há normas
> populacionais, estudos de validade nem estimativas de fidedignidade; por isso não exibimos QI, percentis populacionais ou
> classificações. A arquitetura está preparada para calibração futura (IRT e tabelas normativas), mas esses módulos ficam
> inativos até existirem dados reais. Detalhes em `/metodologia` no site.

## Sumário

- [Stack e arquitetura](#stack-e-arquitetura)
- [Execução local](#execução-local)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Banco de dados e Supabase](#banco-de-dados-e-supabase)
- [Testes](#testes)
- [Deploy na Vercel](#deploy-na-vercel)
- [Banco de questões](#banco-de-questões)
- [Segurança e privacidade](#segurança-e-privacidade)
- [O que depende de configuração externa](#o-que-depende-de-configuração-externa)

## Stack e arquitetura

- **Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS 3**
- **PostgreSQL** (Supabase em produção) acessado pelo servidor via `pg`
- **Supabase Auth** (e-mail/senha) com `@supabase/ssr`; sem Supabase configurado, um **modo de autenticação local**
  (scrypt + sessões httpOnly) é usado em desenvolvimento e testes
- **Zod** para validação de toda entrada; **Vitest** (unidade/integração) e **Playwright + axe-core** (E2E/acessibilidade)

```
data/                      Conteúdo versionado (fonte de seed)
  questions/*.json         77 questões originais, por categoria
  categories.json          10 categorias + sugestões de prática
  test-versions.json       Matriz (blueprint) da avaliação ativa
  references.json          Referências científicas (com DOI quando disponível)
supabase/migrations/       Esquema, constraints, triggers e políticas RLS
db/local/auth-stub.sql     Simula auth.users/auth.uid() do Supabase em Postgres puro (dev/testes)
scripts/                   migrate, seed, setup-local, validate-questions
src/lib/engine/            Motor puro: sorteio (selection), pontuação (scoring), IRT, normas
src/lib/stats/             Estatística descritiva e análise de itens (TCT)
src/lib/services/          Regras de negócio no servidor (avaliação, admin, conteúdo)
src/lib/auth/              Sessões (Supabase ou local), dono anônimo, guarda de admin
src/lib/security/          Erros, validação HTTP, mesma origem, rate limiting
src/app/(site)/            Páginas públicas, resultado, histórico, perfil, admin
src/app/(focus)/avaliacao/ Tela de avaliação sem distrações
src/app/api/               Rotas da API
tests/unit|integration|e2e Testes
```

### Princípios do motor de avaliação

- O cliente recebe apenas a **visão pública** das questões: sem gabarito, sem explicação; alternativas identificadas pela
  **posição de exibição** (o id original nunca vai ao navegador).
- Estímulos de memória **não** são enviados no estado da tentativa; são revelados uma única vez por uma rota própria, que
  registra o horário no servidor.
- **Pontuação apenas no servidor** (`finalizeAttempt`), idempotente e transacional. Clientes não têm permissão de escrita em
  tentativas, respostas ou resultados (RLS + `revoke`).
- Sorteio determinístico com **semente registrada** (`mulberry32`), seguindo a matriz categoria × dificuldade, sem repetição,
  do fácil ao difícil e sem categorias adjacentes repetidas.
- Respostas são **idempotentes** (reenvio não altera o resultado; o tempo nunca diminui). Prazo controlado pelo servidor;
  tentativas vencidas são encerradas como "tempo esgotado".
- Algoritmo `idc-1.0`: 1 ponto por acerto, IDC = 100 × acertos ÷ itens. A dificuldade **não** pondera o escore.

## Execução local

Pré-requisitos: Node.js ≥ 20 e um PostgreSQL ≥ 14 acessível (local, Docker ou `supabase start`).

```bash
cd apps/cognis
npm install
cp .env.example .env.local          # edite DATABASE_URL, SESSION_SECRET e ADMIN_EMAILS

# Postgres local puro (sem Supabase): stub de auth + migrações + conteúdo
createdb cognis
DATABASE_URL=postgres://postgres:postgres@localhost:5432/cognis npm run db:setup-local

npm run dev                          # http://localhost:3000
```

Com Docker, um Postgres descartável:

```bash
docker run -d --name cognis-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
```

Para virar administrador, inclua seu e-mail em `ADMIN_EMAILS` e crie a conta (ou entre) — o papel é aplicado no servidor ao
autenticar. Alternativa via SQL: `update public.profiles set role = 'admin' where id = '<uuid>';`

## Variáveis de ambiente

| Variável | Onde | Descrição |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | público | URL do site (metadados, sitemap, redirecionamento de confirmação de e-mail) |
| `DATABASE_URL` | servidor | Conexão Postgres. Na Vercel, use o **pooler do Supabase em modo transação (porta 6543)** |
| `DATABASE_SSL` | servidor | `disable`/`require` (padrão: sem TLS em localhost, TLS em hosts remotos) |
| `DATABASE_SSL_CA` | servidor | Opcional: CA do Supabase para verificação completa do certificado |
| `DATABASE_POOL_MAX` | servidor | Conexões por instância (padrão 5) |
| `NEXT_PUBLIC_SUPABASE_URL` | público | URL do projeto Supabase (ativa o modo Supabase Auth) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | público | Chave anônima do Supabase (protegida pelo RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | **somente servidor** | Necessária para excluir contas. Nunca exponha no cliente |
| `ADMIN_EMAILS` | servidor | E-mails promovidos a admin ao autenticar |
| `SESSION_SECRET` | servidor | Obrigatório no modo de autenticação local em produção |
| `COGNIS_ALLOW_LOCAL_AUTH` | servidor | `true` permite auth local em build de produção (apenas ensaios/testes) |

Nenhuma credencial real está no repositório. `.env*.local` está no `.gitignore`.

## Banco de dados e Supabase

Tabelas (schema `public`): `profiles`, `categories`, `questions`, `question_options`, `test_versions`, `attempts`,
`attempt_items`, `responses`, `results`, `scientific_references`, `norm_tables`, `admin_audit_log` e a view
`score_history` (`security_invoker`).

**Políticas RLS** (resumo):

- `questions`, `question_options`, `norm_tables`, `admin_audit_log`: **nenhum** acesso para `anon`/`authenticated` (gabaritos
  nunca saem pelo Data API).
- `categories`, `scientific_references`, `test_versions` (ativa): leitura pública.
- `profiles`, `attempts`, `attempt_items`, `responses`, `results`, `score_history`: o titular lê apenas as próprias linhas;
  pode alterar somente o próprio `display_name` (nunca `role`).
- Escritas em avaliações são feitas exclusivamente pelo servidor da aplicação.

### Configurando um projeto Supabase

1. Crie o projeto e, em **Authentication → Providers**, mantenha **Email** habilitado. Em **URL Configuration**, defina o
   Site URL e adicione `https://SEU-DOMINIO/auth/confirm` às Redirect URLs.
2. Aplique a migração (escolha **um** método):
   - Supabase CLI: `supabase link --project-ref <ref> && supabase db push`; ou
   - `DATABASE_URL=<conexão direta, porta 5432> npm run db:migrate`.
   > **Não** execute `db:setup-local` nem `db/local/auth-stub.sql` em um projeto Supabase.
3. Popule o conteúdo: `DATABASE_URL=<conexão> npm run db:seed` (não sobrescreve edições feitas no painel; use
   `npm run db:seed -- --overwrite` para forçar).
4. Configure as variáveis na Vercel (abaixo).

## Testes

```bash
npm run typecheck
npm run validate:questions          # esquema + viabilidade da matriz
npm test                            # unidade + integração (Postgres real)
npm run build && npm run test:e2e   # Playwright contra `next start` (inclui axe-core)
```

- **Unidade** (`tests/unit`): sorteio (matriz, reprodutibilidade, sem repetição, sem categorias adjacentes), pontuação, IRT,
  normas, estatística e **recálculo independente dos gabaritos** (sequências, quantitativos, memória, enumeração lógica,
  regras das matrizes figurais e distratores).
- **Integração** (`tests/integration`): fluxo completo no Postgres com a migração real — consentimento, ocultação de gabaritos,
  retomada, concorrência, isolamento entre usuários, idempotência, estímulo único, expiração, abandono, compartilhamento,
  vínculo de tentativas anônimas, estatísticas agregadas, exclusão em cascata e **políticas RLS** com os papéis
  `anon`/`authenticated`.
  Usa `TEST_DATABASE_URL` (padrão `postgres://postgres@127.0.0.1:5432/cognis_test`); sem Postgres, esses testes são pulados.
- **E2E** (`tests/e2e`): páginas públicas (axe WCAG 2 A/AA, links internos, layout móvel, cabeçalhos de segurança), avaliação
  completa, recarga, queda de conexão, teclado, memória, relatório, compartilhamento, contas, isolamento, admin, exportação e
  exclusão de conta. Usa `E2E_DATABASE_URL` (padrão `.../cognis_e2e`, recriado a cada execução).

## Deploy na Vercel

Guia passo a passo, sem terminal: [`DEPLOY-VERCEL.md`](DEPLOY-VERCEL.md). Para configurar o banco pelo editor SQL do Supabase, cole `supabase/setup-completo.sql` (migração + conteúdo, gerado por `npm run db:sql`); use esse arquivo **ou** `db:migrate` + `db:seed`, não os dois.

1. Importe o repositório e defina **Root Directory** = `apps/cognis`.
2. Configure as variáveis de ambiente (Production e Preview): `NEXT_PUBLIC_SITE_URL`, `DATABASE_URL` (pooler, porta 6543),
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAILS`.
3. Rode a migração e o seed contra o banco de produção (seção anterior) antes do primeiro acesso.
4. Verifique `GET /api/health` → `{"ok":true}`.

O rate limiting atual é em memória (por instância). Para limites globais em ambiente serverless, implemente a mesma interface
(`rateLimit`) com um armazenamento compartilhado, como Redis/Upstash.

## Banco de questões

Questões novas podem ser cadastradas **sem alterar código**: pelo painel (`/admin/questoes/nova`) ou adicionando objetos aos
arquivos `data/questions/*.json` e rodando `npm run db:seed`. Toda questão é validada pelo esquema em
`src/lib/questions/schema.ts` (gabarito existente, alternativas únicas, figura coerente com o formato, etc.). Só entram no
sorteio questões **ativas** e com estado **revisada**. Edições incrementam a versão do item e geram registro em
`admin_audit_log`.

Formatos: `text`, `matrix` (3×3 com uma célula ausente), `sequence`, `figure_choice` (rotação/reflexão) e `memory` (estímulo
exibido uma vez). Figuras são descritas por dados (`shape`, `fill`, `rotation`, `mirror`, `count`) e desenhadas em SVG, com
descrição textual para leitores de tela.

### Referências

As referências estão em `data/references.json` e na página `/referencias`. Os DOIs foram conferidos por busca bibliográfica
durante o desenvolvimento; dois documentos da ITC (2001 e 2006) estão sem DOI porque ele não pôde ser confirmado e, por isso,
apontam para o site da ITC. Recomenda-se uma conferência final de cada DOI em doi.org antes da publicação.

## Segurança e privacidade

- Gabaritos e estímulos nunca expostos antes do tempo; pontuação só no servidor; RLS + revogação de privilégios.
- Autorização no servidor em toda rota e página (admin verificado pelo papel no banco, não pela interface).
- Validação Zod de todos os corpos, limite de tamanho, verificação de mesma origem em requisições mutáveis,
  cookies `httpOnly`/`SameSite=Lax`/`Secure`, CSP e cabeçalhos de segurança, rate limiting por IP.
- Erros internos nunca são devolvidos ao cliente (mensagem genérica + log no servidor).
- LGPD: coleta mínima, consentimento no início da avaliação e no cadastro, exportação (`/api/account/export`) e exclusão
  definitiva em cascata, separação entre dados pessoais e estatísticas agregadas (o painel não mostra dados individuais).

## O que depende de configuração externa

- **Supabase**: projeto, chaves, Redirect URL de confirmação de e-mail e aplicação da migração. O código de integração
  (`src/lib/auth/session.ts`, `src/middleware.ts`, `src/app/auth/confirm`) está implementado, mas **não foi testado contra um
  projeto Supabase real** neste ambiente; os testes cobrem o mesmo esquema e as mesmas políticas RLS em Postgres 16 com o stub
  `db/local/auth-stub.sql`.
- **Vercel**: projeto e variáveis de ambiente.
- **Controlador de dados**: preencher na página de privacidade o nome do responsável e o canal do encarregado (LGPD, art. 41).
- **Calibração psicométrica**: exige estudo com amostra planejada; até lá, IRT e normas permanecem inativos por design.
