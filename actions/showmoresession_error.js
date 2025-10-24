// actions/showmoresession_error.js

(function () {
    console.log("Скрипт 'Поиск ошибок: Показать больше сессий' запущен");

    let clickCount = 0;
    const maxClicksBeforeDelay = 10;
    const shortDelay = 3000;
    const longDelay = 5000;

    function clickShowMoreButton() {
        const iframe = document.querySelector('iframe.iframe-integration__iframe');
        if (!iframe) {
            console.warn("Iframe не найден. Повтор через 2 сек.");
            setTimeout(clickShowMoreButton, 2000);
            return;
        }

        let iframeDoc;
        try {
            iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        } catch (e) {
            console.error("Нет доступа к iframe (CSP/Sandbox):", e);
            setTimeout(clickShowMoreButton, 3000);
            return;
        }

        if (!iframeDoc) {
            console.warn("Не удалось получить document iframe");
            setTimeout(clickShowMoreButton, 3000);
            return;
        }

        const button = iframeDoc.querySelector('.profile-sessions-history__show-more-sessions-button');

        if (button && isElementVisible(button)) {
            console.log(`Кликаем на 'Показать больше сессий' (клик #${++clickCount})`);
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
            });
            button.dispatchEvent(clickEvent);

            const delay = clickCount >= maxClicksBeforeDelay ? longDelay : shortDelay;
            setTimeout(clickShowMoreButton, delay);
        } else {
            console.log("Кнопка больше не найдена. Переходим к loadallevents_error.js");

            // Обновляем прогресс
            if (window.sfuaErrorProgress) {
                window.sfuaErrorProgress.setStep(2, "Загружаю события");
            }

            // Запускаем следующий скрипт
            chrome.runtime.sendMessage({ action: "executeLoadAllEventsError" });
        }
    }

    function isElementVisible(element) {
        return element &&
               element.offsetWidth > 0 &&
               element.offsetHeight > 0 &&
               getComputedStyle(element).visibility !== 'hidden' &&
               getComputedStyle(element).display !== 'none';
    }

    // Запускаем
    clickShowMoreButton();
})();