import { useState, useEffect } from 'react'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import AuthModal from './components/AuthModal'
import './App.css'

function App() {
  const [user, setUser] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile sidebar state

  // Initialize from LocalStorage
  useEffect(() => {
    const storedUser = localStorage.getItem('calicutOneUser');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
      // User not logged in? Prompt them!
      setIsAuthOpen(true);
    }
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    localStorage.setItem('calicutOneUser', JSON.stringify(userData));
    setIsAuthOpen(false);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('calicutOneUser');
    // Optionally reopen auth or just let them be
    setIsAuthOpen(true);
  };

  return (
    <div className="h-screen w-full bg-slate-50 flex flex-col overflow-hidden">
      <Navbar
        user={user}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      <main className="flex-1 min-h-0 w-full max-w-[1600px] mx-auto">
        <Home />
      </main>

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  )
}

export default App
