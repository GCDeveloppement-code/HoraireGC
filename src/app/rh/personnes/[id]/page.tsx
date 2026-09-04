import Link from "next/link";
import { notFound } from "next/navigation";
import { utilisateurRH } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate, fmtDuree, fmtMois, hm, maintenantParis, MOMENT_LABEL, ORDRE_MOMENT, solde, totaux, type MomentJour } from "@/lib/calcul";
import { moisClos, parametres, versDTO } from "@/lib/donnees";
import { moisVoisins } from "@/lib/rh";
import { EnteteRH } from "@/components/rh/EnteteRH";
import { BoutonsDeclaration } from "@/components/rh/BoutonsDeclaration";
import { Chips } from "@/components/salarie/Elements";

const MOIS_RE = /^\d{4}-\d{2}$/;

export default async function PagePersonne({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mois?: string }>;
}) {
  const rh = await utilisateurRH();
  const { id } = await params;
  const { mois: moisParam } = await searchParams;
  const moisCourant = maintenantParis().date.slice(0, 7);
  const mois = moisParam && MOIS_RE.test(moisParam) ? moisParam : moisCourant;
  const [u, toutes, p, clos] = await Promise.all([
    db.user.findUnique({ where: { id } }),
    db.declaration.findMany({ where: { userId: id } }),
    parametres(),
    moisClos(mois),
  ]);
  if (!u) notFound();
  const duMois = toutes
    .filter((d) => d.date.startsWith(mois))
    .sort((a, b) => b.date.localeCompare(a.date) || ORDRE_MOMENT[b.moment] - ORDRE_MOMENT[a.moment]);
  const t = totaux(duMois);
  const s = solde(u.soldeInitial, toutes, p.majoration);
  const { precedent, suivant } = moisVoisins(mois);

  return (
    <div className="rh">
      <EnteteRH prenom={rh.prenom} mois={mois} moisCourant={moisCourant} clos={clos} onglet="compteurs" />
      <p style={{ margin: "22px 0 14px" }}>
        <Link href={`/rh?mois=${mois}`}>‹ Tout le monde</Link>
      </p>
      <div className="card" style={{ maxWidth: 760 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ fontSize: 22 }}>
              {u.prenom} {u.nom ?? ""}
            </h2>
            <div className="muted">
              {[u.equipe, u.poste].filter(Boolean).join(" · ")} · réf. {hm(u.refMatin)} / {hm(u.refMidi)} / {hm(u.refSoir)}
              {!u.actif && " · compte désactivé"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <Link className="rbtn" href={`/rh/personnes/${u.id}?mois=${precedent}`} style={{ padding: "6px 12px" }}>
              ‹ {fmtMois(precedent)}
            </Link>
            {mois < moisCourant && (
              <Link className="rbtn" href={`/rh/personnes/${u.id}?mois=${suivant}`} style={{ padding: "6px 12px" }}>
                {fmtMois(suivant)} ›
              </Link>
            )}
          </div>
        </div>

        <div className="kv" style={{ marginTop: 16 }}>
          <div>
            <div className="k">Solde</div>
            <div className={`v ${s > 0 ? "r-hs" : s < 0 ? "r-late" : ""}`}>{fmtDuree(s)}</div>
          </div>
          <div>
            <div className="k">Sup · {fmtMois(mois).split(" ")[0].toLowerCase()}</div>
            <div className="v">{fmtDuree(t.sup)}</div>
          </div>
          <div>
            <div className="k">Retards</div>
            <div className="v">{fmtDuree(t.retards)}</div>
          </div>
          <div>
            <div className="k">Récups</div>
            <div className="v">{fmtDuree(t.recups)}</div>
          </div>
        </div>

        <div className="muted" style={{ marginBottom: 8 }}>
          Déclarations de {fmtMois(mois).toLowerCase()} · solde de départ {fmtDuree(u.soldeInitial)}
          {p.majoration !== 1 && ` · majoration ×${p.majoration}`}
        </div>
        <ul className="dl">
          {duMois.length ? (
            duMois.map((d) => {
              const dto = versDTO(d);
              const l1 =
                d.moment === "RECUP"
                  ? `${fmtDate(d.date)} · récup ${d.libelle?.toLowerCase() ?? ""}`
                  : `${fmtDate(d.date)} · ${MOMENT_LABEL[d.moment as MomentJour].label.toLowerCase()} ${d.heure ? hm(d.heure) : ""}`;
              const l2 = d.moment === "RECUP" ? "" : [d.motif, d.client].filter(Boolean).join(" · ") || "sans motif";
              return (
                <li key={d.id}>
                  <div>
                    <div className="l1">
                      {l1} <Chips d={dto} rh long />
                    </div>
                    {l2 && <div className="l2">{l2}</div>}
                    {d.justification && (
                      <div className="l2" style={{ whiteSpace: "normal", fontStyle: "italic" }}>
                        « {d.justification} »
                      </div>
                    )}
                  </div>
                  <div className={`v ${d.moment === "RECUP" ? "r-recup" : d.minutes > 0 ? "r-hs" : "r-late"}`}>{fmtDuree(d.minutes)}</div>
                  {d.moment !== "RECUP" && !clos && (
                    <div className="acts">
                      <BoutonsDeclaration id={d.id} statut={d.statut} />
                    </div>
                  )}
                </li>
              );
            })
          ) : (
            <li>
              <div className="empty">Aucune déclaration ce mois : toutes les journées sont normales.</div>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
