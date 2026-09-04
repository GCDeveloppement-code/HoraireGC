import Link from "next/link";
import { fmtMois } from "@/lib/calcul";
import { moisVoisins } from "@/lib/rh";
import { BoutonCloture } from "./BoutonCloture";

export type Stat = { k: string; v: string };

export function EnteteRH({
  prenom,
  mois,
  moisCourant,
  clos,
  onglet,
  stats,
  note,
}: {
  prenom: string;
  mois: string;
  moisCourant: string;
  clos: boolean;
  onglet: "compteurs" | "regles";
  stats?: Stat[];
  note?: string;
}) {
  const { precedent, suivant } = moisVoisins(mois);
  return (
    <>
      <header className="rh-head">
        <div>
          <div className="eyebrow">Vue RH — {prenom}</div>
          <div className="titre-mois">
            <Link href={`/rh?mois=${precedent}`} aria-label="Mois précédent" className="rond">
              ‹
            </Link>
            <h1>{fmtMois(mois)}</h1>
            {mois < moisCourant && (
              <Link href={`/rh?mois=${suivant}`} aria-label="Mois suivant" className="rond">
                ›
              </Link>
            )}
            <span className={`etat${clos ? " clos" : ""}`}>{clos ? "Mois clôturé" : "Mois ouvert"}</span>
          </div>
        </div>
        <div className="rh-actions">
          <a className="rbtn" href={`/rh/export?mois=${mois}`}>
            Exporter pour la paie
          </a>
          <BoutonCloture mois={mois} clos={clos} />
        </div>
      </header>

      {stats && stats.length > 0 && (
        <div className="stats">
          {stats.map((s, i) => (
            <div key={s.k} style={{ display: "contents" }}>
              {i > 0 && <div className="sep" />}
              <div>
                <div className="k">{s.k}</div>
                <div className="v tnum">{s.v}</div>
              </div>
            </div>
          ))}
          {note && <div className="note">{note}</div>}
        </div>
      )}

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
