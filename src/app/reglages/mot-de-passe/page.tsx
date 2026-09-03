import Link from "next/link";
import { utilisateurCourant } from "@/lib/auth";
import { FormulaireMotDePasse } from "./FormulaireMotDePasse";

export const metadata = { title: "Mot de passe · Heures Sup GC" };

export default async function PageMotDePasse({ searchParams }: { searchParams: Promise<{ premiere?: string }> }) {
  const user = await utilisateurCourant();
  const { premiere } = await searchParams;
  return (
    <main className="page-claire login">
      <div className="login-card">
        <div className="eyebrow">{user.prenom}</div>
        <h1>{premiere ? "Bienvenue, choisis ton mot de passe" : "Changer de mot de passe"}</h1>
        <p>
          {premiere
            ? "Le mot de passe provisoire ne sert qu'une fois : choisis-en un à toi (8 caractères minimum)."
            : "8 caractères minimum."}
        </p>
        <FormulaireMotDePasse />
        {!premiere && (
          <p style={{ marginTop: 14, textAlign: "center" }}>
            <Link href={user.role === "RH" ? "/rh" : "/"}>Retour</Link>
          </p>
        )}
      </div>
    </main>
  );
}
