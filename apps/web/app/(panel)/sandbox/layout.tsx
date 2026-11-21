import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { devRoutesEnabled, panelHomePath } from "@/lib/panel-routes";

export default function SandboxLayout({ children }: { children: ReactNode }) {
  if (!devRoutesEnabled()) {
    redirect(panelHomePath());
  }

  return children;
}
