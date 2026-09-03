import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { db } from "./db";

export const SESSION_COOKIE = "hs_session";
const DUREE_SESSION_S = 60 * 60 * 24 * 30; // 30 jours

export type Session = { userId: string; role: "SALARIE" | "RH" };

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET manquant ou trop court");
  return new TextEncoder().encode(s);
}

export async function signerSession(session: Session): Promise<string> {
  return new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DUREE_SESSION_S}s`)
    .sign(secret());
}

export async function lireSession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.userId !== "string") return null;
    return { userId: payload.userId, role: payload.role === "RH" ? "RH" : "SALARIE" };
  } catch {
    return null;
  }
}

export async function poserCookieSession(session: Session) {
  const token = await signerSession(session);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DUREE_SESSION_S,
  });
}

export async function effacerCookieSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function sessionCourante(): Promise<Session | null> {
  const store = await cookies();
  return lireSession(store.get(SESSION_COOKIE)?.value);
}

/** Utilisateur connecté (ou redirection vers la page de connexion). */
export async function utilisateurCourant() {
  const session = await sessionCourante();
  if (!session) redirect("/connexion");
  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user || !user.actif) {
    redirect("/connexion?raison=inactif");
  }
  return user;
}

/** Comme utilisateurCourant, mais exige le rôle RH. */
export async function utilisateurRH() {
  const user = await utilisateurCourant();
  if (user.role !== "RH") redirect("/");
  return user;
}
