# Publicar o Cognis na Vercel (passo a passo)

São 3 etapas: **banco de dados (Supabase)**, **Vercel** e **teste final**. Leva cerca de 15 minutos.
Você não precisa instalar nada no computador se usar o caminho A da etapa 2.

> O site precisa de um banco de dados para funcionar (avaliações, contas, resultados). Sem a etapa 1,
> ele abre, mas não consegue iniciar avaliações.

---

## Etapa 1 — Banco de dados no Supabase (gratuito)

1. Crie uma conta em https://supabase.com e clique em **New project**. Anote a senha do banco que você definir.
2. Quando o projeto terminar de ser criado, abra **SQL Editor** → **New query**.
3. Abra o arquivo `supabase/setup-completo.sql` (está dentro da pasta do projeto), copie **todo** o conteúdo,
   cole no editor e clique em **Run**. Deve aparecer "Success". Faça isso **uma única vez**.
4. Pegue as chaves:
   - **Project Settings → API**: copie a **Project URL** e a chave **anon / publishable**.
     Copie também a chave **service_role / secret** (ela é secreta: nunca publique).
   - Clique em **Connect** (no topo do projeto) → aba **Connection string** → **Transaction pooler**.
     Copie a URL (porta **6543**) e troque `[YOUR-PASSWORD]` pela senha do banco do passo 1.

## Etapa 2 — Publicar na Vercel

### Caminho A (recomendado, sem terminal): pelo GitHub

1. No GitHub, faça o merge do pull request do Cognis na branch `main` do repositório `claude-site-agency`.
2. Em https://vercel.com → **Add New… → Project** → importe o repositório `claude-site-agency`.
3. Em **Root Directory**, clique em **Edit** e escolha `apps/cognis`. O framework será detectado como **Next.js**.
4. Abra **Environment Variables** e adicione (valores da etapa 1):

   | Nome | Valor |
   |---|---|
   | `DATABASE_URL` | URL do Transaction pooler (porta 6543), com a senha |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave anon / publishable |
   | `SUPABASE_SERVICE_ROLE_KEY` | chave service_role / secret |
   | `ADMIN_EMAILS` | seu e-mail (vira administrador ao criar a conta) |
   | `NEXT_PUBLIC_SITE_URL` | deixe para depois (passo 6) |

5. Clique em **Deploy** e aguarde.
6. Copie o endereço do site (ex.: `https://cognis-xxxx.vercel.app`) e:
   - na Vercel: **Settings → Environment Variables**, crie `NEXT_PUBLIC_SITE_URL` com esse endereço e depois
     **Deployments → ⋯ → Redeploy**;
   - no Supabase: **Authentication → URL Configuration**: em **Site URL** coloque o endereço e, em
     **Redirect URLs**, adicione `https://SEU-ENDERECO/auth/confirm`.

### Caminho B: enviando a pasta (precisa do Node.js 20+ instalado)

1. Descompacte o arquivo `cognis-vercel.zip`.
2. Abra o terminal dentro da pasta `cognis` e rode `npx vercel` (faça login quando pedir; aceite as opções padrão).
3. Cadastre as mesmas variáveis do passo 4 em **Settings → Environment Variables** do projeto criado na Vercel.
4. Rode `npx vercel --prod` e siga o passo 6 do caminho A.

## Etapa 3 — Teste final

1. Abra `https://SEU-ENDERECO/status`. A página verifica as variáveis e o banco e diz, em português, o que
   corrigir. Tudo deve aparecer como OK (avisos em amarelo não impedem o funcionamento da avaliação).
2. Abra o site, clique em **Começar avaliação** e responda algumas questões.
3. Em **Entrar → Criar conta**, cadastre-se com o e-mail de `ADMIN_EMAILS`. O Supabase envia um e-mail de
   confirmação; depois de confirmar, entre e acesse `/admin`.

## Problemas comuns

| Sintoma | Causa e solução |
|---|---|
| Erro com "Código: …" ou `/status` mostra erro na conexão | `DATABASE_URL` errada: use o **Transaction pooler** (porta 6543) e a senha correta, sem colchetes. |
| "Nenhuma versão da avaliação está ativa" | O `setup-completo.sql` não foi executado. Rode-o no SQL Editor. |
| Link de confirmação de e-mail dá erro | Falta `https://SEU-ENDERECO/auth/confirm` nas Redirect URLs do Supabase. |
| Não consigo acessar `/admin` | O e-mail da conta precisa estar em `ADMIN_EMAILS`; depois de alterar, faça Redeploy e entre de novo. |
| Excluir conta falha | Falta `SUPABASE_SERVICE_ROLE_KEY` na Vercel. |
| O Supabase limita o envio de e-mails | O plano gratuito tem limite baixo; para uso real, configure um SMTP próprio em Authentication → Emails. |

Antes de divulgar o site, preencha na página `/privacidade` (arquivo `src/app/(site)/privacidade/page.tsx`)
o nome do responsável pelos dados e um contato, como exige a LGPD.
