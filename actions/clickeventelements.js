// actions/clickeventelements.js

(async function () {
    console.log("Скрипт 'Клик по событиям' запущен");

    let eventType, key, value;

    try {
        const paramsResponse = await chrome.runtime.sendMessage({ action: "getSearchParams" });
        eventType = paramsResponse.eventType ?? 0;
        key = paramsResponse.key ?? '%';
        value = paramsResponse.value ?? 'обновить данные';
    } catch (error) {
        console.error("Ошибка при получении параметров поиска:", error);
        window.sfuaProgress?.searchComplete(false, 'Не удалось получить параметры поиска');
        return;
    }

    const eventMapping = {
        0: "tap", 1: "open_screen", 2: "condition", 3: "event",
        4: "authorization", 5: "tabbar", 6: "Deeplink", 7: "tech",
        8: "error", 9: "open_error", 10: "open_error_screen",
        11: "errorMetric", 12: "offline_tap"
    };

    const selectedEvent = eventMapping[eventType] || "tap";

    if (window.__SFUA_CLICK_EVENTS_RUNNING__) return;
    window.__SFUA_CLICK_EVENTS_RUNNING__ = true;

    function convertToRegex(str) {
        const trimmed = str.trim();
        if (trimmed === '%') return /.+/;
        const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(escaped.replace(/%/g, '.*'), 'i');
    }

    const regexKey = convertToRegex(key);
    const regexValue = convertToRegex(value);

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function getRandomPause(count) {
        const map = [
            [1, 50, 100, 300],
            [51, 200, 300, 500],
            [201, 500, 500, 700],
            [501, 1000, 700, 1000],
            [1001, 2000, 1000, 2000],
            [2001, Infinity, 2000, 4000]
        ];
        for (const [min, max, minMs, maxMs] of map) {
            if (count >= min && count <= max) {
                return Math.random() * (maxMs - minMs) + minMs;
            }
        }
        return 300;
    }

    function simulateClickWithCheck(element) {
        if (!element || element.classList.contains('span_checked')) return;
        element.click();
        element.classList.add('span_checked');
        element.dispatchEvent(new CustomEvent('sfua:spanToggled', {
            bubbles: true,
            detail: { checked: true }
        }));
    }

    async function clickAndSearch() {
        const iframe = document.querySelector('.iframe-integration__iframe');
        if (!iframe) {
            window.sfuaProgress?.searchComplete(false, 'iframe не найден');
            return;
        }

        let iframeDoc;
        try {
            iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        } catch (e) {
            window.sfuaProgress?.searchComplete(false, 'Нет доступа к iframe');
            return;
        }

        if (!iframeDoc) {
            window.sfuaProgress?.searchComplete(false, 'iframe не загружен');
            return;
        }

        iframeDoc.querySelectorAll('.this_one_matches').forEach(el => {
            el.style.border = '';
            el.classList.remove('this_one_matches');
        });

        const allEventSpans = [...iframeDoc.querySelectorAll('span.link__inner')]
            .filter(span => {
                const text = span.textContent.trim();
                return text === selectedEvent && !span.classList.contains('span_checked');
            });

        const total = allEventSpans.length;
        console.log(`Найдено "${selectedEvent}": ${total}`);

        if (total === 0) {
            window.sfuaProgress?.searchComplete(true, 'Совпадений не найдено');
            return;
        }

        // ✅ Только здесь — когда total известен — обновляем прогресс
        if (typeof window.sfuaProgress !== 'undefined') {
            window.sfuaProgress.setStep(4, "Кликаю по событиям и осуществляю поиск");
        }

        const updateProgress = window.sfuaProgress?.startProgress
            ? window.sfuaProgress.startProgress("Кликаю по событиям и осуществляю поиск", total)
            : null;

        let eventCounter = 1;
        let foundAny = false;

        for (let i = 0; i < total; i++) {
            const span = allEventSpans[i];
            simulateClickWithCheck(span);
            await delay(getRandomPause(total));

            const allParams = iframeDoc.querySelectorAll('.event-details__param');
            for (const param of allParams) {
                if (param.classList.contains('check_has_already_been_performed')) continue;

                const keyEl = param.querySelector('.event-details__key');
                const valueEl = param.querySelector('.event-details__value');
                if (!keyEl || !valueEl) {
                    param.classList.add('check_has_already_been_performed');
                    continue;
                }

                const keyText = keyEl.textContent.trim();
                const valueText = valueEl.textContent.trim();

                if (regexKey.test(keyText) && regexValue.test(valueText)) {
                    foundAny = true;
                    const eventParent = param.closest('.profile-session__event');
                    const sessionParent = eventParent?.closest('.profile-session_js_inited');
                    const timeEl = eventParent?.querySelector('.profile-session__event-time');
                    const dateEl = sessionParent?.querySelector('.profile-session__date');

                    const timeText = timeEl?.textContent.trim() || 'время не найдено';
                    const dateText = dateEl?.textContent.trim() || 'дата не найдено';
                    const shortDateText = dateText.split(' ').slice(0, 2).join(' ');

                    const anchorId = `found_event_${Date.now()}_${eventCounter++}`;
                    if (timeEl) timeEl.id = anchorId;

                    const detailsParent = param.closest('.event-details_js_inited');
                    if (detailsParent) {
                        detailsParent.classList.add('this_one_matches');
                        detailsParent.style.border = '2px solid #008D00';
                    }

                    window.sfuaProgress?.addResult({ id: anchorId, shortDateText, timeText });
                }

                param.classList.add('check_has_already_been_performed');
            }

            // ✅ Обновляем прогресс
            if (updateProgress && typeof window.sfuaProgress?.updateProgress === 'function') {
                window.sfuaProgress.updateProgress(() => {
                    updateProgress(i + 1);
                });
            }
        }

        window.sfuaProgress?.searchComplete(true, foundAny ? undefined : 'Совпадений не найдено');
    }

    try {
        await delay(1000);
        await clickAndSearch();
    } catch (err) {
        console.error("Ошибка в clickeventelements:", err);
        window.sfuaProgress?.searchComplete(false, 'Ошибка: ' + err.message);
    } finally {
        delete window.__SFUA_CLICK_EVENTS_RUNNING__;
    }
})();