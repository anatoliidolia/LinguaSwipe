import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { sb, check, NOT_CONFIGURED_MESSAGE } from '../lib/supabase.js';
import { readStored, writeStored, STORAGE_KEYS } from '../lib/storage.js';
import { useUiStore } from './ui.js';
import { useWordsStore } from './words.js';
import { usePracticeStore } from './practice.js';

const GUEST = { guest: true, username: 'Гість' };

function toUser(authUser) {
    return authUser ? { id: authUser.id, username: authUser.email.split('@')[0], email: authUser.email } : null;
}

export const useAuthStore = defineStore('auth', () => {
    const user = ref(null);
    const authReady = ref(false);
    const authMode = ref('login');
    const authError = ref('');
    const authLoading = ref(false);
    // Супер-адмін (таблиця admins, migrations/002_super_admin.sql) може видаляти слова із загального словника
    const isAdmin = ref(false);

    const isGuest = computed(() => !!(user.value && user.value.guest));

    async function loadAdminFlag() {
        if (isGuest.value) { isAdmin.value = false; return; }
        const { data, error } = await sb.rpc('is_admin');
        // Міграцію ще не виконано або немає мережі — просто без прав адміна
        isAdmin.value = !error && data === true;
    }

    function resetUserState() {
        user.value = null;
        isAdmin.value = false;
        useWordsStore().reset();
        usePracticeStore().reset();
        useUiStore().reset();
    }

    function setMode(mode) {
        authMode.value = mode;
        authError.value = '';
    }

    async function submit(credentials) {
        authError.value = '';
        if (!sb) {
            authError.value = NOT_CONFIGURED_MESSAGE;
            return false;
        }
        authLoading.value = true;
        try {
            const data = check(authMode.value === 'login'
                ? await sb.auth.signInWithPassword(credentials)
                : await sb.auth.signUp(credentials));
            if (!data.session) {
                authError.value = 'Акаунт створено. Підтвердіть email за посиланням з листа і увійдіть.';
                authMode.value = 'login';
                return false;
            }
            user.value = toUser(data.user);
            writeStored(STORAGE_KEYS.guest, null);
            useUiStore().statusMessage = '';
            await useWordsStore().loadWords();
            return true;
        } catch (err) {
            authError.value = err.message;
            return false;
        } finally {
            authLoading.value = false;
        }
    }

    async function loginAsGuest() {
        authError.value = '';
        if (!sb) {
            authError.value = NOT_CONFIGURED_MESSAGE;
            return;
        }
        authLoading.value = true;
        user.value = { ...GUEST };
        writeStored(STORAGE_KEYS.guest, '1');
        useUiStore().statusMessage = '';
        await useWordsStore().loadWords();
        authLoading.value = false;
    }

    async function logout() {
        if (isGuest.value) {
            writeStored(STORAGE_KEYS.guest, null);
        } else {
            try { await sb.auth.signOut(); } catch (e) { /* ignore */ }
        }
        resetUserState();
        useUiStore().statusMessage = '';
    }

    async function goToRegister() {
        await logout();
        authMode.value = 'register';
    }

    // Відновлює сесію при запуску додатку
    async function init() {
        if (!sb) {
            authError.value = NOT_CONFIGURED_MESSAGE;
            authReady.value = true;
            return;
        }
        try {
            const { data } = await sb.auth.getSession();
            user.value = toUser(data.session && data.session.user);
            if (!user.value && readStored(STORAGE_KEYS.guest) === '1') {
                user.value = { ...GUEST };
            }
            if (user.value) await useWordsStore().loadWords();
        } catch (err) {
            authError.value = 'Не вдалося підключитися до Supabase: ' + err.message;
        } finally {
            authReady.value = true;
        }
        sb.auth.onAuthStateChange(event => {
            if (event === 'SIGNED_OUT' && !isGuest.value) resetUserState();
        });
    }

    return {
        user,
        authReady,
        authMode,
        authError,
        authLoading,
        isAdmin,
        isGuest,
        loadAdminFlag,
        setMode,
        submit,
        loginAsGuest,
        logout,
        goToRegister,
        init
    };
});
