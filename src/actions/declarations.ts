"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { utilisateurCourant } from "@/lib/auth";
import { dureesRecup, ecart, maintenantParis, momentCourant, type MomentJour } from "@/lib/calcul";
import { moisClos, parametres } from "@/lib/donnees";

export type Resultat = { ok: true; message: string; id?: string; retiree?: boolean } | { ok: false; erreur: string };

const dateISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide");
const heureHM = z.string().regex(/^\d{2}:\d{2}$/, "Heure invalide");
const momentJour = z.enum(["MATIN", "MIDI", "SOIR"]);
const texteCourt = z.string().trim().max(120).optional().nullable();
const texteLong = z.string().trim().max(1000).optional().nullable();

const schemaDeclaration = z.object({
  id: z.string().optional().nullable(),
  date: dateISO,
  moment: momentJour,
  heure: heureHM,
  motif: texteCourt,
  client: texteCourt,
  justification: texteLong,
});

function vide(s: string | null | undefined) {
  return s && s.length ? s : null;
}

async function verifierMoisOuvert(date: string): Promise<string | null> {
  if (await moisClos(date.slice(0, 7))) return "Ce mois est clôturé : plus de modification possible, vois avec la RH.";
  return null;
}

/** Un tap sur le gros bouton : enregistre l'écart à l'heure courante (heure de Paris, côté serveur). */
export async function declarerMaintenant(momentDemande?: MomentJour): Promise<Resultat> {
  const user = await utilisateurCourant();
  const { date, heure } = maintenantParis();
  const moment = momentDemande ?? momentCourant(heure);
  const bloque = await verifierMoisOuvert(date);
  if (bloque) return { ok: false, erreur: bloque };

  const existante = await db.declaration.findUnique({ where: { userId_date_moment: { userId: user.id, date, moment } } });
  if (existante) return { ok: false, erreur: "Déjà déclaré pour ce moment : touche la ligne pour modifier." };

  const params = await parametres();
  const minutes = ecart(moment, heure, user, params.arrondiMinutes);
  if (minutes === 0) return { ok: true, message: "Dans l’horaire, rien à déclarer" };

  const d = await db.declaration.create({
    data: { userId: user.id, date, moment, heure, minutes, creeLe: date },
  });
  revalidatePath("/");
  return { ok: true, message: "Déclaré", id: d.id };
}

/** Enregistre ou modifie une déclaration (heure choisie, motif, client, justification). */
export async function enregistrerDeclaration(entree: z.input<typeof schemaDeclaration>): Promise<Resultat> {
  const user = await utilisateurCourant();
  const parse = schemaDeclaration.safeParse(entree);
  if (!parse.success) return { ok: false, erreur: parse.error.issues[0]?.message ?? "Saisie invalide" };
  const { id, date, moment, heure } = parse.data;
  const { date: aujourdhui } = maintenantParis();
  if (date > aujourdhui) return { ok: false, erreur: "On ne déclare pas un jour à venir." };
  const bloque = await verifierMoisOuvert(date);
  if (bloque) return { ok: false, erreur: bloque };

  const params = await parametres();
  const minutes = ecart(moment, heure, user, params.arrondiMinutes);
  const existante = id
    ? await db.declaration.findFirst({ where: { id, userId: user.id } })
    : await db.declaration.findUnique({ where: { userId_date_moment: { userId: user.id, date, moment } } });

  if (minutes === 0) {
    if (existante) {
      await db.declaration.delete({ where: { id: existante.id } });
      revalidatePath("/");
      return { ok: true, message: "Dans l’horaire : déclaration retirée", retiree: true };
    }
    return { ok: true, message: "Dans l’horaire, rien à déclarer", retiree: true };
  }

  const champs = {
    motif: vide(parse.data.motif),
    client: vide(parse.data.client),
    justification: vide(parse.data.justification),
  };

  if (existante) {
    const heureChangee = existante.heure !== heure;
    const d = await db.declaration.update({
      where: { id: existante.id },
      data: {
        heure,
        minutes,
        ...champs,
        modifiee: existante.modifiee || heureChangee,
        statut: heureChangee && existante.statut === "A_CONFIRMER" ? "CONFIRMEE" : existante.statut,
      },
    });
    revalidatePath("/");
    return { ok: true, message: heureChangee ? "Modifié" : "Enregistré", id: d.id };
  }

  const d = await db.declaration.create({
    data: { userId: user.id, date, moment, heure, minutes, creeLe: aujourdhui, ...champs },
  });
  revalidatePath("/");
  return { ok: true, message: date !== aujourdhui ? "Déclaré après coup" : "Déclaré", id: d.id };
}

