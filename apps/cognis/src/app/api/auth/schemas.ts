import { z } from "zod";

export const credentialsSchema = z
  .object({
    email: z.email("E-mail inválido.").max(254),
    password: z.string().min(1).max(200),
  })
  .strict();

export const signupSchema = z
  .object({
    email: z.email("E-mail inválido.").max(254),
    password: z
      .string()
      .min(10, "A senha deve ter pelo menos 10 caracteres.")
      .max(200)
      .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), "A senha deve combinar letras e números."),
    displayName: z.string().trim().max(80).optional().transform((v) => v || null),
    acceptPrivacy: z.literal(true, { error: "É necessário aceitar a política de privacidade." }),
  })
  .strict();
