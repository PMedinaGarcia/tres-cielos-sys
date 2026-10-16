import { BandejaScreen } from "@/components/bandeja/bandeja-screen";
import { Suspense } from "react";

export default function BandejaPage() {
  return (
    <Suspense
      fallback={
        <p className="px-6 py-10 text-sm text-ink/50">Cargando bandeja…</p>
      }
    >
      <BandejaScreen />
    </Suspense>
  );
}
