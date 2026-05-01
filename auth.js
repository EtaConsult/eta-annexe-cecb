/* ═══════════════════════════════════════════════════════
   CECB Plus — Authentication System
   Local management with SHA-256 hashed passwords
   Admin: info@etaconsult.ch
   ═══════════════════════════════════════════════════════ */

const AUTH_STORAGE_KEY = 'cecb-auth-users';
const AUTH_SESSION_KEY = 'cecb-auth-session';
const ADMIN_EMAIL = 'info@etaconsult.ch';

/* ─── Crypto ──────────────────────────────────────────── */

const PBKDF2_ITERATIONS = 100000;

function bytesToHex(bytes) {
    return Array.from(bytes).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
}

function hexToBytes(hex) {
    var bytes = new Uint8Array(hex.length / 2);
    for (var i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    return bytes;
}

async function sha256Hex(str) {
    var hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return bytesToHex(new Uint8Array(hash));
}

async function pbkdf2Hex(password, saltBytes, iterations) {
    var key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        'PBKDF2',
        false,
        ['deriveBits']
    );
    var bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: saltBytes, iterations: iterations, hash: 'SHA-256' },
        key,
        256
    );
    return bytesToHex(new Uint8Array(bits));
}

/**
 * Produce a stored-hash string in the format `pbkdf2:<iter>:<saltHex>:<hashHex>`.
 * If `saltHex` is omitted, a fresh 16-byte salt is generated.
 */
async function hashPassword(password, saltHex) {
    var salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
    var saltStr = saltHex || bytesToHex(salt);
    var hash = await pbkdf2Hex(password, salt, PBKDF2_ITERATIONS);
    return 'pbkdf2:' + PBKDF2_ITERATIONS + ':' + saltStr + ':' + hash;
}

/**
 * Verify a clear-text password against a stored hash.
 * Supports both the new pbkdf2:* format and legacy bare SHA-256 hex.
 */
async function verifyPassword(password, storedHash) {
    if (!storedHash) return false;
    if (storedHash.indexOf('pbkdf2:') === 0) {
        var parts = storedHash.split(':');
        if (parts.length !== 4) return false;
        var iter = parseInt(parts[1], 10) || PBKDF2_ITERATIONS;
        var saltBytes = hexToBytes(parts[2]);
        var expected = parts[3];
        var actual = await pbkdf2Hex(password, saltBytes, iter);
        return actual === expected;
    }
    // Legacy: bare SHA-256 hex (64 chars)
    var sha = await sha256Hex(password);
    return sha === storedHash;
}

function isLegacyHash(storedHash) {
    return !!storedHash && storedHash.indexOf('pbkdf2:') !== 0;
}

/* ─── User Store ──────────────────────────────────────── */

function getUsers() {
    try {
        return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY)) || [];
    } catch (e) {
        return [];
    }
}

function saveUsers(users) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(users));
}

/* ─── Default accounts (provisioned on every browser) ─ */

const DEFAULT_USERS = [
    { email: 'info@etaconsult.ch', passwordHash: '', isAdmin: true, firstName: 'Gérard', lastName: 'Merminod' },
    { email: 'axel@etaconsult.ch', passwordHash: 'b59a657462df28db9e52ee64b5d6aba3464f234f6e4ae8b3d7790ead4e0785fc', isAdmin: false, firstName: 'Axel', lastName: 'Merminod' }
];

function initDefaultUsers() {
    const users = getUsers();
    let changed = false;
    // Migration: strip legacy plainPassword field from existing users
    users.forEach(function (u) {
        if (Object.prototype.hasOwnProperty.call(u, 'plainPassword')) {
            delete u.plainPassword;
            changed = true;
        }
    });
    DEFAULT_USERS.forEach(function (def) {
        const existing = users.find(u => u.email.toLowerCase() === def.email.toLowerCase());
        if (!existing) {
            users.push({
                email: def.email,
                passwordHash: def.passwordHash,
                isAdmin: def.isAdmin,
                firstName: def.firstName,
                lastName: def.lastName,
                name: (def.firstName + ' ' + def.lastName).trim()
            });
            changed = true;
        } else {
            // Ensure existing accounts have firstName/lastName
            if (!existing.firstName && def.firstName) {
                existing.firstName = def.firstName;
                existing.lastName = def.lastName;
                existing.name = (def.firstName + ' ' + def.lastName).trim();
                changed = true;
            }
        }
    });
    if (changed) saveUsers(users);
}

/* backward compat */
var initAdmin = initDefaultUsers;

