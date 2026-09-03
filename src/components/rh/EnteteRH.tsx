import Link from "next/link";
import { fmtMois } from "@/lib/calcul";
import { moisVoisins } from "@/lib/rh";
import { BoutonCloture } from "./BoutonCloture";

export function EnteteRH({
  prenom,
  mois,
  moisCourant,
  clos,
  onglet,
}: {
  prenom: string;
  mois: string;
  moisCourant: string;
  clos: boolean;
  onglet: "compteurs" | "regles";
}) {
  const { precedent, suivant } = moisVoisins(mois);
  return (
    <>
      <header className="rh-head">
        <div>
          <div className="eyebrow">Vue RH · {prenom}</div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link href={`/rh?mois=${precedent}`} aria-label="Mois précédent" className="rbtn" style={{ padding: "4px 12px" }}>
              ‹
            </Link>
            {fmtMois(mois)}
            {mois < moisCourant && (
              <Link href={`/rh?mois=${suivant}`} aria-label="Mois suivant" className="rbtn" style={{ padding: "4px 12px" }}>
                ›
              </Link>
            )}
          </h1>
          <div className="muted">
            {clos ? "Mois clôturé : les compteurs sont figés, l’export est définitif pour la paie." : "Mois ouvert : les salariés peuvent encore déclarer et corriger."}
          </div>
        </div>
        <div className="rh-actions">
          <a className="rbtn" href={`/rh/export?mois=${mois}`}>
            Exporter pour la paie
          </a>
          <BoutonCloture mois={mois} clos={clos} />
        </div>
      </header>
      <nav className="tabs">
        <Link href={`/rh?mois=${mois}`} className={onglet === "compteurs" ? "on" : ""}>
          Compteurs
        </Link>
        <Link href="/rh/regles" className={onglet === "regles" ? "on" : ""}>
          Règles et horaires
        </Link>
        <Link href="/">Mon écran</Link>
      </nav>
    </>
  );
}
