import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Finish creating your site · Folio" };

export default function GoogleSignupLayout({ children }: { children: ReactNode }) {
  return children;
}
