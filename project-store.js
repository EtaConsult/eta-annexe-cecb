/* ═══════════════════════════════════════════════════════
   CECB Plus — Project Store
   Couche de persistance unifiée par projet / par utilisateur
   localStorage pour données structurées, IndexedDB pour photos
   ═══════════════════════════════════════════════════════ */

const ProjectStore = (function () {
    const STORAGE_KEY = 'cecb-projects';
    const DB_NAME = 'cecb-photos-db';
    const DB_VERSION = 2;
    let db = null;

    /* ─── UUID ───────────────────────────────────────── */
    function uuid() {
        return 'xxxx-xxxx'.replace(/x/g, () => ((Math.random() * 16) | 0).toString(16));
    }

    /* ─── Helpers ─────────────────────────────────────── */
    function _getAll() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
        catch (e) { return []; }
    }
    function _saveAll(projects) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    }

    /* ─── CRUD ────────────────────────────────────────── */
    function create(address, userId) {
        const project = {
            id: uuid(),
            name: address.label || 'Nouveau projet',
            userId: userId,
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            address: address,
            recueil: { formData: {}, generatedTexts: {}, transcript: '' },
            variantes: null,
            textes: null
        };
        const all = _getAll();
        all.unshift(project);
        _saveAll(all);
        return project;
    }

    function get(id) {
        return _getAll().find(p => p.id === id) || null;
    }

    function list(userId) {
        const all = _getAll();
        if (!userId) return all;
        return all.filter(p => p.userId === userId);
    }

    function update(id, section, data) {
        const all = _getAll();
        const idx = all.findIndex(p => p.id === id);
        if (idx < 0) return false;
        if (section) {
            all[idx][section] = data;
        } else {
            Object.assign(all[idx], data);
        }
        all[idx].updated = new Date().toISOString();
        _saveAll(all);
        return true;
    }

    function updateField(id, path, value) {
        const all = _getAll();
        const idx = all.findIndex(p => p.id === id);
        if (idx < 0) return false;
        const keys = path.split('.');
        let obj = all[idx];
        for (let i = 0; i < keys.length - 1; i++) {
            if (!obj[keys[i]]) obj[keys[i]] = {};
            obj = obj[keys[i]];
        }
        obj[keys[keys.length - 1]] = value;
        all[idx].updated = new Date().toISOString();
        _saveAll(all);
        return true;
    }

    function remove(id) {
        const all = _getAll();
        const filtered = all.filter(p => p.id !== id);
        _saveAll(filtered);
        deletePhotos(id);
        return true;
    }

    function rename(id, newName) {
        return update(id, null, { name: newName });
    }

    /* ─── IndexedDB pour photos ───────────────────────── */
    function initDB() {
        return new Promise((resolve, reject) => {
            if (db) { resolve(db); return; }
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = function (e) {
                const d = e.target.result;
                if (!d.objectStoreNames.contains('photos')) {
                    d.createObjectStore('photos');
                }
            };
            req.onsuccess = function (e) { db = e.target.result; resolve(db); };
            req.onerror = function (e) { reject(e); };
        });
    }

    async function getPhotos(projectId) {
        const d = await initDB();
        return new Promise((resolve, reject) => {
            const tx = d.transaction('photos', 'readonly');
            const store = tx.objectStore('photos');
            const req = store.get(projectId);
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    }

    async function savePhotos(projectId, photos) {
        const d = await initDB();
        return new Promise((resolve, reject) => {
            const tx = d.transaction('photos', 'readwrite');
            const store = tx.objectStore('photos');
            store.put(photos, projectId);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async function deletePhotos(projectId) {
        try {
            const d = await initDB();
            const tx = d.transaction('photos', 'readwrite');
            tx.objectStore('photos').delete(projectId);
        } catch (e) { /* ignore */ }
    }

    /* ─── Current project in session ─────────────────── */
    function setCurrentId(id) {
        sessionStorage.setItem('cecb-current-project', id);
    }
    function getCurrentId() {
        return sessionStorage.getItem('cecb-current-project') || new URLSearchParams(window.location.search).get('id');
    }

    /* ─── API publique ────────────────────────────────── */
    return {
        create, get, list, update, updateField, remove, rename,
        getPhotos, savePhotos, deletePhotos, initDB,
        setCurrentId, getCurrentId, uuid
    };
})();
