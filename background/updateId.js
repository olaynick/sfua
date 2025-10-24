(function initIdUpdater() {
    console.log('[SFUA] Инициализация редактора ID');

    // Функция для инжекта стилей
    const injectStyles = (iframeDoc) => {
        return new Promise((resolve) => {
            const styleLink = iframeDoc.createElement('link');
            styleLink.rel = 'stylesheet';
            styleLink.href = chrome.runtime.getURL('background/styles/updateId.css');
            styleLink.onload = resolve;
            iframeDoc.head.appendChild(styleLink);
        });
    };

    // Создаём элемент для ввода ID
    const createIdInput = () => {
        const container = document.createElement('div');
        container.className = 'sfua-id-container';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'sfua-id-input';
        input.placeholder = 'ID Appmetrica';

        const button = document.createElement('button');
        button.className = 'sfua-id-submit';
        button.disabled = true;
        button.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
        `;

        container.appendChild(input);
        container.appendChild(button);
        return { container, input, button };
    };

    // Функция для обновления URL с новым ID
    const updateUrlWithNewId = (newId) => {
        const currentUrl = new URL(window.location.href);
        
        // Обновляем оба параметра
        currentUrl.searchParams.set('profileId', newId);
        currentUrl.searchParams.set('deviceId', newId);
        
        // Переходим по новому URL
        window.location.href = currentUrl.toString();
    };

    // Основная функция инициализации
    const init = async () => {
        const iframe = document.querySelector('iframe.iframe-integration__iframe');
        if (!iframe) {
            console.log('[SFUA] Iframe не найден, повтор через 1с');
            setTimeout(init, 1000);
            return;
        }

        try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            
            // Инжектим стили
            await injectStyles(iframeDoc);
            
            const profileIdElement = iframeDoc.querySelector('.page-user-profile__profile-id');
            
            if (!profileIdElement) {
                console.log('[SFUA] Элемент ID не найден, повтор через 1с');
                setTimeout(init, 1000);
                return;
            }

            if (iframeDoc.querySelector('.sfua-id-container')) {
                return;
            }

            console.log('[SFUA] Найден элемент ID, добавляем поле ввода');
            
            const { container, input, button } = createIdInput();
            profileIdElement.parentNode.insertBefore(container, profileIdElement.nextSibling);

            // Получаем текущий ID из URL
            const getCurrentId = () => {
                const urlParams = new URLSearchParams(window.location.search);
                return urlParams.get('profileId') || '';
            };

            const currentId = getCurrentId();

            const checkId = () => {
                const newId = input.value.trim();

                if (!newId) {
                    button.disabled = true;
                    input.classList.remove('error', 'warning');
                    return;
                }

                if (newId === currentId) {
                    input.classList.add('warning');
                    input.classList.remove('error');
                    button.disabled = true;
                } else if (!/^\d{15,}$/.test(newId)) {
                    input.classList.add('error');
                    input.classList.remove('warning');
                    button.disabled = true;
                } else {
                    input.classList.remove('error', 'warning');
                    button.disabled = false;
                }
            };

            // Обработчик изменения input
            input.addEventListener('input', checkId);

            // Обработчик клика по кнопке
            button.addEventListener('click', () => {
                if (!button.disabled) {
                    updateUrlWithNewId(input.value.trim());
                }
            });

            // Обработчик нажатия Enter в input
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !button.disabled) {
                    updateUrlWithNewId(input.value.trim());
                }
            });

        } catch (error) {
            console.error('[SFUA] Ошибка инициализации:', error);
            setTimeout(init, 1000);
        }
    };

    // Запускаем с небольшой задержкой
    setTimeout(init, 100);
})();