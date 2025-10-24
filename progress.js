// progress.js

(function () {
    console.log("Progress UI: Инициализация (в родительской странице)");

    // === Удаляем старые контейнеры ===
    const existingErrorContainer = document.querySelector('.sfua_error_container');
    if (existingErrorContainer) {
        existingErrorContainer.style.transform = 'scale(0)';
        existingErrorContainer.style.opacity = '0';
        setTimeout(() => existingErrorContainer.remove(), 300);
    }

    const existingContainer = document.querySelector('.sfua_result_container');
    if (existingContainer) {
        existingContainer.style.transform = 'scale(0)';
        existingContainer.style.opacity = '0';
        setTimeout(() => existingContainer.remove(), 300);
    }

    // === Загружаем стили ===
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = chrome.runtime.getURL('progress.css');
    document.head.appendChild(style);

    // === Контейнер ===
    const targetContainer = document.querySelector('.screen__header');
    if (!targetContainer) {
        console.warn("⚠️ .screen__header не найден");
        return;
    }

    const container = document.createElement('div');
    container.className = 'sfua_result_container';
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
        followBtn.style.color = follow ? '#4299e1' : '#a0aec0';
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
        console.log(`[Progress] Follow mode: ${newFollow}`);
        updateFollowBtn(newFollow);
        await chrome.storage.local.set({ sfua_followMode: newFollow });
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

    for (let i = 0; i < 4; i++) {
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
    chrome.storage.local.get(['sfua_followMode'], (result) => {
        const follow = !!result.sfua_followMode;
        console.log(`[Progress] Загружено состояние followMode: ${follow}`);
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

    // === SVG иконка глаза (голубой) ===
    const EYE_ICON = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3182ce" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
        </svg>
    `;

    // === Глобальный интерфейс ===
    window.sfuaProgress = {
        container,
        circles: container.querySelectorAll('.progress_circle'),
        operationText,
        resultsContainer,

        setStep(step, text) {
            this.circles.forEach((c, i) => {
                c.style.width = '20px';
                c.style.height = '20px';
                c.style.backgroundColor = '#edf2f7';
            });
            for (let i = 0; i < step - 1; i++) {
                this.circles[i].style.backgroundColor = '#4299e1';
            }
            if (step >= 1 && step <= 4) {
                const c = this.circles[step - 1];
                c.style.width = '10px';
                c.style.height = '10px';
                c.style.backgroundColor = '#4299e1';
            }
            if (text) this.operationText.textContent = text;
        },

        startProgress(baseText, total) {
            this.operationText.textContent = baseText;
            const progressText = document.createElement('span');
            progressText.style.cssText = `
                display: inline;
                margin-left: 6px;
                opacity: 0;
                transition: opacity 0.3s ease;
            `;
            this.operationText.appendChild(progressText);

            setTimeout(() => {
                progressText.textContent = `1 из ${total}`;
                progressText.style.opacity = '1';
            }, 300);

            return (current) => {
                if (progressText.parentNode) {
                    progressText.textContent = `${current} из ${total}`;
                }
            };
        },

        updateProgress(updateFn) {
            if (typeof updateFn === 'function') {
                updateFn();
            }
        },

        addResult(result) {
            const link = document.createElement('div');
            link.className = 'sfua_result_item';
            link.style.cssText = `
                padding: 5px 10px;
                background-color: #edf2f7;
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

            link.textContent = `${result.shortDateText} ${result.timeText}`;

            // === Иконка "глаз" — изначально скрыта ===
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
            eyeIcon.innerHTML = EYE_ICON;
            link.appendChild(eyeIcon);

            let isViewed = false;
            let clickTimer = null;

            link.addEventListener('click', (e) => {
                e.stopPropagation();

                // Двойной клик — сбрасываем
                if (e.detail === 2) {
                    if (clickTimer) {
                        clearTimeout(clickTimer);
                        clickTimer = null;
                    }

                    eyeIcon.style.width = '0';
                    eyeIcon.style.height = '0';
                    eyeIcon.style.opacity = '0';
                    isViewed = false;
                    return;
                }

                // Одинарный клик
                if (clickTimer) {
                    clearTimeout(clickTimer);
                    clickTimer = null;
                    return;
                }

                clickTimer = setTimeout(() => {
                    if (!isViewed) {
                        eyeIcon.style.width = '14px';
                        eyeIcon.style.height = '14px';
                        eyeIcon.style.opacity = '0.7';
                        isViewed = true;
                    }

                    // Прокрутка к событию
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

                    requestAnimationFrame(() => {
                        try {
                            target.scrollIntoView({
                                behavior: 'smooth',
                                block: 'center'
                            });
                        } catch (e) {}
                    });

                    clickTimer = null;
                }, 300);
            });

            this.resultsContainer.appendChild(link);

            setTimeout(() => {
                link.style.opacity = '1';
                link.style.transform = 'translateY(0)';
            }, 10);
        },

        searchComplete() {
            this.circles.forEach(c => {
                c.style.width = '10px';
                c.style.height = '10px';
                c.style.backgroundColor = '#4299e1';
            });

            const resultCount = this.resultsContainer.children.length;
            this.operationText.textContent = resultCount > 0
                ? `Поиск завершён. Найдено совпадений: ${resultCount}`
                : "Поиск завершён. Искомые события не найдены";

            closeBtn.style.cursor = 'pointer';
            closeBtn.style.opacity = '0.7';
            closeBtn.removeAttribute('title');
            closeBtn.title = 'Закрыть';

            closeBtn.addEventListener('click', () => {
                console.log('[Progress] Контейнер закрыт');
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

    window.sfuaProgress.setStep(1, "Загружаю сессии");

    console.log("Progress UI: Готов (в родительской странице)");
})();