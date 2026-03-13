import React from "react";

export default function RunsPage() {
  return (
    <div className="wf-page-shell">
      <section className="wf-hero-panel">
        <div>
          <div className="wf-kicker">Runs</div>
          <h1>Workflow Run History</h1>
          <p>
            This page will display the execution history of workflows run
            through the orchestrator.
          </p>
        </div>
      </section>

      <section className="wf-details-panel">
        <div className="wf-details-empty">
          <h3>No Run History Yet</h3>
          <p>
            Once workflows are executed through the system, their run status,
            logs, and outputs will appear here.
          </p>
        </div>
      </section>
    </div>
  );
}