import "server-only";
import { db } from "./db";
import { solde, totaux, type Totaux } from "./calcul";

export type LignePersonne = {
  id: string;
  prenom: string;
  nom: string | null;
  poste: string | null;
  equipe: string | null;
  role: "SALARIE" | "RH";
  actif: boolean;
  refMatin: string;
  refPause: string;
  refMidi: string;
  refSoir: string;
  soldeInitial: number;
  solde: number;
  totaux: Totaux;
};

/** Toutes les personnes actives avec leur solde global et les totaux du mois demandé. */
export async function tableauDuMois(mois: string): Promise<LignePersonne[]> {
  const [users, params, decls] = await Promise.all([
    db.user.findMany({ where: { actif: true }, orderBy: [{ equipe: "asc" }, { prenom: "asc" }] }),
    db.parametres.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),
    db.declaration.findMany({ where: { user: { actif: true } } }),
  ]);
  return users.map((u) => {
    const siennes = decls.filter((d) => d.userId === u.id);
    return {
      id: u.id,
      prenom: u.prenom,
      nom: u.nom,
      poste: u.poste,
      equipe: u.equipe,
      role: u.role,
      actif: u.actif,
      refMatin: u.refMatin,
      refPause: u.refPause,
      refMidi: u.refMidi,
      refSoir: u.refSoir,
      soldeInitial: u.soldeInitial,
      solde: solde(u.soldeInitial, siennes, params.majoration),
      totaux: totaux(siennes.filter((d) => d.date.startsWith(mois))),
    };
  });
}

/** Mois voisins pour la navigation (YYYY-MM). */
export function moisVoisins(mois: string): { precedent: string; suivant: string } {
  const [y, m] = mois.split("-").map(Number);
  const p = new Date(Date.UTC(y, m - 2, 1));
  const s = new Date(Date.UTC(y, m, 1));
  const f = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  return { precedent: f(p), suivant: f(s) };
}
