"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, logoutUser } from "@/auth/googleAuth";
import NaukriForm from "@/components/NaukriForm";
import type { AppUser } from "@/auth/googleAuth";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      router.push("/");
      return;
    }
    setUser(currentUser);
  }, [router]);

  const handleLogout = async () => {
    await logoutUser();
    router.push("/");
  };

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Signed in as</p>
            <p className="text-xl font-semibold">{user.name}</p>
            <p className="text-sm text-slate-500">{user.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">Naukri Automation</h1>
          <p className="mt-2 text-slate-600">
            Enter your Naukri credentials and upload your resume PDF. The backend will run the
            automation and upload the resume.
          </p>
        </div>
        <NaukriForm />
      </main>
    </div>
  );
}
