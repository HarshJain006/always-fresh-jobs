"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/auth/googleAuth";
import LoginPage from "@/components/Login";
import Image from "next/image";
import heroImage from "@/assets/image.png";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      router.push("/dashboard");
    }
  }, [router]);

  return (
    <main>
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] items-start">
          <div>
            <h1 className="text-4xl font-bold">
              Get seen by recruiters, every single day.
            </h1>
            <p>
              We help you get seen by recruiters, every single day.
            </p>
            <button className="mt-4 bg-blue-500 text-white px-4 py-2 rounded">
              Get Started
            </button>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-full max-w-md">
              <Image
                src={heroImage}
                alt="Get seen by recruiters"
                width={720}
                height={540}
                className="w-full h-auto rounded-3xl object-cover"
                priority
              />
            </div>

            <div className="mt-6 w-full">
              <p>
                We help you get seen by recruiters, every single day.
              </p>
              <button className="mt-4 bg-blue-500 text-white px-4 py-2 rounded">
                Get Started
              </button>
            </div>
          </div>
        </div>
      </section>
      <section>
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] items-start">
          <div>
            <h1 className="text-4xl font-bold">
              Get seen by recruiters, every single day.
            </h1>
            <p>
              We help you get seen by recruiters, every single day.
            </p>
            <button className="mt-4 bg-blue-500 text-white px-4 py-2 rounded">
              Get Started
            </button>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-full max-w-md">
              <Image
                src={heroImage}
                alt="Recruiter visibility"
                className="w-full h-auto rounded-3xl object-cover"
                priority
              />
            </div>

            <div className="mt-6 w-full">
              <p>
                We help you get seen by recruiters, every single day.
              </p>
              <button className="mt-4 bg-blue-500 text-white px-4 py-2 rounded">
                Get Started
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
