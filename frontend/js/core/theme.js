class Theme {
    static init() {
        const saved = localStorage.getItem('theme') || 'system';
        this.set(saved);
        
        document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
            btn.addEventListener('click', () => {
                const current = document.documentElement.getAttribute('data-theme');
                const next = current === 'dark' ? 'light' : 'dark';
                this.set(next);
            });
        });
    }

    static set(mode) {
        localStorage.setItem('theme', mode);
        if (mode === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        } else {
            document.documentElement.setAttribute('data-theme', mode);
        }
    }
}

export { Theme };