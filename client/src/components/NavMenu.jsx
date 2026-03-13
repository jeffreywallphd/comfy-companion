import React, { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router";

export default function NavMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  const navItems = [
    { name: "Dashboard", path: "/" },
    { name: "Workflows", path: "/workflows" },
    { name: "Run JSON", path: "/run-json" },
    { name: "Assets", path: "/assets" },
    { name: "Run History", path: "/runs" },
    { name: "System Status", path: "/system-status" },
  ];

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div className="nav-menu" ref={menuRef}>
      <button
        type="button"
        className="nav-menu-button"
        aria-label="Open navigation menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="nav-menu-icon">
          <span />
          <span />
          <span />
        </span>
        <span className="nav-menu-label">Menu</span>
      </button>

      {open && (
        <div className="nav-menu-dropdown">
          <div className="nav-menu-dropdown-header">Navigate</div>

          <div className="nav-menu-links">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `nav-menu-link ${isActive ? "nav-menu-link-active" : ""}`
                }
                onClick={() => setOpen(false)}
              >
                <span>{item.name}</span>
                <span className="nav-menu-arrow">→</span>
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}