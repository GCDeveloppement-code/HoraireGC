import { redirect } from "next/navigation";
import { utilisateurCourant } from "@/lib/auth";
import { maintenantParis } from "@/lib/calcul";
import { declarationsAccueil, moisClos, parametres, prenomRH, prenomsDemandeurs, toutesDeclarations, utilisateurVersDTO, versDTO } from "@/lib/donnees";
import { Accueil } from "@/components/salarie/Accueil";

export const dynamic = "force-dynamic";

export default async function PageAccueil() {
  const user = await utilisateurCourant();
  if (user.mustChangePassword) redirect("/reglages/mot-de-passe?premiere=1");
  const { date } = maintenantParis();
  const mois = date.slice(0, 7);
  const [decls, toutes, params, clos, rh] = await Promise.all([
    declarationsAccueil(user.id, date),
    toutesDeclarations(user.id),
    parametres(),
    moisClos(mois),
    prenomRH(),
  ]);
  const demandeurs = await prenomsDemandeurs(decls);
  return (
    <Accueil
      utilisateur={utilisateurVersDTO(user)}
      declarations={decls.map((d) => versDTO(d, d.demandeeParId ? demandeurs.get(d.demandeeParId) : undefined))}
      toutes={toutes.map((d) => ({ date: d.date, moment: d.moment, minutes: d.minutes, creeLe: d.creeLe, statut: d.statut }))}
      aujourdhui={date}
      moisClos={clos}
      majoration={params.majoration}
      prenomRH={rh}
    />
  );
}
