import { describe, expect, it } from "vitest";
import {
  ambiance,
  arrondir,
  dansTolerance,
  dureesRecup,
  ecart,
  ecartBrut,
  estApresCoup,
  fmtDate,
  fmtDuree,
  hm,
  maintenantParis,
  momentCourant,
  semaineDe,
  solde,
  totaux,
} from "./calcul";

const refs = { refMatin: "09:00", refPause: "12:30", refMidi: "14:00", refSoir: "17:30" };

describe("arrondi au quart d'heure", () => {
  it("arrondit au plus proche, symétriquement", () => {
    expect(arrondir(77)).toBe(75);
    expect(arrondir(82)).toBe(75);
    expect(arrondir(83)).toBe(90);
    expect(arrondir(-22)).toBe(-15);
    expect(arrondir(-23)).toBe(-30);
    expect(arrondir(7)).toBe(0);
    expect(arrondir(8)).toBe(15);
  });
});

describe("écart par rapport à l'horaire de référence", () => {
  it("soir : finir plus tard est positif", () => {
    expect(ecart("SOIR", "18:47", refs)).toBe(75);
    expect(ecart("SOIR", "19:32", refs)).toBe(120);
    expect(ecart("SOIR", "16:00", refs)).toBe(-90);
    expect(ecart("SOIR", "17:35", refs)).toBe(0);
  });
  it("matin : arriver en retard est négatif, en avance positif", () => {
    expect(ecart("MATIN", "09:22", refs)).toBe(-15);
    expect(ecart("MATIN", "08:40", refs)).toBe(15);
    expect(ecart("MATIN", "09:05", refs)).toBe(0);
  });
  it("midi : reprendre plus tôt est positif", () => {
    expect(ecart("MIDI", "13:20", refs)).toBe(45);
    expect(ecart("MIDI", "14:20", refs)).toBe(-15);
  });
  it("respecte des horaires aménagés", () => {
    const decale = { ...refs, refMatin: "09:30", refMidi: "14:30", refSoir: "18:00" };
    expect(ecart("SOIR", "19:30", decale)).toBe(90);
    expect(ecart("MATIN", "09:30", decale)).toBe(0);
  });
});

describe("tolérance", () => {
  const sans = { arrondiMinutes: 15, toleranceMinutes: 0 };
  const dix = { arrondiMinutes: 15, toleranceMinutes: 10 };
  it("un écart dans la tolérance (15 min par défaut) ne compte pas, dans les deux sens", () => {
    expect(ecart("SOIR", "17:40", refs)).toBe(0);
    expect(ecart("SOIR", "17:45", refs)).toBe(0);
    expect(ecart("MATIN", "09:10", refs)).toBe(0);
    expect(ecart("MATIN", "09:15", refs)).toBe(0);
    expect(ecart("MATIN", "08:50", refs)).toBe(0);
    expect(ecart("MIDI", "14:10", refs)).toBe(0);
  });
  it("au-delà de la tolérance, l'écart entier est retenu, arrondi", () => {
    expect(ecart("SOIR", "17:46", refs)).toBe(15);
    expect(ecart("SOIR", "17:53", refs)).toBe(30);
    expect(ecart("SOIR", "19:00", refs)).toBe(90);
    expect(ecart("MATIN", "09:16", refs)).toBe(-15);
    expect(ecart("MATIN", "09:25", refs)).toBe(-30);
  });
  it("se règle : à 0 on retrouve l'arrondi pur, à 10 le seuil bouge", () => {
    expect(ecart("SOIR", "17:40", refs, sans)).toBe(15);
    expect(ecart("MATIN", "09:10", refs, sans)).toBe(-15);
    expect(ecart("SOIR", "17:40", refs, dix)).toBe(0);
    expect(ecart("SOIR", "17:41", refs, dix)).toBe(15);
  });
  it("distingue « pile à l'heure » de « dans la tolérance »", () => {
    expect(ecartBrut("SOIR", "17:40", refs)).toBe(10);
    expect(dansTolerance("SOIR", "17:40", refs)).toBe(true);
    expect(dansTolerance("SOIR", "17:30", refs)).toBe(false);
    expect(dansTolerance("SOIR", "18:00", refs)).toBe(false);
  });
});

describe("durées de récup", () => {
  it("découlent des horaires : 9h-12h30 et 14h-17h30 font deux demi-journées de 3h30", () => {
    const d = dureesRecup(refs);
    expect(d.map((x) => x.minutes)).toEqual([-210, -210, -420]);
  });
  it("suivent un temps partiel", () => {
    const d = dureesRecup({ ...refs, refSoir: "16:30" });
    expect(d[1].minutes).toBe(-150);
  });
});

describe("solde et totaux", () => {
  const decls = [
    { date: "2026-09-01", moment: "SOIR" as const, minutes: 120, creeLe: "2026-09-01", statut: "A_CONFIRMER" as const },
    { date: "2026-09-02", moment: "MATIN" as const, minutes: -15, creeLe: "2026-09-02", statut: "DECLAREE" as const },
    { date: "2026-09-02", moment: "MIDI" as const, minutes: 45, creeLe: "2026-09-03", statut: "DECLAREE" as const },
    { date: "2026-09-04", moment: "RECUP" as const, minutes: -210, creeLe: "2026-09-02", statut: "DECLAREE" as const },
  ];
  it("additionne sup, retards et récups", () => {
    expect(solde(330, decls)).toBe(270);
  });
  it("applique la majoration aux seules heures sup", () => {
    expect(solde(0, decls, 1.25)).toBe(Math.round(120 * 1.25) + Math.round(45 * 1.25) - 15 - 210);
  });
  it("compte les après coup et les demandes de confirmation", () => {
    const t = totaux(decls);
    expect(t).toEqual({ sup: 165, retards: -15, recups: -210, apresCoup: 1, aConfirmer: 1, nb: 4 });
  });
  it("une récup posée à l'avance n'est pas « après coup »", () => {
    expect(estApresCoup(decls[3])).toBe(false);
    expect(estApresCoup(decls[2])).toBe(true);
  });
});

describe("moments et ambiance", () => {
  it("choisit le bouton selon l'heure", () => {
    expect(momentCourant("08:52")).toBe("MATIN");
    expect(momentCourant("13:35")).toBe("MIDI");
    expect(momentCourant("18:47")).toBe("SOIR");
  });
  it("Aube, Ciel, Soir", () => {
    expect(ambiance("09:00")).toBe("aube");
    expect(ambiance("12:30")).toBe("ciel");
    expect(ambiance("17:30")).toBe("soir");
  });
});

describe("dates", () => {
  it("formate en français", () => {
    expect(fmtDate("2026-09-03")).toBe("jeu. 3 sept.");
    expect(fmtDate("2026-09-03", true)).toBe("Jeudi 3 septembre");
    expect(hm("09:05")).toBe("9h05");
    expect(fmtDuree(75)).toBe("+1h15");
    expect(fmtDuree(-15)).toBe("-0h15");
    expect(fmtDuree(0)).toBe("0h00");
  });
  it("donne les 5 jours ouvrés de la semaine", () => {
    expect(semaineDe("2026-09-03")).toEqual(["2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"]);
    expect(semaineDe("2026-09-06")).toEqual(["2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"]);
  });
  it("lit l'heure de Paris", () => {
    const { date, heure } = maintenantParis(new Date("2026-09-03T16:47:00Z"));
    expect(date).toBe("2026-09-03");
    expect(heure).toBe("18:47");
  });
});