/* ─── Session ─────────────────────────────────────────── */

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;          // 8 hours (default)
const SESSION_TTL_PERSISTENT_MS = 30 * 24 * 60 * 60 * 1000; // 30 days (rester connecté)

function getSession() {
    try {
        // Check sessionStorage first, then localStorage (rester connecté)
        var s = sessionStorage.getItem(AUTH_SESSION_KEY);
        if (!s) s = localStorage.getItem(AUTH_SESSION_KEY);
        if (!s) return null;
        var session = JSON.parse(s);
        if (session && session.expiresAt && Date.now() > session.expiresAt) {
            clearSession();
            return null;
        }
        return session;
    } catch (e) {
        return null;
    }
}

function setSession(user, persistent) {
    var ttl = persistent ? SESSION_TTL_PERSISTENT_MS : SESSION_TTL_MS;
    var data = JSON.stringify({
        email: user.email,
        isAdmin: user.isAdmin,
        name: (user.firstName || '') + ' ' + (user.lastName || ''),
        expiresAt: Date.now() + ttl
    });
    sessionStorage.setItem(AUTH_SESSION_KEY, data);
    if (persistent) {
        localStorage.setItem(AUTH_SESSION_KEY, data);
    }
}

function clearSession() {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    localStorage.removeItem(AUTH_SESSION_KEY);
}

function isLoggedIn() {
    return getSession() !== null;
}

function isAdmin() {
    const s = getSession();
    return s && s.isAdmin;
}

/* ─── Auth Actions ────────────────────────────────────── */

async function login(email, password, persistent) {
    const users = getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) return { ok: false, msg: 'Compte introuvable' };

    // First login for admin (no password set)
    if (user.isAdmin && !user.passwordHash) {
        return { ok: false, msg: 'first-setup', user: user };
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return { ok: false, msg: 'Mot de passe incorrect' };

    // Rotate legacy SHA-256 hashes to PBKDF2 transparently
    if (isLegacyHash(user.passwordHash)) {
        user.passwordHash = await hashPassword(password);
        saveUsers(users);
    }

    setSession(user, persistent);
    return { ok: true };
}

async function setPassword(email, newPassword) {
    const users = getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) return false;
    user.passwordHash = await hashPassword(newPassword);
    saveUsers(users);
    return true;
}

async function addUser(email, password, firstName, lastName) {
    const users = getUsers();
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
        return { ok: false, msg: 'Cet email existe déjà' };
    }
    const hash = await hashPassword(password);
    users.push({ email: email.toLowerCase(), passwordHash: hash, isAdmin: false, firstName: firstName || '', lastName: lastName || '', name: ((firstName || '') + ' ' + (lastName || '')).trim() || email });
    saveUsers(users);
    return { ok: true };
}

function removeUser(email) {
    if (email.toLowerCase() === ADMIN_EMAIL) return false;
    let users = getUsers();
    users = users.filter(u => u.email.toLowerCase() !== email.toLowerCase());
    saveUsers(users);
    return true;
}

/* ─── UI ──────────────────────────────────────────────── */

