// background.js
// Параметры поиска (для обычного поиска)
let searchParams = {
    eventType: 0,
    key: '%',
    value: 'обновить данные'
};
// Слушаем загрузку вкладки AppMetrica
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url?.includes('appmetrica.yandex.ru')) {
        console.log(`[Background] Страница AppMetrica загружена: ${tab.url}`);
        // === ОЧИСТКА СОСТОЯНИЯ POPUP И ПОИСКА ОШИБОК ===
        const popupStateKey = `sfua_popup_state_tab_${tabId}`;
        const errorSearchDoneKey = `sfua_error_search_done_tab_${tabId}`;
        const searchInProgressKey = `sfua_search_in_progress_tab_${tabId}`;
        chrome.storage.local.remove([popupStateKey, errorSearchDoneKey, searchInProgressKey], () => {
            if (chrome.runtime.lastError) {
                console.warn(`[Background] Ошибка очистки состояния:`, chrome.runtime.lastError);
            } else {
                console.log(`[Background] Очищено состояние: ${popupStateKey}, ${errorSearchDoneKey}, ${searchInProgressKey}`);
            }
        });
        // Инжектируем вспомогательные скрипты
        loadHelperScripts(tabId).catch(err => {
            console.warn(`[Background] Не удалось инжектировать хелперы сразу:`, err);
        });
    }
});
// Следим за активацией вкладок (опционально)
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
// Основной обработчик сообщений
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("[Background] Получено сообщение:", request);
    // === Обработка updateId — обновление profileId ===
    if (request.action === "updateId") {
        updateProfileId(sender.tab.id, request.newId);
        sendResponse({ success: true });
        return true;
    }
    // === Сброс флагов проверки параметров (для повторного поиска) ===
    if (request.action === "resetParamCheckFlags") {
        const targetTabId = request.tabId || sender.tab?.id;
        if (!targetTabId) {
            sendResponse({ success: false, error: "Не указан tabId" });
            return true;
        }
        try {
            chrome.scripting.executeScript({
                target: { tabId: targetTabId },
                func: () => {
                    const iframe = document.querySelector('iframe.iframe-integration__iframe');
                    if (!iframe || !iframe.contentDocument) {
                        console.warn('SFUA: iframe не доступен при сбросе флагов');
                        return;
                    }
                    const doc = iframe.contentDocument;
                    doc.querySelectorAll('.check_has_already_been_performed')
                        .forEach(el => el.classList.remove('check_has_already_been_performed'));
                    console.log('SFUA: Сброшены флаги проверки параметров внутри iframe');
                }
            });
            console.log(`[Background] Отправлен сброс флагов проверки параметров в вкладку ${targetTabId}`);
            sendResponse({ success: true });
        } catch (err) {
            console.error(`[Background] Ошибка сброса флагов:`, err);
            sendResponse({ success: false, error: err.message });
        }
        return true;
    }
    // === Завершение поиска — сброс флага ===
    if (request.action === "searchCompleted") {
        const tabId = sender.tab?.id;
        if (tabId) {
            const searchInProgressKey = `sfua_search_in_progress_tab_${tabId}`;
            chrome.storage.local.remove(searchInProgressKey, () => {
                if (chrome.runtime.lastError) {
                    console.warn(`[Background] Ошибка удаления флага поиска:`, chrome.runtime.lastError);
                } else {
                    console.log(`[Background] Сброшен флаг поиска: ${searchInProgressKey}`);
                }
            });
        }
        return true;
    }
    // === Обработка модального окна: показать ===
    if (request.action === "showErrorModal") {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            const tab = tabs[0];
            if (tab && tab.url.includes('appmetrica.yandex.ru')) {
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: (text, id) => {
                            window.sfuaErrorModal?.show?.(text, id);
                        },
                        args: [request.text, request.id]
                    });
                } catch (err) {
                    console.error("[Background] Ошибка показа модального окна:", err);
                }
            }
        });
        return true;
    }
    // === Обработка модального окна: скрыть ===
    if (request.action === "hideErrorModal") {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            const tab = tabs[0];
            if (tab && tab.url.includes('appmetrica.yandex.ru')) {
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: () => {
                            window.sfuaErrorModal?.hide?.();
                        }
                    });
                } catch (err) {
                    console.error("[Background] Ошибка скрытия модального окна:", err);
                }
            }
        });
        return true;
    }
    // === Показать FAQ / инструкцию на странице ===
    if (request.action === "showHowToUse") {
        chrome.tabs.query({
            active: true,
            currentWindow: true,
            url: '*://appmetrica.yandex.ru/*'
        }, async (tabs) => {
            const tab = tabs.find(t => t.url.includes('appmetrica.yandex.ru'));
            if (!tab) {
                console.warn('SFUA: AppMetrica не открыта');
                return;
            }
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['how_to_use.js']
                });
                console.log('✅ how_to_use.js инжектирован в страницу');
            } catch (err) {
                console.error('SFUA: Ошибка инъекции how_to_use.js:', err);
            }
        });
        sendResponse({ success: true });
        return true;
    }
    // === Обработка модального окна обновления ===
    if (request.action === "showUpdateModal") {
        chrome.tabs.query({
            active: true,
            currentWindow: true,
            url: '*://appmetrica.yandex.ru/*'
        }, (tabs) => {
            const tab = tabs.find(t => t.url.includes('appmetrica.yandex.ru'));
            if (!tab) return;
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    if (document.querySelector('.sfua_update_modal')) return;
                    const modal = document.createElement('div');
                    modal.className = 'sfua_update_modal';
                    modal.style.cssText = `
                        position: fixed;
                        top: 20px;
                        right: 20px;
                        background: white;
                        border: 1px solid #ccc;
                        border-radius: 8px;
                        padding: 16px;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                        z-index: 2147483647;
                        max-width: 300px;
                        font-family: sans-serif;
                        font-size: 14px;
                    `;
                    modal.innerHTML = `
                        <div>Доступна новая версия. Перейти на <a href="https://github.com/olaynick/sfua" target="_blank">https://github.com/olaynick/sfua</a> для загрузки?</div>
                        <div style="margin-top: 12px; display: flex; gap: 8px;">
                            <button class="sfua_update_yes">Да</button>
                            <button class="sfua_update_no">Нет</button>
                        </div>
                    `;
                    document.body.appendChild(modal);
                    modal.querySelector('.sfua_update_yes').onclick = () => {
                        window.open('https://github.com/olaynick/sfua', '_blank');
                        modal.remove();
                    };
                    modal.querySelector('.sfua_update_no').onclick = () => modal.remove();
                }
            });
        });
        return true;
    }
    // Определение целевой вкладки
    let targetTabId;
    if (request.tabId) {
        targetTabId = request.tabId;
    } else if (sender.tab?.id) {
        targetTabId = sender.tab.id;
    } else {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            const currentTab = tabs[0];
            if (!currentTab || !currentTab.url?.includes('appmetrica.yandex.ru')) {
                sendResponse({ success: false, error: "AppMetrica не открыта" });
                return;
            }
            await handleAction(request, currentTab.id, sendResponse);
        });
        return true;
    }
    // Проверка существования вкладки
    chrome.tabs.get(targetTabId, async (tab) => {
        if (chrome.runtime.lastError || !tab || !tab.url.includes('appmetrica.yandex.ru')) {
            console.error(`[Background] Вкладка ${targetTabId} не существует или не AppMetrica`);
            sendResponse({ success: false, error: "Вкладка AppMetrica закрыта или недоступна" });
            return;
        }
        await handleAction(request, targetTabId, sendResponse);
    });
    return true;
});
// Проверка готовности iframe
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
            if (Array.isArray(result) && result[0]?.result) {
                console.log("[Background] iframe готов");
                return true;
            }
        } catch (e) {
            console.log("[Background] iframe ещё не готов, попытка:", i + 1, e.message || '');
        }
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    console.warn("[Background] iframe не загрузился за отведённое время");
    return false;
}
// Загрузка вспомогательных скриптов
async function loadHelperScripts(tabId) {
    const scripts = [
        'background/userinfo.js',
        'background/updateId.js'
    ];
    for (const file of scripts) {
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: [file]
            });
            console.log(`[Background] Инжектирован: ${file}`);
        } catch (err) {
            console.error(`[Background] Ошибка инъекции ${file}:`, err);
        }
    }
}
// Обработка действий
async function handleAction(request, targetTabId, sendResponse) {
    try {
        if (request.action === "getSearchParams") {
            sendResponse(searchParams);
            return;
        }
        // === Запуск обычного поиска ===
        if (request.action === "startSearch") {
            searchParams = {
                eventType: request.eventType ?? 0,
                key: request.key ?? '%',
                value: request.value ?? 'обновить данные'
            };
            console.log("[Background] Параметры поиска:", searchParams);
            const ready = await waitForIframeReady(targetTabId);
            if (!ready) {
                throw new Error("iframe не загрузился");
            }
            await injectScript(targetTabId, 'progress.js');
            await injectScript(targetTabId, 'actions/showmoresession.js');
            sendResponse({ success: true });
        }
        // === Запуск поиска ошибок (начало цепочки) ===
        if (request.action === "executeStartErrorSearch") {
            console.log("[Background] Запуск потока поиска ошибок...");
            const ready = await waitForIframeReady(targetTabId);
            if (!ready) {
                throw new Error("iframe не загрузился");
            }
            // ✅ Сначала модальное окно
            await injectScript(targetTabId, 'modal_error.js');
            // ✅ Потом прогресс
            await injectScript(targetTabId, 'progress_error.js');
            await injectScript(targetTabId, 'actions/showmoresession_error.js');
            sendResponse({ success: true });
            return;
        }
        // === Остальные скрипты ===
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
        } else {
            console.warn("[Background] Неизвестное действие:", request.action);
            sendResponse({ success: false, error: "Неизвестное действие" });
        }
    } catch (err) {
        console.error("[Background] Ошибка при обработке действия:", err);
        if (!sendResponse.sent) {
            sendResponse({ success: false, error: err.message });
        }
    }
}
// === Цепочка обычного поиска ===
async function startSearchFlow(tabId) {
    console.log("[Background] Запуск потока обычного поиска...");
    const iframeReady = await waitForIframeReady(tabId);
    if (!iframeReady) {
        throw new Error("iframe не загрузился");
    }
    await injectScript(tabId, 'progress.js');
    await injectScript(tabId, 'actions/showmoresession.js');
}
// === Цепочка поиска ошибок ===
async function startErrorSearchFlow(tabId) {
    console.log("[Background] Запуск потока поиска ошибок...");
    const iframeReady = await waitForIframeReady(tabId);
    if (!iframeReady) {
        throw new Error("iframe не загрузился");
    }
    await injectScript(tabId, 'modal_error.js');
    await injectScript(tabId, 'progress_error.js');
    await injectScript(tabId, 'actions/showmoresession_error.js');
}
// === Инжектирование скрипта ===
async function injectScript(tabId, file) {
    try {
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: [file]
        });
        console.log(`[Background] Инжектирован: ${file}`);
    } catch (err) {
        console.error(`[Background] Ошибка инъекции ${file}:`, err);
        throw new Error(`Не удалось загрузить ${file}`);
    }
}
// === Обновление ID ===
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