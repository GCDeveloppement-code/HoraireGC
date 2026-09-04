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

export function FormulaireRegles({
  majoration,
  arrondiMinutes,
  toleranceMinutes,
}: {
  majoration: number;
  arrondiMinutes: number;
  toleranceMinutes: number;
}) {
  const { message, setMessage, enCours, lancer } = useAction();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        lancer(() => majParametres(new FormData(e.currentTarget)));
      }}
    >
      <div className="reglages">
        <label className="champ">
          <span>Majoration des heures sup</span>
          <select name="majoration" defaultValue={String(majoration)}>
            <option value="1">aucune : 1h sup = 1h de récup</option>
            <option value="1.25">25 % : 1h sup = 1h15 de récup</option>
            <option value="1.5">50 % : 1h sup = 1h30 de récup</option>
          </select>
        </label>
        <label className="champ">
          <span>Tolérance avant de compter</span>
          <select name="toleranceMinutes" defaultValue={String(toleranceMinutes)}>
            <option value="0">aucune</option>
            <option value="5">5 minutes</option>
            <option value="10">10 minutes</option>
            <option value="15">15 minutes</option>
            <option value="20">20 minutes</option>
            <option value="30">30 minutes</option>
          </select>
        </label>
        <label className="champ">
          <span>Arrondi des écarts</span>
          <select name="arrondiMinutes" defaultValue={String(arrondiMinutes)}>
            <option value="5">5 minutes</option>
            <option value="10">10 minutes</option>
            <option value="15">quart d’heure</option>
            <option value="30">demi-heure</option>
          </select>
        </label>
        <button className="rbtn brand" type="submit" disabled={enCours}>
          Enregistrer
        </button>
      </div>
      <ToastRH message={message} effacer={() => setMessage(null)} />
    </form>
  );
}

/** Heure au format 24 h : un champ texte court, identique sur tous les navigateurs.
 *  Le champ natif type="time" bascule en 12 h selon la langue du navigateur, ce qui tronque
 *  l'affichage et prête à confusion entre 5h30 et 17h30. */
function ChampHeure({ form, name, valeur, label }: { form: string; name: string; valeur: string; label: string }) {
  return (
    <input
      className="field heure"
      form={form}
      name={name}
      defaultValue={valeur}
      aria-label={label}
      inputMode="numeric"
      maxLength={5}
      pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
      title="Heure au format 24 h, par exemple 09:00 ou 17:30"
      placeholder="09:00"
    />
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
          <form
            id={idForm}
            onSubmit={(e) => {
              e.preventDefault();
              lancer(() => majUtilisateur(new FormData(e.currentTarget)));
            }}
          >
            <input type="hidden" name="id" value={u.id} />
          </form>
          <div className="duo">
            <input className="field" form={idForm} name="prenom" defaultValue={u.prenom} aria-label="Prénom" />
            <input className="field" form={idForm} name="nom" defaultValue={u.nom} placeholder="Nom" aria-label="Nom" />
          </div>
        </td>
        <td>
          <input className="field large" form={idForm} name="email" type="email" defaultValue={u.email} aria-label="Email" />
        </td>
        <td>
          <div className="duo">
            <input className="field" form={idForm} name="equipe" defaultValue={u.equipe} placeholder="Équipe" aria-label="Équipe" />
            <input className="field" form={idForm} name="poste" defaultValue={u.poste} placeholder="Poste" aria-label="Poste" />
          </div>
        </td>
        <td>
          <div className="horaires">
            <ChampHeure form={idForm} name="refMatin" valeur={u.refMatin} label="Arrivée le matin" />
            <span>–</span>
            <ChampHeure form={idForm} name="refPause" valeur={u.refPause} label="Pause du midi" />
            <em>·</em>
            <ChampHeure form={idForm} name="refMidi" valeur={u.refMidi} label="Reprise" />
            <span>–</span>
            <ChampHeure form={idForm} name="refSoir" valeur={u.refSoir} label="Fin de journée" />
          </div>
        </td>
        <td className="r">
          <input className="field init" form={idForm} name="soldeInitial" defaultValue={u.soldeInitial} aria-label="Solde de départ" />
        </td>
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
        <td className="actions">
          <button className="rbtn-sm" type="submit" form={idForm} disabled={enCours}>
            Enregistrer
          </button>
          <button
            className="rbtn-sm ghost cle"
            type="button"
            disabled={enCours}
            title="Réinitialiser le mot de passe"
            aria-label={`Réinitialiser le mot de passe de ${u.prenom}`}
            onClick={() => lancer(() => reinitialiserMotDePasse(u.id))}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="15" r="4" />
              <path d="M10.8 12.2 20 3" />
              <path d="M17 6l2.5 2.5" />
            </svg>
          </button>
        </td>
      </tr>
      {secret && (
        <tr>
          <td colSpan={9} style={{ background: "var(--straw)", color: "var(--straw-ink)" }}>
            Mot de passe provisoire pour {u.prenom} : <strong className="tnum">{secret}</strong>{" "}
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
      className="creation"
    >
      <input className="field" name="prenom" placeholder="Prénom" required />
      <input className="field large" name="email" type="email" placeholder="email@…" required />
      <input className="field" name="equipe" placeholder="Équipe" list="equipes" />
      <datalist id="equipes">
        {equipes.map((e) => (
          <option key={e} value={e} />
        ))}
      </datalist>
      <input className="field" name="poste" placeholder="Poste" />
      <select className="field" name="role" defaultValue="SALARIE">
        <option value="SALARIE">Salarié</option>
        <option value="RH">RH</option>
      </select>
      <button className="rbtn brand" type="submit" disabled={enCours}>
        Créer le compte
      </button>
      {secret && (
        <div className="secret">
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
