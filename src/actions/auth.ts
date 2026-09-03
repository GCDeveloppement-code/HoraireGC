"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { effacerCookieSession, poserCookieSession, utilisateurCourant } from "@/lib/auth";

export type EtatFormulaire = { erreur?: string } | undefined;

const schemaConnexion = z.object({
  email: z.string().trim().toLowerCase().email("Adresse email invalide"),
  motDePasse: z.string().min(1, "Mot de passe manquant"),
});

export async function connexion(_etat: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const parse = schemaConnexion.safeParse({
    email: formData.get("email"),
    motDePasse: formData.get("motDePasse"),
  });
  if (!parse.success) return { erreur: parse.error.issues[0]?.message ?? "Formulaire invalide" };

  const user = await db.user.findUnique({ where: { email: parse.data.email } });
  const ok = user && user.actif && (await bcrypt.compare(parse.data.motDePasse, user.passwordHash));
  if (!ok) return { erreur: "Email ou mot de passe incorrect" };

  await poserCookieSession({ userId: user.id, role: user.role });
  redirect(user.mustChangePassword ? "/reglages/mot-de-passe?premiere=1" : user.role === "RH" ? "/rh" : "/");
}

export async function deconnexion() {
  await effacerCookieSession();
  redirect("/connexion");
}

const schemaMotDePasse = z
  .object({
    actuel: z.string().min(1, "Mot de passe actuel manquant"),
    nouveau: z.string().min(8, "8 caractères minimum"),
    confirmation: z.string(),
  })
  .refine((d) => d.nouveau === d.confirmation, { message: "Les deux mots de passe ne correspondent pas", path: ["confirmation"] });

export async function changerMotDePasse(_etat: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const user = await utilisateurCourant();
  const parse = schemaMotDePasse.safeParse({
    actuel: formData.get("actuel"),
    nouveau: formData.get("nouveau"),
    confirmation: formData.get("confirmation"),
  });
  if (!parse.success) return { erreur: parse.error.issues[0]?.message ?? "Formulaire invalide" };
  if (!(await bcrypt.compare(parse.data.actuel, user.passwordHash))) return { erreur: "Mot de passe actuel incorrect" };

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(parse.data.nouveau, 12), mustChangePassword: false },
  });
  redirect(user.role === "RH" ? "/rh" : "/");
}
