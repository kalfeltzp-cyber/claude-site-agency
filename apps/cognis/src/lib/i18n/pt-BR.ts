export const ptBR = {
  status: {
    in_progress: "Em andamento",
    completed: "Concluída",
    expired: "Tempo esgotado",
    abandoned: "Abandonada",
  },
  difficulty: { 1: "Fácil", 2: "Médio", 3: "Difícil" } as Record<number, string>,
  outcome: { correct: "Corretas", incorrect: "Incorretas", unanswered: "Não respondidas" },
  scoreName: "Índice de Desempenho Cognitivo",
  scoreShort: "IDC",
  disclaimer:
    "Resultado experimental: descreve o desempenho nesta avaliação. Não é um QI, não é um diagnóstico e não determina inteligência, potencial ou valor de uma pessoa.",
  actions: {
    start: "Começar avaliação",
    resume: "Continuar avaliação",
    retake: "Fazer outra avaliação",
    fullReport: "Relatório completo",
    share: "Compartilhar",
    signIn: "Entrar",
    signOut: "Sair",
  },
};
