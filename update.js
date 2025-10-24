// update.js
const REPO_URL = `https://raw.githubusercontent.com/olaynick/sfua/main/manifest.json?_=${Date.now()}`;
const STORAGE_KEY = 'sfua_last_update_check';
const UPDATE_AVAILABLE_KEY = 'sfua_update_available';

async function fetchRemoteVersion() {
    const res = await fetch(REPO_URL);
    if (!res.ok) throw new Error('Не удалось загрузить manifest.json');
    const manifest = await res.json();
    return manifest.version;
}

function getLocalVersion() {
    return chrome.runtime.getManifest().version;
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

async function checkForUpdate(showPopup = false) {
    const local = getLocalVersion();
    let remote;
    try {
        remote = await fetchRemoteVersion();
    } catch (e) {
        console.error('[SFUA Update] Ошибка проверки обновления:', e);
        return false;
    }

    const hasUpdate = isVersionNewer(remote, local);
    const now = Date.now();

    chrome.storage.local.set({
        [STORAGE_KEY]: now,
        [UPDATE_AVAILABLE_KEY]: hasUpdate
    });

    if (showPopup) {
        if (hasUpdate) {
            showUpdatePopup();
        } else {
            const btn = document.querySelector('.update_button');
            if (btn) {
                const original = btn.textContent;
                btn.textContent = 'Нет новых версий';
                setTimeout(() => { btn.textContent = original; }, 3000);
            }
        }
    }

    return hasUpdate;
}

function showUpdatePopup() {
    chrome.runtime.sendMessage({ action: 'showUpdateModal' });
}

async function autoCheck() {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    const lastCheck = result[STORAGE_KEY] || 0;
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    if (now - lastCheck > sevenDays) {
        await checkForUpdate(false);
    }
}

window.sfuaUpdate = { checkForUpdate, autoCheck };