"use client";

import { useEffect } from "react";
import type { DeclarationDTO } from "@/lib/donnees";
import { estApresCoup, fmtDate } from "@/lib/calcul";

export type ToastState = { texte: string; erreur?: boolean; action?: { label: string; fn: () => void } } | null;

export function Toast({ etat, effacer }: { etat: ToastState; effacer: () => void }) {
  useEffect(() => {
    if (!etat) return;
    const t = setTimeout(effacer, etat.action ? 6000 : 2800);
    return () => clearTimeout(t);
  }, [etat, effacer]);
  if (!etat) return null;
  return (
    <div className="toast" role="status">
      <span>{etat.texte}</span>
      {etat.action && (
        <button
          onClick={() => {
            effacer();
            etat.action?.fn();
          }}
        >
          {etat.action.label}
        </button>
      )}
    </div>
  );
}

/** Pastilles d'état d'une déclaration : à confirmer, confirmée, après coup, modifiée. */
export function Chips({ d, long = false, rh = false }: { d: DeclarationDTO; long?: boolean; rh?: boolean }) {
  const c = rh ? "rchip" : "chip";
  return (
    <>
      {d.statut === "A_CONFIRMER" && <span className={`${c} warn`}>à confirmer</span>}
      {d.statut === "CONFIRMEE" && <span className={`${c} ok`}>confirmée</span>}
      {estApresCoup(d) && <span className={c}>après coup{long ? ` · saisie le ${fmtDate(d.creeLe)}` : ""}</span>}
      {d.modifiee && <span className={c}>modifiée</span>}
    </>
  );
}

export const IconeFermer = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const IconeInfo = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
);

/**
 * Filtre de réfraction du verre : une turbulence douce sert de carte de déplacement,
 * appliquée en bordure des cartes (voir .hero::after et .glass::after). Le ciel derrière
 * étant un dégradé, la déformation se lit comme une tranche de verre, jamais comme du flou.
 * Les navigateurs qui ignorent url() dans backdrop-filter n'affichent simplement rien de plus.
 */
export function FiltresVerre() {
  return (
    <svg className="verre-filtres" aria-hidden="true" focusable="false">
      <filter id="verre-onde" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.0035 0.006" numOctaves="1" seed="11" result="bruit" />
        <feGaussianBlur in="bruit" stdDeviation="4" result="doux" />
        <feDisplacementMap in="SourceGraphic" in2="doux" scale="9" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}
