// Добавляем стили из отдельного файла
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = chrome.runtime.getURL('styles.css');
document.head.appendChild(link);

function hideElements() {
    const elementsToHide = [
        'updateId_container',
        'inputEvent_container',
        'input-details__key',
        'input-details__value',
        'start_search'
    ];

    elementsToHide.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.style.display = 'none';
        }
    });
}

function createProgressInterface() {
    const infoContainer = document.getElementById('infoContainer');
    if (!infoContainer) {
        console.error('Контейнер infoContainer не найден');
        return null;
    }

    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-container';

    for (let i = 0; i < 5; i++) {
        const circle = document.createElement('div');
        circle.className = `progress-circle progress-circle-${i+1}`;
        progressContainer.appendChild(circle);
    }

    infoContainer.appendChild(progressContainer);

    const statusText = document.createElement('div');
    statusText.className = 'progress-status-text';
    statusText.textContent = 'Загружаю сессии';
    infoContainer.appendChild(statusText);

    progressContainer.style.display = 'none';
    statusText.style.display = 'none';

    return { progressContainer, statusText };
}

function updateProgress(step, progressContainer, statusText) {
    if (!progressContainer || !statusText) return;

    const circles = progressContainer.querySelectorAll('.progress-circle');

    circles.forEach((circle, index) => {
        circle.style.width = '20px';
        circle.style.height = '20px';
        
        if (!circle.classList.contains('active')) {
            circle.style.backgroundColor = '';
        }
    });

    const steps = [
        { 
            text: 'Загружаю сессии',
            activeCircle: 0,
            nextCircleSize: 0
        },
        {
            text: 'Загружаю все события',
            activeCircle: 0,
            nextCircleSize: 1
        },
        {
            text: 'Загружаю дополнительные события',
            activeCircle: 1,
            nextCircleSize: 2
        },
        {
            text: 'Кликаю по выбранному событию',
            activeCircle: 2,
            nextCircleSize: 3
        },
        {
            text: 'Ищу запрошенные события',
            activeCircle: 3,
            nextCircleSize: 4
        },
        {
            text: 'Поиск завершен',
            activeCircle: -1
        }
    ];

    if (step >= 0 && step < steps.length) {
        const currentStep = steps[step];
        statusText.textContent = currentStep.text;

        if (currentStep.activeCircle >= 0) {
            if (currentStep.activeCircle === -1) {
                circles.forEach(circle => {
                    circle.classList.add('active');
                });
            } else {
                circles[currentStep.activeCircle].classList.add('active');
            }
        }

        if (currentStep.nextCircleSize !== undefined && step < steps.length - 1) {
            const nextCircle = circles[step + 1];
            if (nextCircle) {
                nextCircle.style.width = '10px';
                nextCircle.style.height = '10px';
            }
        }
    }
}

function initProgress() {
    const iframe = document.querySelector('iframe.iframe-integration__iframe');
    if (!iframe) {
        console.error('Iframe не найден');
        return;
    }

    const iframeDocument = iframe.contentDocument || iframe.contentWindow.document;
    if (!iframeDocument) {
        console.error('Не удалось получить доступ к документу iframe');
        return;
    }

    const showMoreButton = iframeDocument.querySelector('.profile-sessions-history__show-more-sessions-button');
    
    if (showMoreButton) {
        showMoreButton.addEventListener('click', () => {
            hideElements();
            const progress = createProgressInterface();
            if (progress) {
                const { progressContainer, statusText } = progress;
                progressContainer.style.display = 'flex';
                statusText.style.display = 'block';
                updateProgress(0, progressContainer, statusText);
                
                // Пример автоматического обновления прогресса (можно заменить на реальные события)
                let currentStep = 0;
                const interval = setInterval(() => {
                    currentStep++;
                    if (currentStep <= 5) {
                        updateProgress(currentStep, progressContainer, statusText);
                    } else {
                        clearInterval(interval);
                    }
                }, 2000);
            }
        });
    } else {
        console.log('Кнопка "Показать больше сессий" не найдена');
    }
}

// Запускаем инициализацию после полной загрузки страницы
if (document.readyState === 'complete') {
    initProgress();
} else {
    document.addEventListener('DOMContentLoaded', initProgress);
}