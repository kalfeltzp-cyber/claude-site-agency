import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Privacidade e tratamento de dados",
  description: "Política de privacidade do Cognis conforme a LGPD: dados coletados, finalidades, bases legais, retenção, direitos e exclusão.",
  alternates: { canonical: "/privacidade" },
};
export const dynamic = "force-static";

export default function PrivacyPage() {
  return (
    <div className="container pb-16">
      <PageHeader eyebrow="Privacidade" title="Privacidade e tratamento de dados">
        Coletamos o mínimo necessário para aplicar a avaliação, mostrar seus resultados e melhorar a qualidade das questões.
        Esta política segue a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
      </PageHeader>
      <article className="prose-cognis mt-10 max-w-3xl">
        <p className="text-sm">Versão de 29 de outubro de 2026.</p>

        <h2>1. Quem trata os dados</h2>
        <p>
          O controlador é o responsável pela publicação desta instância do Cognis. Antes de publicar, o operador deve informar aqui seu
          nome ou razão social e um canal de contato para o encarregado de dados (LGPD, art. 41). Solicitações de titulares também
          podem ser feitas diretamente pelas ferramentas do <Link href="/perfil">perfil</Link>.
        </p>

        <h2>2. Dados coletados</h2>
        <ul>
          <li><strong>Sem conta:</strong> um identificador aleatório de sessão em cookie (o servidor guarda apenas um hash dele), as respostas, os tempos por questão e o resultado.</li>
          <li><strong>Com conta:</strong> e-mail, senha (armazenada apenas como hash), nome de exibição opcional e a data de aceite desta política, além das avaliações.</li>
          <li><strong>Técnicos:</strong> o endereço IP é usado em memória para limitar abusos (rate limiting) e não é gravado no banco de dados pela aplicação.</li>
        </ul>
        <p>Não coletamos dados de saúde, documentos, localização, nem usamos cookies de publicidade ou rastreamento de terceiros.</p>

        <h2>3. Finalidades e bases legais</h2>
        <ul>
          <li>Aplicar a avaliação, corrigir e exibir resultados — execução do serviço solicitado por você (art. 7º, V).</li>
          <li>Manter conta e histórico — execução do serviço e consentimento (art. 7º, I e V).</li>
          <li>Estatísticas agregadas para melhorar as questões — legítimo interesse, sempre de forma agregada e sem identificação (art. 7º, IX).</li>
          <li>Segurança e prevenção de abuso — legítimo interesse (art. 7º, IX).</li>
        </ul>

        <h2>4. O que não fazemos</h2>
        <ul>
          <li>Não vendemos nem compartilhamos dados individuais.</li>
          <li>Não usamos resultados para decisões automatizadas sobre você, nem para fins médicos, educacionais ou profissionais.</li>
          <li>Administradores não têm acesso a resultados individuais identificados — apenas a estatísticas agregadas.</li>
        </ul>

        <h2>5. Compartilhamento</h2>
        <p>
          Os dados ficam em infraestrutura de banco de dados e autenticação contratada pelo operador (por exemplo, Supabase) e de
          hospedagem (por exemplo, Vercel), que atuam como operadores. Um resultado só é visível a terceiros se você gerar um link de
          compartilhamento, que mostra um resumo anônimo e pode ser desativado a qualquer momento.
        </p>

        <h2>6. Retenção</h2>
        <ul>
          <li>Sem conta: o cookie de sessão expira em 30 dias; os dados da avaliação permanecem para estatísticas agregadas sem vínculo com pessoa identificada.</li>
          <li>Com conta: enquanto a conta existir. Ao excluir a conta, perfil, tentativas, respostas e resultados são apagados definitivamente.</li>
        </ul>

        <h2>7. Seus direitos</h2>
        <p>Você pode, a qualquer momento (art. 18):</p>
        <ul>
          <li>acessar e baixar seus dados (botão “Baixar meus dados” no perfil);</li>
          <li>corrigir o nome de exibição;</li>
          <li>excluir a conta e todos os dados associados;</li>
          <li>revogar o consentimento, o que equivale à exclusão da conta;</li>
          <li>obter informações sobre o compartilhamento descrito acima.</li>
        </ul>

        <h2>8. Segurança</h2>
        <p>
          Senhas com hash, comunicação cifrada (HTTPS), cookies httpOnly, controle de acesso no servidor e políticas de segurança em
          nível de linha no banco de dados, validação de entradas e limitação de requisições. Nenhum sistema é totalmente imune a
          incidentes; em caso de incidente relevante, os titulares e a ANPD serão comunicados conforme a lei.
        </p>

        <h2>9. Crianças e adolescentes</h2>
        <p>O Cognis não se destina a menores de 18 anos sem o acompanhamento e o consentimento de um responsável.</p>

        <h2>10. Alterações</h2>
        <p>Mudanças relevantes nesta política serão indicadas nesta página com nova data de versão.</p>
      </article>
    </div>
  );
}
