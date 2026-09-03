"use client";

import { useActionState } from "react";
import { connexion } from "@/actions/auth";

export function FormulaireConnexion() {
  const [etat, action, enCours] = useActionState(connexion, undefined);
  return (
    <form action={action}>
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" autoComplete="username" required placeholder="prenom@…" />
      <label htmlFor="motDePasse">Mot de passe</label>
      <input id="motDePasse" name="motDePasse" type="password" autoComplete="current-password" required />
      {etat?.erreur && <p className="erreur" style={{ marginBottom: 12 }}>{etat.erreur}</p>}
      <button className="rbtn brand" type="submit" disabled={enCours}>
        {enCours ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
