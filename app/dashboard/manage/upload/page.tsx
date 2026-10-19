/* eslint-disable @next/next/no-img-element -- user uploads are served by our own route */
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { photoSource } from "@/lib/uploads";
import { PhotoUploader } from "../../editor";
import { Card, PageHeader } from "../section";

export const metadata = { title: "Upload photos — Folio" };

export default function UploadPage() {
  return (
    <>
      <PageHeader title="Upload photos" subtitle="Photos are resized for the web, and location data hidden in the files is removed." />
      <Card>
        <PhotoUploader />
      </Card>
      <Suspense fallback={null}>
        <RecentUploads />
      </Suspense>
    </>
  );
}

async function RecentUploads() {
  const user = await requireUser();
  const recent = user.photos.filter((p) => !p.removed).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 12);
  if (recent.length === 0) return null;
  return (
    <Card title="Recently uploaded">
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {recent.map((p) => {
          const src = photoSource(user.id, p);
          return (
            <li key={p.id}>
              <img src={src.src} srcSet={src.srcSet} sizes="160px" alt="" className="aspect-square w-full object-cover" />
            </li>
          );
        })}
      </ul>
      <Link href="/dashboard/manage/photos?filter=no-description" className="inline-block text-sm font-medium underline underline-offset-4">
        Add descriptions and locations →
      </Link>
    </Card>
  );
}