function injectAuthStyles() {
    if (document.getElementById('auth-styles')) return;
    const style = document.createElement('style');
    style.id = 'auth-styles';
    style.textContent = `
.auth-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center}
.auth-box{background:#fff;border-radius:12px;padding:32px;width:380px;max-width:90vw;box-shadow:0 8px 32px rgba(0,0,0,.2)}
.auth-box h2{color:#0F172A;margin:0 0 20px;font-size:20px;text-align:center}
.auth-box .auth-field{margin-bottom:14px}
.auth-box label{display:block;font-size:13px;font-weight:600;color:#555;margin-bottom:4px}
.auth-box input{width:100%;padding:10px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px}
.auth-box input:focus{outline:none;border-color:#10B981}
.auth-box .auth-btn{width:100%;padding:12px;background:#10B981;color:#fff;border:none;border-radius:6px;font-size:15px;font-weight:600;cursor:pointer;transition:background .2s;margin-top:8px}
.auth-box .auth-btn:hover{background:#059669}
.auth-box .auth-error{color:#c62828;font-size:13px;margin-top:8px;text-align:center;display:none}
.auth-box .auth-error.visible{display:block}
.auth-user-bar{background:#0F172A;color:#fff;display:flex;align-items:center;padding:0 24px;font-size:13px;gap:12px;height:32px}
.auth-user-bar span{opacity:.8}
.auth-user-bar .auth-logout{margin-left:auto;background:none;border:none;color:rgba(255,255,255,.75);cursor:pointer;font-size:13px;font-weight:600;padding:4px 12px;border-radius:4px;transition:all .2s}
.auth-user-bar .auth-logout:hover{color:#fff;background:rgba(255,255,255,.15)}
.auth-user-bar .auth-admin-link{background:none;border:none;color:rgba(255,255,255,.75);cursor:pointer;font-size:13px;font-weight:600;padding:4px 12px;border-radius:4px;transition:all .2s}
.auth-user-bar .auth-admin-link:hover{color:#fff;background:rgba(255,255,255,.15)}
.admin-panel{background:#fff;border-radius:10px;padding:20px 24px;margin-bottom:20px;box-shadow:0 1px 4px rgba(0,0,0,.06)}
.admin-panel h3{color:#059669;margin:0 0 16px;font-size:16px}
.admin-panel table{width:100%;border-collapse:collapse;font-size:13px}
.admin-panel th{text-align:left;padding:8px;border-bottom:2px solid #10B981;font-weight:600;color:#333}
.admin-panel td{padding:8px;border-bottom:1px solid #eee}
.admin-panel .btn-del{padding:4px 12px;background:#fce4ec;color:#c62828;border:1px solid #f8bbd0;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600}
.admin-panel .btn-del:hover{background:#f8bbd0}
.admin-add-form{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;align-items:flex-end}
.admin-add-form .field{display:flex;flex-direction:column;gap:4px}
.admin-add-form .field label{font-size:11px;font-weight:600;color:#666}
.admin-add-form .field input{padding:6px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px}
.admin-add-form .field input:focus{outline:none;border-color:#10B981}
.admin-add-form button{padding:8px 16px;background:#10B981;color:#fff;border:none;border-radius:4px;font-size:13px;font-weight:600;cursor:pointer;align-self:flex-end}
.admin-add-form button:hover{background:#059669}
`;
    document.head.appendChild(style);
}

