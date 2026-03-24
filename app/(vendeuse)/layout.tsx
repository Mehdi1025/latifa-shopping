import VendeuseLayout from "@/components/VendeuseLayout";

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <VendeuseLayout>{children}</VendeuseLayout>;
}
