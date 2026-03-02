import React, { useState, useEffect } from 'react';

const Navbar = ({ toggleSidebar, user, onOpenAuth, onLogout }) => {
    const [status, setStatus] = useState(user?.status || 'active');

    // Sync status with user prop if it changes
    useEffect(() => {
        if (user?.status) setStatus(user.status);
    }, [user]);

    const toggleStatus = async () => {
        if (!user) return;
        const newStatus = status === 'active' ? 'inactive' : 'active';
        setStatus(newStatus);

        try {
            await fetch('http://127.0.0.1:8000/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id, status: newStatus })
            });
        } catch (e) {
            console.error("Status update failed", e);
            setStatus(status); // Revert on error
        }
    };

    return (
        <nav className="sticky top-0 z-[1000] w-full bg-primary-600/90 backdrop-blur-md text-white shadow-lg rounded-b-3xl transition-all duration-300 border-b border-primary-500/30">
            <div className="max-w-7xl mx-auto px-6 py-3">
                <div className="flex items-center justify-between">
                    {/* Logo */}
                    <div className="flex items-center gap-3">
                        <button onClick={toggleSidebar} className="md:hidden p-1 hover:bg-white/10 rounded-lg">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                        <div className="text-2xl font-bold tracking-wider cursor-pointer hover:text-primary-100 transition-colors">
                            Route.ai
                        </div>
                    </div>



                    {/* Auth & Profile Section */}
                    <div className="flex items-center gap-4">


                        {user ? (
                            <div className="flex items-center gap-3 bg-white/10 pl-4 pr-2 py-1.5 rounded-full border border-white/10 backdrop-blur-sm">
                                <div className="flex flex-col items-end leading-none mr-2">
                                    <span className="text-sm font-bold">{user.name}</span>
                                    <span className="text-[10px] text-primary-200 uppercase tracking-wider">{user.profession || 'Member'}</span>
                                </div>

                                {/* Status Toggle */}
                                <button
                                    onClick={toggleStatus}
                                    title={`Current Status: ${status}`}
                                    className={`relative w-8 h-4 rounded-full transition-colors duration-300 ${status === 'active' ? 'bg-green-400' : 'bg-gray-400'}`}
                                >
                                    <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${status === 'active' ? 'translate-x-4' : 'translate-x-0'}`} />
                                </button>

                                <button
                                    onClick={onLogout}
                                    className="ml-2 p-1.5 bg-red-500/20 hover:bg-red-500 text-red-100 hover:text-white rounded-full transition-all"
                                    title="Logout"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                </button>
                            </div>
                        ) : (
                            <div className="flex gap-2">
                                <button
                                    onClick={onOpenAuth}
                                    className="bg-primary-800 text-white px-5 py-2 rounded-full font-medium hover:bg-primary-900 transition-colors shadow-sm"
                                >
                                    Login / Sign Up
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
