import { API } from './api.js';

class Auth {
    static async check() {
        try {
            const user = await API.get('/auth/profile/');
            if (user) {
                localStorage.setItem('user', JSON.stringify(user));
                return user;
            }
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