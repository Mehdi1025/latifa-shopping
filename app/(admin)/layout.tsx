import DashboardLayout from "@/components/DashboardLayout";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { Toaster } from "sonner";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NotificationsProvider>
      <DashboardLayout>{children}</DashboardLayout>
      <Toaster
        position="top-right"
        toastOptions={{
          unstyled: true,
          classNames: {
            toast: "!rounded-2xl !border !border-emerald-500/60 !bg-black/90 !px-5 !py-4 !shadow-xl !backdrop-blur-sm",
            title: "!text-white !font-semibold",
            description: "!text-gray-200 !text-sm",
          },
        }}
      />
    </NotificationsProvider>
  );
}
