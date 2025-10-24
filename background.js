// background.js
let searchParams = {
    eventType: 0,
    key: '%',
    value: 'обновить данные'
};

// === Логика обновлений ===
const REPO_URL = `https://raw.githubusercontent.com/olaynick/sfua/main/manifest.json?_=${Date.now()}`;
const STORAGE_KEY_LAST_CHECK = 'sfua_last_update_check';
const STORAGE_KEY_HAS_UPDATE = 'sfua_update_available';

async function checkForUpdateBackground() {
    const local = chrome.runtime.getManifest().version;
    let remote = 'неизвестно';
    try {
        const res = await fetch(REPO_URL);
        if (res.ok) {
            const manifest = await res.json();
            remote = manifest.version;
        }
    } catch (e) {
        console.error('[SFUA Update] Ошибка загрузки версии:', e);
    }

    const r = remote.split('.').map(Number);
    const l = local.split('.').map(Number);
    let hasUpdate = false;
    for (let i = 0; i < Math.max(r.length, l.length); i++) {
        const rv = r[i] || 0;
        const lv = l[i] || 0;
        if (rv > lv) { hasUpdate = true; break; }
        if (rv < lv) break;
    }

    const now = Date.now();
    await chrome.storage.local.set({
        [STORAGE_KEY_LAST_CHECK]: now,
        [STORAGE_KEY_HAS_UPDATE]: hasUpdate
    });
}

// Автопроверка при запуске и по таймеру
chrome.alarms.create('checkUpdate', { periodInMinutes: 60 });
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'checkUpdate') {
        checkForUpdateBackground();
    }
});

// Первый запуск
checkForUpdateBackground();

// === Слушаем загрузку вкладки AppMetrica ===
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url?.includes('appmetrica.yandex.ru')) {
        console.log(`[Background] Страница AppMetrica загружена: ${tab.url}`);
        const popupStateKey = `sfua_popup_state_tab_${tabId}`;
        const errorSearchDoneKey = `sfua_error_search_done_tab_${tabId}`;
        const searchInProgressKey = `sfua_search_in_progress_tab_${tabId}`;
        chrome.storage.local.remove([popupStateKey, errorSearchDoneKey, searchInProgressKey]);
        loadHelperScripts(tabId).catch(err => {
            console.warn(`[Background] Не удалось инжектировать хелперы сразу:`, err);
        });
    }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (tab.url?.includes('appmetrica.yandex.ru')) {
            await loadHelperScripts(activeInfo.tabId);
        }
    } catch (e) {
        console.warn('Не удалось обновить вкладку при активации:', e);
    }
});

