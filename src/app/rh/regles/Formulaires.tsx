"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { creerUtilisateur, majParametres, majUtilisateur, reinitialiserMotDePasse, type ResultatRH } from "@/actions/rh";
import { ToastRH } from "@/components/rh/ToastRH";

export type Personne = {
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
  ecart: string;
  ecartMinutes: number;
  soldeActuel: string;
  estMoi: boolean;
};

/** Champs réellement modifiables dans le tableau. */
type Champs = Pick<
  Personne,
  "prenom" | "nom" | "email" | "poste" | "equipe" | "role" | "actif" | "refMatin" | "refPause" | "refMidi" | "refSoir" | "soldeInitial"
>;

const CHAMPS: (keyof Champs)[] = [
  "prenom",
  "nom",
  "email",
  "poste",
  "equipe",
  "role",
  "actif",
  "refMatin",
  "refPause",
  "refMidi",
  "refSoir",
  "soldeInitial",
];

function initiales(prenom: string, nom: string) {
  const a = prenom.trim()[0] ?? "?";
  const b = nom.trim()[0] ?? prenom.trim()[1] ?? "";
  return (a + b).toUpperCase();
}

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

export function PanneauPersonnes({
  majoration,
  arrondiMinutes,
  toleranceMinutes,
  personnes,
  clos,
}: {
  majoration: number;
  arrondiMinutes: number;
  toleranceMinutes: number;
  personnes: Personne[];
  clos: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [secret, setSecret] = useState<{ prenom: string; valeur: string } | null>(null);
  const [enCours, startTransition] = useTransition();

  const [reglesOuvertes, setReglesOuvertes] = useState(false);
  const [q, setQ] = useState("");
  const [equipeFiltre, setEquipeFiltre] = useState("Toutes");
  const [actifsSeuls, setActifsSeuls] = useState(false);
  const [edits, setEdits] = useState<Record<string, Partial<Champs>>>({});

  const equipes = useMemo(() => Array.from(new Set(personnes.map((p) => p.equipe))).sort(), [personnes]);
  const valeur = <K extends keyof Champs>(p: Personne, champ: K): Champs[K] => (edits[p.id]?.[champ] ?? p[champ]) as Champs[K];
  const nbModifiees = Object.keys(edits).length;

  function changer<K extends keyof Champs>(p: Personne, champ: K, v: Champs[K]) {
    setEdits((e) => {
      const courant = { ...(e[p.id] ?? {}), [champ]: v };
      // une ligne revenue à son état d'origine sort de la liste des modifications
      const identique = CHAMPS.every((c) => (courant[c] ?? p[c]) === p[c]);
      const suite = { ...e };
      if (identique) delete suite[p.id];
      else suite[p.id] = courant;
      return suite;
    });
  }

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return personnes.filter((p) => {
      const v = <K extends keyof Champs>(c: K) => (edits[p.id]?.[c] ?? p[c]) as Champs[K];
      if (actifsSeuls && !v("actif")) return false;
      if (equipeFiltre !== "Toutes" && v("equipe") !== equipeFiltre) return false;
      if (!t) return true;
      return [v("prenom"), v("nom"), v("email"), v("poste"), v("equipe")].join(" ").toLowerCase().includes(t);
    });
  }, [personnes, q, equipeFiltre, actifsSeuls, edits]);

  const groupes = useMemo(() => {
    const m = new Map<string, Personne[]>();
    for (const p of visibles) {
      const e = ((edits[p.id]?.equipe ?? p.equipe) as string) || "Sans équipe";
      if (!m.has(e)) m.set(e, []);
      m.get(e)!.push(p);
    }
    return Array.from(m.entries());
  }, [visibles, edits]);

  const actifs = personnes.filter((p) => (edits[p.id]?.actif ?? p.actif) as boolean).length;

  function enregistrerTout() {
    const aFaire = personnes.filter((p) => edits[p.id]);
    if (!aFaire.length) return;
    startTransition(async () => {
      let erreur: string | null = null;
      let ok = 0;
      for (const p of aFaire) {
        const fd = new FormData();
        fd.set("id", p.id);
        for (const c of CHAMPS) {
          const v = valeur(p, c);
          if (c === "actif") {
            if (v) fd.set("actif", "on");
          } else fd.set(c, String(v));
        }
        const r = await majUtilisateur(fd);
        if (r.ok) ok++;
        else {
          erreur = `${p.prenom} : ${r.erreur}`;
          break;
        }
      }
      setMessage(erreur ?? `${ok} ligne${ok > 1 ? "s" : ""} enregistrée${ok > 1 ? "s" : ""}`);
      if (!erreur) setEdits({});
      router.refresh();
    });
  }

  function reinitialiser(p: Personne) {
    startTransition(async () => {
      const r = await reinitialiserMotDePasse(p.id);
      if (r.ok && r.secret) setSecret({ prenom: p.prenom, valeur: r.secret });
      else setMessage(r.ok ? r.message : r.erreur);
    });
  }

  const resume = `${majoration === 1 ? "1 h sup = 1 h de récup" : `majoration ×${majoration}`} · tolérance ${toleranceMinutes} min · arrondi ${
    arrondiMinutes === 15 ? "au quart d’heure" : `aux ${arrondiMinutes} min`
  }`;

  return (
    <>
      <div className="regles-bloc">
        <div className="k">Règles de calcul</div>
        {reglesOuvertes ? (
          <FormulaireRegles
            majoration={majoration}
            arrondiMinutes={arrondiMinutes}
            toleranceMinutes={toleranceMinutes}
            fermer={() => setReglesOuvertes(false)}
          />
        ) : (
          <div className="regles-resume">
            <div>{resume}</div>
            <button className="rbtn" type="button" onClick={() => setReglesOuvertes(true)}>
              Modifier
            </button>
          </div>
        )}
      </div>

      <div className="barre-filtres">
        <div className="recherche">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher une personne"
            aria-label="Rechercher une personne"
          />
        </div>
        <div className="puces">
          <button type="button" className={`puce${equipeFiltre === "Toutes" ? " on" : ""}`} onClick={() => setEquipeFiltre("Toutes")}>
            Toutes
          </button>
          {equipes.map((e) => (
            <button key={e} type="button" className={`puce${equipeFiltre === e ? " on" : ""}`} onClick={() => setEquipeFiltre(e)}>
              {e}
            </button>
          ))}
        </div>
        <button type="button" className="bascule" onClick={() => setActifsSeuls((v) => !v)} aria-pressed={actifsSeuls}>
          <span className={`rail${actifsSeuls ? " on" : ""}`} />
          Actifs seulement
        </button>
      </div>

      <div className="liste">
        <div className="liste-head">
          <div>
            <h2>Personnes et horaires</h2>
            <div style={{ marginTop: 3, fontSize: 13.5, color: "var(--cr-ink-2)" }}>
              Tout se modifie directement dans le tableau. Un seul enregistrement en bas de page.
            </div>
          </div>
          <div className="compte">
            {actifs} actif{actifs > 1 ? "s" : ""} sur {personnes.length}
          </div>
        </div>

        <div className="grille-p entete">
          <div>Personne</div>
          <div>Équipe · poste</div>
          <div className="acc">Horaires</div>
          <div className="r acc">Écart</div>
          <div className="r">Départ</div>
          <div className="r">Solde</div>
          <div>Rôle</div>
          <div className="c">Actif</div>
          <div />
        </div>

        {groupes.map(([equipe, gens]) => (
          <div key={equipe}>
            <div className="groupe">
              <div className="nom">{equipe}</div>
              <div className="meta">
                {gens.length} personne{gens.length > 1 ? "s" : ""}
              </div>
              <div className="trait" />
            </div>
            {gens.map((p) => (
              <div key={p.id} className={`grille-p ligne-p${valeur(p, "actif") ? "" : " inactif"}${edits[p.id] ? " modifiee" : ""}`}>
                <div className="identite">
                  <div className="avatar">{initiales(valeur(p, "prenom"), valeur(p, "nom"))}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <input
                        className="champ-nu"
                        style={{ fontSize: 14.5, fontWeight: 600 }}
                        value={valeur(p, "prenom")}
                        onChange={(e) => changer(p, "prenom", e.target.value)}
                        disabled={clos}
                        aria-label={`Prénom de ${p.prenom}`}
                      />
                      <input
                        className="champ-nu"
                        style={{ fontSize: 14.5, fontWeight: 600 }}
                        value={valeur(p, "nom")}
                        placeholder="Nom"
                        onChange={(e) => changer(p, "nom", e.target.value)}
                        disabled={clos}
                        aria-label={`Nom de ${p.prenom}`}
                      />
                    </div>
                    <input
                      className="champ-nu"
                      style={{ fontSize: 12, color: "var(--cr-ink-3)" }}
                      value={valeur(p, "email")}
                      onChange={(e) => changer(p, "email", e.target.value)}
                      disabled={clos}
                      type="email"
                      aria-label={`Email de ${p.prenom}`}
                    />
                  </div>
                </div>

                <div style={{ minWidth: 0 }}>
                  <input
                    className="champ-nu"
                    value={valeur(p, "poste")}
                    placeholder="Poste"
                    onChange={(e) => changer(p, "poste", e.target.value)}
                    disabled={clos}
                    aria-label={`Poste de ${p.prenom}`}
                  />
                  <input
                    className="champ-nu"
                    style={{ fontSize: 12, color: "var(--cr-ink-3)" }}
                    value={valeur(p, "equipe")}
                    placeholder="Équipe"
                    onChange={(e) => changer(p, "equipe", e.target.value)}
                    disabled={clos}
                    aria-label={`Équipe de ${p.prenom}`}
                  />
                </div>

                <div className="bloc-heures">
                  <Heure p={p} champ="refMatin" label="Arrivée" valeur={valeur} changer={changer} clos={clos} />
                  <span className="tiret">–</span>
                  <Heure p={p} champ="refPause" label="Pause" valeur={valeur} changer={changer} clos={clos} />
                  <span className="point" />
                  <Heure p={p} champ="refMidi" label="Reprise" valeur={valeur} changer={changer} clos={clos} />
                  <span className="tiret">–</span>
                  <Heure p={p} champ="refSoir" label="Fin" valeur={valeur} changer={changer} clos={clos} />
                </div>

                <div
                  className="r val-mono"
                  style={{ color: p.ecartMinutes > 0 ? "var(--g-violet)" : p.ecartMinutes < 0 ? "var(--danger)" : "var(--cr-ink-3)" }}
                >
                  {p.ecart}
                </div>

                <input
                  className="champ-nu solde"
                  value={valeur(p, "soldeInitial")}
                  onChange={(e) => changer(p, "soldeInitial", e.target.value)}
                  disabled={clos}
                  aria-label={`Solde de départ de ${p.prenom}`}
                />

                <div className="r val-mono" style={{ color: "var(--cr-ink-2)" }}>
                  {p.soldeActuel}
                </div>

                <select
                  className="champ-nu"
                  value={valeur(p, "role")}
                  onChange={(e) => changer(p, "role", e.target.value as "SALARIE" | "RH")}
                  disabled={clos || p.estMoi}
                  aria-label={`Rôle de ${p.prenom}`}
                >
                  <option value="SALARIE">Salarié</option>
                  <option value="RH">RH</option>
                </select>

                <div className="c">
                  <button
                    type="button"
                    className={`interrupteur${valeur(p, "actif") ? " on" : ""}`}
                    disabled={clos || p.estMoi}
                    onClick={() => changer(p, "actif", !valeur(p, "actif"))}
                    aria-label={`${p.prenom} actif`}
                    aria-pressed={valeur(p, "actif")}
                  />
                </div>

                <button
                  type="button"
                  className="cle"
                  disabled={enCours}
                  title="Réinitialiser le mot de passe"
                  aria-label={`Réinitialiser le mot de passe de ${p.prenom}`}
                  onClick={() => reinitialiser(p)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="8" cy="15" r="4" />
                    <path d="M10.8 12.2 20 3" />
                    <path d="M17 6l2.5 2.5" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        ))}

        {!visibles.length && (
          <div className="vide">
            <div style={{ fontFamily: "var(--f-titre)", fontSize: 18, fontWeight: 500 }}>Personne ne correspond à cette recherche</div>
            <button
              type="button"
              className="rbtn"
              style={{ marginTop: 12 }}
              onClick={() => {
                setQ("");
                setEquipeFiltre("Toutes");
                setActifsSeuls(false);
              }}
            >
              Réinitialiser les filtres
            </button>
          </div>
        )}

        {secret && (
          <div className="pied-liste" style={{ background: "rgba(109,91,67,0.12)", color: "#5b4a33" }}>
            Mot de passe provisoire pour {secret.prenom} : <strong className="mono">{secret.valeur}</strong>{" "}
            <button className="rbtn-sm ghost" type="button" onClick={() => setSecret(null)}>
              OK
            </button>
          </div>
        )}
        <div className="pied-liste">
          {clos
            ? "Mois clôturé : les horaires ne sont plus modifiables tant qu’il n’est pas rouvert."
            : "Modifier un horaire recalcule les déclarations déjà faites de la personne."}
        </div>
      </div>

      <CarteCreation equipes={equipes} />

      <div className={`rh-barre${nbModifiees ? "" : " cache"}`}>
        <div>
          <span>
            {nbModifiees} ligne{nbModifiees > 1 ? "s" : ""} modifiée{nbModifiees > 1 ? "s" : ""}
          </span>
          <span style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => setEdits({})} disabled={enCours}>
              Annuler
            </button>
            <button type="button" className="valider" onClick={enregistrerTout} disabled={enCours}>
              {enCours ? "Enregistrement…" : "Enregistrer"}
            </button>
          </span>
        </div>
      </div>

      <ToastRH message={message} effacer={() => setMessage(null)} />
    </>
  );
}

function Heure({
  p,
  champ,
  label,
  valeur,
  changer,
  clos,
}: {
  p: Personne;
  champ: "refMatin" | "refPause" | "refMidi" | "refSoir";
  label: string;
  valeur: <K extends keyof Champs>(p: Personne, c: K) => Champs[K];
  changer: <K extends keyof Champs>(p: Personne, c: K, v: Champs[K]) => void;
  clos: boolean;
}) {
  return (
    <input
      value={valeur(p, champ)}
      onChange={(e) => changer(p, champ, e.target.value)}
      disabled={clos}
      placeholder="--:--"
      inputMode="numeric"
      maxLength={5}
      pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
      title="Heure au format 24 h, par exemple 09:00 ou 17:30"
      aria-label={`${label} de ${p.prenom}`}
    />
  );
}

function FormulaireRegles({
  majoration,
  arrondiMinutes,
  toleranceMinutes,
  fermer,
}: {
  majoration: number;
  arrondiMinutes: number;
  toleranceMinutes: number;
  fermer: () => void;
}) {
  const { message, setMessage, enCours, lancer } = useAction();
  return (
    <form
      className="reglages"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        lancer(async () => {
          const r = await majParametres(fd);
          if (r.ok) fermer();
          return r;
        });
      }}
    >
      <label className="champ">
        <span>Majoration des heures sup</span>
        <select name="majoration" defaultValue={String(majoration)}>
          <option value="1">aucune : 1 h sup = 1 h de récup</option>
          <option value="1.25">25 % : 1 h sup = 1 h 15 de récup</option>
          <option value="1.5">50 % : 1 h sup = 1 h 30 de récup</option>
        </select>
      </label>
      <label className="champ">
        <span>Tolérance</span>
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
          <option value="5">aux 5 minutes</option>
          <option value="10">aux 10 minutes</option>
          <option value="15">au quart d’heure</option>
          <option value="30">à la demi-heure</option>
        </select>
      </label>
      <div style={{ display: "flex", gap: 6 }}>
        <button className="rbtn-sm ghost" type="button" onClick={fermer}>
          Annuler
        </button>
        <button className="rbtn brand" type="submit" disabled={enCours}>
          Enregistrer
        </button>
      </div>
      <ToastRH message={message} effacer={() => setMessage(null)} />
    </form>
  );
}

