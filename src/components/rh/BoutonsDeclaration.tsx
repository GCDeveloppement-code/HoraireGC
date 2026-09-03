"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { annulerDemande, demanderConfirmation } from "@/actions/rh";
import { ToastRH } from "./ToastRH";

export function BoutonsDeclaration({ id, statut }: { id: string; statut: "DECLAREE" | "A_CONFIRMER" | "CONFIRMEE" }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, startTransition] = useTransition();

  function lancer(fn: (id: string) => Promise<{ ok: boolean; message?: string; erreur?: string }>) {
    startTransition(async () => {
      const r = await fn(id);
      setMessage(r.ok ? (r.message ?? "OK") : (r.erreur ?? "Erreur"));
      router.refresh();
    });
  }

  return (
    <>
      {statut === "DECLAREE" && (
        <button className="rbtn-sm" onClick={() => lancer(demanderConfirmation)} disabled={enCours}>
          Demander confirmation
        </button>
      )}
      {statut === "A_CONFIRMER" && (
        <button className="rbtn-sm ghost" onClick={() => lancer(annulerDemande)} disabled={enCours}>
          Annuler la demande
        </button>
      )}
      <ToastRH message={message} effacer={() => setMessage(null)} />
    </>
  );
}
