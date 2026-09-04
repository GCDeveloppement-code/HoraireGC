/**
 * Règles de calcul du compteur d'heures sup.
 * Fonctions pures, sans dépendance : testées dans calcul.test.ts.
 */

export type MomentJour = "MATIN" | "MIDI" | "SOIR";
export type Refs = { refMatin: string; refPause: string; refMidi: string; refSoir: string };

export const PARIS_TZ = "Europe/Paris";

/** "HH:MM" -> minutes depuis minuit */
export function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** minutes depuis minuit -> "HH:MM" */
export function fromMin(min: number): string {
  const m = Math.max(0, Math.min(23 * 60 + 59, min));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** "HH:MM" -> "9h05" (affichage français) */
export function hm(hhmm: string): string {
  const [h, m] = hhmm.split(":");
  return `${Number(h)}h${m}`;
}

/** Durée signée en minutes -> "+1h15", "-0h15", "0h00" */
export function fmtDuree(min: number, avecPlus = true): string {
  const signe = min < 0 ? "-" : min > 0 && avecPlus ? "+" : "";
  const a = Math.abs(min);
  return `${signe}${Math.floor(a / 60)}h${String(a % 60).padStart(2, "0")}`;
}

/** Arrondi au pas le plus proche (15 min par défaut). Symétrique : -22 -> -15, +23 -> +30. */
export function arrondir(minutes: number, pas = 15): number {
  const r = Math.round(minutes / pas) * pas;
  return r === 0 ? 0 : r; // évite le -0
}

/** Règles communes fixées par la RH (page Règles). Les valeurs par défaut sont celles de la base. */
export type Regles = { arrondiMinutes: number; toleranceMinutes: number };
export const REGLES_DEFAUT: Regles = { arrondiMinutes: 15, toleranceMinutes: 15 };

/** Horaire de référence de la personne pour un moment donné. */
export function refDuMoment(moment: MomentJour, refs: Refs): string {
  return moment === "MATIN" ? refs.refMatin : moment === "MIDI" ? refs.refMidi : refs.refSoir;
}

/**
 * Écart signé brut (en minutes, sans arrondi ni tolérance) entre l'heure déclarée et l'horaire de référence.
 * Matin et midi : arriver ou reprendre plus tôt est positif, plus tard est négatif.
 * Soir : finir plus tard est positif, plus tôt est négatif.
 */
export function ecartBrut(moment: MomentJour, heure: string, refs: Refs): number {
  const ref = toMin(refDuMoment(moment, refs));
  return moment === "SOIR" ? toMin(heure) - ref : ref - toMin(heure);
}

/**
 * Écart retenu : 0 si l'écart brut tient dans la tolérance (dans un sens comme dans l'autre : finir à 17h40
 * ou arriver à 9h10 ne compte pas), sinon l'écart brut arrondi au pas.
 */
export function ecart(moment: MomentJour, heure: string, refs: Refs, regles: Regles = REGLES_DEFAUT): number {
  const brut = ecartBrut(moment, heure, refs);
  if (Math.abs(brut) <= regles.toleranceMinutes) return 0;
  return arrondir(brut, regles.arrondiMinutes);
}

/** Vrai si l'heure déclarée s'écarte de la référence mais reste dans la tolérance. */
export function dansTolerance(moment: MomentJour, heure: string, refs: Refs, regles: Regles = REGLES_DEFAUT): boolean {
  const brut = ecartBrut(moment, heure, refs);
  return brut !== 0 && Math.abs(brut) <= regles.toleranceMinutes;
}

/** Durées de récup possibles, déduites des horaires de la personne. */
export function dureesRecup(refs: Refs): { cle: "am" | "pm" | "day"; libelle: string; minutes: number }[] {
  const matin = toMin(refs.refPause) - toMin(refs.refMatin);
  const aprem = toMin(refs.refSoir) - toMin(refs.refMidi);
  return [
    { cle: "am", libelle: "Matin", minutes: -matin },
    { cle: "pm", libelle: "Après-midi", minutes: -aprem },
    { cle: "day", libelle: "Journée", minutes: -(matin + aprem) },
  ];
}

/** Moment concerné par le gros bouton, selon l'heure courante. */
export function momentCourant(hhmm: string): MomentJour {
  if (hhmm < "11:30") return "MATIN";
  if (hhmm < "15:45") return "MIDI";
  return "SOIR";
}

/** Ambiance de l'écran selon l'heure : Aube le matin, Ciel l'après-midi, Soir après 17h30. */
export type Ambiance = "aube" | "ciel" | "soir";
export function ambiance(hhmm: string): Ambiance {
  if (hhmm < "12:30") return "aube";
  if (hhmm < "17:30") return "ciel";
  return "soir";
}

export type DeclarationCalc = {
  date: string;
  moment: "MATIN" | "MIDI" | "SOIR" | "RECUP";
  minutes: number;
  creeLe: string;
  statut: "DECLAREE" | "A_CONFIRMER" | "CONFIRMEE";
};

/** Déclarée un autre jour que le jour concerné (les récups, posées à l'avance, ne comptent pas). */
export function estApresCoup(d: Pick<DeclarationCalc, "moment" | "date" | "creeLe">): boolean {
  return d.moment !== "RECUP" && d.creeLe !== d.date;
}

export type Totaux = { sup: number; retards: number; recups: number; apresCoup: number; aConfirmer: number; nb: number };

/** Totaux d'un ensemble de déclarations (typiquement un mois). */
export function totaux(decls: DeclarationCalc[]): Totaux {
  const t: Totaux = { sup: 0, retards: 0, recups: 0, apresCoup: 0, aConfirmer: 0, nb: 0 };
  for (const d of decls) {
    t.nb++;
    if (d.moment === "RECUP") t.recups += d.minutes;
    else if (d.minutes > 0) t.sup += d.minutes;
    else t.retards += d.minutes;
    if (estApresCoup(d)) t.apresCoup++;
    if (d.statut === "A_CONFIRMER") t.aConfirmer++;
  }
  return t;
}

/**
 * Solde de récup : solde initial + heures sup (majorées) + retards + récups prises.
 * La majoration ne s'applique qu'aux écarts positifs.
 */
export function solde(soldeInitial: number, decls: DeclarationCalc[], majoration = 1): number {
  let s = soldeInitial;
  for (const d of decls) {
    if (d.moment === "RECUP" || d.minutes < 0) s += d.minutes;
    else s += Math.round(d.minutes * majoration);
  }
  return s;
}

/** Date et heure courantes à Paris, au format YYYY-MM-DD / HH:MM. */
export function maintenantParis(now = new Date()): { date: string; heure: string } {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const heure = `${get("hour").padStart(2, "0")}:${get("minute")}`.replace("24:", "00:");
  return { date: `${get("year")}-${get("month")}-${get("day")}`, heure };
}

/** Les 5 jours ouvrés (lundi à vendredi) de la semaine contenant `date` (YYYY-MM-DD). */
export function semaineDe(date: string): string[] {
  const [y, m, d] = date.split("-").map(Number);
  const jour = new Date(Date.UTC(y, m - 1, d));
  const dow = (jour.getUTCDay() + 6) % 7; // lundi = 0
  const lundi = new Date(jour);
  lundi.setUTCDate(jour.getUTCDate() - dow);
  return Array.from({ length: 5 }, (_, i) => {
    const x = new Date(lundi);
    x.setUTCDate(lundi.getUTCDate() + i);
    return x.toISOString().slice(0, 10);
  });
}

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const JOURS_C = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const MOIS_C = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** "2026-09-03" -> "jeu. 3 sept." ou "Jeudi 3 septembre" */
export function fmtDate(date: string, long = false): string {
  const [y, m, d] = date.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  if (long) {
    const j = JOURS[dow];
    return `${j.charAt(0).toUpperCase()}${j.slice(1)} ${d} ${MOIS[m - 1]}`;
  }
  return `${JOURS_C[dow]} ${d} ${MOIS_C[m - 1]}`;
}

export function jourCourt(date: string): { jour: string; num: number } {
  const [y, m, d] = date.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { jour: JOURS_C[dow].replace(".", ""), num: d };
}

/** "2026-09" -> "Septembre 2026" */
export function fmtMois(mois: string): string {
  const [y, m] = mois.split("-").map(Number);
  const nom = MOIS[m - 1];
  return `${nom.charAt(0).toUpperCase()}${nom.slice(1)} ${y}`;
}

export const MOMENT_LABEL: Record<MomentJour, { label: string; verbe: string; maintenant: string }> = {
  MATIN: { label: "Matin", verbe: "J’ai commencé à", maintenant: "J’arrive maintenant" },
  MIDI: { label: "Midi", verbe: "J’ai repris à", maintenant: "Je reprends maintenant" },
  SOIR: { label: "Soir", verbe: "J’ai fini à", maintenant: "Je termine maintenant" },
};

export const ORDRE_MOMENT: Record<string, number> = { MATIN: 0, MIDI: 1, SOIR: 2, RECUP: 3 };

export const MOTIFS = ["Installation client", "Incident", "Réunion", "Autre"] as const;
