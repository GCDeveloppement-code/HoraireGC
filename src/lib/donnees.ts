import "server-only";
import { db } from "./db";
import type { Declaration, User } from "@/generated/prisma/client";
import { maintenantParis, semaineDe } from "./calcul";

/** Paramètres globaux (ligne unique, créée à la volée). */
export async function parametres() {
  return db.parametres.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

export async function moisClos(mois: string): Promise<boolean> {
  return !!(await db.cloture.findUnique({ where: { mois } }));
}

/** Déclarations d'une personne visibles sur l'écran d'accueil : la semaine en cours et le mois en cours. */
export async function declarationsAccueil(userId: string, dateDuJour: string) {
  const semaine = semaineDe(dateDuJour);
  const mois = dateDuJour.slice(0, 7);
  const debut = semaine[0] < `${mois}-01` ? semaine[0] : `${mois}-01`;
  const fin = semaine[4] > `${mois}-31` ? semaine[4] : `${mois}-31`;
  return db.declaration.findMany({
    where: { userId, date: { gte: debut, lte: fin } },
    orderBy: [{ date: "asc" }],
  });
}

/** Déclarations d'un mois pour une personne (historique). */
export async function declarationsDuMois(userId: string, mois: string) {
  return db.declaration.findMany({
    where: { userId, date: { startsWith: mois } },
    orderBy: [{ date: "desc" }],
  });
}

/** Toutes les déclarations de la personne (pour le solde). */
export async function toutesDeclarations(userId: string) {
  return db.declaration.findMany({ where: { userId } });
}

/** Forme sérialisable d'une déclaration pour les composants client. */
export type DeclarationDTO = {
  id: string;
  date: string;
  moment: "MATIN" | "MIDI" | "SOIR" | "RECUP";
  heure: string | null;
  minutes: number;
  libelle: string | null;
  motif: string | null;
  client: string | null;
  justification: string | null;
  statut: "DECLAREE" | "A_CONFIRMER" | "CONFIRMEE";
  creeLe: string;
  modifiee: boolean;
  /** Prénom de la personne RH qui a demandé une confirmation */
  demandeePar?: string;
};

export function versDTO(d: Declaration, demandeePar?: string): DeclarationDTO {
  return {
    id: d.id,
    date: d.date,
    moment: d.moment,
    heure: d.heure,
    minutes: d.minutes,
    libelle: d.libelle,
    motif: d.motif,
    client: d.client,
    justification: d.justification,
    statut: d.statut,
    creeLe: d.creeLe,
    modifiee: d.modifiee,
    demandeePar,
  };
}

/** Prénoms des personnes RH ayant demandé une confirmation, indexés par id. */
export async function prenomsDemandeurs(decls: Declaration[]): Promise<Map<string, string>> {
  const ids = Array.from(new Set(decls.map((d) => d.demandeeParId).filter((x): x is string => !!x)));
  if (!ids.length) return new Map();
  const users = await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, prenom: true } });
  return new Map(users.map((u) => [u.id, u.prenom]));
}

export type UtilisateurDTO = {
  id: string;
  prenom: string;
  role: "SALARIE" | "RH";
  refMatin: string;
  refPause: string;
  refMidi: string;
  refSoir: string;
  soldeInitial: number;
  rappelSoir: boolean;
};

export function utilisateurVersDTO(u: User): UtilisateurDTO {
  return {
    id: u.id,
    prenom: u.prenom,
    role: u.role,
    refMatin: u.refMatin,
    refPause: u.refPause,
    refMidi: u.refMidi,
    refSoir: u.refSoir,
    soldeInitial: u.soldeInitial,
    rappelSoir: u.rappelSoir,
  };
}

/** Prénom de la personne RH qui a demandé une confirmation (pour le bandeau). */
export async function prenomRH(): Promise<string> {
  const rh = await db.user.findFirst({ where: { role: "RH", actif: true }, orderBy: { createdAt: "asc" } });
  return rh?.prenom ?? "La RH";
}

export function aujourdhuiParis() {
  return maintenantParis();
}
