import { utilisateurRH } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LayoutRH({ children }: { children: React.ReactNode }) {
  await utilisateurRH();
  return <main className="page-claire">{children}</main>;
}
