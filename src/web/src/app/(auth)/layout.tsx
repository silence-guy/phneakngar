import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "ចូល",
  description: "ចូលដើម្បីគ្រប់គ្រងក្រុមហ៊ុនផ្ទាល់ខ្លួនរបស់អ្នកលើ ភ្នាក់ងារ។",
  openGraph: {
    images: [{ url: "/og?title=ចូល", width: 1200, height: 630 }],
  },
};

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (session) redirect("/workspaces?auto");

  return <>{children}</>;
}
