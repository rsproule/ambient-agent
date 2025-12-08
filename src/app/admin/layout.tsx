import { auth } from "@/src/lib/auth/config";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Not authenticated - redirect to login
  if (!session?.user) {
    redirect("/auth/login?callbackUrl=/admin/chats");
  }

  // Authenticated but not admin - redirect to home with error
  if (!session.user.isAdmin) {
    redirect("/?error=unauthorized");
  }

  return <>{children}</>;
}
