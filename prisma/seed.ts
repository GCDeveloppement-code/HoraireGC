/**
 * Seed : crée les paramètres par défaut et l'équipe décrite dans prisma/equipe.json.
 * Idempotent : un membre déjà présent (même email) n'est pas recréé ni modifié.
 * Mot de passe provisoire : SEED_PASSWORD (à changer à la première connexion).
 *
 *   npx prisma db seed
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient, Role } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

type Membre = {
  prenom: string;
  nom?: string;
  email: string;
  equipe?: string;
  poste?: string;
  role?: "SALARIE" | "RH";
  soldeInitial?: number;
  refMatin?: string;
  refPause?: string;
  refMidi?: string;
  refSoir?: string;
};

async function main() {
  await prisma.parametres.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  const fichier = JSON.parse(readFileSync(join(__dirname, "equipe.json"), "utf8")) as { membres: Membre[] };
  const motDePasse = process.env.SEED_PASSWORD ?? "gc-2026";
  const hash = await bcrypt.hash(motDePasse, 12);

  let crees = 0;
  for (const m of fichier.membres) {
    const existe = await prisma.user.findUnique({ where: { email: m.email.toLowerCase() } });
    if (existe) continue;
    await prisma.user.create({
      data: {
        email: m.email.toLowerCase(),
        passwordHash: hash,
        prenom: m.prenom,
        nom: m.nom,
        equipe: m.equipe,
        poste: m.poste,
        role: m.role === "RH" ? Role.RH : Role.SALARIE,
        soldeInitial: m.soldeInitial ?? 0,
        refMatin: m.refMatin ?? "09:00",
        refPause: m.refPause ?? "12:30",
        refMidi: m.refMidi ?? "14:00",
        refSoir: m.refSoir ?? "17:30",
        mustChangePassword: true,
      },
    });
    crees++;
  }
  console.log(`Seed terminé : ${crees} compte(s) créé(s), mot de passe provisoire « ${motDePasse} ».`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
