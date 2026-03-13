import React from "react";

export default function RunJsonPage() {
  return (
    <div className="wf-page-shell">
      <section className="wf-hero-panel">
        <div>
          <div className="wf-kicker">Run JSON Workflow</div>
          <h1>Run Workflow From JSON</h1>
          <p>
            This page will allow users to paste a workflow JSON definition and
            execute it with custom inputs and assets.
          </p>
        </div>
      </section>

      <section className="wf-details-panel">
        <div className="wf-details-empty">
          <h3>Feature Coming Soon</h3>
          <p>
            This page will support running arbitrary workflows by pasting JSON
            or loading saved input configurations.
          </p>
        </div>
      </section>
    </div>
  );
}