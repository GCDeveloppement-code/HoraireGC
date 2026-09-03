"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { creerUtilisateur, majParametres, majUtilisateur, reinitialiserMotDePasse, type ResultatRH } from "@/actions/rh";
import { ToastRH } from "@/components/rh/ToastRH";

function useAction() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [enCours, startTransition] = useTransition();
  function lancer(fn: () => Promise<ResultatRH>) {
    startTransition(async () => {
      const r = await fn();
      setMessage(r.ok ? r.message : r.erreur);
      if (r.ok && r.secret) setSecret(r.secret);
      if (r.ok) router.refresh();
    });
  }
  return { message, setMessage, secret, setSecret, enCours, lancer };
}

export function FormulaireRegles({ majoration, arrondiMinutes }: { majoration: number; arrondiMinutes: number }) {
  const { message, setMessage, enCours, lancer } = useAction();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        lancer(() => majParametres(new FormData(e.currentTarget)));
      }}
    >
      <div className="prow">
        <span className="k">Majoration des heures sup</span>
        <select name="majoration" defaultValue={String(majoration)}>
          <option value="1">aucune : 1h sup = 1h de récup</option>
          <option value="1.25">25 % : 1h sup = 1h15 de récup</option>
          <option value="1.5">50 % : 1h sup = 1h30 de récup</option>
        </select>
      </div>
      <div className="prow">
        <span className="k">Arrondi des écarts</span>
        <select name="arrondiMinutes" defaultValue={String(arrondiMinutes)}>
          <option value="5">aux 5 minutes</option>
          <option value="10">aux 10 minutes</option>
          <option value="15">au quart d’heure le plus proche</option>
          <option value="30">à la demi-heure</option>
        </select>
      </div>
      <div className="prow" style={{ justifyContent: "flex-end" }}>
        <button className="rbtn brand" type="submit" disabled={enCours}>
          Enregistrer les règles
        </button>
      </div>
      <ToastRH message={message} effacer={() => setMessage(null)} />
    </form>
  );
}

export type UtilisateurForm = {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  poste: string;
  equipe: string;
  role: "SALARIE" | "RH";
  actif: boolean;
  refMatin: string;
  refPause: string;
  refMidi: string;
  refSoir: string;
  soldeInitial: string;
};

export function LigneUtilisateur({ u, soldeActuel, estMoi }: { u: UtilisateurForm; soldeActuel: string; estMoi: boolean }) {
  const { message, setMessage, secret, setSecret, enCours, lancer } = useAction();
  const idForm = `f-${u.id}`;
  return (
    <>
      <tr style={{ opacity: u.actif ? 1 : 0.55 }}>
        <td>
          <form id={idForm} onSubmit={(e) => { e.preventDefault(); lancer(() => majUtilisateur(new FormData(e.currentTarget))); }}>
            <input type="hidden" name="id" value={u.id} />
          </form>
          <input className="field" form={idForm} name="prenom" defaultValue={u.prenom} style={{ width: 96 }} aria-label="Prénom" />
          <input className="field" form={idForm} name="nom" defaultValue={u.nom} placeholder="Nom" style={{ width: 96, marginTop: 4 }} aria-label="Nom" />
        </td>
        <td>
          <input className="field" form={idForm} name="email" type="email" defaultValue={u.email} style={{ width: 190 }} aria-label="Email" />
        </td>
        <td>
          <input className="field" form={idForm} name="equipe" defaultValue={u.equipe} placeholder="Équipe" style={{ width: 120 }} aria-label="Équipe" />
          <input className="field" form={idForm} name="poste" defaultValue={u.poste} placeholder="Poste" style={{ width: 120, marginTop: 4 }} aria-label="Poste" />
        </td>
        <td><input className="field" form={idForm} type="time" name="refMatin" defaultValue={u.refMatin} aria-label="Début" /></td>
        <td><input className="field" form={idForm} type="time" name="refPause" defaultValue={u.refPause} aria-label="Pause" /></td>
        <td><input className="field" form={idForm} type="time" name="refMidi" defaultValue={u.refMidi} aria-label="Reprise" /></td>
        <td><input className="field" form={idForm} type="time" name="refSoir" defaultValue={u.refSoir} aria-label="Fin" /></td>
        <td className="r"><input className="field init" form={idForm} name="soldeInitial" defaultValue={u.soldeInitial} aria-label="Solde de départ" /></td>
        <td className="r tnum">{soldeActuel}</td>
        <td>
          <select className="field" form={idForm} name="role" defaultValue={u.role} disabled={estMoi} aria-label="Rôle">
            <option value="SALARIE">Salarié</option>
            <option value="RH">RH</option>
          </select>
          {estMoi && <input type="hidden" form={idForm} name="role" value="RH" />}
        </td>
        <td>
          <input type="checkbox" form={idForm} name="actif" defaultChecked={u.actif} disabled={estMoi} aria-label="Actif" />
          {estMoi && <input type="hidden" form={idForm} name="actif" value="on" />}
        </td>
        <td style={{ whiteSpace: "nowrap" }}>
          <button className="rbtn-sm" type="submit" form={idForm} disabled={enCours}>
            Enregistrer
          </button>{" "}
          <button className="rbtn-sm ghost" type="button" disabled={enCours} onClick={() => lancer(() => reinitialiserMotDePasse(u.id))}>
            Mot de passe
          </button>
        </td>
      </tr>
      {secret && (
        <tr>
          <td colSpan={12} style={{ background: "var(--straw)", color: "var(--straw-ink)" }}>
            Mot de passe provisoire pour {u.prenom} : <strong className="tnum">{secret}</strong> (à lui transmettre, il devra le changer à la connexion){" "}
            <button className="rbtn-sm ghost" type="button" onClick={() => setSecret(null)}>
              OK
            </button>
          </td>
        </tr>
      )}
      <ToastRH message={message} effacer={() => setMessage(null)} />
    </>
  );
}

export function FormulaireCreation({ equipes }: { equipes: string[] }) {
  const { message, setMessage, secret, setSecret, enCours, lancer } = useAction();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        lancer(async () => {
          const r = await creerUtilisateur(new FormData(form));
          if (r.ok) form.reset();
          return r;
        });
      }}
      style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
    >
      <input className="field" name="prenom" placeholder="Prénom" required style={{ width: 130 }} />
      <input className="field" name="email" type="email" placeholder="email@…" required style={{ width: 220 }} />
      <input className="field" name="equipe" placeholder="Équipe" list="equipes" style={{ width: 140 }} />
      <datalist id="equipes">
        {equipes.map((e) => (
          <option key={e} value={e} />
        ))}
      </datalist>
      <input className="field" name="poste" placeholder="Poste" style={{ width: 160 }} />
      <select className="field" name="role" defaultValue="SALARIE">
        <option value="SALARIE">Salarié</option>
        <option value="RH">RH</option>
      </select>
      <button className="rbtn brand" type="submit" disabled={enCours}>
        Créer le compte
      </button>
      {secret && (
        <div style={{ width: "100%", background: "var(--straw)", color: "var(--straw-ink)", borderRadius: 12, padding: "8px 12px" }}>
          Mot de passe provisoire : <strong className="tnum">{secret}</strong>{" "}
          <button className="rbtn-sm ghost" type="button" onClick={() => setSecret(null)}>
            OK
          </button>
        </div>
      )}
      <ToastRH message={message} effacer={() => setMessage(null)} />
    </form>
  );
}
