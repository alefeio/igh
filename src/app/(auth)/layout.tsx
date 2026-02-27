import { ToastProvider } from "@/components/feedback/ToastProvider";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-zinc-50 py-4 sm:py-8">
        <div className="container-page flex flex-col items-center">{children}</div>
      </div>
    </ToastProvider>
  );
}
