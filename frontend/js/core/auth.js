import { API } from './api.js';

class Auth {
    static async check() {
        try {
            // skipAuthRedirect: a guest hitting this is a normal 401,
            // not a session expiry - it must not bounce them to
            // /login.html, or nobody could browse products while
            // logged out.
            const user = await API.get('/auth/profile/', { skipAuthRedirect: true });
            if (user) {
                localStorage.setItem('user', JSON.stringify(user));
                return user;
            }
            localStorage.removeItem('user');
            return null;
        } catch {
            localStorage.removeItem('user');
            return null;
        }
    }

    static async login(email, password) {
        return API.post('/auth/login/', { email, password });
    }

    static async register(data) {
        return API.post('/auth/register/', data);
    }

    static async logout() {
        await API.post('/auth/logout/');
        localStorage.removeItem('user');
        window.location.href = '/';
    }

    static getUser() {
        const u = localStorage.getItem('user');
        return u ? JSON.parse(u) : null;
    }

    static isAuthenticated() {
        return !!this.getUser();
    }
}

export { Auth };