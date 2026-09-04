import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/karla";
import "@fontsource/space-mono";
import { utilisateurRH } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LayoutRH({ children }: { children: React.ReactNode }) {
  await utilisateurRH();
  return <main className="page-claire rh-fond">{children}</main>;
}
