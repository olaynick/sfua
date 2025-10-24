// modal_error.js

(function () {
    console.log("🔧 modal_error.js: Инициализация");

    let modal = null;
    let currentId = null;
    let hasScrolledFromModal = false;

    function getContainerBottom() {
        const container = document.querySelector('.sfua_error_container');
        if (!container) return 400;
        const rect = container.getBoundingClientRect();
        return rect.bottom;
    }

    function updateModalPosition() {
        if (!modal) return;
        const left = window.innerWidth * 0.25;
        modal.style.top = `${getContainerBottom() + 30}px`;
        modal.style.left = `${left}px`;
    }

    function createModal() {
        if (modal) return;

        modal = document.createElement('div');
        modal.className = 'sfua_error_modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 25%;
            transform: scale(0);
            max-width: 700px;
            min-width: 200px;
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            padding: 16px;
            font-size: 14px;
            color: #4a5568;
            z-index: 2147483647;
            white-space: pre-wrap;
            word-break: break-word;
            line-height: 1.5;
            transform-origin: top;
            transition: 
                transform 0.3s ease,
                top 0.3s ease,
                left 0.3s ease,
                opacity 0.3s ease;
            opacity: 0;
            display: flex;
            align-items: flex-start;
            gap: 16px;
        `;

        const textEl = document.createElement('div');
        textEl.style.flex = '1';
        modal.appendChild(textEl);

        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 10px;
            align-items: center;
        `;
        modal.appendChild(buttonsContainer);

        // === Кнопка "Скролл к ошибке" ===
        const scrollBtn = document.createElement('div');
        scrollBtn.style.cssText = `
            width: 40px;
            height: 40px;
            border-radius: 20%;
            background-color: rgb(237, 242, 247);
            color: rgb(74, 85, 104);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: background-color 0.2s ease;
        `;
        scrollBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <polyline points="19 12 12 19 5 12"></polyline>
            </svg>
        `;
        scrollBtn.addEventListener('click', () => {
            const iframe = document.querySelector('iframe.iframe-integration__iframe');
            if (!iframe) return;

            let iframeDoc;
            try {
                iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            } catch (e) {
                return;
            }

            if (!iframeDoc) return;

            const target = iframeDoc.getElementById(currentId);
            if (!target) return;

            target.style.transition = 'background-color 0.3s ease';
            target.style.backgroundColor = '#fff4f4';
            setTimeout(() => {
                target.style.backgroundColor = '';
            }, 5000);

            requestAnimationFrame(() => {
                try {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });
                } catch (e) {}
            });

            hasScrolledFromModal = true;
            // Уведомляем progress, что был скролл
            window.sfuaErrorProgress?.onScrollFromModal?.(currentId);
            hideModal();
        });
        buttonsContainer.appendChild(scrollBtn);

        // === Кнопка "Копировать" ===
        const copyBtn = document.createElement('div');
        copyBtn.style.cssText = `
            width: 40px;
            height: 40px;
            border-radius: 20%;
            background-color: rgb(237, 242, 247);
            color: rgb(74, 85, 104);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: background-color 0.2s ease;
        `;
        copyBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
        `;
        copyBtn.addEventListener('click', async () => {
            const text = modal.querySelector('div').textContent;
            try {
                await navigator.clipboard.writeText(text);
                copyBtn.style.backgroundColor = '#48bb78';
                copyBtn.style.color = 'white';
                setTimeout(() => {
                    copyBtn.style.backgroundColor = 'rgb(237, 242, 247)';
                    copyBtn.style.color = 'rgb(74, 85, 104)';
                }, 1000);
            } catch (err) {
                console.error('Не удалось скопировать', err);
            }
        });
        buttonsContainer.appendChild(copyBtn);

        document.body.appendChild(modal);
        updateModalPosition();
    }

    function showModal(text, id) {
        if (currentId === id) return;

        if (modal && currentId !== id) {
            // Анимация вспышки при смене текста
            const textEl = modal.querySelector('div');
            textEl.style.opacity = '0.3';
            setTimeout(() => {
                textEl.textContent = text;
                textEl.style.opacity = '1';
            }, 50);
            currentId = id;
            hasScrolledFromModal = false;
            updateModalPosition();
            return;
        }

        hideModal();
        currentId = id;
        hasScrolledFromModal = false;

        setTimeout(() => {
            createModal();
            const textEl = modal.querySelector('div');
            textEl.textContent = text;
            updateModalPosition();
            modal.style.opacity = '1';
            modal.style.transform = 'scale(1)';
        }, 10);
    }

    function hideModal() {
        currentId = null;
        hasScrolledFromModal = false;

        if (modal) {
            modal.style.transform = 'scale(0)';
            modal.style.opacity = '0';

            setTimeout(() => {
                if (modal) {
                    modal.remove();
                    modal = null;
                }
            }, 300);
        }
    }

    // === Слушатели для обновления позиции ===
    function onScrollOrResize() {
        if (modal) {
            updateModalPosition();
        }
    }

    function setupListeners() {
        window.addEventListener('scroll', onScrollOrResize, { passive: true });
        window.addEventListener('resize', onScrollOrResize, { passive: true });

        const container = document.querySelector('.sfua_error_container');
        if (container) {
            const resizeObserver = new ResizeObserver(onScrollOrResize);
            resizeObserver.observe(container);
        }
    }

    // === Клик вне — закрыть, кроме кнопок прогресса ===
    document.addEventListener('click', (e) => {
        if (!modal) return;

        const progressButton = e.target.closest('.sfua_error_result_item');
        if (progressButton) {
            // Клик по кнопке → обновляем, не закрываем
            const fullText = progressButton.textContent.replace(/👁️.*$/, '').trim();
            const eyeIcon = progressButton.querySelector('.eye-icon');
            const id = eyeIcon?.getAttribute('data-id');
            if (id) {
                showModal(fullText, id);
            }
            return;
        }

        if (!modal.contains(e.target)) {
            hideModal();
        }
    });

    // === Нажатие Esc — закрыть модалку ===
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideModal();
        }
    });

    // === Глобальный интерфейс ===
    window.sfuaErrorModal = {
        showModal,
        hideModal,
        onButtonEnter() {
            if (modal) {
                updateModalPosition();
            }
        },
        onButtonLeave() {
            // не закрываем
        },
        hasScrolled() {
            return hasScrolledFromModal;
        }
    };

    setupListeners();
    console.log("✅ modal_error.js: Готов");
})();