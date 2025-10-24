// sync_manual_clicks.js

(function () {
    console.log('SFUA: sync_manual_clicks.js — запущен');

    // === Обработчик кликов по span.link__inner ===
    document.addEventListener('click', function (e) {
        const target = e.target;

        // Проверяем, что это span с классом link__inner
        if (target.classList.contains('link__inner')) {
            e.preventDefault();
            e.stopPropagation();

            // Переключаем класс span_checked
            if (target.classList.contains('span_checked')) {
                target.classList.remove('span_checked');
            } else {
                target.classList.add('span_checked');
            }

            // 🔔 Опционально: можно отправить событие для других скриптов
            // Например, если другие скрипты должны реагировать
            target.dispatchEvent(new CustomEvent('sfua:spanToggled', {
                bubbles: true,
                detail: { checked: target.classList.contains('span_checked') }
            }));
        }
    });
    const observer = new MutationObserver(() => {
        // Можно переназначить обработчики, если элементы подгружаются динамически
        // Но в данном случае — достаточно делегирования на document
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    console.log('SFUA: Обработчик кликов по link__inner активен');
})();