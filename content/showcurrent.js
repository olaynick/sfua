// content/showcurrent.js

if (!window.__SFUA_SHOWCURRENT_LOADED__) {
    window.__SFUA_SHOWCURRENT_LOADED__ = true;

    console.log('SFUA ShowCurrent инициализирован (v3.3)');

    window.__SFUA__ = window.__SFUA__ || {};
    window.__SFUA__.globalSessionCounter = window.__SFUA__.globalSessionCounter || 0;
    window.__SFUA__.observer = null;

    const mainStyles = `
        [class^="btn_current_"] {
            color: #04b;
            cursor: pointer;
            font-size: 12px;
            margin-left: 10px;
            display: inline-block;
        }
        [class^="btn_current_"]:hover { opacity: 0.8; }
        [class^="btn_current_"][data-state="loading"] {
            color: #555;
            cursor: default;
            pointer-events: none;
        }
        [class^="btn_current_"][data-state="done"] {
            color: #0a0;
            cursor: default;
        }
    `;

    const ALLOWED_ELEMENTS = new Set([
        'tap', 'condition', 'open_screen', 'event', 'tabbar', 'authorization',
        'offline_tap', 'offline_open_screen', 'errorMetric', 'error', 'Deeplink',
        'tech', 'push', 'open_error_screen', 'deeplink'
    ]);

    function checkHasAnyClickable(sessionElement) {
        const buttons = sessionElement.querySelectorAll('span.link__inner');
        for (const btn of buttons) {
            const text = btn.textContent.trim();
            if (
                /^(Все \d+ событи[яей]|Все \d+)$/.test(text) ||
                /^\+\d+$/.test(text) ||
                ALLOWED_ELEMENTS.has(text)
            ) {
                return true;
            }
        }
        return false;
    }

    function addStyles(doc) {
        if (doc.querySelector('link[data-sfua-showcurrent]')) return;

        const link = doc.createElement('link');
        link.rel = 'stylesheet';
        link.href = chrome.runtime.getURL('content/styles/showcurrent.css');
        link.setAttribute('data-sfua-showcurrent', 'true');

        link.onerror = () => console.error('SFUA SHOWCURRENT: Не удалось загрузить CSS');
        link.onload = () => console.log('SFUA SHOWCURRENT: Стили загружены');

        doc.head.appendChild(link);
    }

    function processSessionElements(doc, isNew = false) {
        const selector = 'div.profile-session_js_inited:not([class*="current_parent_"])';
        const sessionElements = doc.querySelectorAll(selector);

        console.log(`SFUA SHOWCURRENT: Найдено ${sessionElements.length} сессий`);

        if (sessionElements.length === 0) return;

        let itemsProcessed = 0;
        sessionElements.forEach(element => {
            const className = `current_parent_${window.__SFUA__.globalSessionCounter}`;
            element.classList.add(className);

            const dateElement = element.querySelector('div.profile-session__date');
            if (!dateElement) {
                window.__SFUA__.globalSessionCounter++;
                return;
            }

            const hasAnyClickable = checkHasAnyClickable(element);

            if (hasAnyClickable) {
                if (!dateElement.nextElementSibling?.classList?.contains(`btn_current_${window.__SFUA__.globalSessionCounter}`)) {
                    const button = doc.createElement('div');
                    button.className = `btn_current_${window.__SFUA__.globalSessionCounter}`;
                    button.textContent = "Развернуть события сессии";
                    button.addEventListener('click', handleButtonClick);
                    dateElement.insertAdjacentElement('afterend', button);
                    itemsProcessed++;
                }
            } else {
                const nextEl = dateElement.nextElementSibling;
                if (!nextEl || !nextEl.classList?.contains('sfua_no_events_placeholder')) {
                    if (nextEl && nextEl.classList?.contains('sfua_no_events_placeholder')) {
                        nextEl.remove();
                    }
                    const placeholder = doc.createElement('div');
                    placeholder.className = 'sfua_no_events_placeholder';
                    placeholder.textContent = "События отсутствуют";
                    placeholder.style.cssText = 'display: inline-block; font-size: 12px; color: #a0aec0; margin-left: 10px; user-select: none;';
                    dateElement.insertAdjacentElement('afterend', placeholder);
                    itemsProcessed++;
                }
            }

            window.__SFUA__.globalSessionCounter++;
        });

        console.log(`SFUA SHOWCURRENT: Обработано сессий: ${itemsProcessed}`);
    }

    function setupMutationObserver(doc) {
        if (window.__SFUA__.observer) {
            window.__SFUA__.observer.disconnect();
        }

        window.__SFUA__.observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                if (mutation.addedNodes.length) {
                    processSessionElements(doc, true);
                }
            });
        });

        window.__SFUA__.observer.observe(doc.body, {
            childList: true,
            subtree: true
        });
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // === ЕДИНЫЙ МЕТОД КЛИКА С ДОБАВЛЕНИЕМ КЛАССА ===
    function simulateClickWithCheck(element) {
        if (!element || element.classList.contains('span_checked')) {
            return;
        }

        // 1. Кликаем
        element.click();

        // 2. Добавляем класс — как при ручном клике
        element.classList.add('span_checked');

        // 3. Можно отправить событие
        element.dispatchEvent(new CustomEvent('sfua:spanToggled', {
            bubbles: true,
            detail: { checked: true }
        }));
    }

    async function handleButtonClick(event) {
        event.preventDefault();
        event.stopPropagation();

        const button = event.currentTarget;
        const currentState = button.getAttribute('data-state');
        if (currentState === 'loading' || currentState === 'done') return;

        console.log(`SFUA SHOWCURRENT: Нажата кнопка ${button.className}`);
        button.setAttribute('data-state', 'loading');
        button.textContent = "Загрузка...";

        try {
            const sessionIndex = parseInt(button.className.split('_').pop());
            const parent = button.ownerDocument.querySelector(`.current_parent_${sessionIndex}`);
            if (!parent) throw new Error('Parent not found');

            // 1. "Все N событий"
            const allEventsButtons = [...parent.querySelectorAll('span.link__inner')]
            .filter(btn => 
                /^(Все \d+ событи[яей]|Все \d+)$/.test(btn.textContent.trim()) &&
                !btn.classList.contains('span_checked')
            );
            console.log(`"Все N": ${allEventsButtons.length}`);
            for (const btn of allEventsButtons) {
                simulateClickWithCheck(btn);
                console.log(`Клик по "${btn.textContent.trim()}"`);
                await delay(2000);
            }

            // 2. "+N"
            const plusButtons = [...parent.querySelectorAll('span.link__inner')]
                .filter(btn => 
                    /^\+\d+$/.test(btn.textContent.trim()) &&
                    !btn.classList.contains('span_checked')
                );
            console.log(`"+N": ${plusButtons.length}`);
            for (const btn of plusButtons) {
                simulateClickWithCheck(btn);
                console.log(`Клик по "${btn.textContent.trim()}"`);
                await delay(300 + Math.random() * 200);
            }

            if (plusButtons.length) await delay(1000);

            // 3. ALLOWED_ELEMENTS
            const otherButtons = [...parent.querySelectorAll('span.link__inner')]
                .filter(btn => 
                    ALLOWED_ELEMENTS.has(btn.textContent.trim()) &&
                    !btn.classList.contains('span_checked')
                );
            console.log(`Разрешённые: ${otherButtons.length}`);
            for (const btn of otherButtons) {
                simulateClickWithCheck(btn);
                console.log(`Клик по "${btn.textContent.trim()}"`);
                await delay(300 + Math.random() * 200);
            }

            button.setAttribute('data-state', 'done');
            button.textContent = "События загружены";

        } catch (error) {
            console.error('SFUA Error:', error);
            button.textContent = "Ошибка!";
            button.removeAttribute('data-state');
        }
    }

    function initForDocument(doc) {
        addStyles(doc);
        processSessionElements(doc);
        setupMutationObserver(doc);

        setTimeout(() => processSessionElements(doc, true), 3000);
    }

    function initialize() {
        initForDocument(document);

        window.addEventListener('unload', () => {
            if (window.__SFUA__.observer) window.__SFUA__.observer.disconnect();
        });
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(initialize, 0);
    } else {
        document.addEventListener('DOMContentLoaded', initialize);
        window.addEventListener('load', initialize);
    }
} else {
    console.log('SFUA SHOWCURRENT: Уже загружен');
}