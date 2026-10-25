import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Create your site · Folio" };

export default function SignupLayout({ children }: { children: ReactNode }) {
  return children;
}
