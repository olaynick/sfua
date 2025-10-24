// actions/clickpluselements.js

(async function () {
    console.log("Скрипт 'Загрузить дополнительные события' запущен");

    const { eventType } = await chrome.runtime.sendMessage({ action: "getSearchParams" });

    const eventMapping = {
        0: "tap", 1: "open_screen", 2: "condition", 3: "event",
        4: "authorization", 5: "tabbar", 6: "deeplink", 7: "tech",
        8: "error", 9: "open_error", 10: "open_error_screen",
        11: "errorMetric", 12: "offline_tap"
    };

    const selectedEvent = eventMapping[eventType] || "tap";

    function getRandomPause(count) {
        let pause;
        if (count >= 1 && count <= 50) pause = Math.random() * (300 - 100) + 100;
        else if (count >= 51 && count <= 200) pause = Math.random() * (500 - 300) + 300;
        else if (count >= 201 && count <= 500) pause = Math.random() * (700 - 500) + 500;
        else if (count >= 501 && count <= 1000) pause = Math.random() * (1000 - 700) + 700;
        else if (count >= 1001 && count <= 2000) pause = Math.random() * (2000 - 1000) + 1000;
        else if (count > 2000) pause = Math.random() * (4000 - 2000) + 2000;
        else pause = 300;
        return { value: pause };
    }

    function getRelevantPlusElements(selectedEvent) {
        const iframe = document.querySelector('iframe.iframe-integration__iframe');
        if (!iframe) return [];
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        const eventNameElements = Array.from(
            iframeDoc.querySelectorAll('.profile-session__event-name-link .link__inner')
        ).filter(el => el.textContent.trim().toLowerCase() === selectedEvent.toLowerCase());

        const plusElements = [];
        eventNameElements.forEach(eventNameEl => {
            const eventContainer = eventNameEl.closest('.profile-session__event-description_type_client');
            if (eventContainer) {
                const plusEl = eventContainer.querySelector('.profile-session__expander-link .link__inner:not(.clicked)');
                if (plusEl && plusEl.textContent.trim().startsWith('+')) {
                    plusElements.push({ element: plusEl, parent: eventContainer });
                }
            }
        });
        return plusElements;
    }

    async function clickRelevantElements() {
        console.log(`Выбранное событие: ${selectedEvent}`);
        let waveNum = 1;

        while (true) {
            const elements = getRelevantPlusElements(selectedEvent);
            const count = elements.length;

            if (count === 0) break;

            const updateProgress = window.sfuaProgress?.startProgress
                ? window.sfuaProgress.startProgress(`Загружаю дополнительные события (волна ${waveNum})`, count)
                : null;

            for (let i = 0; i < count; i++) {
                const { element, parent } = elements[i];
                try {
                    element.classList.add('clicked');
                    parent.classList.add(`wave_${waveNum}`);
                    element.click();

                    if (updateProgress && typeof window.sfuaProgress?.updateProgress === 'function') {
                        window.sfuaProgress.updateProgress(() => {
                            updateProgress(i + 1);
                        });
                    }

                    const currentPause = getRandomPause(count);
                    if (i < count - 1) {
                        await new Promise(resolve => setTimeout(resolve, currentPause.value));
                    }
                } catch (error) {
                    console.error('Ошибка при клике:', error);
                }
            }

            await new Promise(resolve => setTimeout(resolve, 3000));
            waveNum++;
        }

        // ✅ Убираем setStep(4, ...) — пусть clickeventelements сам управляет прогрессом
        console.log('Запускаем clickeventelements.js через 1 секунду');
        setTimeout(() => {
            chrome.runtime.sendMessage({ action: "executeClickEventElements" });
        }, 1000);
    }

    await clickRelevantElements();
})();