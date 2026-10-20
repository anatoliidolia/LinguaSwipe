// LinguaSwipe extension: content script.
// Після виділення слова показує біля нього поле для перекладу.
// Мережевих запитів тут немає — усе через background.js.

(() => {
    if (window.__linguaswipeLoaded) return;
    window.__linguaswipeLoaded = true;

    const MAX_LENGTH = 60;
    const MAX_WORDS = 5;

    let loggedIn = false;
    let autoPopup = true;

    chrome.storage.local.get(['user', 'settings'], ({ user, settings }) => {
        loggedIn = !!user;
        autoPopup = !settings || settings.autoPopup !== false;
    });
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        if (changes.user) {
            loggedIn = !!changes.user.newValue;
            if (!loggedIn) closePopover();
        }
        if (changes.settings) autoPopup = !changes.settings.newValue || changes.settings.newValue.autoPopup !== false;
    });

    function send(message) {
        return new Promise(resolve => {
            try {
                chrome.runtime.sendMessage(message, response => {
                    if (chrome.runtime.lastError) resolve({ error: 'Розширення оновилось — перезавантажте сторінку' });
                    else resolve(response || {});
                });
            } catch (e) {
                resolve({ error: 'Розширення оновилось — перезавантажте сторінку' });
            }
        });
    }

    // ===== SELECTION =====
    function cleanText(text) {
        return text
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    }

    function isAcceptable(text) {
        return text.length > 0 &&
            text.length <= MAX_LENGTH &&
            text.split(' ').length <= MAX_WORDS &&
            /[A-Za-z]/.test(text);
    }

    function isEditable(node) {
        const el = node && (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement);
        return !!(el && el.closest('input, textarea, [contenteditable=""], [contenteditable="true"]'));
    }

    function selectionInfo() {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
        if (isEditable(sel.anchorNode)) return null;
        const text = cleanText(sel.toString());
        if (!isAcceptable(text)) return null;
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        if (!rect.width && !rect.height) return null;
        return { text, rect };
    }

    let host = null;

    function isInsidePopover(event) {
        return !!host && event.composedPath().includes(host);
    }

    document.addEventListener('mouseup', event => {
        // isTrusted: реагуємо лише на справжні дії користувача, а не на події, створені скриптом сторінки
        if (!event.isTrusted || !loggedIn || !autoPopup || event.button !== 0 || isInsidePopover(event)) return;
        // Дочекатися, поки браузер оновить виділення (важливо для кліку всередині вже виділеного)
        setTimeout(() => {
            const info = selectionInfo();
            if (info) openPopover(info.text, info.rect, false);
        }, 10);
    }, true);

    document.addEventListener('mousedown', event => {
        if (host && !isInsidePopover(event)) closePopover();
    }, true);

    document.addEventListener('keydown', event => {
        if (host && event.key === 'Escape') closePopover();
    }, true);

    chrome.runtime.onMessage.addListener(msg => {
        if (msg && msg.type === 'openPopover') {
            const info = selectionInfo();
            const text = cleanText(msg.text || '') || (info && info.text) || '';
            const rect = info ? info.rect : new DOMRect(window.innerWidth / 2 - 150, 80, 0, 0);
            if (!loggedIn) {
                openPopover(text, rect, true, 'Увійдіть у LinguaSwipe: натисніть іконку розширення на панелі браузера.');
            } else {
                openPopover(text.slice(0, 200), rect, true);
            }
        }
    });

    // ===== POPOVER =====
    const STYLE = `
        :host { all: initial; }
        .box {
            position: fixed; z-index: 2147483647; width: 300px; box-sizing: border-box;
            font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #0f172a; color: #e2e8f0; border: 1px solid #334155; border-radius: 16px;
            box-shadow: 0 18px 40px rgba(2, 6, 23, .55); padding: 12px;
        }
        .head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .logo { font-weight: 700; font-size: 12px; color: #38bdf8; flex: 1; letter-spacing: .02em; }
        .close {
            all: unset; cursor: pointer; color: #64748b; font-size: 18px; line-height: 1; padding: 0 4px;
        }
        .close:hover { color: #e2e8f0; }
        label { display: block; font-size: 11px; color: #94a3b8; margin: 6px 0 3px; }
        .opt { color: #64748b; }
        input {
            width: 100%; box-sizing: border-box; background: #1e293b; color: #f8fafc;
            border: 1px solid #334155; border-radius: 10px; padding: 8px 10px; font: inherit; outline: none;
        }
        input:focus { border-color: #0ea5e9; }
        .word { font-weight: 600; }
        .hint { font-size: 11px; color: #94a3b8; min-height: 15px; margin-top: 6px; }
        .hint.ok { color: #34d399; }
        .hint.err { color: #fb7185; }
        .hint.warn { color: #fbbf24; }
        .send {
            all: unset; box-sizing: border-box; display: block; width: 100%; margin-top: 8px; cursor: pointer;
            text-align: center; padding: 9px 0; border-radius: 12px; font-weight: 700; color: #fff;
            background: linear-gradient(90deg, #0ea5e9, #4f46e5);
        }
        .send:hover { filter: brightness(1.1); }
        .send[disabled] { opacity: .6; cursor: default; }
    `;

    function openPopover(text, rect, focus, notice) {
        closePopover();

        host = document.createElement('linguaswipe-popover');
        const root = host.attachShadow({ mode: 'closed' });
        root.innerHTML = `
            <style>${STYLE}</style>
            <form class="box" autocomplete="off">
                <div class="head">
                    <span class="logo">LinguaSwipe</span>
                    <button type="button" class="close" title="Закрити (Esc)">×</button>
                </div>
                <label>Слово</label>
                <input class="word" name="word" maxlength="200" required>
                <label>Транскрипція <span class="opt">(необов'язково)</span></label>
                <input class="transcription" name="transcription" maxlength="200" placeholder="напр. ˈwɜːd">
                <label>Переклад</label>
                <input class="translation" name="translation" maxlength="500" placeholder="Шукаю переклад…" required>
                <div class="hint"></div>
                <button type="submit" class="send">Надіслати</button>
            </form>
        `;

        const box = root.querySelector('.box');
        const wordInput = root.querySelector('.word');
        const transcriptionInput = root.querySelector('.transcription');
        const translationInput = root.querySelector('.translation');
        const hint = root.querySelector('.hint');
        const sendButton = root.querySelector('.send');

        const setHint = (message, kind = '') => {
            hint.textContent = message;
            hint.className = 'hint' + (kind ? ' ' + kind : '');
        };

        wordInput.value = text;
        root.querySelector('.close').addEventListener('click', closePopover);
        // Не віддавати натискання клавіш гарячим клавішам сайту (YouTube, GitHub тощо)
        ['keydown', 'keyup', 'keypress'].forEach(type => box.addEventListener(type, event => {
            event.stopPropagation();
            if (type === 'keydown' && event.key === 'Escape') closePopover();
        }));
        document.documentElement.appendChild(host);
        position(box, rect);

        if (notice) {
            translationInput.placeholder = '';
            setHint(notice, 'warn');
            sendButton.disabled = true;
            return;
        }

        // Підказати переклад: з власного словника, загального або автоперекладом
        let userTyped = false;
        let userTypedTranscription = false;
        translationInput.addEventListener('input', () => { userTyped = true; });
        transcriptionInput.addEventListener('input', () => { userTypedTranscription = true; });
        const current = host;
        send({ type: 'lookup', word: text }).then(({ data, error }) => {
            if (host !== current) return;
            translationInput.placeholder = 'Введіть переклад';
            if (error) { setHint(error, 'err'); return; }
            if (data.suggestion && !userTyped) translationInput.value = data.suggestion;
            if (data.transcription && !userTypedTranscription) transcriptionInput.value = data.transcription;
            if (data.existing) {
                setHint('Слово вже є у вашому словнику — можна оновити переклад і транскрипцію', 'warn');
                sendButton.textContent = 'Оновити';
            } else if (data.source === 'shared') {
                setHint('Переклад із загального словника');
            } else if (data.source === 'machine') {
                setHint('Автопереклад — перевірте перед надсиланням');
            }
        });

        box.addEventListener('submit', async event => {
            event.preventDefault();
            const word = wordInput.value.trim();
            const transcription = transcriptionInput.value.trim();
            const translation = translationInput.value.trim();
            if (!word || !translation) {
                setHint('Введіть слово і переклад', 'err');
                return;
            }
            sendButton.disabled = true;
            setHint('Надсилаю…');
            const { data, error } = await send({ type: 'saveWord', word, transcription, translation });
            if (host !== current) return;
            if (error) {
                sendButton.disabled = false;
                setHint(error, 'err');
                return;
            }
            setHint(data.action === 'updated' ? '✓ Слово оновлено' : '✓ Додано у словник', 'ok');
            setTimeout(() => { if (host === current) closePopover(); }, 1200);
        });

        if (focus) (text ? translationInput : wordInput).focus();
    }

    function position(box, rect) {
        const margin = 8;
        const width = box.offsetWidth;
        const height = box.offsetHeight;
        let left = rect.left + rect.width / 2 - width / 2;
        left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
        let top = rect.bottom + margin;
        if (top + height > window.innerHeight - margin) top = Math.max(margin, rect.top - height - margin);
        box.style.left = `${left}px`;
        box.style.top = `${top}px`;
    }

    function closePopover() {
        if (host) host.remove();
        host = null;
    }

    window.addEventListener('scroll', () => { if (host && !host.matches(':focus-within')) closePopover(); }, { passive: true });
})();
