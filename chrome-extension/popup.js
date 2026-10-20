// LinguaSwipe extension: popup (вхід, ручне додавання слова, налаштування)

const $ = id => document.getElementById(id);

function send(message) {
    return new Promise(resolve => {
        chrome.runtime.sendMessage(message, response => {
            if (chrome.runtime.lastError) resolve({ error: chrome.runtime.lastError.message });
            else resolve(response || {});
        });
    });
}

function show(view) {
    ['config', 'login', 'main'].forEach(name => { $(`view-${name}`).hidden = name !== view; });
}

async function render() {
    const { data } = await send({ type: 'getState' });
    if (!data || !data.configured) return show('config');
    if (!data.user) {
        show('login');
        $('email').focus();
        return;
    }
    show('main');
    $('user-email').textContent = data.user.email;
    $('add-word').focus();

    const { settings } = await chrome.storage.local.get('settings');
    $('auto-popup').checked = !settings || settings.autoPopup !== false;
    loadRecent();
}

async function loadRecent() {
    const list = $('recent');
    const { data, error } = await send({ type: 'recentWords' });
    list.replaceChildren();
    if (error) {
        list.append(item(null, error));
        // Сесія недійсна — фоновий скрипт уже вийшов з акаунта
        const state = await send({ type: 'getState' });
        if (state.data && !state.data.user) render();
        return;
    }
    if (!data.length) list.append(item(null, 'Поки що порожньо'));
    data.forEach(w => list.append(item(w.transcription ? `${w.word} [${w.transcription}]` : w.word, w.translation)));
}

function item(word, translation) {
    const li = document.createElement('li');
    if (word) {
        const b = document.createElement('b');
        b.textContent = word;
        li.append(b);
    }
    const span = document.createElement('span');
    span.textContent = translation;
    span.title = translation;
    if (!word) span.className = 'muted';
    li.append(span);
    return li;
}

$('login-form').addEventListener('submit', async event => {
    event.preventDefault();
    $('login-error').textContent = '';
    $('login-button').disabled = true;
    const { error } = await send({ type: 'login', email: $('email').value, password: $('password').value });
    $('login-button').disabled = false;
    if (error) {
        $('login-error').textContent = error;
        return;
    }
    $('password').value = '';
    render();
});

$('logout-button').addEventListener('click', async () => {
    await send({ type: 'logout' });
    render();
});

$('auto-popup').addEventListener('change', event => {
    chrome.storage.local.set({ settings: { autoPopup: event.target.checked } });
});

function setHint(message, kind = '') {
    $('add-hint').textContent = message;
    $('add-hint').className = 'hint' + (kind ? ' ' + kind : '');
}

// Підказати переклад, коли слово введене вручну
$('add-word').addEventListener('change', async () => {
    const word = $('add-word').value.trim();
    if (!word || $('add-translation').value.trim()) return;
    $('add-translation').placeholder = 'Шукаю переклад…';
    const { data } = await send({ type: 'lookup', word });
    $('add-translation').placeholder = 'Переклад';
    if (!data || $('add-word').value.trim() !== word) return;
    if (data.transcription && !$('add-transcription').value.trim()) $('add-transcription').value = data.transcription;
    if (data.suggestion && !$('add-translation').value.trim()) {
        $('add-translation').value = data.suggestion;
        setHint(data.existing ? 'Слово вже є у словнику — переклад буде оновлено' : '');
    }
});

$('add-form').addEventListener('submit', async event => {
    event.preventDefault();
    $('add-button').disabled = true;
    setHint('Надсилаю…');
    const { data, error } = await send({
        type: 'saveWord',
        word: $('add-word').value,
        transcription: $('add-transcription').value,
        translation: $('add-translation').value
    });
    $('add-button').disabled = false;
    if (error) return setHint(error, 'err');
    setHint(data.action === 'updated' ? '✓ Слово оновлено' : '✓ Додано у словник', 'ok');
    $('add-word').value = '';
    $('add-transcription').value = '';
    $('add-translation').value = '';
    $('add-word').focus();
    loadRecent();
});

render();