function showLoginModal() {
    injectAuthStyles();
    const overlay = document.createElement('div');
    overlay.className = 'auth-overlay';
    overlay.id = 'authOverlay';
    overlay.innerHTML = `
        <div class="auth-box">
            <h2>Assistant CECB — Connexion</h2>
            <div id="authLoginForm">
                <div class="auth-field">
                    <label>Email</label>
                    <input type="email" id="authEmail" placeholder="votre@email.ch" autocomplete="email">
                </div>
                <div class="auth-field">
                    <label>Mot de passe</label>
                    <input type="password" id="authPassword" placeholder="Mot de passe" autocomplete="current-password">
                </div>
                <div style="display:flex;align-items:center;gap:6px;margin:8px 0 12px">
                    <input type="checkbox" id="authRemember" style="margin:0;width:16px;height:16px;accent-color:#10B981">
                    <label for="authRemember" style="font-size:13px;color:#64748B;cursor:pointer;user-select:none">Rester connecté</label>
                </div>
                <button class="auth-btn" id="authLoginBtn">Se connecter</button>
                <div style="text-align:center;margin-top:10px"><a href="#" id="authForgotLink" style="font-size:12px;color:#64748B;text-decoration:underline">Mot de passe oublié ?</a></div>
                <div class="auth-error" id="authError"></div>
            </div>
            <div id="authSetupForm" style="display:none">
                <p style="font-size:13px;color:#666;margin-bottom:12px;text-align:center">Première connexion admin — définissez votre mot de passe</p>
                <div class="auth-field">
                    <label>Nouveau mot de passe</label>
                    <input type="password" id="authNewPw" placeholder="Nouveau mot de passe">
                </div>
                <div class="auth-field">
                    <label>Confirmer</label>
                    <input type="password" id="authConfirmPw" placeholder="Confirmer le mot de passe">
                </div>
                <button class="auth-btn" id="authSetupBtn">Définir le mot de passe</button>
                <div class="auth-error" id="authSetupError"></div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    // Focus email input
    setTimeout(() => document.getElementById('authEmail').focus(), 100);

    // Login handler
    document.getElementById('authLoginBtn').addEventListener('click', handleLogin);
    document.getElementById('authPassword').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') handleLogin();
    });
    document.getElementById('authEmail').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') document.getElementById('authPassword').focus();
    });

    // Setup handler
    document.getElementById('authSetupBtn').addEventListener('click', handleSetup);
    document.getElementById('authConfirmPw').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') handleSetup();
    });

    // Forgot password handler
    document.getElementById('authForgotLink').addEventListener('click', function(e) {
        e.preventDefault();
        handleForgotPassword();
    });
}

function handleForgotPassword() {
    const email = document.getElementById('authEmail').value.trim();
    const errorEl = document.getElementById('authError');
    if (!email) {
        errorEl.textContent = 'Saisissez votre email avant de cliquer sur « Mot de passe oublié ».';
        errorEl.classList.add('visible');
        return;
    }
    const users = getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
        errorEl.textContent = 'Compte introuvable';
        errorEl.classList.add('visible');
        return;
    }
    if (!user.isAdmin) {
        errorEl.textContent = 'Demandez à l\'administrateur de réinitialiser votre mot de passe.';
        errorEl.classList.add('visible');
        return;
    }
    if (!confirm('Réinitialiser le mot de passe admin pour ' + user.email + ' ?\n\nVous serez invité à en définir un nouveau.')) return;
    user.passwordHash = '';
    saveUsers(users);
    setupEmail = user.email;
    errorEl.classList.remove('visible');
    document.getElementById('authLoginForm').style.display = 'none';
    document.getElementById('authSetupForm').style.display = 'block';
    document.getElementById('authNewPw').focus();
}

let setupEmail = '';

async function handleLogin() {
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const errorEl = document.getElementById('authError');

    if (!email || !password) {
        errorEl.textContent = 'Veuillez remplir tous les champs';
        errorEl.classList.add('visible');
        return;
    }

    const persistent = document.getElementById('authRemember').checked;
    const result = await login(email, password, persistent);
    if (result.ok) {
        document.getElementById('authOverlay').remove();
        onAuthSuccess();
    } else if (result.msg === 'first-setup') {
        setupEmail = email;
        document.getElementById('authLoginForm').style.display = 'none';
        document.getElementById('authSetupForm').style.display = 'block';
        document.getElementById('authNewPw').focus();
    } else {
        errorEl.textContent = result.msg;
        errorEl.classList.add('visible');
    }
}

async function handleSetup() {
    const pw = document.getElementById('authNewPw').value;
    const confirm = document.getElementById('authConfirmPw').value;
    const errorEl = document.getElementById('authSetupError');

    if (!pw) {
        errorEl.textContent = 'Veuillez saisir un mot de passe';
        errorEl.classList.add('visible');
        return;
    }
    if (pw !== confirm) {
        errorEl.textContent = 'Les mots de passe ne correspondent pas';
        errorEl.classList.add('visible');
        return;
    }

    await setPassword(setupEmail, pw);
    const loginResult = await login(setupEmail, pw);
    if (loginResult.ok) {
        document.getElementById('authOverlay').remove();
        onAuthSuccess();
    }
}

function showUserBar() {
    injectAuthStyles();
    const session = getSession();
    if (!session) return;

    // Remove existing bar if any
    const existing = document.getElementById('authUserBar');
    if (existing) existing.remove();

    const bar = document.createElement('div');
    bar.className = 'auth-user-bar';
    bar.id = 'authUserBar';
    bar.innerHTML = '<span>Connecté : ' + escapeAuthHtml(session.email) + '</span>';

    if (session.isAdmin) {
        const adminBtn = document.createElement('button');
        adminBtn.className = 'auth-admin-link';
        adminBtn.textContent = 'Gestion des accès';
        adminBtn.addEventListener('click', toggleAdminPanel);
        bar.appendChild(adminBtn);
    }

    // Paramètres button — visible for all users
    if (typeof openApiSettings === 'function') {
        const settingsBtn = document.createElement('button');
        settingsBtn.className = 'auth-admin-link';
        settingsBtn.textContent = 'Paramètres';
        settingsBtn.addEventListener('click', openApiSettings);
        bar.appendChild(settingsBtn);
    }

    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'auth-logout';
    logoutBtn.textContent = 'Déconnexion';
    logoutBtn.addEventListener('click', function() {
        clearSession();
        location.reload();
    });
    bar.appendChild(logoutBtn);

    // Insert after main-nav
    const nav = document.querySelector('.main-nav');
    if (nav) {
        nav.parentNode.insertBefore(bar, nav.nextSibling);
    } else {
        document.body.prepend(bar);
    }
}

function toggleAdminPanel() {
    const existing = document.getElementById('adminPanel');
    if (existing) {
        existing.remove();
        return;
    }
    renderAdminPanel();
}

function renderAdminPanel() {
    const existing = document.getElementById('adminPanel');
    if (existing) existing.remove();

    const users = getUsers();
    const panel = document.createElement('div');
    panel.className = 'admin-panel';
    panel.id = 'adminPanel';

    let html = '<h3>Gestion des accès</h3>';
    html += '<table><thead><tr><th>Prénom</th><th>Nom</th><th>Email</th><th>Rôle</th><th>Actions</th></tr></thead><tbody>';
    users.forEach(u => {
        var fn = u.firstName || (u.name ? u.name.split(' ')[0] : '');
        var ln = u.lastName || (u.name ? u.name.split(' ').slice(1).join(' ') : '');
        html += '<tr><td>' + escapeAuthHtml(fn) + '</td><td>' + escapeAuthHtml(ln) + '</td><td>' + escapeAuthHtml(u.email) + '</td><td>' + (u.isAdmin ? 'Admin' : 'Utilisateur') + '</td>';
        html += '<td>';
        html += '<button class="btn-reset-pw" data-email="' + escapeAuthHtml(u.email) + '">Réinitialiser mdp</button>';
        if (!u.isAdmin) {
            html += ' <button class="btn-del" data-email="' + escapeAuthHtml(u.email) + '">Supprimer</button>';
        }
        html += '</td></tr>';
    });
    html += '</tbody></table>';
    html += '<div class="admin-add-form" id="adminAddForm">';
    html += '<div class="field"><label>Prénom</label><input type="text" id="adminNewFirstName" placeholder="Prénom"></div>';
    html += '<div class="field"><label>Nom</label><input type="text" id="adminNewLastName" placeholder="Nom"></div>';
    html += '<div class="field"><label>Email</label><input type="email" id="adminNewEmail" placeholder="email@example.ch"></div>';
    html += '<div class="field"><label>Mot de passe</label><input type="text" id="adminNewPw" placeholder="Mot de passe"></div>';
    html += '<button id="adminAddBtn">Ajouter</button>';
    html += '</div>';
    html += '<div class="auth-error" id="adminError" style="text-align:left;margin-top:8px"></div>';

    panel.innerHTML = html;

    // Insert after user bar
    const bar = document.getElementById('authUserBar');
    const container = document.querySelector('.container');
    if (container) {
        container.prepend(panel);
    }

    // Delete handlers
    panel.querySelectorAll('.btn-del').forEach(function(btn) {
        btn.addEventListener('click', function() {
            const email = this.dataset.email;
            if (confirm('Supprimer l\'accès pour ' + email + ' ?')) {
                removeUser(email);
                renderAdminPanel();
            }
        });
    });

    // Reset password handlers
    panel.querySelectorAll('.btn-reset-pw').forEach(function(btn) {
        btn.addEventListener('click', async function() {
            const email = this.dataset.email;
            const newPw = prompt('Nouveau mot de passe pour ' + email + ' :');
            if (newPw === null) return;
            if (!newPw) {
                alert('Veuillez saisir un mot de passe.');
                return;
            }
            const ok = await setPassword(email, newPw);
            if (ok) {
                alert('Mot de passe mis à jour pour ' + email + '.\nCommuniquez-le à l\'utilisateur (il ne sera plus affiché ensuite).');
            } else {
                alert('Erreur lors de la mise à jour.');
            }
        });
    });

    // Add handler
    document.getElementById('adminAddBtn').addEventListener('click', async function() {
        const firstName = document.getElementById('adminNewFirstName').value.trim();
        const lastName = document.getElementById('adminNewLastName').value.trim();
        const email = document.getElementById('adminNewEmail').value.trim();
        const pw = document.getElementById('adminNewPw').value;
        const errorEl = document.getElementById('adminError');

        if (!email || !pw) {
            errorEl.textContent = 'Email et mot de passe requis';
            errorEl.classList.add('visible');
            return;
        }

        const result = await addUser(email, pw, firstName, lastName);
        if (result.ok) {
            renderAdminPanel();
        } else {
            errorEl.textContent = result.msg;
            errorEl.classList.add('visible');
        }
    });
}

function escapeAuthHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/* ─── Auth Gate ────────────────────────────────────────── */

function onAuthSuccess() {
    showUserBar();
    // Show app content
    document.querySelectorAll('.container, .section-nav').forEach(function(el) {
        el.style.display = '';
    });
}

async function checkAuth() {
    await initAdmin();
    injectAuthStyles();

    if (isLoggedIn()) {
        onAuthSuccess();
    } else {
        // Hide app content until login
        document.querySelectorAll('.container, .section-nav').forEach(function(el) {
            el.style.display = 'none';
        });
        showLoginModal();
    }
}

// Auto-run on load
document.addEventListener('DOMContentLoaded', checkAuth);
