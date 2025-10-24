// progress_error.js

(function () {
    console.log("Progress Error: Инициализация");

    // === Удаляем старые контейнеры ===
    const existingResultContainer = document.querySelector('.sfua_result_container');
    if (existingResultContainer) {
        existingResultContainer.style.transform = 'scale(0)';
        existingResultContainer.style.opacity = '0';
        setTimeout(() => existingResultContainer.remove(), 300);
    }

    const existingContainer = document.querySelector('.sfua_error_container');
    if (existingContainer) {
        existingContainer.style.transform = 'scale(0)';
        existingContainer.style.opacity = '0';
        setTimeout(() => existingContainer.remove(), 300);
    }

    // === Загружаем стили ===
    const linkStyle = document.createElement('link');
    linkStyle.rel = 'stylesheet';
    linkStyle.href = chrome.runtime.getURL('progress_error.css');
    document.head.appendChild(linkStyle);

    const targetContainer = document.querySelector('.screen__header');
    if (!targetContainer) {
        console.warn("⚠️ .screen__header не найден");
        return;
    }

    const container = document.createElement('div');
    container.className = 'sfua_error_container';
    container.style.cssText = `
        transform: scale(0);
        opacity: 0;
        transform-origin: top center;
        transition: transform 0.3s ease, opacity 0.3s ease;
    `;

    targetContainer.parentNode.insertBefore(container, targetContainer.nextSibling);

    // === Кнопка "следить" — стрелка вниз ===
    const followBtn = document.createElement('div');
    followBtn.style.cssText = `
        position: absolute;
        top: 8px;
        left: 8px;
        width: 26px;
        height: 26px;
        cursor: pointer;
        opacity: 0.7;
        transition: color 0.2s ease, opacity 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
    `;

    const arrowSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="21" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <polyline points="19 12 12 19 5 12"></polyline>
        </svg>
    `;
    followBtn.innerHTML = arrowSvg;

    let isFollowing = false;

    function updateFollowBtn(follow) {
        followBtn.style.color = follow ? '#AB4E52' : '#a0aec0';
        followBtn.style.opacity = follow ? '1' : '0.7';
        isFollowing = follow;
        if (follow) {
            container.classList.add('following');
        } else {
            container.classList.remove('following');
        }
    }

    followBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        const newFollow = !isFollowing;
        console.log(`[Progress Error] Follow mode: ${newFollow}`);
        updateFollowBtn(newFollow);
        await chrome.storage.local.set({ sfua_error_followMode: newFollow });
    });

    container.appendChild(followBtn);

    // === Крестик — справа ===
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = `
        position: absolute;
        top: 6px;
        right: 8px;
        width: 26px;
        height: 26px;
        background: none;
        border: none;
        font-size: 26px;
        cursor: not-allowed;
        color: #718096;
        opacity: 0.4;
        z-index: 10001;
    `;
    closeBtn.setAttribute('title', 'Закрыть можно только после завершения поиска');

    closeBtn.addEventListener('click', (e) => {
        if (closeBtn.style.cursor === 'not-allowed') {
            e.stopPropagation();
            e.preventDefault();
        }
    });

    container.appendChild(closeBtn);

    // === Верхняя часть: круги, текст ===
    const header = document.createElement('div');
    header.className = 'progress_header';

    const circlesContainer = document.createElement('div');
    circlesContainer.className = 'progress_circles';

    for (let i = 0; i < 3; i++) {
        const wrapper = document.createElement('div');
        wrapper.className = 'circle_wrapper';
        const circle = document.createElement('div');
        circle.className = 'progress_circle';
        wrapper.appendChild(circle);
        circlesContainer.appendChild(wrapper);
    }

    const operationText = document.createElement('span');
    operationText.className = 'current_operation';
    operationText.textContent = 'Загружаю сессии';

    header.appendChild(circlesContainer);
    header.appendChild(operationText);
    container.appendChild(header);

    // === Результаты ===
    const resultsContainer = document.createElement('div');
    resultsContainer.className = 'results_container';
    container.appendChild(resultsContainer);

    // === Плавное появление ===
    setTimeout(() => {
        container.style.transform = 'scale(1)';
        container.style.opacity = '1';
    }, 100);

    // === Загрузка состояния followMode ===
    chrome.storage.local.get(['sfua_error_followMode'], (result) => {
        const follow = !!result.sfua_error_followMode;
        console.log(`[Progress Error] Загружено состояние followMode: ${follow}`);
        updateFollowBtn(follow);
    });

    // === Логика прокрутки ===
    function handleScroll() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        if (isFollowing && scrollTop >= 150) {
            container.classList.add('pinned');
        } else {
            container.classList.remove('pinned');
        }
    }

    window.addEventListener('scroll', handleScroll);
    handleScroll();

    // === Функция для перезагрузки modal_error.js ===
    function injectScriptAgain() {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('modal_error.js');
            script.onload = () => {
                console.log('✅ modal_error.js перезагружен');
                resolve();
            };
            script.onerror = (err) => {
                console.error('❌ Ошибка загрузки modal_error.js', err);
                resolve();
            };
            document.head.appendChild(script);
        });
    }

    // === SVG иконки глаз ===
    const EYE_ICON_GRAY = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
        </svg>
    `;

    const EYE_ICON_BLUE = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3182ce" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
        </svg>
    `;

    const EYE_ICON_RED = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#AB4E52" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
        </svg>
    `;

    // === Глобальный интерфейс ===
    window.sfuaErrorProgress = {
        container,
        circles: container.querySelectorAll('.progress_circle'),
        text: operationText,
        resultsContainer,

        setStep(step, text) {
            this.circles.forEach((c, i) => {
                c.style.width = '20px';
                c.style.height = '20px';
                c.style.backgroundColor = '#edf2f7';
            });
            for (let i = 0; i < step - 1; i++) {
                this.circles[i].style.backgroundColor = '#AB4E52';
            }
            if (step >= 1 && step <= 3) {
                const c = this.circles[step - 1];
                c.style.width = '10px';
                c.style.height = '10px';
                c.style.backgroundColor = '#AB4E52';
            }
            if (text) this.text.textContent = text;
        },

        // Вызывается из modal_error.js при скролле
        onScrollFromModal(id) {
            const buttons = this.resultsContainer.querySelectorAll('.sfua_error_result_item');
            for (const btn of buttons) {
                const eyeIcon = btn.querySelector('.eye-icon');
                if (eyeIcon && eyeIcon.getAttribute('data-id') === id) {
                    eyeIcon.innerHTML = EYE_ICON_BLUE;
                    break;
                }
            }
        },

addResult(result) {
    const link = document.createElement('div');
    link.className = 'sfua_error_result_item';
    link.style.cssText = `
        padding: 5px 10px;
        background-color: #f7fafc;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 500;
        color: #4a5568;
        cursor: pointer;
        white-space: nowrap;
        opacity: 0;
        transform: translateY(4px);
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s ease;
        user-select: none;
    `;

    link.textContent = result.shortText;

    if (result.isCrash) {
        link.style.color = '#AB4E52';
        link.style.fontWeight = '600';
        link.setAttribute('is-crash', 'true');
    }

    // === Иконка "глаз" ===
    const eyeIcon = document.createElement('span');
    eyeIcon.className = 'eye-icon';
    eyeIcon.style.cssText = `
        display: inline-flex;
        align-items: center;
        opacity: 0;
        width: 0;
        height: 0;
        overflow: hidden;
        transition: width 0.2s ease, height 0.2s ease, opacity 0.2s ease;
    `;
    eyeIcon.setAttribute('title', 'Просмотрено');
    eyeIcon.innerHTML = EYE_ICON_GRAY;
    eyeIcon.setAttribute('data-id', result.id);
    link.appendChild(eyeIcon);

    let clickTimer = null;
    let isViewed = false;

    link.addEventListener('click', (e) => {
        e.stopPropagation();

        // ❌ Если это двойной клик — сбрасываем и выходим
        if (e.detail === 2) {
            if (clickTimer) {
                clearTimeout(clickTimer);
                clickTimer = null;
            }

            // Сбрасываем состояние
            eyeIcon.style.width = '0';
            eyeIcon.style.height = '0';
            eyeIcon.style.opacity = '0';
            eyeIcon.innerHTML = '';
            isViewed = false;

            return; // Не запускаем одинарный клик
        }

        // ✅ Одинарный клик — запускаем с задержкой
        if (!clickTimer) {
            clickTimer = setTimeout(() => {
                // Только если не было двойного клика
                if (!isViewed) {
                    eyeIcon.style.width = '14px';
                    eyeIcon.style.height = '14px';
                    eyeIcon.style.opacity = '0.7';
                    isViewed = true;
                }

                if (result.isCrash) {
                    // Прокрутка к крэшу
                    const iframe = document.querySelector('iframe.iframe-integration__iframe');
                    if (!iframe) return;

                    let iframeDoc;
                    try {
                        iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                    } catch (e) {
                        return;
                    }

                    if (!iframeDoc) return;

                    const target = iframeDoc.getElementById(result.id);
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

                    eyeIcon.innerHTML = EYE_ICON_RED;
                } else {
                    // Открываем модалку
                    window.sfuaErrorModal.showModal(result.fullText, result.id);
                    eyeIcon.innerHTML = EYE_ICON_GRAY;
                }

                clickTimer = null;
            }, 300);
        }
    });

    this.resultsContainer.appendChild(link);

    setTimeout(() => {
        link.style.opacity = '1';
        link.style.transform = 'translateY(0)';
    }, 10);
},

        searchComplete(total = 0, crashCount = 0) {
            this.circles.forEach(c => {
                c.style.width = '10px';
                c.style.height = '10px';
                c.style.backgroundColor = '#AB4E52';
            });

            const results = this.resultsContainer.children.length;
            if (results === 0) {
                this.text.textContent = "Поиск завершён. Ошибок не найдено";
            } else {
                this.text.textContent = '';
                this.text.appendChild(document.createTextNode(`Поиск завершён. Найдено ошибок: ${results}`));

                if (crashCount > 0) {
                    this.text.appendChild(document.createTextNode(' из них '));

                    const crashSpan = document.createElement('span');
                    crashSpan.textContent = crashCount;
                    crashSpan.style.color = '#AB4E52';
                    crashSpan.style.fontWeight = '600';

                    this.text.appendChild(crashSpan);
                    this.text.appendChild(document.createTextNode(' Crash'));
                }
            }

            // === Разблокируем крестик ===
            closeBtn.style.cursor = 'pointer';
            closeBtn.style.opacity = '0.7';
            closeBtn.removeAttribute('title');
            closeBtn.title = 'Закрыть';

            closeBtn.onclick = null;
            closeBtn.addEventListener('click', () => {
                console.log('[Progress Error] Контейнер закрыт');
                container.style.transform = 'scale(0)';
                container.style.opacity = '0';
                setTimeout(() => container.remove(), 300);
            });

            try {
                chrome.runtime.sendMessage({ action: "searchCompleted" });
            } catch (e) {
                console.warn("SFUA: Не удалось отправить searchCompleted", e);
            }
        }
    };

    window.sfuaErrorProgress.setStep(1, "Загружаю сессии");

    // Инжектируем modal_error.js при старте
    injectScriptAgain().catch(err => console.error('Ошибка первой загрузки modal_error.js', err));
})();