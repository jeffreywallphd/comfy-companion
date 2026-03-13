import React from "react";
import NavMenu from "./NavMenu";

export default function Header() {
  return (
    <header className="app-header">
      <div className="app-header-brand">
        <div className="app-header-kicker">Comfy Companion</div>
        <h1 className="app-header-title">
          Simple controls for complex ComfyUI workflows
        </h1>
      </div>

      <div className="app-header-actions">
        <div className="app-status-pill">LAN Only</div>
        <NavMenu />
      </div>
    </header>
  );
}