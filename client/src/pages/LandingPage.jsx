import React from "react";
import { useNavigate } from "react-router";

export default function LandingPage() {
  const navigate = useNavigate();

    const features = [
      {
        title: "Run saved workflows",
        description:
          "Launch named ComfyUI workflows from a clean interface without editing the underlying defaults.",
      },
      {
        title: "Patch prompts and node values",
        description:
          "Adjust prompts, seeds, image inputs, and workflow properties for the current session only.",
      },
      {
        title: "Reuse saved assets",
        description:
          "Select reference images, masks, and other inputs from a local asset library built for repeat runs.",
      },
      {
        title: "Inspect detailed logs",
        description:
          "See execution status, failures, run history, and raw workflow diagnostics in one place.",
      },
    ];
  
    const quickActions = [
      "Browse workflows",
      "Start new run",
      "Open assets",
      "Review logs",
    ];
  
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-6 lg:px-10">
          <main className="grid flex-1 gap-6 py-6 lg:grid-cols-[1.3fr_0.7fr]">
            <section className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-8 shadow-2xl shadow-black/30">
              <div className="max-w-3xl">
                <div className="inline-flex items-center rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-sm text-sky-300">
                  Session overlays on top of your saved workflows
                </div>
                <h2 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">
                  Run, patch, and monitor ComfyUI workflows from one local dashboard.
                </h2>
                <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                  Load workflows from your ComfyUI workflow folder, apply temporary session changes,
                  reuse local assets, and inspect detailed execution logs without modifying your base
                  workflow files.
                </p>
              </div>
  
              <div className="mt-8 flex flex-wrap gap-3">
                <button className="rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400">
                  Open Workflows
                </button>
                <button className="rounded-2xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-900">
                  New JSON Run
                </button>
                <button className="rounded-2xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-900">
                  View Run History
                </button>
              </div>
  
              <div className="mt-10 grid gap-4 md:grid-cols-2">
                {features.map((feature) => (
                  <div
                    key={feature.title}
                    className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 backdrop-blur"
                  >
                    <h3 className="text-base font-semibold text-white">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{feature.description}</p>
                  </div>
                ))}
              </div>
            </section>
  
            <aside className="space-y-6">
              <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-black/20">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Quick Actions</h3>
                  <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                    Core
                  </span>
                </div>
                <div className="mt-4 grid gap-3">
                  {quickActions.map((action) => (
                    <button
                      key={action}
                      className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-left text-sm font-medium text-slate-200 transition hover:border-sky-500/40 hover:bg-slate-900"
                    >
                      <span>{action}</span>
                      <span className="text-slate-500">→</span>
                    </button>
                  ))}
                </div>
              </section>
  
              <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-black/20">
                <h3 className="text-lg font-semibold">Current Architecture</h3>
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-400">Frontend</div>
                    <div className="mt-1 text-sm text-slate-200">Workflow dashboard and run controls</div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-400">Node server</div>
                    <div className="mt-1 text-sm text-slate-200">Overlay logic, asset routing, validation, logging</div>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-400">ComfyUI engine</div>
                    <div className="mt-1 text-sm text-slate-200">Execution queue, outputs, history, websocket status</div>
                  </div>
                </div>
              </section>
  
              <section className="rounded-3xl border border-amber-500/20 bg-amber-500/5 p-6 shadow-xl shadow-black/20">
                <h3 className="text-lg font-semibold text-amber-200">Setup Notes</h3>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-amber-50/90">
                  <li>• Server bound to local network only.</li>
                  <li>• Base workflows remain unchanged unless explicitly exported.</li>
                  <li>• Session edits are merged in memory before execution.</li>
                </ul>
              </section>
            </aside>
          </main>
        </div>
      </div>
    );
  }
  