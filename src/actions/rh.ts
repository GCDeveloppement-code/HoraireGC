"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { utilisateurRH } from "@/lib/auth";
import { ecart } from "@/lib/calcul";
import { parametres } from "@/lib/donnees";

export type ResultatRH = { ok: true; message: string; secret?: string } | { ok: false; erreur: string };

function toutRevalider() {
  revalidatePath("/rh", "layout");
  revalidatePath("/");
}

export async function demanderConfirmation(id: string): Promise<ResultatRH> {
  const rh = await utilisateurRH();
  const d = await db.declaration.findUnique({ where: { id }, include: { user: true } });
  if (!d || d.moment === "RECUP") return { ok: false, erreur: "Introuvable" };
  await db.declaration.update({ where: { id }, data: { statut: "A_CONFIRMER", demandeeParId: rh.id } });
  toutRevalider();
  return { ok: true, message: `Demande envoyée à ${d.user.prenom}` };
}

export async function annulerDemande(id: string): Promise<ResultatRH> {
  await utilisateurRH();
  const d = await db.declaration.findUnique({ where: { id } });
  if (!d) return { ok: false, erreur: "Introuvable" };
  await db.declaration.update({ where: { id }, data: { statut: "DECLAREE", demandeeParId: null } });
  toutRevalider();
  return { ok: true, message: "Demande annulée" };
}

const moisSchema = z.string().regex(/^\d{4}-\d{2}$/);

export async function cloturerMois(mois: string): Promise<ResultatRH> {
  const rh = await utilisateurRH();
  if (!moisSchema.safeParse(mois).success) return { ok: false, erreur: "Mois invalide" };
  await db.cloture.upsert({ where: { mois }, update: {}, create: { mois, parId: rh.id } });
  toutRevalider();
  return { ok: true, message: "Mois clôturé : les compteurs sont figés" };
}

export async function rouvrirMois(mois: string): Promise<ResultatRH> {
  await utilisateurRH();
  await db.cloture.deleteMany({ where: { mois } });
  toutRevalider();
  return { ok: true, message: "Mois rouvert" };
}

export async function majParametres(formData: FormData): Promise<ResultatRH> {
  await utilisateurRH();
  const majoration = Number(formData.get("majoration"));
  const arrondi = Number(formData.get("arrondiMinutes"));
  const tolerance = Number(formData.get("toleranceMinutes"));
  if (![1, 1.25, 1.5].includes(majoration)) return { ok: false, erreur: "Majoration invalide" };
  if (![5, 10, 15, 30].includes(arrondi)) return { ok: false, erreur: "Arrondi invalide" };
  if (![0, 5, 10, 15, 20, 30].includes(tolerance)) return { ok: false, erreur: "Tolérance invalide" };
  const valeurs = { majoration, arrondiMinutes: arrondi, toleranceMinutes: tolerance };
  await db.parametres.upsert({ where: { id: 1 }, update: valeurs, create: { id: 1, ...valeurs } });
  toutRevalider();
  return { ok: true, message: "Règles enregistrées" };
}

const heure = z.string().regex(/^\d{2}:\d{2}$/, "Heure invalide");
const dureeTexte = z
  .string()
  .trim()
  .regex(/^[+-]?\s*\d{1,3}\s*h\s*\d{0,2}$/i, "Solde au format 5h30 ou -1h15");

function dureeVersMinutes(txt: string): number {
  const m = /^([+-]?)\s*(\d{1,3})\s*h\s*(\d{0,2})$/i.exec(txt.trim())!;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0));
}

const schemaUtilisateur = z.object({
  id: z.string(),
  prenom: z.string().trim().min(1, "Prénom manquant").max(60),
  nom: z.string().trim().max(60).optional(),
  email: z.string().trim().toLowerCase().email("Email invalide"),
  poste: z.string().trim().max(80).optional(),
  equipe: z.string().trim().max(60).optional(),
  role: z.enum(["SALARIE", "RH"]),
  actif: z.boolean(),
  refMatin: heure,
  refPause: heure,
  refMidi: heure,
  refSoir: heure,
  soldeInitial: dureeTexte,
});

