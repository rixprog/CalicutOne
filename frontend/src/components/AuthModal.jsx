import React, { useState } from 'react';

const AuthModal = ({ isOpen, onClose, onLoginSuccess }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: '',
        phone: '',
        aadhar: '',
        blood_group: '',
        profession: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const url = isLogin ? 'http://127.0.0.1:8000/login' : 'http://127.0.0.1:8000/register';

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || 'Authentication failed');
            }

            // Success
            if (isLogin) {
                onLoginSuccess(data.user);
                onClose();
            } else {
                // After register, maybe auto-login or ask to login
                setIsLogin(true);
                setError('Registration successful! Please login.');
            }

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-gray-900 animate-in fade-in duration-300">
            {/* Background Texture/Gradient - Solid and Opaque */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 to-black opacity-100"></div>

            {/* Main Card - Solid & Bold */}
            <div className="relative z-10 bg-white rounded-3xl w-full max-w-lg p-10 shadow-2xl animate-in slide-in-from-bottom-8 duration-500 overflow-hidden transform hover:scale-[1.01] transition-transform">

                {/* Header Section */}
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-black text-gray-900 mb-2 tracking-tight">
                        Calicut<span className="text-primary-600">One</span>
                    </h1>
                    <p className="text-gray-500 font-medium text-lg">Your Smart City Companion</p>
                </div>

                {/* Tab Switcher */}
                <div className="flex bg-gray-100 p-1.5 rounded-2xl mb-8">
                    <button
                        onClick={() => { setIsLogin(true); setError(''); }}
                        className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${isLogin ? 'bg-white text-gray-900 shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        LOGIN
                    </button>
                    <button
                        onClick={() => { setIsLogin(false); setError(''); }}
                        className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${!isLogin ? 'bg-white text-gray-900 shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        SIGN UP
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                    {!isLogin && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <input name="name" required placeholder="Full Name" onChange={handleChange} className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-xl font-medium focus:bg-white focus:border-primary-600 focus:ring-0 outline-none transition-all placeholder:text-gray-400 text-gray-900" />
                            <div className="flex gap-4">
                                <input name="phone" required placeholder="Phone" onChange={handleChange} className="flex-1 p-4 bg-gray-50 border-2 border-gray-100 rounded-xl font-medium focus:bg-white focus:border-primary-600 focus:ring-0 outline-none transition-all placeholder:text-gray-400 text-gray-900" />
                                <input name="blood_group" required placeholder="Blood Group" onChange={handleChange} className="w-1/3 p-4 bg-gray-50 border-2 border-gray-100 rounded-xl font-medium focus:bg-white focus:border-primary-600 focus:ring-0 outline-none transition-all placeholder:text-gray-400 text-gray-900" />
                            </div>
                            <input name="aadhar" required placeholder="Aadhar Number" onChange={handleChange} className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-xl font-medium focus:bg-white focus:border-primary-600 focus:ring-0 outline-none transition-all placeholder:text-gray-400 text-gray-900" />
                            <input name="profession" required placeholder="Profession" onChange={handleChange} className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-xl font-medium focus:bg-white focus:border-primary-600 focus:ring-0 outline-none transition-all placeholder:text-gray-400 text-gray-900" />
                        </div>
                    )}

                    <div className="space-y-4">
                        <input name="email" type="email" required placeholder="Email Address" onChange={handleChange} className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-xl font-medium focus:bg-white focus:border-primary-600 focus:ring-0 outline-none transition-all placeholder:text-gray-400 text-gray-900" />
                        <input name="password" type="password" required placeholder="Password" onChange={handleChange} className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-xl font-medium focus:bg-white focus:border-primary-600 focus:ring-0 outline-none transition-all placeholder:text-gray-400 text-gray-900" />
                    </div>

                    {error && (
                        <div className={`p-4 rounded-xl text-sm text-center font-bold ${error.includes('successful') ? 'bg-green-100 text-green-700 border-2 border-green-200' : 'bg-red-50 text-red-600 border-2 border-red-100'}`}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="mt-4 w-full bg-primary-600 text-white py-4 rounded-2xl font-black text-lg tracking-wide hover:bg-primary-700 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-primary-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'PROCESSING...' : (isLogin ? 'LOGIN NOW' : 'CREATE ACCOUNT')}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AuthModal;
