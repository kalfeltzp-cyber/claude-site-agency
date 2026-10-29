/** Erro de aplicação com status HTTP e código estável (mensagens seguras para o usuário). */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (what = "Recurso") => new AppError(404, "not_found", `${what} não encontrado.`);
export const forbidden = () => new AppError(403, "forbidden", "Acesso negado.");
export const unauthorized = () => new AppError(401, "unauthorized", "É necessário entrar na sua conta.");
export const badRequest = (msg = "Requisição inválida.") => new AppError(400, "bad_request", msg);
export const conflict = (code: string, msg: string) => new AppError(409, code, msg);