export async function supprimerDeclaration(id: string): Promise<Resultat> {
  const user = await utilisateurCourant();
  const d = await db.declaration.findFirst({ where: { id, userId: user.id } });
  if (!d) return { ok: false, erreur: "Introuvable" };
  const bloque = await verifierMoisOuvert(d.date);
  if (bloque) return { ok: false, erreur: bloque };
  await db.declaration.delete({ where: { id } });
  revalidatePath("/");
  return { ok: true, message: d.moment === "RECUP" ? "Récup annulée" : "Déclaration supprimée" };
}

const schemaRecup = z.object({
  id: z.string().optional().nullable(),
  date: dateISO,
  cle: z.enum(["am", "pm", "day"]),
});

export async function poserRecup(entree: z.input<typeof schemaRecup>): Promise<Resultat> {
  const user = await utilisateurCourant();
  const parse = schemaRecup.safeParse(entree);
  if (!parse.success) return { ok: false, erreur: parse.error.issues[0]?.message ?? "Saisie invalide" };
  const { id, date, cle } = parse.data;
  const bloque = await verifierMoisOuvert(date);
  if (bloque) return { ok: false, erreur: bloque };
  const duree = dureesRecup(user).find((d) => d.cle === cle)!;
  const { date: aujourdhui } = maintenantParis();

  if (id) {
    const existante = await db.declaration.findFirst({ where: { id, userId: user.id, moment: "RECUP" } });
    if (!existante) return { ok: false, erreur: "Introuvable" };
    const conflit = await db.declaration.findUnique({ where: { userId_date_moment: { userId: user.id, date, moment: "RECUP" } } });
    if (conflit && conflit.id !== id) return { ok: false, erreur: "Il y a déjà une récup ce jour-là." };
    await db.declaration.update({ where: { id }, data: { date, minutes: duree.minutes, libelle: duree.libelle } });
    revalidatePath("/");
    return { ok: true, message: "Récup modifiée", id };
  }
  const conflit = await db.declaration.findUnique({ where: { userId_date_moment: { userId: user.id, date, moment: "RECUP" } } });
  if (conflit) return { ok: false, erreur: "Il y a déjà une récup ce jour-là : touche-la pour la modifier." };
  const d = await db.declaration.create({
    data: { userId: user.id, date, moment: "RECUP", minutes: duree.minutes, libelle: duree.libelle, creeLe: aujourdhui },
  });
  revalidatePath("/");
  return { ok: true, message: "Récup posée", id: d.id };
}

/** Le salarié confirme une déclaration que la RH lui a demandé de vérifier. */
export async function confirmerDeclaration(id: string): Promise<Resultat> {
  const user = await utilisateurCourant();
  const d = await db.declaration.findFirst({ where: { id, userId: user.id } });
  if (!d) return { ok: false, erreur: "Introuvable" };
  await db.declaration.update({ where: { id }, data: { statut: "CONFIRMEE" } });
  revalidatePath("/");
  return { ok: true, message: "Merci, la RH est prévenue" };
}

export async function reglerRappelSoir(actif: boolean): Promise<Resultat> {
  const user = await utilisateurCourant();
  await db.user.update({ where: { id: user.id }, data: { rappelSoir: actif } });
  revalidatePath("/");
  return { ok: true, message: actif ? "Rappel du soir activé" : "Rappel du soir désactivé" };
}
