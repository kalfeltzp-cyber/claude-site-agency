/** Metadados e navegação compartilhados (seguros para cliente e servidor). */
export const SITE = {
  name: "Cognis",
  fullName: "Cognis — Cognitive Assessment",
  tagline: "Avaliação experimental de raciocínio, com metodologia transparente.",
  description:
    "Plataforma experimental de avaliação de habilidades de raciocínio: 36 questões originais em 10 categorias, correção automática, análise de desempenho e metodologia científica aberta. Não é um teste de QI clínico.",
  locale: "pt-BR",
};

export const NAV = [
  { href: "/como-funciona", label: "Como funciona" },
  { href: "/metodologia", label: "Metodologia" },
  { href: "/referencias", label: "Referências" },
  { href: "/faq", label: "Perguntas" },
  { href: "/historico", label: "Histórico" },
] as const;

export const FOOTER_NAV = [
  { href: "/como-funciona", label: "Como funciona" },
  { href: "/metodologia", label: "Metodologia científica" },
  { href: "/referencias", label: "Referências" },
  { href: "/faq", label: "Perguntas frequentes" },
  { href: "/privacidade", label: "Privacidade e dados" },
] as const;
