/**
 * Conversão para escore padronizado (média 100, DP 15) SÓ é permitida a partir
 * de uma tabela normativa validada: amostra representativa, data de coleta,
 * população descrita e evidências de confiabilidade/validade documentadas.
 * Sem isso, a função retorna null e a interface não exibe nenhum "QI".
 */

export interface NormTable {
  id: string;
  testVersionId: string;
  population: string;
  sampleSize: number;
  collectedFrom: string;
  collectedTo: string;
  reliability: number | null;
  validated: boolean;
  /** Mapeia escore bruto → escore padronizado. */
  rawToStandard: Record<string, number>;
}

export const MIN_NORM_SAMPLE = 1000;

export function normIsUsable(table: NormTable | null | undefined): table is NormTable {
  return Boolean(
    table &&
      table.validated &&
      table.sampleSize >= MIN_NORM_SAMPLE &&
      table.reliability !== null &&
      table.reliability >= 0.8 &&
      Object.keys(table.rawToStandard).length > 0,
  );
}

export function normedScore(raw: number, testVersionId: string, table: NormTable | null | undefined): number | null {
  if (!normIsUsable(table) || table.testVersionId !== testVersionId) return null;
  const value = table.rawToStandard[String(raw)];
  return typeof value === "number" ? value : null;
}
