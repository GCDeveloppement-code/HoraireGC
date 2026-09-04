import { utilisateurRH } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDuree, maintenantParis, solde } from "@/lib/calcul";
import { moisClos, parametres } from "@/lib/donnees";
import { EnteteRH } from "@/components/rh/EnteteRH";
import { FormulaireCreation, FormulaireRegles, LigneUtilisateur } from "./Formulaires";

export default async function PageRegles() {
  const rh = await utilisateurRH();
  const moisCourant = maintenantParis().date.slice(0, 7);
  const [p, users, decls, clos] = await Promise.all([
    parametres(),
    db.user.findMany({ orderBy: [{ actif: "desc" }, { equipe: "asc" }, { prenom: "asc" }] }),
    db.declaration.findMany({ select: { userId: true, date: true, moment: true, minutes: true, creeLe: true, statut: true } }),
    moisClos(moisCourant),
  ]);
  const equipes = Array.from(new Set(users.map((u) => u.equipe).filter(Boolean))) as string[];
  const actifs = users.filter((u) => u.actif).length;

  return (
    <div className="rh">
      <EnteteRH prenom={rh.prenom} mois={moisCourant} moisCourant={moisCourant} clos={clos} onglet="regles" />
      <div className="rh-grille">
        <div className="card">
          <h2>Règles de calcul</h2>
          <FormulaireRegles majoration={p.majoration} arrondiMinutes={p.arrondiMinutes} toleranceMinutes={p.toleranceMinutes} />
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Personnes et horaires</h2>
            <span className="compte">
              {actifs} actif{actifs > 1 ? "s" : ""} sur {users.length}
            </span>
          </div>
          <div className="table-wrap nu">
            <table className="ptable">
              <thead>
                <tr>
                  <th>Personne</th>
                  <th>Email</th>
                  <th>Équipe et poste</th>
                  <th>Horaires</th>
                  <th className="r">Départ</th>
                  <th className="r">Solde</th>
                  <th>Rôle</th>
                  <th>Actif</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <LigneUtilisateur
                    key={u.id}
                    u={{
                      id: u.id,
                      prenom: u.prenom,
                      nom: u.nom ?? "",
                      email: u.email,
                      poste: u.poste ?? "",
                      equipe: u.equipe ?? "",
                      role: u.role,
                      actif: u.actif,
                      refMatin: u.refMatin,
                      refPause: u.refPause,
                      refMidi: u.refMidi,
                      refSoir: u.refSoir,
                      soldeInitial: fmtDuree(u.soldeInitial, false),
                    }}
                    soldeActuel={fmtDuree(
                      solde(
                        u.soldeInitial,
                        decls.filter((d) => d.userId === u.id),
                        p.majoration,
                      ),
                    )}
                    estMoi={u.id === rh.id}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2>Ajouter une personne</h2>
          <FormulaireCreation equipes={equipes} />
        </div>
      </div>
    </div>
  );
}
