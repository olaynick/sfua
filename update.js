// update.js
const REPO_URL = `https://raw.githubusercontent.com/olaynick/sfua/main/manifest.json?_=${Date.now()}`;
const STORAGE_KEY_LAST_CHECK = 'sfua_last_update_check';
const STORAGE_KEY_HAS_UPDATE = 'sfua_update_available';

function getLocalVersion() {
    return chrome.runtime.getManifest().version;
}

async function fetchRemoteVersion() {
    const res = await fetch(REPO_URL);
    if (!res.ok) throw new Error('Failed to fetch remote manifest');
    const manifest = await res.json();
    return manifest.version;
}

function isVersionNewer(remote, local) {
    const r = remote.split('.').map(Number);
    const l = local.split('.').map(Number);
    for (let i = 0; i < Math.max(r.length, l.length); i++) {
        const rv = r[i] || 0;
        const lv = l[i] || 0;
        if (rv > lv) return true;
        if (rv < lv) return false;
    }
    return false;
}

async function checkForUpdate() {
    const local = getLocalVersion();
    let remote;
    try {
        remote = await fetchRemoteVersion();
    } catch (e) {
        console.error('[SFUA Update] Ошибка загрузки версии:', e);
        return false;
    }

    const hasUpdate = isVersionNewer(remote, local);
    const now = Date.now();

    await chrome.storage.local.set({
        [STORAGE_KEY_LAST_CHECK]: now,
        [STORAGE_KEY_HAS_UPDATE]: hasUpdate
    });

    // Обновляем UI в popup, если он открыт
    const btn = document.querySelector('.update_button');
    if (btn) {
        if (hasUpdate) {
            btn.className = 'update_button has-update';
            btn.disabled = false;
        } else {
            btn.className = 'update_button no-update';
            btn.disabled = true;
        }
        btn.textContent = 'Обновить';
    }

    return { hasUpdate, remote, local };
}

// Проверка раз в час и при запуске
async function autoCheck() {
    const result = await chrome.storage.local.get([STORAGE_KEY_LAST_CHECK]);
    const lastCheck = result[STORAGE_KEY_LAST_CHECK] || 0;
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    if (now - lastCheck > oneHour) {
        await checkForUpdate();
    }
}

// Экспорт для popup.js
window.sfuaUpdate = { autoCheck, checkForUpdate };