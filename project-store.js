/* ═══════════════════════════════════════════════════════
   CECB Plus — Service Worker Registration
   ═══════════════════════════════════════════════════════ */

if ('serviceWorker' in navigator && location.hostname !== 'localhost') {
    window.addEventListener('load', function () {
        navigator.serviceWorker.register('./sw.js').catch(function (e) {
            console.warn('SW registration failed:', e);
        });
    });
}

/* ═══════════════════════════════════════════════════════
   CECB Plus — Global Error Handler
   ═══════════════════════════════════════════════════════ */

window.addEventListener('error', function (e) {
    console.error('Erreur globale:', e.message, e.filename, e.lineno);
});
window.addEventListener('unhandledrejection', function (e) {
    console.error('Promise non gérée:', e.reason);
});

/* ═══════════════════════════════════════════════════════
   CECB Plus — Fetch with Timeout (global utility)
   ═══════════════════════════════════════════════════════ */

function fetchWithTimeout(url, options, timeoutMs) {
    timeoutMs = timeoutMs || 30000;
    var controller = new AbortController();
    options = options || {};
    options.signal = controller.signal;
    var timeoutId = setTimeout(function () { controller.abort(); }, timeoutMs);
    return fetch(url, options).then(function (resp) {
        clearTimeout(timeoutId);
        return resp;
    }).catch(function (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            throw new Error('Requête expirée après ' + (timeoutMs / 1000) + 's');
        }
        throw err;
    });
}

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

    /* ─── Save Queue (prevent race conditions) ────────── */
    let _saveQueue = Promise.resolve();
    let _lastSaveError = null;

    function _enqueueSave(fn) {
        _saveQueue = _saveQueue.then(fn).catch(function (e) {
            _lastSaveError = e;
            console.error('ProjectStore save error:', e);
        });
        return _saveQueue;
    }

    /* ─── Helpers ─────────────────────────────────────── */
    function _getAll() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return [];
            var parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) {
                console.warn('ProjectStore: invalid data format, expected array');
                return [];
            }
            return parsed;
        } catch (e) {
            console.error('ProjectStore: JSON parse error, attempting recovery', e);
            // Try backup
            try {
                var backup = localStorage.getItem(STORAGE_KEY + '-backup');
                if (backup) {
                    var recovered = JSON.parse(backup);
                    if (Array.isArray(recovered)) {
                        _showStoreToast('Données récupérées depuis la sauvegarde de secours', 'warning');
                        localStorage.setItem(STORAGE_KEY, backup);
                        return recovered;
                    }
                }
            } catch (e2) { /* backup also corrupt */ }
            _showStoreToast('Erreur de lecture des projets — données corrompues', 'error');
            return [];
        }
    }

    function _saveAll(projects) {
        try {
            var data = JSON.stringify(projects);
            localStorage.setItem(STORAGE_KEY, data);
            // Rotate backup (every 10th save)
            if (!_saveAll._count) _saveAll._count = 0;
            if (++_saveAll._count % 10 === 0) {
                localStorage.setItem(STORAGE_KEY + '-backup', data);
            }
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014) {
                _showStoreToast('Espace de stockage plein — impossible de sauvegarder. Exportez vos projets.', 'error');
            } else {
                _showStoreToast('Erreur de sauvegarde: ' + e.message, 'error');
            }
            throw e;
        }
    }

    function _showStoreToast(msg, type) {
        type = type || 'error';
        var t = document.createElement('div');
        t.style.cssText = 'position:fixed;bottom:20px;right:20px;padding:14px 22px;border-radius:8px;color:#fff;font-weight:600;z-index:9999;animation:slideIn .3s ease;font-size:14px;max-width:400px;box-shadow:0 4px 12px rgba(0,0,0,.2)';
        t.style.background = type === 'error' ? '#c0392b' : type === 'warning' ? '#e67e22' : '#27ae60';
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(function () { t.remove(); }, 5000);
    }

    /* ─── CRUD ────────────────────────────────────────── */
    function create(address, userId) {
        const project = {
            id: uuid(),
            name: address.projectName || address.label || 'Nouveau projet',
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
        } catch (e) {
            console.warn('deletePhotos error for ' + projectId + ':', e);
        }
    }

    /* ─── Current project in session ─────────────────── */
    function setCurrentId(id) {
        sessionStorage.setItem('cecb-current-project', id);
    }
    function getCurrentId() {
        return sessionStorage.getItem('cecb-current-project') || new URLSearchParams(window.location.search).get('id');
    }

    /* ─── Export / Import ───────────────────────────────── */
    async function exportAll() {
        var projects = _getAll();
        var exportData = { version: 2, exported: new Date().toISOString(), projects: [] };
        for (var i = 0; i < projects.length; i++) {
            var p = projects[i];
            var photos = [];
            try { photos = await getPhotos(p.id); } catch (e) { /* no photos */ }
            exportData.projects.push({ project: p, photos: photos });
        }
        var blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'cecb-backup-' + new Date().toISOString().slice(0, 10) + '.json';
        a.click();
        URL.revokeObjectURL(url);
        _showStoreToast('Backup exporté (' + projects.length + ' projets)', 'success');
    }

    async function importAll(file) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = async function (e) {
                try {
                    var data = JSON.parse(e.target.result);
                    if (!data.projects || !Array.isArray(data.projects)) {
                        _showStoreToast('Fichier invalide — format non reconnu', 'error');
                        reject(new Error('Invalid format'));
                        return;
                    }
                    var existing = _getAll();
                    var existingIds = existing.map(function (p) { return p.id; });
                    var imported = 0;
                    for (var i = 0; i < data.projects.length; i++) {
                        var entry = data.projects[i];
                        var proj = entry.project;
                        if (existingIds.indexOf(proj.id) === -1) {
                            existing.unshift(proj);
                            imported++;
                        }
                        if (entry.photos && entry.photos.length > 0) {
                            try { await savePhotos(proj.id, entry.photos); } catch (e2) { /* skip */ }
                        }
                    }
                    _saveAll(existing);
                    _showStoreToast(imported + ' projet(s) importé(s)', 'success');
                    resolve(imported);
                } catch (err) {
                    _showStoreToast('Erreur import: ' + err.message, 'error');
                    reject(err);
                }
            };
            reader.readAsText(file);
        });
    }

    /* ─── Flush pending saves on page unload ────────── */
    window.addEventListener('beforeunload', function () {
        // Force-save backup on exit
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (raw) localStorage.setItem(STORAGE_KEY + '-backup', raw);
        } catch (e) { /* best effort */ }
    });

    /* ─── API publique ────────────────────────────────── */
    return {
        create, get, list, update, updateField, remove, rename,
        getPhotos, savePhotos, deletePhotos, initDB,
        setCurrentId, getCurrentId, uuid,
        exportAll, importAll, _showStoreToast
    };
})();
