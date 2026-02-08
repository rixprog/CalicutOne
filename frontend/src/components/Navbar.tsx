import React from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from "@/lib/utils";

export const Navbar: React.FC = () => {
    return (
        <div className="flex items-center gap-4 px-6 py-4 bg-primary-600 shrink-0 w-full shadow-md z-20">
            <h1 className="text-xl font-bold tracking-tight text-white mr-8">Administrator Dashboard</h1>

            <nav className="flex gap-4">
                <NavLink
                    to="/"
                    className={({ isActive }) => cn(
                        "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                        isActive
                            ? "bg-primary-700 text-white"
                            : "text-primary-100 hover:bg-primary-500 hover:text-white"
                    )}
                >
                    Dashboard
                </NavLink>
                <NavLink
                    to="/ai-cameras"
                    className={({ isActive }) => cn(
                        "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                        isActive
                            ? "bg-primary-700 text-white"
                            : "text-primary-100 hover:bg-primary-500 hover:text-white"
                    )}
                >
                    AI Cameras
                </NavLink>
            </nav>

            <div className="ml-auto flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-sm rounded-full border border-white/20 shadow-sm transition-colors hover:bg-white/20">
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-xs font-mono text-white/90 uppercase font-semibold">Online</span>
            </div>
        </div>
    );
};
