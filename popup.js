// popup.js

document.addEventListener('DOMContentLoaded', async function () {
    const eventTypes = document.querySelectorAll('.event_type');
    const searchButton = document.querySelector('.search_button');
    const errorSearchButton = document.querySelector('.error_search_button');
    const paramKey = document.querySelector('.param_key');
    const paramValue = document.querySelector('.param_value');

    let currentTabId = null;

    // Получаем активную вкладку AppMetrica
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

    // Если AppMetrica не открыта
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

    // === Функции управления состоянием кнопки "Поиск ошибок" ===
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

    // === Проверка состояния поиска ошибок ===
    async function checkErrorSearchState() {
        const result = await chrome.storage.local.get([ERROR_SEARCH_DONE_KEY]);
        const isDone = result[ERROR_SEARCH_DONE_KEY] === true;
        const hasActiveContainer = !!document.querySelector('.sfua_error_container');

        if (isDone && !hasActiveContainer) {
            // Поиск был завершён, но контейнера нет → можно запустить снова
            enableErrorSearchButton();
            // Очищаем устаревший флаг
            chrome.storage.local.remove(ERROR_SEARCH_DONE_KEY);
        } else if (isDone && hasActiveContainer) {
            // Поиск завершён и контейнер активен → нельзя запускать
            disableErrorSearchButton();
        } else {
            // Никаких следов поиска → разрешаем
            enableErrorSearchButton();
        }
    }

    // === Загрузка сохранённого состояния ===
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

    // === Проверка состояния обычного поиска ===
    if (result[SEARCH_IN_PROGRESS_KEY]) {
        searchButton.disabled = true;
        searchButton.textContent = 'Идёт поиск…';
        searchButton.title = 'Идёт поиск. Чтобы начать новый, нужно дождаться завершения или обновить страницу';
    } else {
        searchButton.title = 'Поиск событий по совпадению ключ:значение за выбранный период';
    }

    // === Переключение активного типа события ===
    eventTypes.forEach(type => {
        type.addEventListener('click', () => {
            eventTypes.forEach(t => t.classList.remove('active'));
            type.classList.add('active');
            saveState();
        });
    });

    paramKey.addEventListener('input', saveState);
    paramValue.addEventListener('input', saveState);

    // === Сохранение состояния ===
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

    // === Карта типов событий ===
    const typesMap = {
        'tap': 0, 'open_screen': 1, 'condition': 2, 'event': 3,
        'authorization': 4, 'tabbar': 5, 'deeplink': 6, 'tech': 7,
        'error': 8, 'open_error': 9, 'open_error_screen': 10,
        'errorMetric': 11, 'offline_tap': 12
    };

    // === Обработчик кнопки "Поиск ошибок" ===
    errorSearchButton.addEventListener('click', async () => {
        saveState();

        // Проверяем, существует ли вкладка
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

        // Проверяем, загружен ли iframe
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
                    // Пользователь может нажать снова
                }, 3000);
            }
            return;
        }

        // Устанавливаем флаг
        chrome.storage.local.set({ [ERROR_SEARCH_DONE_KEY]: true }, () => {
            if (chrome.runtime.lastError) {
                console.warn('Не удалось сохранить состояние поиска ошибок:', chrome.runtime.lastError);
            } else {
                console.log('✅ Поиск ошибок помечен как выполненный');
            }
            disableErrorSearchButton();
        });

        // Отправляем запрос
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

    // === Обработчик кнопки "Начать поиск" ===
    async function startSearch(eventType, key, value) {
        saveState();

        // Блокируем кнопку
        searchButton.disabled = true;
        const originalText = searchButton.textContent;
        searchButton.textContent = 'Идёт поиск…';
        searchButton.title = 'Идёт поиск. Чтобы начать новый, нужно дождаться завершения или обновить страницу';

        // Устанавливаем флаг, что поиск идёт
        chrome.storage.local.set({ [SEARCH_IN_PROGRESS_KEY]: true }, () => {
            if (chrome.runtime.lastError) {
                console.warn('Не удалось сохранить состояние поиска:', chrome.runtime.lastError);
            }
        });

        // Сбрасываем флаги проверки параметров
        try {
            await chrome.runtime.sendMessage({
                action: "resetParamCheckFlags",
                tabId: currentTabId
            });
        } catch (err) {
            console.warn("SFUA: Не удалось сбросить флаги", err);
        }

        // Отправляем запрос на запуск поиска
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

            // Через 1 сек разблокируем кнопку
            setTimeout(() => {
                if (searchButton.disabled) {
                    searchButton.disabled = false;
                    searchButton.textContent = originalText;
                    searchButton.title = 'Поиск событий по совпадению ключ:значение за выбранный период';
                }
                // Удаляем флаг
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

// === Обработчик кнопки FAQ ===
const faqButton = document.querySelector('.faq_button');
if (faqButton) {
    faqButton.addEventListener('click', () => {
        console.log('[Popup] Открываем FAQ на странице');
        chrome.runtime.sendMessage({
            action: "showHowToUse"
        });
        window.close();
    });
}

function injectHowToUse() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('how_to_use.js');
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
}

    // === Горячие клавиши: Ctrl+Enter ===
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

    // === Проверка состояния при старте ===
    checkErrorSearchState();

    // === Следим за обновлением вкладки ===
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (tabId === currentTabId && changeInfo.status === 'complete' && tab.url.includes('appmetrica.yandex.ru')) {
            console.log('[Popup] Вкладка обновлена — проверяем состояние поиска ошибок');
            checkErrorSearchState();
        }
    });

    // === Следим за активацией вкладки ===
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
        if (activeInfo.tabId === currentTabId) {
            try {
                const tab = await chrome.tabs.get(currentTabId);
                if (tab.url?.includes('appmetrica.yandex.ru')) {
                    console.log('[Popup] Вкладка активирована — проверяем состояние');
                    checkErrorSearchState();
                }
            } catch (e) {
                console.warn('Не удалось получить вкладку:', e);
            }
        }
    });
});