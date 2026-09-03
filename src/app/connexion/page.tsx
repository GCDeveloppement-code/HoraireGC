import { redirect } from "next/navigation";
import { sessionCourante } from "@/lib/auth";
import { FormulaireConnexion } from "./FormulaireConnexion";

export const metadata = { title: "Connexion · Heures Sup GC" };

export default async function PageConnexion({ searchParams }: { searchParams: Promise<{ raison?: string }> }) {
  const session = await sessionCourante();
  if (session) redirect(session.role === "RH" ? "/rh" : "/");
  const { raison } = await searchParams;
  return (
    <main className="page-claire login">
      <div className="login-card">
        <div className="eyebrow">GC Développement</div>
        <h1>Heures Sup</h1>
        <p>On ne déclare que les écarts, et on ne tape jamais une heure.</p>
        {raison === "inactif" && <p className="erreur">Ce compte est désactivé. Vois avec la RH.</p>}
        <FormulaireConnexion />
      </div>
    </main>
  );
}
