import { utilisateurRH } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDuree, maintenantParis, solde, totaux } from "@/lib/calcul";
import { moisClos, parametres } from "@/lib/donnees";
import { EnteteRH } from "@/components/rh/EnteteRH";
import { PanneauPersonnes } from "./Formulaires";

export default async function PageRegles() {
  const rh = await utilisateurRH();
  const moisCourant = maintenantParis().date.slice(0, 7);
  const [p, users, decls, clos] = await Promise.all([
    parametres(),
    db.user.findMany({ orderBy: [{ actif: "desc" }, { equipe: "asc" }, { prenom: "asc" }] }),
    db.declaration.findMany({ select: { userId: true, date: true, moment: true, minutes: true, creeLe: true, statut: true } }),
    moisClos(moisCourant),
  ]);

  const duMois = decls.filter((d) => d.date.startsWith(moisCourant));
  const t = totaux(duMois);
  const soldeCollectif = users.reduce(
    (a, u) =>
      a +
      solde(
        u.soldeInitial,
        decls.filter((d) => d.userId === u.id),
        p.majoration,
      ),
    0,
  );
  const enEcart = users.filter((u) => duMois.some((d) => d.userId === u.id && d.minutes !== 0)).length;

  const personnes = users.map((u) => {
    const siennes = decls.filter((d) => d.userId === u.id);
    const ceMois = totaux(siennes.filter((d) => d.date.startsWith(moisCourant)));
    return {
      id: u.id,
      prenom: u.prenom,
      nom: u.nom ?? "",
      email: u.email,
      poste: u.poste ?? "",
      equipe: u.equipe ?? "Sans équipe",
      role: u.role as "SALARIE" | "RH",
      actif: u.actif,
      refMatin: u.refMatin,
      refPause: u.refPause,
      refMidi: u.refMidi,
      refSoir: u.refSoir,
      soldeInitial: fmtDuree(u.soldeInitial, false),
      ecart: fmtDuree(ceMois.sup + ceMois.retards),
      ecartMinutes: ceMois.sup + ceMois.retards,
      soldeActuel: fmtDuree(solde(u.soldeInitial, siennes, p.majoration)),
      estMoi: u.id === rh.id,
    };
  });

  return (
    <div className="rh">
      <EnteteRH
        prenom={rh.prenom}
        mois={moisCourant}
        moisCourant={moisCourant}
        clos={clos}
        onglet="regles"
        stats={[
          { k: "Heures sup du mois", v: fmtDuree(t.sup) },
          { k: "Solde collectif", v: fmtDuree(soldeCollectif) },
          { k: "Personnes en écart", v: `${enEcart} / ${users.length}` },
        ]}
        note="Les compteurs se recalculent à chaque enregistrement."
      />
      <PanneauPersonnes
        majoration={p.majoration}
        arrondiMinutes={p.arrondiMinutes}
        toleranceMinutes={p.toleranceMinutes}
        personnes={personnes}
        clos={clos}
      />
    </div>
  );
}
