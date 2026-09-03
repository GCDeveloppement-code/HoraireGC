"use client";

import { useActionState } from "react";
import { changerMotDePasse } from "@/actions/auth";

export function FormulaireMotDePasse() {
  const [etat, action, enCours] = useActionState(changerMotDePasse, undefined);
  return (
    <form action={action}>
      <label htmlFor="actuel">Mot de passe actuel</label>
      <input id="actuel" name="actuel" type="password" autoComplete="current-password" required />
      <label htmlFor="nouveau">Nouveau mot de passe</label>
      <input id="nouveau" name="nouveau" type="password" autoComplete="new-password" minLength={8} required />
      <label htmlFor="confirmation">Encore une fois</label>
      <input id="confirmation" name="confirmation" type="password" autoComplete="new-password" minLength={8} required />
      {etat?.erreur && <p className="erreur" style={{ marginBottom: 12 }}>{etat.erreur}</p>}
      <button className="rbtn brand" type="submit" disabled={enCours}>
        {enCours ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}
