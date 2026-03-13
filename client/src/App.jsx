import React from "react";
import { Routes, Route } from "react-router";

import Layout from "./components/Layout";
import LandingPage from "./pages/LandingPage";
import SystemStatusPage from "./pages/SystemStatusPage";
import WorkflowsPage from "./pages/WorkflowsPage";
import WorkflowDetailsPage from "./pages/WorkflowDetailsPage";
import RunJsonPage from "./pages/RunJsonPage";
import AssetsPage from "./pages/AssetsPage";
import RunsPage from "./pages/RunsPage";

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/workflows" element={<WorkflowsPage />} />
        <Route path="/workflows/:workflowId" element={<WorkflowDetailsPage />} />
        <Route path="/run-json" element={<RunJsonPage />} />
        <Route path="/assets" element={<AssetsPage />} />
        <Route path="/runs" element={<RunsPage />} />
        <Route path="/system-status" element={<SystemStatusPage />} />
      </Routes>
    </Layout>
  );
}

export default App;