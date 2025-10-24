// background/userinfo.js

(function () {
    // Проверяем, не загружен ли уже скрипт
    if (window.sfua_userinfo_loaded) {
        console.log('[SFUA] userinfo.js уже загружен — пропускаем');
        return;
    }
    window.sfua_userinfo_loaded = true;

    // Глобальная переменная для хранения часовых поясов
    let TIMEZONES = null;

    // Загружаем timezones.json
    async function loadTimezones() {
        try {
            const url = chrome.runtime.getURL('data/timezones.json');
            const response = await fetch(url);
            if (!response.ok) throw new Error('Не удалось загрузить timezones.json');
            TIMEZONES = await response.json();
            console.log('[SFUA] Часовые пояса загружены');
        } catch (error) {
            console.error('[SFUA] Ошибка загрузки timezones.json:', error);
            TIMEZONES = {}; // fallback
        }
    }

    // Инициализация
    async function initializeUserInfo() {
        await loadTimezones();

        const iframe = document.querySelector('.iframe-integration__iframe');
        if (!iframe) {
            setTimeout(initializeUserInfo, 500);
            return;
        }

        const iframeDocument = iframe.contentDocument || iframe.contentWindow.document;

        // === Плавное исчезновение аватара ===
        const profileImage = iframeDocument.querySelector('div.page-user-profile__profile-image');
        if (profileImage) {
            profileImage.style.transition = 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
            void profileImage.offsetWidth;
            profileImage.style.transform = 'scale(0)';
            setTimeout(() => {
                profileImage.style.display = 'none';
            }, 600);
        }

        const profileTableElement = iframeDocument.querySelector('table.profile-info-table__table');
        if (!profileTableElement) {
            setTimeout(initializeUserInfo, 500);
            return;
        }

        // Подключаем стили
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = chrome.runtime.getURL('background/styles/userinfo.css');
        link.onerror = () => {
            console.error('[SFUA] Не удалось загрузить userinfo.css');
        };
        iframeDocument.head.appendChild(link);

        setTimeout(() => {
            processUserInfo(iframeDocument, profileImage, profileTableElement);
        }, 100);
    }

function processUserInfo(iframeDocument, profileImage, profileTableElement) {
    const headers = iframeDocument.querySelectorAll('th.profile-info-table__row-header');
    const dataCells = iframeDocument.querySelectorAll('td.profile-info-table__row-data-cell');

    console.log('[SFUA] Найдено заголовков:', headers.length);
    console.log('[SFUA] Найдено ячеек данных:', dataCells.length);

    // === Добавляем классы main_userinfo_headerX и main_userinfo_dataX ===
    headers.forEach((header, index) => {
        header.classList.add(`main_userinfo_header${index + 1}`);
        header.style.paddingBottom = '5px';
    });

    // === Храним актуальные данные ===
    const data = {};

    dataCells.forEach((cell, index) => {
        const cellIndex = index + 1;
        cell.classList.add(`main_userinfo_data${cellIndex}`);

        const headerCell = headers[index];
        if (!headerCell) return;

        const headerText = headerCell.textContent.trim();

        let cellText = cell.textContent.trim();

        // === Если это "Версия приложения" — очищаем ===
        if (headerText === "Версия приложения" || (headerText.includes("Версия") && headerText.includes("прилож"))) {
            console.log(`[SFUA] Обнаружена версия: "${cellText}"`);

            // Удаляем всё начиная с первой открывающей скобки
            const openParenIndex = cellText.indexOf('(');
            let cleanedText = cellText;
            if (openParenIndex !== -1) {
                cleanedText = cellText.substring(0, openParenIndex).trim();
            }

            console.log(`[SFUA] Очищено: "${cleanedText}"`);

            if (cleanedText !== cellText) {
                // Принудительно обновляем DOM
                cell.textContent = '';
                setTimeout(() => {
                    cell.textContent = cleanedText;
                    console.log(`✅ Ячейка main_userinfo_data${cellIndex} обновлена`);
                }, 0);

                // 🔥 Сразу обновляем значение в data
                data[cellIndex] = cleanedText;
            } else {
                data[cellIndex] = cellText;
            }
        } else {
            // Обычное значение
            data[cellIndex] = cellText;
        }
    });

    // === Теперь собираем headersData из headers ===
    const headersData = {};
    headers.forEach((header, index) => {
        headersData[index + 1] = header.textContent.trim();
    });

    // === Создаём контейнер с актуальными данными ===
    createUserInfoContainer(iframeDocument, profileImage, profileTableElement, headersData, data);
}

function createUserInfoContainer(iframeDocument, profileImage, profileTableElement, headersData, data) {
    const existingContainer = iframeDocument.querySelector('.userinfo_container');
    if (existingContainer) {
        fadeOut(existingContainer, () => {
            existingContainer.remove();
            if (profileImage) {
                profileImage.style.display = '';
            }
        });
        return;
    }

    // === Кнопка с анимацией текста ===
    const toggleButton = document.createElement('button');
    toggleButton.className = 'toggle-details-button';
    toggleButton.style.overflow = 'hidden';
    toggleButton.style.position = 'relative';
    toggleButton.style.transform = 'scale(0)';
    toggleButton.style.transformOrigin = 'top center';

    const textContainer = document.createElement('div');
    textContainer.style.position = 'absolute';
    textContainer.style.top = '0';
    textContainer.style.left = '0';
    textContainer.style.width = '100%';
    textContainer.style.height = '100%';
    textContainer.style.display = 'flex';
    textContainer.style.flexDirection = 'column';
    textContainer.style.justifyContent = 'center';
    textContainer.style.alignItems = 'center';
    textContainer.style.gap = '0';
    textContainer.style.overflow = 'hidden';

    const oldText = document.createElement('span');
    oldText.textContent = 'Показать подробно';
    oldText.style.position = 'absolute';
    oldText.style.top = '0';
    oldText.style.left = '0';
    oldText.style.width = '100%';
    oldText.style.textAlign = 'center';
    oldText.style.lineHeight = '30px';
    oldText.style.transform = 'translateY(-100%)';
    oldText.style.transition = 'transform 0.3s ease-out';
    oldText.style.display = 'block';

    const newText = document.createElement('span');
    newText.textContent = 'Показать кратко';
    newText.style.position = 'absolute';
    newText.style.top = '0';
    newText.style.left = '0';
    newText.style.width = '100%';
    newText.style.textAlign = 'center';
    newText.style.lineHeight = '30px';
    newText.style.transform = 'translateY(0)';
    newText.style.transition = 'transform 0.3s ease-out';
    newText.style.display = 'block';

    textContainer.appendChild(oldText);
    textContainer.appendChild(newText);
    toggleButton.appendChild(textContainer);

    const container = document.createElement('div');
    container.className = 'userinfo_container';
    container.style.display = 'block';
    container.style.transform = 'scale(0)';
    container.style.transformOrigin = 'top';
    container.style.transition = 'transform 0.3s ease-out';

    // ✅ Передаём актуальные данные
    container.innerHTML = generateInfoHTML(headersData, data);

    profileTableElement.style.transform = 'scale(0)';
    profileTableElement.style.transformOrigin = 'top';
    profileTableElement.style.transition = 'transform 0.3s ease-out';

    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = '10px';
    wrapper.appendChild(toggleButton);
    wrapper.appendChild(container);

    if (profileImage) {
        profileImage.parentNode.insertBefore(wrapper, profileImage.nextSibling);
    } else {
        const parent = iframeDocument.querySelector('.page-user-profile__main-info') || iframeDocument.body;
        parent.insertBefore(wrapper, parent.firstChild);
    }

    // === Анимация появления ===
    setTimeout(() => {
        toggleButton.style.transition = 'transform 0.3s ease-out, max-height 0.4s ease';
        toggleButton.style.maxHeight = '40px';
        toggleButton.style.transform = 'scale(1)';
    }, 100);

    // === Загружаем состояние ===
    chrome.storage.local.get(['sfua_userinfo_showCompact'], async (result) => {
        const showCompact = result.sfua_userinfo_showCompact ?? false;

        if (showCompact) {
            container.style.display = 'block';
            profileTableElement.classList.add('hidden');
            container.style.transform = 'scale(1)';
            profileTableElement.style.transform = 'scale(0)';

            newText.style.transform = 'translateY(100%)';
            oldText.style.transform = 'translateY(0)';
        } else {
            container.style.display = 'none';
            profileTableElement.classList.remove('hidden');
            profileTableElement.style.transform = 'scale(1)';
            container.style.transform = 'scale(0)';

            oldText.style.transform = 'translateY(-100%)';
            newText.style.transform = 'translateY(0)';
        }
    });

    // === Переключение ===
    toggleButton.addEventListener('click', () => {
        if (container.style.display === 'none' || container.style.display === '') {
            container.style.display = 'block';
            profileTableElement.classList.add('hidden');
            profileTableElement.style.transform = 'scale(0)';
            setTimeout(() => container.style.transform = 'scale(1)', 10);

            newText.style.transform = 'translateY(100%)';
            oldText.style.transform = 'translateY(0)';

            chrome.storage.local.set({ sfua_userinfo_showCompact: true });
        } else {
            container.style.display = 'none';
            profileTableElement.classList.remove('hidden');
            container.style.transform = 'scale(0)';
            setTimeout(() => profileTableElement.style.transform = 'scale(1)', 10);

            oldText.style.transform = 'translateY(-100%)';
            newText.style.transform = 'translateY(0)';

            chrome.storage.local.set({ sfua_userinfo_showCompact: false });
        }
    });
}

    function generateInfoHTML(headersData, data) {
        let html = '';

        const addInfoRow = (title, value, isWarning = false) => {
            if (value && value !== 'Не найдено') {
                const valueStyle = isWarning ? 'style="color: red;"' : '';
                html += `
                    <div class="userinfo_wrapper">
                        <div class="userinfo_title">${title}:</div>
                        <div class="userinfo_data" ${valueStyle}>${value}</div>
                    </div>
                `;
            }
        };

        // Все строки — как в оригинале
        for (const [index, headerText] of Object.entries(headersData)) {
            const num = parseInt(index);
            if (headerText === "Модель") {
                const deviceValue = `${data[num] || 'Не найдено'} (${data[num-1] || 'Не найдено'})`;
                addInfoRow("Устройство", deviceValue);
                break;
            }
        }

        for (const [index, headerText] of Object.entries(headersData)) {
            const num = parseInt(index);
            if (headerText === "Операционная система") {
                const osValue = `${data[num] || 'Не найдено'} ${data[num+1] || ''}`.trim();
                addInfoRow("ОС", osValue);
                break;
            }
        }

        for (const [index, headerText] of Object.entries(headersData)) {
            const num = parseInt(index);
            if (headerText === "Версия приложения") {
                let version = data[num] || 'Не найдено';
                // Удаляем последнее слово в скобках
                if (version !== 'Не найдено') {
                    version = version.replace(/\s*$$[^)]+$$\s*$/, '').trim();
                }
                addInfoRow("Версия МП", version);
                break;
            }
        }

        for (const [index, headerText] of Object.entries(headersData)) {
            const num = parseInt(index);
            if (headerText === "Оператор") {
                addInfoRow("Оператор", data[num] || 'Не найдено');
                break;
            }
        }

        let regionValue = 'Не найдено';
        for (const [index, headerText] of Object.entries(headersData)) {
            const num = parseInt(index);
            if (headerText === "Регион" || headerText === "Город" || /регион|область|край/i.test(headerText)) {
                regionValue = data[num] || 'Не найдено';
                addInfoRow("Регион", regionValue);
                if (regionValue !== 'Не найдено') {
                    const timezoneOffset = findTimezone(regionValue);
                    if (timezoneOffset !== null) {
                        const timezoneValue = timezoneOffset > 0 ? `+${timezoneOffset}` : timezoneOffset;
                        addInfoRow("Часовой пояс", `<span class="userinfo_timezone">${timezoneValue}</span> МСК`);
                    }
                }
                break;
            }
        }

        for (const [index, headerText] of Object.entries(headersData)) {
            const num = parseInt(index);
            if (headerText === "Крэши") {
                const crashValue = data[num] || 'Не найдено';
                addInfoRow("Crash", crashValue, crashValue !== '0');
                break;
            }
        }

        for (const [index, headerText] of Object.entries(headersData)) {
            const num = parseInt(index);
            if (headerText === "Root-статус") {
                const rootValue = data[num] || 'Не найдено';
                addInfoRow("Root", rootValue, rootValue !== 'Not Rooted');
                break;
            }
        }

        for (const [index, headerText] of Object.entries(headersData)) {
            const num = parseInt(index);
            if (headerText === "Сессии") {
                const sessionsValue = `${data[num] || 'Не найдено'} (${formatDate(data[num-1] || 'Не найдено')})`;
                addInfoRow("Сессии (последняя)", sessionsValue);
                break;
            }
        }

        for (const [index, headerText] of Object.entries(headersData)) {
            const num = parseInt(index);
            if (headerText === "appmetrica_device_id") {
                addInfoRow("Appmetrica ID", data[num] || 'Не найдено');
                break;
            }
        }

        return html || '<div style="color: rgb(150, 150, 150);">Данные не найдены</div>';
    }

    function findTimezone(regionName) {
        if (!regionName || regionName === 'Не найдено' || !TIMEZONES) return null;

        const normalized = regionName
            .toLowerCase()
            .replace(/[^а-яё\s-]/gi, '')
            .replace(/(область|край|республика|автономный округ|ао|город|г\.|район)\b/gi, '')
            .replace(/\s+/g, ' ')
            .trim();

        for (const [region, offset] of Object.entries(TIMEZONES)) {
            const normalizedRegion = region.toLowerCase();
            if (
                normalized === normalizedRegion ||
                normalized.includes(normalizedRegion) ||
                normalizedRegion.includes(normalized) ||
                regionName.toLowerCase().includes(normalizedRegion)
            ) {
                return offset;
            }
        }

        console.log('Часовой пояс не найден для:', regionName);
        return null;
    }

    function formatDate(dateString) {
        if (dateString === 'Не найдено') return dateString;
        const [year, month, day] = dateString.split('-');
        return `${day}.${month}.${year}`;
    }

    function fadeOut(element, callback) {
        element.style.opacity = '1';
        element.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
        element.style.opacity = '0';
        element.style.transform = 'scale(0.9)';
        element.addEventListener('transitionend', () => callback(), { once: true });
    }

    // Запуск
    initializeUserInfo();
})();