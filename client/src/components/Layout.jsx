import React from "react";
import Header from "./Header";

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-6 lg:px-10">

        <Header />

        <main className="flex-1 py-6">
          {children}
        </main>

      </div>
    </div>
  );
}