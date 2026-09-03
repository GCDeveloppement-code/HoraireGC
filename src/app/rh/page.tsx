import Link from "next/link";
import { utilisateurRH } from "@/lib/auth";
import { fmtDuree, maintenantParis } from "@/lib/calcul";
import { moisClos } from "@/lib/donnees";
import { tableauDuMois } from "@/lib/rh";
import { EnteteRH } from "@/components/rh/EnteteRH";

const MOIS_RE = /^\d{4}-\d{2}$/;

export default async function PageCompteurs({ searchParams }: { searchParams: Promise<{ mois?: string; filtre?: string }> }) {
  const rh = await utilisateurRH();
  const { mois: moisParam, filtre = "tous" } = await searchParams;
  const moisCourant = maintenantParis().date.slice(0, 7);
  const mois = moisParam && MOIS_RE.test(moisParam) ? moisParam : moisCourant;
  const [lignes, clos] = await Promise.all([tableauDuMois(mois), moisClos(mois)]);

  const agg = lignes.reduce(
    (a, l) => {
      a.sup += l.totaux.sup;
      a.retards += l.totaux.retards;
      a.recups += l.totaux.recups;
      a.apres += l.totaux.apresCoup;
      a.aconf += l.totaux.aConfirmer;
      a.nbRecups += l.totaux.nb - (l.totaux.sup || l.totaux.retards ? 0 : 0);
      return a;
    },
    { sup: 0, retards: 0, recups: 0, apres: 0, aconf: 0, nbRecups: 0 },
  );
  const nbSup = lignes.filter((l) => l.totaux.sup > 0).length;
  const verif = agg.apres + agg.aconf;
  const maxSup = Math.max(60, ...lignes.map((l) => l.totaux.sup));
  const visibles = lignes.filter((l) =>
    filtre === "verif" ? l.totaux.aConfirmer > 0 || l.totaux.apresCoup > 0 : filtre === "inhabituel" ? l.totaux.sup >= 480 : true,
  );
  const pl = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

  return (
    <div className="rh">
      <EnteteRH prenom={rh.prenom} mois={mois} moisCourant={moisCourant} clos={clos} onglet="compteurs" />

      <div className="tiles">
        <div className="tile">
          <div className="k">Heures sup du mois</div>
          <div className="v tnum">{fmtDuree(agg.sup)}</div>
          <div className="s">
            {pl(nbSup, "personne")} sur {lignes.length} · retards {fmtDuree(agg.retards)}
          </div>
        </div>
        <div className="tile">
          <div className="k">Récups posées</div>
          <div className="v tnum">{fmtDuree(agg.recups)}</div>
          <div className="s">déduites des soldes</div>
        </div>
        <div className={`tile${verif ? " attn" : ""}`}>
          <div className="k">À vérifier</div>
          <div className="v tnum">{verif}</div>
          <div className="s">{verif ? `${pl(agg.apres, "ligne")} après coup · ${agg.aconf} à confirmer` : "rien en attente"}</div>
        </div>
      </div>

      <div className="filters">
        <span className="lbl">Afficher</span>
        <Link href={`/rh?mois=${mois}`} className={filtre === "tous" ? "on" : ""}>
          Tout le monde
        </Link>
        <Link href={`/rh?mois=${mois}&filtre=verif`} className={filtre === "verif" ? "on" : ""}>
          À vérifier
        </Link>
        <Link href={`/rh?mois=${mois}&filtre=inhabituel`} className={filtre === "inhabituel" ? "on" : ""}>
          Volume inhabituel
        </Link>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Personne</th>
              <th className="r">Solde</th>
              <th>Heures sup du mois</th>
              <th className="r">Retards</th>
              <th className="r">Récups</th>
              <th>À vérifier</th>
            </tr>
          </thead>
          <tbody>
            {visibles.length ? (
              visibles.map((l) => (
                <tr key={l.id} className="clic">
                  <td>
                    <Link href={`/rh/personnes/${l.id}?mois=${mois}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                      <div className="who">{l.prenom}</div>
                      <div className="poste">{[l.equipe, l.poste].filter(Boolean).join(" · ")}</div>
                    </Link>
                  </td>
                  <td className={`r bal ${l.solde > 0 ? "r-hs" : l.solde < 0 ? "r-late" : ""}`}>{fmtDuree(l.solde)}</td>
                  <td>
                    {l.totaux.sup > 0 ? (
                      <>
                        <span className="tnum">{fmtDuree(l.totaux.sup)}</span>
                        <span className="bar" style={{ width: Math.round((l.totaux.sup / maxSup) * 110) }} />
                        {l.totaux.sup >= 480 && <span className="rchip warn" style={{ marginLeft: 8 }}>inhabituel</span>}
                      </>
                    ) : (
                      <span className="zero">0h00</span>
                    )}
                  </td>
                  <td className="r">{l.totaux.retards < 0 ? <span className="r-late">{fmtDuree(l.totaux.retards)}</span> : <span className="zero">0h00</span>}</td>
                  <td className="r">{l.totaux.recups < 0 ? <span className="r-recup">{fmtDuree(l.totaux.recups)}</span> : <span className="zero">0h00</span>}</td>
                  <td>
                    {l.totaux.apresCoup > 0 && <span className="rchip">{l.totaux.apresCoup} après coup</span>}{" "}
                    {l.totaux.aConfirmer > 0 && <span className="rchip warn">{l.totaux.aConfirmer} à confirmer</span>}
                    {!l.totaux.apresCoup && !l.totaux.aConfirmer && <span className="zero">rien</span>}
                  </td>
                </tr>
              ))
            ) : (
              <tr className="empty-row">
                <td colSpan={6}>Personne ne correspond à ce filtre.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