function CarteCreation({ equipes }: { equipes: string[] }) {
  const { message, setMessage, secret, setSecret, enCours, lancer } = useAction();
  return (
    <div className="card" style={{ marginTop: 22 }}>
      <h2>Ajouter une personne</h2>
      <form
        className="creation"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          lancer(async () => {
            const r = await creerUtilisateur(new FormData(form));
            if (r.ok) form.reset();
            return r;
          });
        }}
      >
        <input name="prenom" placeholder="Prénom" required />
        <input name="email" type="email" placeholder="email@…" required style={{ width: 230 }} />
        <input name="equipe" placeholder="Équipe" list="equipes" />
        <datalist id="equipes">
          {equipes.map((e) => (
            <option key={e} value={e} />
          ))}
        </datalist>
        <input name="poste" placeholder="Poste" />
        <select name="role" defaultValue="SALARIE">
          <option value="SALARIE">Salarié</option>
          <option value="RH">RH</option>
        </select>
        <button className="rbtn brand" type="submit" disabled={enCours}>
          Créer le compte
        </button>
        {secret && (
          <div className="secret">
            Mot de passe provisoire : <strong className="mono">{secret}</strong>{" "}
            <button className="rbtn-sm ghost" type="button" onClick={() => setSecret(null)}>
              OK
            </button>
          </div>
        )}
        <ToastRH message={message} effacer={() => setMessage(null)} />
      </form>
    </div>
  );
}