export async function majUtilisateur(formData: FormData): Promise<ResultatRH> {
  const rh = await utilisateurRH();
  const parse = schemaUtilisateur.safeParse({
    id: formData.get("id"),
    prenom: formData.get("prenom"),
    nom: formData.get("nom") ?? undefined,
    email: formData.get("email"),
    poste: formData.get("poste") ?? undefined,
    equipe: formData.get("equipe") ?? undefined,
    role: formData.get("role"),
    actif: formData.get("actif") === "on",
    refMatin: formData.get("refMatin"),
    refPause: formData.get("refPause"),
    refMidi: formData.get("refMidi"),
    refSoir: formData.get("refSoir"),
    soldeInitial: formData.get("soldeInitial"),
  });
  if (!parse.success) return { ok: false, erreur: parse.error.issues[0]?.message ?? "Saisie invalide" };
  const d = parse.data;
  if (d.id === rh.id && (d.role !== "RH" || !d.actif)) return { ok: false, erreur: "Tu ne peux pas te retirer le rôle RH toi-même." };

  const avant = await db.user.findUnique({ where: { id: d.id } });
  if (!avant) return { ok: false, erreur: "Introuvable" };

  await db.user.update({
    where: { id: d.id },
    data: {
      prenom: d.prenom,
      nom: d.nom || null,
      email: d.email,
      poste: d.poste || null,
      equipe: d.equipe || null,
      role: d.role,
      actif: d.actif,
      refMatin: d.refMatin,
      refPause: d.refPause,
      refMidi: d.refMidi,
      refSoir: d.refSoir,
      soldeInitial: dureeVersMinutes(d.soldeInitial),
    },
  });

  // Les horaires ont changé : on recalcule les écarts déjà déclarés de la personne.
  const horairesChanges = avant.refMatin !== d.refMatin || avant.refMidi !== d.refMidi || avant.refSoir !== d.refSoir;
  if (horairesChanges) {
    const params = await parametres();
    const decls = await db.declaration.findMany({ where: { userId: d.id, moment: { not: "RECUP" } } });
    for (const x of decls) {
      if (!x.heure) continue;
      const minutes = ecart(x.moment as "MATIN" | "MIDI" | "SOIR", x.heure, d, params);
      if (minutes !== x.minutes) await db.declaration.update({ where: { id: x.id }, data: { minutes } });
    }
  }
  toutRevalider();
  return {
    ok: true,
    message: horairesChanges ? `${d.prenom} : horaires mis à jour, déclarations recalculées` : `${d.prenom} : enregistré`,
  };
}

function motDePasseProvisoire(): string {
  const mots = ["nuage", "soleil", "brume", "aurore", "ciel", "vent", "pluie", "givre", "braise", "marée"];
  const a = mots[Math.floor(Math.random() * mots.length)];
  const b = mots[Math.floor(Math.random() * mots.length)];
  return `${a}-${b}-${Math.floor(100 + Math.random() * 900)}`;
}

const schemaCreation = z.object({
  prenom: z.string().trim().min(1, "Prénom manquant").max(60),
  email: z.string().trim().toLowerCase().email("Email invalide"),
  poste: z.string().trim().max(80).optional(),
  equipe: z.string().trim().max(60).optional(),
  role: z.enum(["SALARIE", "RH"]),
});

export async function creerUtilisateur(formData: FormData): Promise<ResultatRH> {
  await utilisateurRH();
  const parse = schemaCreation.safeParse({
    prenom: formData.get("prenom"),
    email: formData.get("email"),
    poste: formData.get("poste") ?? undefined,
    equipe: formData.get("equipe") ?? undefined,
    role: formData.get("role") ?? "SALARIE",
  });
  if (!parse.success) return { ok: false, erreur: parse.error.issues[0]?.message ?? "Saisie invalide" };
  if (await db.user.findUnique({ where: { email: parse.data.email } })) return { ok: false, erreur: "Cet email a déjà un compte" };
  const provisoire = motDePasseProvisoire();
  await db.user.create({
    data: {
      prenom: parse.data.prenom,
      email: parse.data.email,
      poste: parse.data.poste || null,
      equipe: parse.data.equipe || null,
      role: parse.data.role,
      passwordHash: await bcrypt.hash(provisoire, 12),
      mustChangePassword: true,
    },
  });
  toutRevalider();
  return { ok: true, message: `Compte créé pour ${parse.data.prenom}`, secret: provisoire };
}

export async function reinitialiserMotDePasse(id: string): Promise<ResultatRH> {
  await utilisateurRH();
  const u = await db.user.findUnique({ where: { id } });
  if (!u) return { ok: false, erreur: "Introuvable" };
  const provisoire = motDePasseProvisoire();
  await db.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(provisoire, 12), mustChangePassword: true } });
  return { ok: true, message: `Mot de passe provisoire pour ${u.prenom}`, secret: provisoire };
}
