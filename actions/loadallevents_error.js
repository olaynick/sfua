// actions/loadallevents_error.js

(function () {
    console.log("Скрипт 'Поиск ошибок: Все события' запущен");

    function getRandomPause(count) {
        if (count >= 1 && count <= 50) {
            return { value: Math.random() * (300 - 100) + 100 };
        } else if (count >= 51 && count <= 200) {
            return { value: Math.random() * (500 - 300) + 300 };
        } else if (count >= 201 && count <= 500) {
            return { value: Math.random() * (700 - 500) + 500 };
        } else if (count >= 501 && count <= 1000) {
            return { value: Math.random() * (1000 - 700) + 700 };
        } else if (count >= 1001 && count <= 2000) {
            return { value: Math.random() * (2000 - 1000) + 1000 };
        } else if (count > 2000) {
            return { value: Math.random() * (4000 - 2000) + 2000 };
        }
        return { value: 300 };
    }

    function loadAllEvents() {
        const iframe = document.querySelector('iframe.iframe-integration__iframe');
        if (!iframe) {
            console.error('Iframe не найден. Прекращаем выполнение.');
            proceedToNextStep();
            return;
        }

        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        const elements = Array.from(iframeDoc.querySelectorAll('.link__inner'));

        const filteredElements = elements.filter(el => {
            const text = el.innerText.trim();
            return /Все \d+( (событи[яй]|событие))?/.test(text);
        });

        const count = filteredElements.length;
        console.log(`Найдено ${count} элементов "Все события"`);

        if (count === 0) {
            console.log('Нет элементов "Все события" — пропускаем клики.');
            proceedToNextStep();
            return;
        }

        // === Старт прогресса с динамическим текстом ===
        if (window.sfuaErrorProgress) {
            window.sfuaErrorProgress.setStep(2, `Загружаю события: 0 из ${count}`);
        }

        const startTime = Date.now();

        function clickWithPause(index) {
            if (index < filteredElements.length) {
                const el = filteredElements[index];
                const text = el.innerText.trim();
                el.click();

                const currentPause = getRandomPause(count);
                const pauseSec = (currentPause.value / 1000).toFixed(3);
                console.log(`Клик: ${text} | Пауза: ${pauseSec} сек`);

                // === Обновляем прогресс ===
                if (window.sfuaErrorProgress) {
                    window.sfuaErrorProgress.setStep(2, `Загружаю события: ${index + 1} из ${count}`);
                }

                setTimeout(() => clickWithPause(index + 1), currentPause.value);
            } else {
                const endTime = Date.now();
                const timeSpent = (endTime - startTime) / 1000;
                console.log(`✅ Все клики по "Все события" выполнены. Время: ${timeSpent.toFixed(2)} сек`);

                // === Переход к поиску ошибок ===
                if (window.sfuaErrorProgress) {
                    window.sfuaErrorProgress.setStep(3, "Ищу ошибки");
                }

                proceedToNextStep();
            }
        }

        clickWithPause(0);
    }

    function proceedToNextStep() {
        console.log('Ожидание 3 секунды перед переходом к founderror.js...');
        setTimeout(() => {
            chrome.runtime.sendMessage({ action: "executeFoundError" });
        }, 3000);
    }

    loadAllEvents();
})();