// how_to_use.js — без анимации высоты, с фиксированной высотой

(function () {
    console.log("SFUA: how_to_use.js — запущен");

    if (document.querySelector('.sfua_howto_modal')) {
        console.log("SFUA: Модалка уже открыта");
        return;
    }

    const cssUrl = chrome.runtime.getURL('how_to_use.css');
    const htmlUrl = chrome.runtime.getURL('how_to_use.html');

    fetch(cssUrl)
        .then(response => {
            if (!response.ok) throw new Error(`CSS: ${response.status} ${response.statusText}`);
            return response.text();
        })
        .then(css => {
            const style = document.createElement('style');
            style.textContent = css;
            document.head.appendChild(style);

            return fetch(htmlUrl);
        })
        .then(response => {
            if (!response.ok) throw new Error(`HTML: ${response.status} ${response.statusText}`);
            return response.text();
        })
        .then(html => {
            const template = document.createElement('div');
            template.innerHTML = html.trim();

            const modal = template.querySelector('.sfua_howto_modal');
            const body = modal.querySelector('.sfua_howto_body');
            const tabs = modal.querySelectorAll('.sfua_howto_tab');
            const panels = modal.querySelectorAll('.sfua_howto_panel');

            document.body.appendChild(modal);

            // === Логика вкладок ===
            function activateTab(tabId) {
                tabs.forEach(t => t.classList.remove('active'));
                panels.forEach(p => p.classList.remove('active'));

                const tab = modal.querySelector(`[data-tab="${tabId}"]`);
                const panel = modal.querySelector(`#${tabId}`);
                if (tab && panel) {
                    tab.classList.add('active');
                    panel.classList.add('active');
                }
            }

            tabs.forEach(tab => {
                tab.addEventListener('click', () => activateTab(tab.dataset.tab));
            });

            // Активируем первую вкладку
            activateTab('basics');

            // === Кнопки закрытия ===
            const closeBtn = modal.querySelector('.sfua_howto_close');
            const okBtn = modal.querySelector('.sfua_howto_ok');

            function closeModal() {
                modal.style.opacity = '0';
                setTimeout(() => modal.remove(), 300);
            }

            closeBtn?.addEventListener('click', closeModal);
            okBtn?.addEventListener('click', closeModal);
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal();
            });

            // === Escape ===
            function handleKeydown(e) {
                if (e.key === 'Escape') {
                    closeModal();
                    document.removeEventListener('keydown', handleKeydown);
                }
            }
            document.addEventListener('keydown', handleKeydown);

            // === Показываем ===
            setTimeout(() => {
                modal.style.opacity = '1';
                modal.querySelector('.sfua_howto_content').style.transform = 'scale(1)';
            }, 10);
        })
        .catch(err => {
            console.error("SFUA: Ошибка загрузки ресурсов:", err);
        });
})();