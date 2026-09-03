"use client";

import { useState } from "react";
import { enregistrerDeclaration, poserRecup, reglerRappelSoir, supprimerDeclaration, type Resultat } from "@/actions/declarations";
import { deconnexion } from "@/actions/auth";
import type { DeclarationDTO, UtilisateurDTO } from "@/lib/donnees";
import {
  dureesRecup,
  ecart,
  estApresCoup,
  fmtDate,
  fmtDuree,
  fromMin,
  hm,
  jourCourt,
  momentCourant,
  MOMENT_LABEL,
  MOTIFS,
  ORDRE_MOMENT,
  toMin,
  totaux,
  type MomentJour,
} from "@/lib/calcul";
import { Chips, IconeFermer, IconeInfo } from "./Elements";

export type Feuille =
  | { type: "decl"; date: string; moment: MomentJour; id?: string }
  | { type: "recup"; id?: string }
  | { type: "mois" }
  | { type: "reglages" }
  | null;

type Commun = {
  fermer: () => void;
  notifier: (r: Resultat) => void;
  rafraichir: () => void;
};

/* ---------- Déclaration (heure, motif, client, justification) ---------- */

export function FeuilleDeclaration({
  feuille,
  utilisateur,
  declarations,
  aujourdhui,
  maintenant,
  fermer,
  notifier,
  rafraichir,
  changerMoment,
}: Commun & {
  cle: string;
  feuille: { date: string; moment: MomentJour; id?: string };
  utilisateur: UtilisateurDTO;
  declarations: DeclarationDTO[];
  aujourdhui: string;
  maintenant: string;
  changerMoment: (m: MomentJour) => void;
}) {
  const existante = feuille.id
    ? declarations.find((d) => d.id === feuille.id)
    : declarations.find((d) => d.date === feuille.date && d.moment === feuille.moment);
  const ref = feuille.moment === "MATIN" ? utilisateur.refMatin : feuille.moment === "MIDI" ? utilisateur.refMidi : utilisateur.refSoir;
  const heureInitiale = existante?.heure ?? (feuille.date === aujourdhui && feuille.moment === momentCourant(maintenant) ? maintenant : ref);

  const [heure, setHeure] = useState(heureInitiale);
  const [motif, setMotif] = useState<string | null>(existante?.motif ?? null);
  const [client, setClient] = useState(existante?.client ?? "");
  const [justification, setJustification] = useState(existante?.justification ?? "");
  const [detail, setDetail] = useState(!!(existante?.motif || existante?.client || existante?.justification));
  const [occupe, setOccupe] = useState(false);

  const e = ecart(feuille.moment, heure, utilisateur);

  async function valider() {
    setOccupe(true);
    try {
      const r = await enregistrerDeclaration({
        id: existante?.id ?? null,
        date: feuille.date,
        moment: feuille.moment,
        heure,
        motif,
        client,
        justification,
      });
      notifier(r);
      if (r.ok) {
        fermer();
        rafraichir();
      }
    } finally {
      setOccupe(false);
    }
  }

  async function supprimer() {
    if (!existante) return;
    setOccupe(true);
    const r = await supprimerDeclaration(existante.id);
    setOccupe(false);
    notifier(r);
    if (r.ok) {
      fermer();
      rafraichir();
    }
  }

  return (
    <div className="sheet" role="dialog" aria-label={fmtDate(feuille.date, true)}>
      <div className="sheet-head">
        <h3>{fmtDate(feuille.date, true)}</h3>
        <button className="x" onClick={fermer} aria-label="Fermer">
          {IconeFermer}
        </button>
      </div>
      <div className="seg2">
        {(["MATIN", "MIDI", "SOIR"] as MomentJour[]).map((m) => (
          <button key={m} className={m === feuille.moment ? "on" : ""} onClick={() => changerMoment(m)}>
            {MOMENT_LABEL[m].label}
          </button>
        ))}
      </div>
      <div className="field-lbl">{MOMENT_LABEL[feuille.moment].verbe}</div>
      <div className="time-row">
        <button className="step" onClick={() => setHeure(fromMin(toMin(heure) - 15))} aria-label="Moins 15 minutes">
          −15
        </button>
        <input type="time" value={heure} step={60} onChange={(ev) => ev.target.value && setHeure(ev.target.value)} aria-label="Heure" />
        <button className="step" onClick={() => setHeure(fromMin(toMin(heure) + 15))} aria-label="Plus 15 minutes">
          +15
        </button>
      </div>
      <div className="preview">
        <span className={`big ${e > 0 ? "v-hs" : e < 0 ? "v-late" : ""}`}>{e === 0 ? "0h00" : fmtDuree(e)}</span>
        <span className="note">
          {e === 0 ? "dans l’horaire, rien à déclarer" : e > 0 ? "heures sup" : "retard"} · réf. {hm(ref)} · arrondi au quart d’heure
        </span>
      </div>

      {detail ? (
        <>
          {e > 0 && (
            <>
              <div className="field-lbl">Motif (facultatif)</div>
              <div className="motifs">
                {MOTIFS.map((m) => (
                  <button key={m} className={motif === m ? "on" : ""} onClick={() => setMotif(motif === m ? null : m)}>
                    {m}
                  </button>
                ))}
              </div>
              <input className="text-in" placeholder="Client ou site (facultatif)" value={client} onChange={(ev) => setClient(ev.target.value)} />
            </>
          )}
          <textarea
            className="text-in"
            rows={2}
            placeholder={e < 0 ? "Un mot pour expliquer le retard (facultatif)" : "Un mot pour expliquer (facultatif)"}
            value={justification}
            onChange={(ev) => setJustification(ev.target.value)}
          />
        </>
      ) : (
        <button className="link-in" onClick={() => setDetail(true)}>
          {e < 0 ? "Justifier ce retard (facultatif)" : "Ajouter un motif, un client ou une explication (facultatif)"}
        </button>
      )}

      {existante ? (
        <>
          {estApresCoup(existante) && (
            <div className="note-box">
              {IconeInfo}
              <span>Déclarée après coup, le {fmtDate(existante.creeLe)}.</span>
            </div>
          )}
          <div className="note-box">
            {IconeInfo}
            <span>Si tu changes l’heure, la ligne gardera la mention « modifiée ».</span>
          </div>
        </>
      ) : (
        feuille.date !== aujourdhui && (
          <div className="note-box">
            {IconeInfo}
            <span>Déclaration après coup : la ligne portera la mention « après coup », visible par toi et par la RH.</span>
          </div>
        )
      )}

      <div className="sheet-actions">
        {existante && (
          <button className="btn danger" onClick={supprimer} disabled={occupe}>
            Supprimer
          </button>
        )}
        <button className="btn" onClick={fermer}>
          Annuler
        </button>
        <button className="btn primary" onClick={valider} disabled={occupe}>
          Valider
        </button>
      </div>
    </div>
  );
}

