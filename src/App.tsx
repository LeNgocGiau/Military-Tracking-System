import React, { useState, useEffect, useRef } from 'react';
import { MilitaryDetector } from './components/MilitaryDetector';
import { Login } from './components/Login';
import { Shield, Info, Globe, LogOut, User, Upload, Camera, Settings, X, Check } from 'lucide-react';

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('');
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  
  // Profile edit states
  const [tempUsername, setTempUsername] = useState('');
  const [tempPhoto, setTempPhoto] = useState<string | null>(null);
  const profilePhotoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const storedUser = localStorage.getItem('username') || '';
    const storedPhoto = localStorage.getItem('userPhoto');
    if (loggedIn) {
      setIsLoggedIn(true);
      setUsername(storedUser);
      setUserPhoto(storedPhoto);
    }
  }, []);

  const handleLogin = (user: string) => {
    setIsLoggedIn(true);
    setUsername(user);
    const storedPhoto = localStorage.getItem('userPhoto');
    setUserPhoto(storedPhoto);
  };

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('username');
    setIsLoggedIn(false);
    setUsername('');
    setIsUserMenuOpen(false);
  };

  const saveProfile = () => {
    localStorage.setItem('username', tempUsername);
    if (tempPhoto) {
      localStorage.setItem('userPhoto', tempPhoto);
    }
    setUsername(tempUsername);
    setUserPhoto(tempPhoto);
    setIsProfileModalOpen(false);
    setIsUserMenuOpen(false);
  };

  const handleProfilePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setTempPhoto(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight uppercase tracking-wider">Hệ thống theo dõi quân sự</h1>
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Advanced Tactical Detection</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <a 
            href="https://aistudio.google.com/apps/bundled/mcp_maps_3d?showPreview=true&showAssistant=true&fullscreenApplet=true"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:flex items-center gap-2 px-4 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 rounded-sm text-blue-400 text-xs font-bold uppercase tracking-wider transition-all"
          >
            <Globe className="w-4 h-4" />
            <span>Maps 3D</span>
          </a>

          <div className="relative">
            <button 
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-3 px-4 py-1.5 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 rounded-sm transition-all active:scale-95"
            >
              {userPhoto ? (
                <img src={userPhoto} alt="Profile" className="w-6 h-6 rounded-full object-cover border border-blue-500/50" />
              ) : (
                <User className="w-4 h-4 text-blue-400" />
              )}
              <div className="flex flex-col text-left">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter leading-none">Operator</span>
                <span className="text-xs font-mono text-zinc-200">{username}</span>
              </div>
            </button>

            {/* User Dropdown Menu */}
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 glass hud-border p-1 z-[60] shadow-2xl">
                <div className="p-3 border-b border-white/5 mb-1">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Session_Active</p>
                  <p className="text-xs font-mono text-blue-400 truncate">{username}</p>
                </div>
                
                <button 
                  onClick={() => {
                    setTempUsername(username);
                    setTempPhoto(userPhoto);
                    setIsProfileModalOpen(true);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-white hover:bg-white/5 transition-all rounded-sm"
                >
                  <Settings className="w-4 h-4" />
                  Update Profile
                </button>

                <button 
                  onClick={() => {
                    document.getElementById('tactical-upload-trigger')?.click();
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-blue-400 hover:bg-blue-500/5 transition-all rounded-sm"
                >
                  <Upload className="w-4 h-4" />
                  Upload Tactical Feed
                </button>

                <div className="h-px bg-white/5 my-1" />

                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold uppercase tracking-wider text-red-500 hover:bg-red-500/10 transition-all rounded-sm"
                >
                  <LogOut className="w-4 h-4" />
                  Logout Session
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
        <MilitaryDetector />
      </main>

      {/* Profile Update Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="max-w-md w-full glass hud-border p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-white">Update_Operator_Profile</h3>
              <button onClick={() => setIsProfileModalOpen(false)} className="text-zinc-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="flex flex-col items-center gap-4">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-zinc-800 bg-zinc-900 flex items-center justify-center">
                    {tempPhoto ? (
                      <img src={tempPhoto} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-10 h-10 text-zinc-700" />
                    )}
                  </div>
                  <button 
                    onClick={() => profilePhotoInputRef.current?.click()}
                    className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
                  >
                    <Camera className="w-6 h-6 text-white" />
                  </button>
                  <input 
                    type="file" 
                    ref={profilePhotoInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={handleProfilePhotoUpload}
                  />
                </div>
                <p className="text-[9px] font-mono text-zinc-500 uppercase">Click to update tactical avatar</p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Operator_Name</label>
                <input 
                  type="text" 
                  value={tempUsername}
                  onChange={(e) => setTempUsername(e.target.value)}
                  className="w-full tactical-input"
                  placeholder="Enter new name"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setIsProfileModalOpen(false)}
                  className="flex-1 btn-secondary"
                >
                  Cancel
                </button>
                <button 
                  onClick={saveProfile}
                  className="flex-1 btn-primary flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
