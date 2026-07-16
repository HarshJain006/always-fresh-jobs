"use client";

import { useState } from "react";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunkSize, i + chunkSize)));
  }
  return window.btoa(binary);
}

export default function NaukriForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mobile, setMobile] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [updatePdf, setUpdatePdf] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setStatus(null);

    if (!file) {
      setError("Please select a resume PDF file.");
      return;
    }
    if (!username || !password || !mobile) {
      setError("Please complete all fields.");
      return;
    }

    setLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const resumeData = arrayBufferToBase64(arrayBuffer);

      const response = await fetch("/api/naukri", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          mobile,
          resumeFileName: file.name,
          resumeData,
          updatePdf,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Naukri automation failed.");
      }

      setStatus("Naukri task completed successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-xl shadow-md">
      <div>
        <label className="block text-sm font-medium text-gray-700">Naukri Login ID</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mt-2 w-full rounded border px-3 py-2"
          placeholder="Enter Naukri username"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Naukri Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-2 w-full rounded border px-3 py-2"
          placeholder="Enter password"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Mobile Number</label>
        <input
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          className="mt-2 w-full rounded border px-3 py-2"
          placeholder="Enter mobile number"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Resume PDF</label>
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="mt-2 w-full"
          required
        />
      </div>

      <div className="flex items-center gap-3">
        <input
          id="updatePdf"
          type="checkbox"
          checked={updatePdf}
          onChange={(e) => setUpdatePdf(e.target.checked)}
          className="h-4 w-4"
        />
        <label htmlFor="updatePdf" className="text-sm">
          Randomize PDF before upload
        </label>
      </div>

      {error && <div className="rounded-md bg-red-50 p-3 text-red-700">{error}</div>}
      {status && <div className="rounded-md bg-green-50 p-3 text-green-700">{status}</div>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Running Naukri automation…" : "Run Naukri"}
      </button>
    </form>
  );
}