// === Основной обработчик сообщений ===
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    (async () => {
        console.log("[Background] Получено сообщение:", request);

        // === Обработка updateId — обновление profileId ===
        if (request.action === "updateId") {
            updateProfileId(sender.tab.id, request.newId);
            sendResponse({ success: true });
            return;
        }

        // === Сброс флагов проверки параметров ===
        if (request.action === "resetParamCheckFlags") {
            const targetTabId = request.tabId || sender.tab?.id;
            if (!targetTabId) {
                sendResponse({ success: false, error: "Не указан tabId" });
                return;
            }
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: targetTabId },
                    func: () => {
                        const iframe = document.querySelector('iframe.iframe-integration__iframe');
                        if (!iframe || !iframe.contentDocument) return;
                        const doc = iframe.contentDocument;
                        doc.querySelectorAll('.check_has_already_been_performed')
                            .forEach(el => el.classList.remove('check_has_already_been_performed'));
                    }
                });
                sendResponse({ success: true });
            } catch (err) {
                console.error(`[Background] Ошибка сброса флагов:`, err);
                sendResponse({ success: false, error: err.message });
            }
            return;
        }

        // === Завершение поиска — сброс флага ===
        if (request.action === "searchCompleted") {
            const tabId = sender.tab?.id;
            if (tabId) {
                const searchInProgressKey = `sfua_search_in_progress_tab_${tabId}`;
                chrome.storage.local.remove(searchInProgressKey);
            }
            sendResponse({ success: true });
            return;
        }

        // === Модальное окно ошибки ===
        if (request.action === "showErrorModal") {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const tab = tabs[0];
            if (tab && tab.url.includes('appmetrica.yandex.ru')) {
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: (text, id) => window.sfuaErrorModal?.show?.(text, id),
                        args: [request.text, request.id]
                    });
                } catch (err) {
                    console.error("[Background] Ошибка показа модального окна:", err);
                }
            }
            sendResponse({ success: true });
            return;
        }

        if (request.action === "hideErrorModal") {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const tab = tabs[0];
            if (tab && tab.url.includes('appmetrica.yandex.ru')) {
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: () => window.sfuaErrorModal?.hide?.()
                    });
                } catch (err) {
                    console.error("[Background] Ошибка скрытия модального окна:", err);
                }
            }
            sendResponse({ success: true });
            return;
        }

        // === Показать руководство ===
        if (request.action === "showHowToUse") {
            const tabs = await chrome.tabs.query({
                active: true,
                currentWindow: true,
                url: '*://appmetrica.yandex.ru/*'
            });
            const tab = tabs.find(t => t.url.includes('appmetrica.yandex.ru'));
            if (!tab) {
                sendResponse({ success: false, error: "AppMetrica не открыта" });
                return;
            }
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['how_to_use.js']
                });
                sendResponse({ success: true });
            } catch (err) {
                console.error('SFUA: Ошибка инъекции how_to_use.js:', err);
                sendResponse({ success: false, error: err.message });
            }
            return;
        }

        // === Модальное окно обновления ===
        if (request.action === "showUpdateModal") {
            const local = chrome.runtime.getManifest().version;
            let remote = 'неизвестно';
            try {
                const res = await fetch(REPO_URL);
                if (res.ok) {
                    const manifest = await res.json();
                    remote = manifest.version;
                }
            } catch (e) {
                console.error('[SFUA] Не удалось получить удалённую версию:', e);
            }

            const tabs = await chrome.tabs.query({
                active: true,
                currentWindow: true,
                url: '*://appmetrica.yandex.ru/*'
            });
            const tab = tabs.find(t => t.url.includes('appmetrica.yandex.ru'));
            if (!tab) {
                sendResponse({ success: false });
                return;
            }

            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (localVer, remoteVer) => {
                    // Удаляем предыдущие модалки и стили
                    document.querySelectorAll('.sfua_update_modal_overlay').forEach(el => el.remove());
                    document.querySelectorAll('style[data-sfua-update-modal]').forEach(el => el.remove());

                    // Инжектим стили
                    const style = document.createElement('style');
                    style.setAttribute('data-sfua-update-modal', '');
                    style.textContent = `
                        .sfua_update_modal_overlay {
                            position: fixed;
                            top: 0; left: 0; width: 100%; height: 100%;
                            background: rgba(0, 0, 0, 0.6);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            z-index: 2147483647;
                        }
                        .sfua_update_modal {
                            background: white;
                            border-radius: 12px;
                            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
                            padding: 24px;
                            color: #2d3748;
                            font-size: 14px;
                            text-align: center;
                            max-width: 400px;
                            width: 90%;
                        }
                        .sfua_update_modal_buttons {
                            display: flex;
                            gap: 12px;
                            justify-content: center;
                            margin-top: 20px;
                        }
                        .sfua_update_modal_button {
                            padding: 8px 20px;
                            border: none;
                            border-radius: 6px;
                            font-size: 14px;
                            font-weight: 500;
                            cursor: pointer;
                            transition: all 0.2s ease;
                        }
                        .sfua_update_modal_button.yes {
                            background-color: #4299e1;
                            color: white;
                        }
                        .sfua_update_modal_button.yes:hover {
                            background-color: #3182ce;
                        }
                        .sfua_update_modal_button.no {
                            background-color: #e2e8f0;
                            color: #4a5568;
                        }
                        .sfua_update_modal_button.no:hover {
                            background-color: #cbd5e0;
                        }
                    `;
                    document.head.appendChild(style);

                    // Создаём модалку
                    const overlay = document.createElement('div');
                    overlay.className = 'sfua_update_modal_overlay';
                    overlay.innerHTML = `
                        <div class="sfua_update_modal">
                            <div>Текущая версия: ${localVer}. Новая версия: ${remoteVer}. Скачать новую версию?</div>
                            <div class="sfua_update_modal_buttons">
                                <button class="sfua_update_modal_button yes">Да</button>
                                <button class="sfua_update_modal_button no">Нет</button>
                            </div>
                        </div>
                    `;
                    document.body.appendChild(overlay);

                    // Функция закрытия
                    const close = () => {
                        overlay.remove();
                        style.remove();
                    };

                    // Обработчики
                    overlay.querySelector('.yes').addEventListener('click', (e) => {
                        e.preventDefault();
                        window.open('https://github.com/olaynick/sfua/archive/refs/heads/main.zip', '_blank');
                        close();
                    });

                    overlay.querySelector('.no').addEventListener('click', close);
                    overlay.addEventListener('click', (e) => {
                        if (e.target === overlay) close();
                    });

                    // Закрытие по Esc
                    const handleEsc = (e) => {
                        if (e.key === 'Escape') {
                            close();
                            document.removeEventListener('keydown', handleEsc);
                        }
                    };
                    document.addEventListener('keydown', handleEsc);
                },
                args: [local, remote]
            });

            sendResponse({ success: true });
            return;
        }

        // === Обработка остальных действий ===
        let targetTabId = request.tabId || sender.tab?.id;
        if (!targetTabId) {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const currentTab = tabs[0];
            if (!currentTab || !currentTab.url?.includes('appmetrica.yandex.ru')) {
                sendResponse({ success: false, error: "AppMetrica не открыта" });
                return;
            }
            await handleAction(request, currentTab.id, sendResponse);
            return;
        }

        try {
            const tab = await chrome.tabs.get(targetTabId);
            if (chrome.runtime.lastError || !tab || !tab.url.includes('appmetrica.yandex.ru')) {
                sendResponse({ success: false, error: "Вкладка AppMetrica закрыта или недоступна" });
                return;
            }
            await handleAction(request, targetTabId, sendResponse);
        } catch (err) {
            console.error("[Background] Ошибка при получении вкладки:", err);
            sendResponse({ success: false, error: "Вкладка недоступна" });
        }
    })().catch(err => {
        console.error("[Background] Необработанная ошибка в обработчике:", err);
        sendResponse({ success: false, error: err.message || 'Неизвестная ошибка' });
    });

    return true; // для асинхронного sendResponse
});

