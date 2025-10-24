// actions/loadallevents.js

(async function () {
    console.log("Скрипт 'Все события' запущен");

    function getRandomPause(count) {
        let pause;
        if (count >= 1 && count <= 50) {
            pause = Math.random() * (300 - 100) + 100;
        } else if (count >= 51 && count <= 200) {
            pause = Math.random() * (500 - 300) + 300;
        } else if (count >= 201 && count <= 500) {
            pause = Math.random() * (700 - 500) + 500;
        } else if (count >= 501 && count <= 1000) {
            pause = Math.random() * (1000 - 700) + 700;
        } else if (count >= 1001 && count <= 2000) {
            pause = Math.random() * (2000 - 1000) + 1000;
        } else if (count > 2000) {
            pause = Math.random() * (4000 - 2000) + 2000;
        } else {
            pause = 300;
        }
        return { value: Math.max(100, pause) };
    }

    function loadAllEvents() {
        const iframe = document.querySelector('iframe.iframe-integration__iframe');
        if (!iframe) {
            console.error('[loadallevents] Iframe не найден');
            proceedToNextStep();
            return;
        }

        let iframeDoc;
        try {
            iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        } catch (e) {
            console.error('[loadallevents] Ошибка доступа к iframe:', e);
            proceedToNextStep();
            return;
        }

        if (!iframeDoc) {
            console.error('[loadallevents] iframeDoc пустой');
            proceedToNextStep();
            return;
        }

        // Ждём, пока загрузится хотя бы один элемент
        setTimeout(() => {
            const elements = Array.from(iframeDoc.querySelectorAll('.link__inner'));
            const filteredElements = elements.filter(el => {
                const text = el.innerText?.trim() || '';
                return /Все \d+(\s(событи[яй]|событие))?/.test(text);
            });

            const count = filteredElements.length;
            console.log(`[loadallevents] Найдено "Все N событий": ${count}`);

            if (count === 0) {
                console.log('[loadallevents] Нет элементов для клика — переходим дальше');
                proceedToNextStep();
                return;
            }

            // === Обновляем прогресс ===
            if (typeof window.sfuaProgress !== 'undefined') {
                window.sfuaProgress.setStep(2, "Загружаю события");

                // Добавляем "N из X" только после того, как count известен
                const updateProgress = window.sfuaProgress.startProgress("Загружаю события", count);

                let index = 0;
                const startTime = Date.now();

                function clickNext() {
                    if (index < filteredElements.length) {
                        const el = filteredElements[index];
                        const text = el.innerText?.trim() || 'неизвестно';

                        try {
                            el.click();
                            console.log(`[loadallevents] Клик ${index + 1}/${count}: ${text}`);

                            // Обновляем прогресс
                            window.sfuaProgress.updateProgress(() => {
                                updateProgress(index + 1);
                            });

                            index++;
                            const pause = getRandomPause(count).value;
                            setTimeout(clickNext, pause);
                        } catch (err) {
                            console.error('[loadallevents] Ошибка клика:', err);
                            index++;
                            setTimeout(clickNext, 500);
                        }
                    } else {
                        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
                        console.log(`[loadallevents] ✅ Все клики выполнены за ${duration} сек`);
                        window.sfuaProgress.setStep(3, "Загружаю дополнительные события");
                        proceedToNextStep();
                    }
                }

                // Запускаем цикл
                clickNext();
            } else {
                console.warn('[loadallevents] window.sfuaProgress не определён');
                proceedToNextStep();
            }
        }, 1000); // Даём время на рендер
    }

    function proceedToNextStep() {
        console.log('[loadallevents] Переход к следующему шагу...');
        setTimeout(() => {
            chrome.runtime.sendMessage({ action: "executeClickPlusElement" });
        }, 3000);
    }

    // Запускаем
    loadAllEvents();
})();