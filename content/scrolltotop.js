// content/scrolltotop.js

(function () {
    console.log("ScrollToTop: Инициализация");

    // === Параметры ===
    const SHOW_THRESHOLD = 300;  // Показать при прокрутке >300px
    const HIDE_THRESHOLD = 500;  // Скрыть при прокрутке <500px
    const ANIMATION_DURATION = 1500; // 1.5 сек

    // === Создаём кнопку ===
    const button = document.createElement('button');
    button.className = 'sfua_scroll_to_top';
    button.style.cssText = `
        position: fixed;
        bottom: -100px;
        right: -100px;
        width: 40px;
        height: 40px;
        border: none;
        border-radius: 20%;
        background-color: #edf2f7;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        cursor: pointer;
        z-index: 10000;
        opacity: 0;
        transform: scale(0);
        transition: all 0.4s ease;
        display: flex;
        align-items: center;
        justify-content: center;
    `;

    // SVG стрелка вверх (серая)
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '32');
    svg.setAttribute('height', '32');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', '#4a5568');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', '12');
    line.setAttribute('y1', '19');
    line.setAttribute('x2', '12');
    line.setAttribute('y2', '5');

    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyline.setAttribute('points', '5 12 12 5 19 12');

    svg.appendChild(line);
    svg.appendChild(polyline);
    button.appendChild(svg);

    // Добавляем в body
    document.body.appendChild(button);

    // === Управление видимостью ===
    let isVisible = false;

    function updateButton() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

        if (scrollTop >= SHOW_THRESHOLD && !isVisible) {
            // Показать с анимацией
            button.style.bottom = '60px';
            button.style.right = '100px';
            button.style.opacity = '1';
            button.style.transform = 'scale(1)';
            isVisible = true;
        } else if (scrollTop < HIDE_THRESHOLD && isVisible) {
            // Скрыть с анимацией
            button.style.opacity = '0';
            button.style.transform = 'scale(0)';
            setTimeout(() => {
                if (!isVisible) {
                    button.style.bottom = '-100px';
                    button.style.right = '-100px';
                }
            }, ANIMATION_DURATION);
            isVisible = false;
        }
    }

    // === Прокрутка наверх ===
    button.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });

    // === Слушаем прокрутку ===
    window.addEventListener('scroll', () => {
        requestAnimationFrame(updateButton);
    });

    // === Инициализация ===
    updateButton();

    console.log("ScrollToTop: Готов");
})();