// === Вспомогательные функции ===
async function waitForIframeReady(tabId) {
    for (let i = 0; i < 40; i++) {
        try {
            const result = await chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: () => {
                    const iframe = document.querySelector('iframe.iframe-integration__iframe');
                    return !!iframe && !!iframe.contentDocument?.body;
                }
            });
            if (Array.isArray(result) && result[0]?.result) return true;
        } catch (e) {}
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    return false;
}

async function loadHelperScripts(tabId) {
    const scripts = ['background/userinfo.js','background/updateId.js'];
    for (const file of scripts) {
        try {
            await chrome.scripting.executeScript({ target: { tabId: tabId }, files: [file] });
        } catch (err) {
            console.error(`[Background] Ошибка инъекции ${file}:`, err);
        }
    }
}

async function handleAction(request, targetTabId, sendResponse) {
    try {
        if (request.action === "getSearchParams") {
            sendResponse(searchParams);
            return;
        }

        if (request.action === "startSearch") {
            searchParams = {
                eventType: request.eventType ?? 0,
                key: request.key ?? '%',
                value: request.value ?? 'обновить данные'
            };
            const ready = await waitForIframeReady(targetTabId);
            if (!ready) throw new Error("iframe не загрузился");
            await injectScript(targetTabId, 'progress.js');
            await injectScript(targetTabId, 'actions/showmoresession.js');
            sendResponse({ success: true });
            return;
        }

        if (request.action === "executeStartErrorSearch") {
            const ready = await waitForIframeReady(targetTabId);
            if (!ready) throw new Error("iframe не загрузился");
            await injectScript(targetTabId, 'modal_error.js');
            await injectScript(targetTabId, 'progress_error.js');
            await injectScript(targetTabId, 'actions/showmoresession_error.js');
            sendResponse({ success: true });
            return;
        }

        const scriptMap = {
            "executeLoadAllEvents": "actions/loadallevents.js",
            "executeClickPlusElement": "actions/clickpluselements.js",
            "executeClickEventElements": "actions/clickeventelements.js",
            "executeLoadAllEventsError": "actions/loadallevents_error.js",
            "executeFoundError": "actions/found_error.js"
        };

        if (scriptMap[request.action]) {
            const ready = await waitForIframeReady(targetTabId);
            if (!ready) {
                sendResponse({ success: false, error: "iframe не готов" });
                return;
            }
            await chrome.scripting.executeScript({
                target: { tabId: targetTabId },
                files: [scriptMap[request.action]]
            });
            sendResponse({ success: true });
            return;
        }

        sendResponse({ success: false, error: "Неизвестное действие" });
    } catch (err) {
        console.error("[Background] Ошибка при обработке действия:", err);
        sendResponse({ success: false, error: err.message });
    }
}

async function injectScript(tabId, file) {
    try {
        await chrome.scripting.executeScript({ target: { tabId: tabId }, files: [file] });
    } catch (err) {
        console.error(`[Background] Ошибка инъекции ${file}:`, err);
        throw new Error(`Не удалось загрузить ${file}`);
    }
}

function updateProfileId(tabId, newId) {
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: (id) => {
            const iframes = document.querySelectorAll('iframe.iframe-integration__iframe');
            iframes.forEach(iframe => {
                try {
                    const src = iframe.src;
                    const newSrc = src.replace(/profileId=\d+/, `profileId=${id}`)
                                    .replace(/deviceId=\d+/, `deviceId=${id}`);
                    iframe.src = newSrc;
                } catch (e) {
                    console.error('Ошибка обновления iframe:', e);
                }
            });
            setTimeout(() => location.reload(), 1000);
        },
        args: [newId]
    });
}