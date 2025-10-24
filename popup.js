// popup.js
document.addEventListener('DOMContentLoaded', async function () {
    const eventTypes = document.querySelectorAll('.event_type');
    const searchButton = document.querySelector('.search_button');
    const errorSearchButton = document.querySelector('.error_search_button');
    const paramKey = document.querySelector('.param_key');
    const paramValue = document.querySelector('.param_value');
    let currentTabId = null;

    try {
        const tabs = await chrome.tabs.query({
            active: true,
            currentWindow: true,
            url: ['*://appmetrica.yandex.ru/*']
        });
        const appTab = tabs.find(tab => tab.url.includes('appmetrica.yandex.ru'));
        if (appTab) {
            currentTabId = appTab.id;
        }
    } catch (err) {
        console.error('SFUA: Ошибка получения вкладки:', err);
    }

    if (!currentTabId) {
        document.querySelector('.sfua_container').innerHTML = `
            <div style="text-align: center; color: #718096; font-size: 12px; padding: 20px;">
                Откройте профиль пользователя в AppMetrica
            </div>
        `;
        return;
    }

    const STORAGE_KEY = `sfua_popup_state_tab_${currentTabId}`;
    const ERROR_SEARCH_DONE_KEY = `sfua_error_search_done_tab_${currentTabId}`;
    const SEARCH_IN_PROGRESS_KEY = `sfua_search_in_progress_tab_${currentTabId}`;
    const STORAGE_KEY_HAS_UPDATE = 'sfua_update_available';

    function disableErrorSearchButton() {
        errorSearchButton.disabled = true;
        errorSearchButton.style.opacity = '0.6';
        errorSearchButton.title = 'Поиск ошибок уже выполнен. Обновите страницу, чтобы запустить снова.';
    }

    function enableErrorSearchButton() {
        errorSearchButton.disabled = false;
        errorSearchButton.style.opacity = '1';
        errorSearchButton.title = 'Поиск всех ошибок (включая Крэш)';
    }

    async function checkErrorSearchState() {
        const result = await chrome.storage.local.get([ERROR_SEARCH_DONE_KEY]);
        const isDone = result[ERROR_SEARCH_DONE_KEY] === true;
        const hasActiveContainer = !!document.querySelector('.sfua_error_container');
        if (isDone && !hasActiveContainer) {
            enableErrorSearchButton();
            chrome.storage.local.remove(ERROR_SEARCH_DONE_KEY);
        } else if (isDone && hasActiveContainer) {
            disableErrorSearchButton();
        } else {
            enableErrorSearchButton();
        }
    }

    const result = await chrome.storage.local.get([STORAGE_KEY, ERROR_SEARCH_DONE_KEY, SEARCH_IN_PROGRESS_KEY]);
    const saved = result[STORAGE_KEY];
    if (saved) {
        eventTypes.forEach(type => {
            if (type.textContent.trim() === saved.eventType) {
                type.classList.add('active');
            } else {
                type.classList.remove('active');
            }
        });
        if (saved.key !== undefined) paramKey.value = saved.key;
        if (saved.value !== undefined) paramValue.value = saved.value;
    } else if (eventTypes.length > 0) {
        eventTypes[0].classList.add('active');
    }

    if (result[SEARCH_IN_PROGRESS_KEY]) {
        searchButton.disabled = true;
        searchButton.textContent = 'Идёт поиск…';
        searchButton.title = 'Идёт поиск. Чтобы начать новый, нужно дождаться завершения или обновить страницу';
    } else {
        searchButton.title = 'Поиск событий по совпадению ключ:значение за выбранный период';
    }

    eventTypes.forEach(type => {
        type.addEventListener('click', () => {
            eventTypes.forEach(t => t.classList.remove('active'));
            type.classList.add('active');
            saveState();
        });
    });
    paramKey.addEventListener('input', saveState);
    paramValue.addEventListener('input', saveState);

    function saveState() {
        const activeType = document.querySelector('.event_type.active');
        const state = {
            eventType: activeType ? activeType.textContent.trim() : 'tap',
            key: paramKey.value,
            value: paramValue.value
        };
        const changes = {};
        changes[STORAGE_KEY] = state;
        chrome.storage.local.set(changes);
    }

    const typesMap = {
        'tap': 0, 'open_screen': 1, 'condition': 2, 'event': 3,
        'authorization': 4, 'tabbar': 5, 'deeplink': 6, 'tech': 7,
        'error': 8, 'open_error': 9, 'open_error_screen': 10,
        'errorMetric': 11, 'offline_tap': 12
    };

    errorSearchButton.addEventListener('click', async () => {
        saveState();
        let tab;
        try {
            tab = await chrome.tabs.get(currentTabId);
            if (!tab || !tab.url.includes('appmetrica.yandex.ru')) {
                alert('Вкладка AppMetrica не найдена или закрыта');
                return;
            }
        } catch (err) {
            console.error('SFUA: Вкладка не доступна:', err);
            alert('Не удалось получить доступ к вкладке');
            return;
        }

        let iframeReady = false;
        try {
            const result = await chrome.scripting.executeScript({
                target: { tabId: currentTabId },
                func: () => {
                    const iframe = document.querySelector('iframe.iframe-integration__iframe');
                    return !!iframe && !!iframe.contentDocument?.body;
                }
            });
            iframeReady = result[0]?.result;
        } catch (e) {
            console.warn('SFUA: Ошибка проверки iframe:', e);
        }
        if (!iframeReady) {
            const retry = confirm('AppMetrica ещё не загружена. Подождать и попробовать снова?');
            if (retry) {
                errorSearchButton.disabled = true;
                errorSearchButton.textContent = 'Ожидание...';
                setTimeout(() => {
                    errorSearchButton.disabled = false;
                    errorSearchButton.textContent = 'Ошибки';
                }, 3000);
            }
            return;
        }

        chrome.storage.local.set({ [ERROR_SEARCH_DONE_KEY]: true }, () => {
            if (chrome.runtime.lastError) {
                console.warn('Не удалось сохранить состояние поиска ошибок:', chrome.runtime.lastError);
            } else {
                console.log('✅ Поиск ошибок помечен как выполненный');
            }
            disableErrorSearchButton();
        });

        try {
            await chrome.runtime.sendMessage({
                action: "executeStartErrorSearch",
                tabId: currentTabId
            });
            console.log('✅ Сообщение "executeStartErrorSearch" отправлено');
            window.close();
        } catch (err) {
            console.error('SFUA: Ошибка отправки сообщения:', err);
            alert('Не удалось запустить поиск ошибок. Обновите страницу и попробуйте снова.');
        }
    });

    async function startSearch(eventType, key, value) {
        saveState();
        searchButton.disabled = true;
        const originalText = searchButton.textContent;
        searchButton.textContent = 'Идёт поиск…';
        searchButton.title = 'Идёт поиск. Чтобы начать новый, нужно дождаться завершения или обновить страницу';
        chrome.storage.local.set({ [SEARCH_IN_PROGRESS_KEY]: true });

        try {
            await chrome.runtime.sendMessage({
                action: "resetParamCheckFlags",
                tabId: currentTabId
            });
        } catch (err) {
            console.warn("SFUA: Не удалось сбросить флаги", err);
        }

        try {
            const response = await chrome.runtime.sendMessage({
                action: "startSearch",
                eventType: eventType,
                key: key,
                value: value,
                tabId: currentTabId
            });
            if (response && !response.success) {
                throw new Error(response.error);
            }
            setTimeout(() => {
                if (searchButton.disabled) {
                    searchButton.disabled = false;
                    searchButton.textContent = originalText;
                    searchButton.title = 'Поиск событий по совпадению ключ:значение за выбранный период';
                }
                chrome.storage.local.remove(SEARCH_IN_PROGRESS_KEY);
            }, 1000);
            window.close();
        } catch (error) {
            console.error('SFUA: Ошибка при запуске поиска:', error);
            setTimeout(() => {
                if (searchButton.disabled) {
                    searchButton.disabled = false;
                    searchButton.textContent = originalText;
                    searchButton.title = 'Поиск событий по совпадению ключ:значение за выбранный период';
                }
                chrome.storage.local.remove(SEARCH_IN_PROGRESS_KEY);
            }, 3000);
        }
    }

    searchButton.addEventListener('click', () => {
        const activeType = document.querySelector('.event_type.active');
        if (!activeType) return;
        const typeName = activeType.textContent.trim();
        const eventType = typesMap[typeName] ?? 0;
        startSearch(eventType, paramKey.value, paramValue.value);
    });

    // === FAQ ===
    const faqButton = document.querySelector('.faq_button');
    if (faqButton) {
        faqButton.addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: "showHowToUse" });
            window.close();
        });
    }

    // === Горячие клавиши ===
    function handleCtrlEnter(e) {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            const activeType = document.querySelector('.event_type.active');
            if (!activeType) return;
            const typeName = activeType.textContent.trim();
            const eventType = typesMap[typeName] ?? 0;
            startSearch(eventType, paramKey.value, paramValue.value);
        }
    }
    paramKey.addEventListener('keydown', handleCtrlEnter);
    paramValue.addEventListener('keydown', handleCtrlEnter);

    // === Обновление ===
    const updateScript = document.createElement('script');
    updateScript.src = chrome.runtime.getURL('update.js');
    updateScript.onload = () => {
        updateScript.remove();
        initUpdateButton();
        window.sfuaUpdate.autoCheck();
    };
    document.head.appendChild(updateScript);

    function initUpdateButton() {
        const updateBtn = document.querySelector('.update_button');
        if (!updateBtn) return;

        updateBtn.textContent = 'Обновить';

        chrome.storage.local.get([STORAGE_KEY_HAS_UPDATE], (result) => {
            const hasUpdate = result[STORAGE_KEY_HAS_UPDATE] || false;
            if (hasUpdate) {
                updateBtn.className = 'update_button has-update';
                updateBtn.disabled = false;
            } else {
                updateBtn.className = 'update_button no-update';
                updateBtn.disabled = true;
            }
        });

        updateBtn.addEventListener('click', () => {
            chrome.storage.local.get([STORAGE_KEY_HAS_UPDATE], (result) => {
                if (result[STORAGE_KEY_HAS_UPDATE]) {
                    showUpdatePopup();
                }
            });
        });
    }

    function showUpdatePopup() {
        chrome.runtime.sendMessage({ action: 'showUpdateModal' });
        window.close();
    }

    checkErrorSearchState();

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (tabId === currentTabId && changeInfo.status === 'complete' && tab.url.includes('appmetrica.yandex.ru')) {
            checkErrorSearchState();
        }
    });

    chrome.tabs.onActivated.addListener(async (activeInfo) => {
        if (activeInfo.tabId === currentTabId) {
            try {
                const tab = await chrome.tabs.get(currentTabId);
                if (tab.url?.includes('appmetrica.yandex.ru')) {
                    checkErrorSearchState();
                }
            } catch (e) {
                console.warn('Не удалось получить вкладку:', e);
            }
        }
    });
});