/* ---------- Récup ---------- */

export function FeuilleRecup({
  feuille,
  utilisateur,
  declarations,
  soldeActuel,
  aujourdhui,
  fermer,
  notifier,
  rafraichir,
}: Commun & {
  feuille: { id?: string };
  utilisateur: UtilisateurDTO;
  declarations: DeclarationDTO[];
  soldeActuel: number;
  aujourdhui: string;
}) {
  const existante = feuille.id ? declarations.find((d) => d.id === feuille.id) : undefined;
  const durees = dureesRecup(utilisateur);
  const [date, setDate] = useState(existante?.date ?? prochainJourOuvre(aujourdhui));
  const [cle, setCle] = useState<"am" | "pm" | "day">(
    (durees.find((d) => d.libelle === existante?.libelle)?.cle as "am" | "pm" | "day") ?? "pm",
  );
  const [occupe, setOccupe] = useState(false);
  const duree = durees.find((d) => d.cle === cle)!;
  const apres = soldeActuel - (existante?.minutes ?? 0) + duree.minutes;

  async function valider() {
    setOccupe(true);
    const r = await poserRecup({ id: existante?.id ?? null, date, cle });
    setOccupe(false);
    notifier(r);
    if (r.ok) {
      fermer();
      rafraichir();
    }
  }
  async function annuler() {
    if (!existante) return;
    setOccupe(true);
    const r = await supprimerDeclaration(existante.id);
    setOccupe(false);
    notifier(r);
    if (r.ok) {
      fermer();
      rafraichir();
    }
  }

  return (
    <div className="sheet" role="dialog" aria-label="Récup">
      <div className="sheet-head">
        <h3>{existante ? "Ma récup" : "Poser une récup"}</h3>
        <button className="x" onClick={fermer} aria-label="Fermer">
          {IconeFermer}
        </button>
      </div>
      <div className="field-lbl">Jour</div>
      <input type="date" className="date-in" value={date} onChange={(ev) => ev.target.value && setDate(ev.target.value)} />
      <div className="field-lbl">Durée</div>
      <div className="seg2">
        {durees.map((d) => (
          <button key={d.cle} className={d.cle === cle ? "on" : ""} onClick={() => setCle(d.cle)}>
            {d.libelle}
            <br />
            <span className="tnum" style={{ fontSize: 12, fontWeight: 600, opacity: 0.7 }}>
              {fmtDuree(d.minutes, false).replace("-", "")}
            </span>
          </button>
        ))}
      </div>
      <div className="preview">
        <span className="big v-recup">{fmtDuree(duree.minutes)}</span>
        <span className="note">solde après : {fmtDuree(apres)}</span>
      </div>
      {apres < 0 && (
        <div className="note-box">
          {IconeInfo}
          <span>Ton solde passerait en négatif : à voir avec la RH avant de poser.</span>
        </div>
      )}
      <div className="sheet-actions">
        {existante && (
          <button className="btn danger" onClick={annuler} disabled={occupe}>
            Annuler la récup
          </button>
        )}
        <button className="btn" onClick={fermer}>
          Fermer
        </button>
        <button className="btn primary" onClick={valider} disabled={occupe}>
          Valider
        </button>
      </div>
    </div>
  );
}

