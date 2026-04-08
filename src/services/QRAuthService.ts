export class QRAuthService {
  private static STORAGE_PREFIX = 'qr_auth_token_';

  static generateToken(username: string): string {
    const token = crypto.randomUUID();
    localStorage.setItem(`${this.STORAGE_PREFIX}${username}`, token);
    return token;
  }

  static getStoredToken(username: string): string | null {
    return localStorage.getItem(`${this.STORAGE_PREFIX}${username}`);
  }

  static validateToken(username: string, token: string): boolean {
    const storedToken = this.getStoredToken(username);
    return storedToken !== null && storedToken === token;
  }

  static revokeToken(username: string): void {
    localStorage.removeItem(`${this.STORAGE_PREFIX}${username}`);
  }

  static findUserByToken(token: string): string | null {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.STORAGE_PREFIX)) {
        const storedToken = localStorage.getItem(key);
        if (storedToken === token) {
          return key.replace(this.STORAGE_PREFIX, '');
        }
      }
    }
    return null;
  }
}
