// content/usertimezone.js

(function () {
    // Защита от двойного выполнения
    if (window.sfua_usertimezone_loaded) {
        console.log('[SFUA TIMEZONE] Уже загружен — пропускаем');
        return;
    }
    window.sfua_usertimezone_loaded = true;

    const CONFIG = {
        logPrefix: '[SFUA TIMEZONE]',
        checkInterval: 200,
        maxRetries: 50,
        animationDuration: 700, // 0.7s
        animationEasing: 'cubic-bezier(0.4, 0, 0.2, 1)'
    };

    let timezoneOffset = null;
    let isInitialized = false;
    let observer = null;
    let interval = null;

    async function initTimezoneHandler() {
        if (isInitialized) {
            console.log(`${CONFIG.logPrefix} Уже инициализирован — пропускаем`);
            return;
        }

        console.log(`${CONFIG.logPrefix} Инициализация`);

        try {
            // ✅ Ищем .userinfo_timezone ВО ВСЕМ документе (включая iframe и родитель)
            timezoneOffset = await findTimezoneOffset();
            if (timezoneOffset === null) {
                console.error(`${CONFIG.logPrefix} Не удалось получить часовой пояс`);
                return;
            }

            console.log(`${CONFIG.logPrefix} Найдена разница в часовом поясе: ${timezoneOffset} от МСК`);

            // ✅ Начинаем обработку
            processExistingDates();
            setupObservation();

            isInitialized = true;

        } catch (error) {
            console.error(`${CONFIG.logPrefix} Ошибка инициализации:`, error);
        }
    }

    // ✅ Ищем .userinfo_timezone везде: в iframe и в родительском документе
    function findTimezoneOffset() {
        return new Promise((resolve) => {
            let retries = 0;

            const tryFind = () => {
                if (isInitialized) {
                    resolve(null);
                    return;
                }

                // 1. Ищем в iframe
                const iframe = document.querySelector('iframe.iframe-integration__iframe');
                if (iframe && iframe.contentDocument) {
                    const el = iframe.contentDocument.querySelector('.userinfo_timezone');
                    if (el) {
                        const offset = parseTimezone(el.textContent);
                        if (offset !== null) {
                            resolve(offset);
                            return;
                        }
                    }
                }

                // 2. Ищем в родительском документе
                const elInParent = document.querySelector('.userinfo_timezone');
                if (elInParent) {
                    const offset = parseTimezone(elInParent.textContent);
                    if (offset !== null) {
                        resolve(offset);
                        return;
                    }
                }

                // 3. Повторяем
                if (retries++ < CONFIG.maxRetries) {
                    setTimeout(tryFind, CONFIG.checkInterval);
                } else {
                    console.warn(`${CONFIG.logPrefix} Элемент .userinfo_timezone нигде не найден`);
                    resolve(null);
                }
            };

            tryFind();
        });
    }

    function parseTimezone(text) {
        if (!text) return null;
        const cleaned = text.trim();
        const sign = cleaned.includes('-') ? -1 : 1;
        const numbers = cleaned.replace(/\D/g, '');
        const value = parseInt(numbers);
        return isNaN(value) ? null : sign * value;
    }

    function processExistingDates() {
        const dateElements = document.querySelectorAll('.profile-session__date');
        console.log(`${CONFIG.logPrefix} Найдено ${dateElements.length} элементов с датой/временем сессии`);
        dateElements.forEach(el => {
            if (!el.querySelector('.user_sessiontime')) {
                updateDateElement(el);
            }
        });
    }

    function updateDateElement(element) {
        if (element.dataset.timezoneProcessed) return;
        const originalText = element.textContent.trim();
        if (!originalText.includes(' в ')) return;

        try {
            const adjustedTime = adjustTime(originalText);
            const span = document.createElement('span');
            span.className = 'user_sessiontime';
            span.textContent = ` (${adjustedTime})`;
            span.title = 'Время сессии в часовом поясе пользователя';

            // === Стили для анимации справа налево ===
            span.style.cssText = `
                font-size: 18px;
                font-weight: 700;
                color: rgba(0, 0, 0, .35);
                margin-left: 4px;
                cursor: default;
                display: inline-block;
                transform: scale(0);
                transform-origin: right center; /* Ключ: масштабирование справа */
                transition: transform ${CONFIG.animationDuration}ms ${CONFIG.animationEasing};
            `;

            element.appendChild(span);
            element.dataset.timezoneProcessed = 'true';
            console.log(`${CONFIG.logPrefix} Добавлено время пользователя: ${adjustedTime}`);

            // === АНИМАЦИЯ: scale(0) → scale(1) ===
            requestAnimationFrame(() => {
                setTimeout(() => {
                    span.style.transform = 'scale(1)';
                }, 10);
            });

        } catch (e) {
            console.error(`${CONFIG.logPrefix} Ошибка обработки даты:`, e);
        }
    }

    function adjustTime(dateString) {
        const MONTHS = {
            'Января': 0, 'Февраля': 1, 'Марта': 2, 'Апреля': 3,
            'Мая': 4, 'Июня': 5, 'Июля': 6, 'Августа': 7,
            'Сентября': 8, 'Октября': 9, 'Ноября': 10, 'Декабря': 11
        };

        const [datePart, timePart] = dateString.split(' в ');
        const [hours, minutes] = timePart.split(':').map(Number);
        const now = new Date();
        let date = new Date();

        if (datePart === 'Сегодня') {
            // оставляем текущую дату
        } else if (datePart === 'Вчера') {
            date.setDate(date.getDate() - 1);
        } else {
            const [day, monthName] = datePart.split(' ');
            date.setMonth(MONTHS[monthName], parseInt(day));
            date.setFullYear(now.getFullYear());
        }

        date.setHours(hours, minutes, 0, 0);
        const adjustedDate = new Date(date.getTime() + timezoneOffset * 3600000);
        return `${adjustedDate.getHours().toString().padStart(2, '0')}:${adjustedDate.getMinutes().toString().padStart(2, '0')}`;
    }

    function setupObservation() {
        if (observer) observer.disconnect();
        if (interval) clearInterval(interval);

        observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.matches('.profile-session__date')) {
                            updateDateElement(node);
                        }
                        node.querySelectorAll('.profile-session__date').forEach(updateDateElement);
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        interval = setInterval(() => {
            if (isInitialized) {
                const newElements = document.querySelectorAll('.profile-session__date:not([data-timezone-processed])');
                if (newElements.length > 0) {
                    console.log(`${CONFIG.logPrefix} Найдено ${newElements.length} новых элементов`);
                    newElements.forEach(updateDateElement);
                }
            }
        }, CONFIG.checkInterval);

        console.log(`${CONFIG.logPrefix} Наблюдение за DOM запущено`);
    }

    function start() {
        if (document.readyState === 'complete') {
            initTimezoneHandler();
        } else {
            document.addEventListener('DOMContentLoaded', initTimezoneHandler);
        }

        // Принудительная проверка
        setTimeout(() => {
            if (!isInitialized && !document.querySelector('.user_sessiontime')) {
                console.log(`${CONFIG.logPrefix} Принудительная проверка`);
                initTimezoneHandler();
            }
        }, 3000);
    }

    start();

})();