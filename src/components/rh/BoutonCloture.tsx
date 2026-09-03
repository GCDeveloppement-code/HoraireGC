"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cloturerMois, rouvrirMois } from "@/actions/rh";
import { ToastRH } from "./ToastRH";

export function BoutonCloture({ mois, clos }: { mois: string; clos: boolean }) {
  const router = useRouter();
  const [confirme, setConfirme] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, startTransition] = useTransition();

  function agir() {
    startTransition(async () => {
      const r = clos ? await rouvrirMois(mois) : await cloturerMois(mois);
      setMessage(r.ok ? r.message : r.erreur);
      setConfirme(false);
      router.refresh();
    });
  }

  if (!confirme) {
    return (
      <>
        <button className={`rbtn ${clos ? "" : "brand"}`} onClick={() => setConfirme(true)}>
          {clos ? "Rouvrir le mois" : "Clôturer le mois"}
        </button>
        <ToastRH message={message} effacer={() => setMessage(null)} />
      </>
    );
  }
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <span className="muted">{clos ? "Rouvrir ce mois ?" : "Figer ce mois ?"}</span>
      <button className="rbtn" onClick={() => setConfirme(false)} disabled={enCours}>
        Non
      </button>
      <button className="rbtn brand" onClick={agir} disabled={enCours}>
        {enCours ? "…" : "Oui"}
      </button>
    </span>
  );
}
