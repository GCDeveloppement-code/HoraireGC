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

  return (
    <div className="rh">
      <EnteteRH prenom={rh.prenom} mois={moisCourant} moisCourant={moisCourant} clos={clos} onglet="regles" />
      <div style={{ display: "grid", gap: 18, maxWidth: 1100 }}>
        <div className="card">
          <h2>Règles de calcul</h2>
          <p>
            Elles s’appliquent à tout le monde. La tolérance, c’est la marge avant de compter : finir à 17h40 ou arriver à 9h10 ne donne
            rien tant que l’écart tient dedans, dans un sens comme dans l’autre. Au-delà, l’écart entier est retenu, arrondi. La majoration
            transforme les heures sup en temps de récup ; les retards et les récups se déduisent tels quels. Changer la majoration recalcule
            tous les soldes affichés ; la tolérance et l’arrondi valent pour les prochaines déclarations, les existantes gardent leur
            valeur.
          </p>
          <FormulaireRegles majoration={p.majoration} arrondiMinutes={p.arrondiMinutes} toleranceMinutes={p.toleranceMinutes} />
          <div className="prow">
            <span className="k">Déclaration après coup</span>
            <span>autorisée jusqu’à la clôture, marquée « après coup »</span>
          </div>
        </div>

        <div className="card">
          <h2>Personnes, horaires et soldes de départ</h2>
          <p>
            Horaires GC par défaut : 9h · 12h30 · 14h · 17h30, ajustables par personne (temps partiel, horaires décalés). Modifier les
            horaires recalcule les déclarations déjà faites. Le solde de départ est repris de l’Excel, au format 5h30 ou -1h15.
          </p>
          <div className="table-wrap" style={{ border: 0, borderRadius: 0, background: "transparent" }}>
            <table className="ptable">
              <thead>
                <tr>
                  <th>Personne</th>
                  <th>Email</th>
                  <th>Équipe · poste</th>
                  <th>Début</th>
                  <th>Pause</th>
                  <th>Reprise</th>
                  <th>Fin</th>
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
          <p>Un mot de passe provisoire est généré : donne-le lui, il devra le changer à sa première connexion.</p>
          <FormulaireCreation equipes={equipes} />
        </div>
      </div>
    </div>
  );
}
