import { describe, expect, it } from "vitest";
import { explainDbError } from "@/lib/diagnostics";

describe("explainDbError", () => {
  const cases: [unknown, RegExp][] = [
    [{ code: "28P01", message: "password authentication failed for user" }, /Senha do banco incorreta/],
    [{ code: "XX000", message: "Tenant or user not found" }, /Usuário da DATABASE_URL inválido/],
    [{ message: 'role "postgres.abc" does not exist' }, /Usuário da DATABASE_URL inválido/],
    [{ code: "ENOTFOUND", message: "getaddrinfo ENOTFOUND db.x.supabase.co" }, /Transaction pooler/],
    [{ code: "ETIMEDOUT", message: "connect ETIMEDOUT" }, /Não foi possível conectar/],
    [{ code: "42P01", message: 'relation "public.test_versions" does not exist' }, /setup-completo\.sql/],
    [{ code: "3D000", message: 'database "x" does not exist' }, /não existe/],
    [new Error("DATABASE_URL não configurada."), /não está cadastrada/],
    [new Error("algo estranho"), /Erro inesperado/],
  ];
  it.each(cases)("traduz %o", (err, expected) => {
    expect(explainDbError(err)).toMatch(expected);
  });
});
