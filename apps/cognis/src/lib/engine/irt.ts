/**
 * Modelos de Teoria de Resposta ao Item (Rasch/1PL e 2PL).
 *
 * Este módulo está pronto para uso FUTURO. Os itens atuais não possuem
 * parâmetros estimados com dados reais; por isso `estimateAbility` retorna
 * `null` sempre que algum item não estiver marcado como calibrado. Não há
 * parâmetros simulados apresentados como científicos.
 */

export interface ItemParams {
  a: number; // discriminação (1 no modelo Rasch)
  b: number; // dificuldade na escala θ
  calibrated: boolean;
}

export function probability(theta: number, p: Pick<ItemParams, "a" | "b">): number {
  return 1 / (1 + Math.exp(-p.a * (theta - p.b)));
}

export function testInformation(theta: number, params: Pick<ItemParams, "a" | "b">[]): number {
  return params.reduce((sum, p) => {
    const P = probability(theta, p);
    return sum + p.a * p.a * P * (1 - P);
  }, 0);
}

export interface AbilityEstimate {
  theta: number;
  standardError: number;
  method: "EAP";
}

/**
 * Estimativa EAP (expected a posteriori) com priori N(0, 1) por quadratura
 * de 81 pontos em [−4, 4]. EAP é finita mesmo com escores extremos (0% ou 100%).
 */
export function estimateAbility(
  responses: { correct: boolean; params: ItemParams }[],
): AbilityEstimate | null {
  if (responses.length === 0) return null;
  if (responses.some((r) => !r.params.calibrated)) return null;

  const points = 81;
  let num = 0;
  let den = 0;
  const nodes: { theta: number; w: number }[] = [];
  for (let k = 0; k < points; k++) {
    const theta = -4 + (8 * k) / (points - 1);
    let logLik = -0.5 * theta * theta;
    for (const r of responses) {
      const P = probability(theta, r.params);
      logLik += Math.log(r.correct ? P : 1 - P);
    }
    nodes.push({ theta, w: Math.exp(logLik) });
  }
  for (const n of nodes) {
    num += n.theta * n.w;
    den += n.w;
  }
  const mean = num / den;
  const variance = nodes.reduce((s, n) => s + (n.theta - mean) ** 2 * n.w, 0) / den;
  return { theta: mean, standardError: Math.sqrt(variance), method: "EAP" };
}
