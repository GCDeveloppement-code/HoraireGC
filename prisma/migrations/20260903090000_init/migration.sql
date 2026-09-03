-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SALARIE', 'RH');

-- CreateEnum
CREATE TYPE "Moment" AS ENUM ('MATIN', 'MIDI', 'SOIR', 'RECUP');

-- CreateEnum
CREATE TYPE "Statut" AS ENUM ('DECLAREE', 'A_CONFIRMER', 'CONFIRMEE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "nom" TEXT,
    "poste" TEXT,
    "equipe" TEXT,
    "role" "Role" NOT NULL DEFAULT 'SALARIE',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "refMatin" TEXT NOT NULL DEFAULT '09:00',
    "refPause" TEXT NOT NULL DEFAULT '12:30',
    "refMidi" TEXT NOT NULL DEFAULT '14:00',
    "refSoir" TEXT NOT NULL DEFAULT '17:30',
    "soldeInitial" INTEGER NOT NULL DEFAULT 0,
    "rappelSoir" BOOLEAN NOT NULL DEFAULT false,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Declaration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "moment" "Moment" NOT NULL,
    "heure" TEXT,
    "minutes" INTEGER NOT NULL,
    "libelle" TEXT,
    "motif" TEXT,
    "client" TEXT,
    "justification" TEXT,
    "statut" "Statut" NOT NULL DEFAULT 'DECLAREE',
    "creeLe" TEXT NOT NULL,
    "modifiee" BOOLEAN NOT NULL DEFAULT false,
    "demandeeParId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Declaration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cloture" (
    "mois" TEXT NOT NULL,
    "clotureeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parId" TEXT NOT NULL,

    CONSTRAINT "Cloture_pkey" PRIMARY KEY ("mois")
);

-- CreateTable
CREATE TABLE "Parametres" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "majoration" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "arrondiMinutes" INTEGER NOT NULL DEFAULT 15,
    "recapVendredi" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Parametres_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_actif_idx" ON "User"("actif");

-- CreateIndex
CREATE INDEX "Declaration_userId_date_idx" ON "Declaration"("userId", "date");

-- CreateIndex
CREATE INDEX "Declaration_date_idx" ON "Declaration"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Declaration_userId_date_moment_key" ON "Declaration"("userId", "date", "moment");

-- AddForeignKey
ALTER TABLE "Declaration" ADD CONSTRAINT "Declaration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
