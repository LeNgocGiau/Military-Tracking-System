import React, { useState } from 'react';
import { AlertCircle, Eye, EyeOff, ScanFace, QrCode } from 'lucide-react';
import { FaceScanner } from './FaceScanner';
import { QRScanner } from './QRScanner';

interface LoginProps {
  onLogin: (username: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isFaceScannerOpen, setIsFaceScannerOpen] = useState(false);
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'Admin@LENGOCGIAU' && password === 'Admin@LENGOCGIAU') {
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('username', username);
      onLogin(username);
    } else {
      setError('Thông tin đăng nhập không hợp lệ. Vui lòng sử dụng mã truy cập chiến thuật được cung cấp.');
    }
  };

  const handleFaceLogin = () => {
    setIsFaceScannerOpen(true);
  };

  const handleQRLogin = () => {
    setIsQRScannerOpen(true);
  };

  const onFaceVerifyComplete = (_?: Float32Array, matchedUsername?: string) => {
    const finalUsername = matchedUsername || username;
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('username', finalUsername);
    onLogin(finalUsername);
    setIsFaceScannerOpen(false);
  };

  const onQRVerifyComplete = (matchedUsername: string) => {
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('username', matchedUsername);
    onLogin(matchedUsername);
    setIsQRScannerOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
      <div className="max-w-md w-full glass hud-border p-8 space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold uppercase tracking-[0.2em] text-white">Hệ thống quân sự</h1>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Operator_ID</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full tactical-input"
                placeholder="Enter Operator ID"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Access_Code</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full tactical-input pr-10"
                  placeholder="Enter Access Code"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-sm flex items-center gap-3 text-red-400 text-xs font-mono">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-3">
            <button type="submit" className="w-full btn-primary py-4">
              Initialize Session
            </button>
            
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-widest"><span className="bg-[#050505] px-2 text-zinc-600">Or Biometric</span></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button 
                type="button"
                onClick={handleFaceLogin}
                className="flex items-center justify-center gap-2 py-3 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 rounded-sm text-blue-400 text-[10px] font-bold uppercase tracking-widest transition-all"
              >
                <ScanFace className="w-4 h-4" />
                Face ID
              </button>
              <button 
                type="button"
                onClick={handleQRLogin}
                className="flex items-center justify-center gap-2 py-3 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/20 rounded-sm text-emerald-400 text-[10px] font-bold uppercase tracking-widest transition-all"
              >
                <QrCode className="w-4 h-4" />
                QR Code
              </button>
            </div>
          </div>
        </form>

        <div className="pt-4 border-t border-white/5 text-center">
          <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest">
            Authorized Personnel Only // AES-256 Encrypted
          </p>
        </div>
      </div>

      {isFaceScannerOpen && (
        <FaceScanner 
          mode="verify"
          username={username}
          onComplete={onFaceVerifyComplete}
          onCancel={() => setIsFaceScannerOpen(false)}
        />
      )}

      {isQRScannerOpen && (
        <QRScanner 
          onComplete={onQRVerifyComplete}
          onCancel={() => setIsQRScannerOpen(false)}
        />
      )}
    </div>
  );
};
