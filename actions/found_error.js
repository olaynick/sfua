// actions/found_error.js

(function () {
    console.log("Скрипт 'Поиск ошибок: Ищу ошибки' запущен");

    const iframe = document.querySelector('iframe.iframe-integration__iframe');
    if (!iframe) {
        console.error("❌ iframe не найден");
        return;
    }

    let iframeDoc;
    try {
        iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    } catch (e) {
        console.error("❌ Нет доступа к iframe:", e);
        return;
    }

    if (!iframeDoc) {
        console.error("❌ iframeDoc пуст");
        return;
    }

    // === Находим ВСЕ элементы с красной полосой через ::after ===
    const allDescriptionElements = Array.from(iframeDoc.querySelectorAll(
        '.profile-session__event-description'
    ));

    const errorElements = allDescriptionElements.filter(el => {
        const afterStyle = getComputedStyle(el, '::after');
        const borderColor = afterStyle.borderTopColor ||
                           afterStyle.borderRightColor ||
                           afterStyle.borderBottomColor ||
                           afterStyle.borderLeftColor;
        return borderColor === 'rgb(255, 68, 62)' || borderColor === '#ff443e';
    });

    console.log(`✅ Найдено ${errorElements.length} ошибок (включая Крэш)`);

    if (window.sfuaErrorProgress) {
        window.sfuaErrorProgress.setStep(3, `Ищу ошибки: 0 из ${errorElements.length}`);
    }

    if (errorElements.length === 0) {
        if (window.sfuaErrorProgress && typeof window.sfuaErrorProgress.searchComplete === 'function') {
            window.sfuaErrorProgress.searchComplete();
        }
        return;
    }

    let crashCount = 0;

    for (let i = 0; i < errorElements.length; i++) {
        const el = errorElements[i];
        const eventElement = el.closest('.profile-session__event');

        if (!eventElement) continue;

        const errorId = `error_found_${Date.now()}_${i}`;
        eventElement.id = errorId;

        const nameEl = eventElement.querySelector('.profile-session__event-name');
        const nameText = nameEl?.textContent.trim() || 'ошибка';

        // Проверяем, является ли это "Крэш"
        const isCrash = el.classList.contains('profile-session__event-description_type_crash') ||
                       nameText === 'Крэш';

        if (isCrash) crashCount++;

        const sessionParent = eventElement.closest('.profile-session_js_inited');
        const dateEl = sessionParent?.querySelector('.profile-session__date');
        const fullDateText = dateEl?.textContent.trim() || 'дата не найдена';
        const shortDateText = fullDateText.split(' в ')[0].trim();

        const timeEl = eventElement.querySelector('.profile-session__event-time');
        const timeText = timeEl?.textContent.trim() || 'время не найдено';

        // === Добавляем результат сразу ===
        if (window.sfuaErrorProgress) {
            window.sfuaErrorProgress.addResult({
                id: errorId,
                shortText: `${shortDateText} в ${timeText}`,
                fullText: nameText,
                isCrash: isCrash
            });
        }

        // === Обновляем прогресс ===
        if (window.sfuaErrorProgress) {
            window.sfuaErrorProgress.setStep(3, `Ищу ошибки: ${i + 1} из ${errorElements.length}`);
        }
    }

    // === Вызываем завершение ===
    if (window.sfuaErrorProgress && typeof window.sfuaErrorProgress.searchComplete === 'function') {
        window.sfuaErrorProgress.searchComplete(errorElements.length, crashCount);
    }
})();