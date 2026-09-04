"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmerDeclaration, declarerMaintenant, type Resultat } from "@/actions/declarations";
import type { DeclarationDTO, UtilisateurDTO } from "@/lib/donnees";
import {
  ambiance,
  dansTolerance,
  ecart,
  fmtDate,
  fmtDuree,
  hm,
  jourCourt,
  momentCourant,
  MOMENT_LABEL,
  ORDRE_MOMENT,
  semaineDe,
  solde,
  refDuMoment,
  type DeclarationCalc,
  type Regles,
} from "@/lib/calcul";
import { Chips, FiltresVerre, Toast, type ToastState } from "./Elements";
import { FeuilleDeclaration, FeuilleMois, FeuilleRecup, FeuilleReglages, type Feuille } from "./Feuilles";

type Props = {
  utilisateur: UtilisateurDTO;
  declarations: DeclarationDTO[];
  toutes: DeclarationCalc[];
  aujourdhui: string;
  moisClos: boolean;
  majoration: number;
  regles: Regles;
  prenomRH: string;
};

function heureLocale(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function Accueil({ utilisateur, declarations, toutes, aujourdhui, moisClos, majoration, regles, prenomRH }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [maintenant, setMaintenant] = useState(heureLocale);
  const [feuille, setFeuilleBrut] = useState<Feuille>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const setFeuille = useCallback((f: Feuille) => {
    setToast(null);
    setFeuilleBrut(f);
  }, []);
  const [occupe, setOccupe] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setMaintenant(heureLocale()), 20_000);
    return () => clearInterval(t);
  }, []);

  const amb = ambiance(maintenant);
  const semaine = useMemo(() => semaineDe(aujourdhui), [aujourdhui]);
  const mois = aujourdhui.slice(0, 7);
  const soldeActuel = solde(utilisateur.soldeInitial, toutes, majoration);
  const moment = momentCourant(maintenant);
  const declDuJour = declarations.find((d) => d.date === aujourdhui && d.moment === moment);
  const aConfirmer = declarations.filter((d) => d.statut === "A_CONFIRMER");

  const rafraichir = useCallback(() => startTransition(() => router.refresh()), [router]);

  const notifier = useCallback((r: Resultat) => {
    if (r.ok) setToast({ texte: r.message });
    else setToast({ texte: r.erreur, erreur: true });
  }, []);

  async function surGrosBouton() {
    if (occupe) return;
    if (declDuJour) {
      setFeuille({ type: "decl", date: aujourdhui, moment, id: declDuJour.id });
      return;
    }
    setOccupe(true);
    try {
      const r = await declarerMaintenant(moment);
      if (r.ok && r.id) {
        const id = r.id;
        setToast({
          texte: `${r.message} : ${MOMENT_LABEL[moment].label.toLowerCase()} ${hm(maintenant)}`,
          action: { label: "Ajouter un motif", fn: () => setFeuille({ type: "decl", date: aujourdhui, moment, id }) },
        });
      } else notifier(r);
      rafraichir();
    } finally {
      setOccupe(false);
    }
  }

  function ouvrirJour(date: string) {
    const recup = declarations.find((d) => d.date === date && d.moment === "RECUP");
    if (date > aujourdhui) {
      if (recup) setFeuille({ type: "recup", id: recup.id });
      else
        setToast({
          texte: "Jour à venir : rien à déclarer pour l’instant",
          action: { label: "Poser une récup", fn: () => setFeuille({ type: "recup" }) },
        });
      return;
    }
    const ds = declarations
      .filter((d) => d.date === date && d.moment !== "RECUP")
      .sort((a, b) => ORDRE_MOMENT[a.moment] - ORDRE_MOMENT[b.moment]);
    const m = ds.length ? (ds[0].moment as "MATIN" | "MIDI" | "SOIR") : date === aujourdhui ? moment : "SOIR";
    setFeuille({ type: "decl", date, moment: m });
  }

  async function confirmer(id: string) {
    const r = await confirmerDeclaration(id);
    notifier(r);
    rafraichir();
  }

  const ecartMaintenant = ecart(moment, maintenant, utilisateur, regles);
  const sousTitreMaintenant =
    ecartMaintenant !== 0
      ? fmtDuree(ecartMaintenant)
      : dansTolerance(moment, maintenant, utilisateur, regles)
        ? `dans la tolérance de ${regles.toleranceMinutes} min`
        : "dans l’horaire, rien à déclarer";
  const totalSemaine = useMemo(
    () => declarations.filter((d) => semaine.includes(d.date) && d.moment !== "RECUP").reduce((a, d) => a + d.minutes, 0),
    [declarations, semaine],
  );

  return (
    <div className="screen" data-ambiance={amb}>
      <div className={`sky sky-aube${amb === "aube" ? " on" : ""}`} />
      <div className={`sky sky-ciel${amb === "ciel" ? " on" : ""}`} />
      <div className={`sky sky-soir${amb === "soir" ? " on" : ""}`} />
      <FiltresVerre />

      <div className="app">
        <header className="app-head">
          <div>
            <div className="date">{fmtDate(aujourdhui, true)}</div>
            <h1>Bonjour {utilisateur.prenom}</h1>
          </div>
          <button className="icon-btn" aria-label="Réglages" onClick={() => setFeuille({ type: "reglages" })}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="17" x2="20" y2="17" />
              <circle cx="9" cy="7" r="2.6" />
              <circle cx="15" cy="17" r="2.6" />
            </svg>
          </button>
        </header>

        {moisClos && (
          <div className="banner">
            <div>
              <strong>Ce mois est clôturé.</strong> Plus de modification possible, vois avec {prenomRH} si besoin.
            </div>
          </div>
        )}
        {aConfirmer.map((d) => (
          <div className="banner" key={d.id}>
            <div>
              <strong>{d.demandeePar ?? prenomRH} (RH) te demande de confirmer</strong>
              <br />
              {fmtDate(d.date)} · {MOMENT_LABEL[d.moment as "MATIN" | "MIDI" | "SOIR"].label.toLowerCase()} {d.heure ? hm(d.heure) : ""} ·{" "}
              {fmtDuree(d.minutes)}
            </div>
            <div className="acts">
              <button className="btn-sm primary" onClick={() => confirmer(d.id)}>
                Je confirme
              </button>
              <button
                className="btn-sm"
                onClick={() => setFeuille({ type: "decl", date: d.date, moment: d.moment as "MATIN" | "MIDI" | "SOIR", id: d.id })}
              >
                Modifier
              </button>
            </div>
          </div>
        ))}

        <section className="hero">
          <div>
            <div className="lbl">Mon solde de récup</div>
            <div className={`val tnum`}>{fmtDuree(soldeActuel)}</div>
          </div>
          <button className="pill" onClick={() => setFeuille({ type: "recup" })}>
            Poser une récup
          </button>
        </section>

        <button className={`cta${declDuJour ? " done" : ""}`} onClick={surGrosBouton} disabled={occupe}>
          {declDuJour ? (
            <>
              <span className="main">
                {MOMENT_LABEL[moment].label} déclaré ·{" "}
                <span className={declDuJour.minutes > 0 ? "v-hs" : "v-late"}>{fmtDuree(declDuJour.minutes)}</span>
              </span>
              <span className="sub">{declDuJour.heure ? hm(declDuJour.heure) : ""} · toucher pour modifier ou justifier</span>
            </>
          ) : (
            <>
              <span className="main">{MOMENT_LABEL[moment].maintenant}</span>
              <span className="sub">
                {hm(maintenant)} → {sousTitreMaintenant} · réf. {hm(refDuMoment(moment, utilisateur))}
              </span>
            </>
          )}
        </button>

        <section>
          <div className="section-head">
            <h2>Cette semaine</h2>
            <span className={`tnum ${totalSemaine > 0 ? "v-hs" : totalSemaine < 0 ? "v-late" : ""}`}>
              {totalSemaine === 0 ? "" : fmtDuree(totalSemaine)}
            </span>
          </div>
          <div className="wlist glass">
            {semaine.map((date) => {
              const ds = declarations.filter((d) => d.date === date).sort((a, b) => ORDRE_MOMENT[a.moment] - ORDRE_MOMENT[b.moment]);
              const recup = ds.find((d) => d.moment === "RECUP");
              const somme = ds.filter((d) => d.moment !== "RECUP").reduce((a, d) => a + d.minutes, 0);
              const { jour, num } = jourCourt(date);
              const futur = date > aujourdhui && !recup;
              const total = recup && !somme ? recup.minutes : somme;
              const classeVal = recup && !somme ? "v-recup" : total > 0 ? "v-hs" : total < 0 ? "v-late" : "";
              return (
                <button
                  key={date}
                  className={`wrow${date === aujourdhui ? " today" : ""}${futur ? " future" : ""}`}
                  onClick={() => ouvrirJour(date)}
                >
                  <span className="wd">
                    <b>{jour}</b>
                    <span>{num}</span>
                  </span>
                  <span className="wc">
                    {ds.length ? (
                      ds.map((d) => (
                        <span className="ent" key={d.id}>
                          {d.moment === "RECUP" ? (
                            <b>Récup {d.libelle?.toLowerCase()}</b>
                          ) : (
                            <>
                              <b>{MOMENT_LABEL[d.moment as "MATIN" | "MIDI" | "SOIR"].label}</b>
                              <span className="tnum">{d.heure ? hm(d.heure) : ""}</span>
                              <Chips d={d} />
                            </>
                          )}
                        </span>
                      ))
                    ) : date > aujourdhui ? (
                      <span className="normal">à venir</span>
                    ) : date === aujourdhui ? (
                      <span className="normal">rien à signaler pour l’instant</span>
                    ) : (
                      <span className="normal">journée normale</span>
                    )}
                  </span>
                  {ds.length ? <span className={`wv ${classeVal}`}>{fmtDuree(total)}</span> : <span />}
                </button>
              );
            })}
          </div>
          <button className="link more" onClick={() => setFeuille({ type: "mois" })}>
            Voir tout le mois
          </button>
        </section>
      </div>

      {feuille && <div className="backdrop" onClick={() => setFeuille(null)} />}
      {feuille?.type === "decl" && (
        <FeuilleDeclaration
          key={`${feuille.date}-${feuille.moment}-${feuille.id ?? "new"}`}
          cle={`${feuille.date}-${feuille.id ?? "new"}`}
          feuille={feuille}
          utilisateur={utilisateur}
          declarations={declarations}
          aujourdhui={aujourdhui}
          maintenant={maintenant}
          regles={regles}
          fermer={() => setFeuille(null)}
          notifier={notifier}
          rafraichir={rafraichir}
          changerMoment={(m) => setFeuille({ ...feuille, moment: m, id: undefined })}
        />
      )}
      {feuille?.type === "recup" && (
        <FeuilleRecup
          feuille={feuille}
          utilisateur={utilisateur}
          declarations={declarations}
          soldeActuel={soldeActuel}
          aujourdhui={aujourdhui}
          fermer={() => setFeuille(null)}
          notifier={notifier}
          rafraichir={rafraichir}
        />
      )}
      {feuille?.type === "mois" && (
        <FeuilleMois
          mois={mois}
          declarations={declarations.filter((d) => d.date.startsWith(mois))}
          majoration={majoration}
          fermer={() => setFeuille(null)}
          ouvrir={(d) =>
            d.moment === "RECUP"
              ? setFeuille({ type: "recup", id: d.id })
              : setFeuille({ type: "decl", date: d.date, moment: d.moment as "MATIN" | "MIDI" | "SOIR", id: d.id })
          }
        />
      )}
      {feuille?.type === "reglages" && (
        <FeuilleReglages utilisateur={utilisateur} fermer={() => setFeuille(null)} notifier={notifier} rafraichir={rafraichir} />
      )}
      <Toast etat={toast} effacer={() => setToast(null)} />
    </div>
  );
}
