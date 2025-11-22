export const DB = {
    set(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    },

    get(key, fallback = []) {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : fallback;
    },

    delete(key) {
        localStorage.removeItem(key);
    }
};
