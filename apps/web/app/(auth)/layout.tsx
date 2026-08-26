import { LoginBackdrop } from "@/components/login-backdrop";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="relative isolate min-h-screen overflow-hidden">
      <LoginBackdrop />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10 lg:justify-end lg:pr-16 xl:pr-28">
        {children}
      </div>
    </div>
  );
}
