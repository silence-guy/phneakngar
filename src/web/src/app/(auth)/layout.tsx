import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to manage your company on ភ្នាក់ងារ.",
  alternates: {
    languages: {
      en: "/sign-in",
      km: "/km/sign-in",
    },
  },
  openGraph: {
    images: [{ url: "/og?title=Sign in", width: 1200, height: 630 }],
    locale: "en_US",
    alternateLocale: ["km_KH"],
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