function prochainJourOuvre(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const x = new Date(Date.UTC(y, m - 1, d + 1));
  while (x.getUTCDay() === 0 || x.getUTCDay() === 6) x.setUTCDate(x.getUTCDate() + 1);
  return x.toISOString().slice(0, 10);
}

/* ---------- Le mois ---------- */

export function FeuilleMois({
  mois,
  declarations,
  majoration,
  fermer,
  ouvrir,
}: {
  mois: string;
  declarations: DeclarationDTO[];
  majoration: number;
  fermer: () => void;
  ouvrir: (d: DeclarationDTO) => void;
}) {
  const t = totaux(declarations);
  const liste = [...declarations].sort((a, b) => b.date.localeCompare(a.date) || ORDRE_MOMENT[b.moment] - ORDRE_MOMENT[a.moment]);
  const [y, m] = mois.split("-").map(Number);
  const nomMois = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("fr-FR", { month: "long", timeZone: "UTC" });
  return (
    <div className="sheet" role="dialog" aria-label="Le mois">
      <div className="sheet-head">
        <h3 style={{ textTransform: "capitalize" }}>{nomMois}</h3>
        <button className="x" onClick={fermer} aria-label="Fermer">
          {IconeFermer}
        </button>
      </div>
      <div className="month-sub">
        <span>{fmtDuree(t.sup)} heures sup</span>
        <span>{fmtDuree(t.retards)} retard</span>
        <span>{fmtDuree(t.recups)} récup</span>
        {majoration !== 1 && <span>majoration ×{majoration}</span>}
      </div>
      <ul className="hist">
        {liste.length ? (
          liste.map((d) => {
            const { jour, num } = jourCourt(d.date);
            const l2 = d.moment === "RECUP" ? "posée" : [d.motif, d.client, d.justification].filter(Boolean).join(" · ") || "sans motif";
            return (
              <li key={d.id}>
                <button onClick={() => ouvrir(d)}>
                  <span className="d">
                    {jour}
                    <b>{num}</b>
                  </span>
                  <span className="what">
                    <span className="l1">
                      {d.moment === "RECUP" ? `Récup · ${d.libelle}` : `${MOMENT_LABEL[d.moment as MomentJour].label} · ${d.heure ? hm(d.heure) : ""}`} <Chips d={d} />
                    </span>
                    <span className="l2">{l2}</span>
                  </span>
                  <span className={`v ${d.moment === "RECUP" ? "v-recup" : d.minutes > 0 ? "v-hs" : "v-late"}`}>{fmtDuree(d.minutes)}</span>
                </button>
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
  );
}

/* ---------- Réglages ---------- */

export function FeuilleReglages({ utilisateur, fermer, notifier, rafraichir }: Commun & { utilisateur: UtilisateurDTO }) {
  const [rappel, setRappel] = useState(utilisateur.rappelSoir);
  async function basculer() {
    const v = !rappel;
    setRappel(v);
    const r = await reglerRappelSoir(v);
    notifier(r);
    rafraichir();
  }
  return (
    <div className="sheet" role="dialog" aria-label="Mes réglages">
      <div className="sheet-head">
        <h3>Mes réglages</h3>
        <button className="x" onClick={fermer} aria-label="Fermer">
          {IconeFermer}
        </button>
      </div>
      <div className="field-lbl">Mes horaires de référence (définis par la RH)</div>
      <div className="settings-row">
        <span className="k">Début</span>
        <span className="tnum">{hm(utilisateur.refMatin)}</span>
      </div>
      <div className="settings-row">
        <span className="k">Pause</span>
        <span className="tnum">
          {hm(utilisateur.refPause)} → {hm(utilisateur.refMidi)}
        </span>
      </div>
      <div className="settings-row">
        <span className="k">Fin</span>
        <span className="tnum">{hm(utilisateur.refSoir)}</span>
      </div>
      <div className="field-lbl" style={{ marginTop: 14 }}>
        Rappels
      </div>
      <div className="settings-row">
        <span className="k">Rappel à 18h si rien de déclaré</span>
        <button className={`toggle${rappel ? " on" : ""}`} role="switch" aria-checked={rappel} aria-label="Rappel du soir" onClick={basculer} />
      </div>
      <div className="field-lbl" style={{ marginTop: 14 }}>
        Compte
      </div>
      <div className="settings-row">
        <span className="k">Solde de départ (repris de l’Excel)</span>
        <span className="tnum">{fmtDuree(utilisateur.soldeInitial)}</span>
      </div>
      <div className="settings-row">
        <a className="link" href="/reglages/mot-de-passe">
          Changer mon mot de passe
        </a>
        {utilisateur.role === "RH" && (
          <a className="link" href="/rh">
            Vue RH
          </a>
        )}
        <form action={deconnexion}>
          <button className="link" type="submit">
            Me déconnecter
          </button>
        </form>
      </div>
    </div>
  );
}
