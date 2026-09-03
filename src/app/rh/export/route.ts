import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { sessionCourante } from "@/lib/auth";
import { db } from "@/lib/db";
import { estApresCoup, fmtMois, maintenantParis, MOMENT_LABEL, solde, totaux, type MomentJour } from "@/lib/calcul";
import { parametres } from "@/lib/donnees";

export const dynamic = "force-dynamic";

const MOIS_RE = /^\d{4}-\d{2}$/;

/** Export Excel pour la paie : un récap par personne et le détail de chaque déclaration du mois. */
export async function GET(req: Request) {
  const session = await sessionCourante();
  if (!session || session.role !== "RH") return new NextResponse("Accès réservé à la RH", { status: 403 });
  const url = new URL(req.url);
  const moisParam = url.searchParams.get("mois");
  const mois = moisParam && MOIS_RE.test(moisParam) ? moisParam : maintenantParis().date.slice(0, 7);

  const [users, decls, p, cloture] = await Promise.all([
    db.user.findMany({ orderBy: [{ equipe: "asc" }, { prenom: "asc" }] }),
    db.declaration.findMany({ include: { user: true } }),
    parametres(),
    db.cloture.findUnique({ where: { mois } }),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Heures Sup GC";
  wb.created = new Date();

  const h = (min: number) => Math.round((min / 60) * 100) / 100; // heures décimales

  const recap = wb.addWorksheet("Récap");
  recap.columns = [
    { header: "Prénom", key: "prenom", width: 14 },
    { header: "Nom", key: "nom", width: 14 },
    { header: "Équipe", key: "equipe", width: 16 },
    { header: "Poste", key: "poste", width: 24 },
    { header: "Solde de départ (h)", key: "initial", width: 18 },
    { header: `Heures sup ${mois} (h)`, key: "sup", width: 20 },
    { header: `Retards ${mois} (h)`, key: "retards", width: 18 },
    { header: `Récups ${mois} (h)`, key: "recups", width: 18 },
    { header: "Après coup (nb)", key: "apres", width: 15 },
    { header: "À confirmer (nb)", key: "aconf", width: 16 },
    { header: "Solde actuel (h)", key: "solde", width: 16 },
  ];
  for (const u of users) {
    const siennes = decls.filter((d) => d.userId === u.id);
    const t = totaux(siennes.filter((d) => d.date.startsWith(mois)));
    recap.addRow({
      prenom: u.prenom,
      nom: u.nom ?? "",
      equipe: u.equipe ?? "",
      poste: u.poste ?? "",
      initial: h(u.soldeInitial),
      sup: h(t.sup),
      retards: h(t.retards),
      recups: h(t.recups),
      apres: t.apresCoup,
      aconf: t.aConfirmer,
      solde: h(solde(u.soldeInitial, siennes, p.majoration)),
    });
  }
  recap.getRow(1).font = { bold: true };

  const detail = wb.addWorksheet("Détail");
  detail.columns = [
    { header: "Prénom", key: "prenom", width: 14 },
    { header: "Date", key: "date", width: 12 },
    { header: "Moment", key: "moment", width: 10 },
    { header: "Heure déclarée", key: "heure", width: 14 },
    { header: "Écart (h)", key: "ecart", width: 10 },
    { header: "Écart (min)", key: "min", width: 11 },
    { header: "Motif", key: "motif", width: 20 },
    { header: "Client / site", key: "client", width: 24 },
    { header: "Justification", key: "justification", width: 40 },
    { header: "Statut", key: "statut", width: 12 },
    { header: "Après coup", key: "apres", width: 11 },
    { header: "Saisie le", key: "creeLe", width: 12 },
    { header: "Modifiée", key: "modifiee", width: 10 },
  ];
  const libStatut = { DECLAREE: "déclarée", A_CONFIRMER: "à confirmer", CONFIRMEE: "confirmée" } as const;
  for (const d of decls.filter((d) => d.date.startsWith(mois)).sort((a, b) => a.user.prenom.localeCompare(b.user.prenom) || a.date.localeCompare(b.date))) {
    detail.addRow({
      prenom: d.user.prenom,
      date: d.date,
      moment: d.moment === "RECUP" ? `Récup ${d.libelle ?? ""}` : MOMENT_LABEL[d.moment as MomentJour].label,
      heure: d.heure ?? "",
      ecart: h(d.minutes),
      min: d.minutes,
      motif: d.motif ?? "",
      client: d.client ?? "",
      justification: d.justification ?? "",
      statut: libStatut[d.statut],
      apres: estApresCoup(d) ? "oui" : "",
      creeLe: d.creeLe,
      modifiee: d.modifiee ? "oui" : "",
    });
  }
  detail.getRow(1).font = { bold: true };

  const infos = wb.addWorksheet("Infos");
  infos.addRow(["Mois", fmtMois(mois)]);
  infos.addRow(["Clôturé", cloture ? `oui, le ${cloture.clotureeLe.toLocaleDateString("fr-FR")}` : "non"]);
  infos.addRow(["Majoration des heures sup", `×${p.majoration}`]);
  infos.addRow(["Arrondi", `${p.arrondiMinutes} min`]);
  infos.addRow(["Généré le", new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })]);

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="heures-sup-${mois}.xlsx"`,
    },
  });
}
