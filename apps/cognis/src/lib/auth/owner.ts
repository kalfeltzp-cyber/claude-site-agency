/** Dono de uma tentativa: conta autenticada ou sessão anônima (hash do cookie). */
export interface Owner {
  userId: string | null;
  anonHash: string | null;
}
