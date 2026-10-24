import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { sb, check, NOT_CONFIGURED_MESSAGE } from '../lib/supabase.js';
import { readStored, writeStored, STORAGE_KEYS } from '../lib/storage.js';
import { useUiStore } from './ui.js';
import { useWordsStore } from './words.js';
import { usePracticeStore } from './practice.js';
import { useStudentsStore } from './students.js';
import { useTopicsStore } from './topics.js';

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
    // Роль (migrations/003_teachers.sql): 'admin' — може все (002_super_admin.sql),
    // 'teacher' — редагує словники своїх студентів, 'student' — лише свій словник.
    // Інтерфейс лише ховає кнопки: права перевіряє база.
    const role = ref('student');

    const isGuest = computed(() => !!(user.value && user.value.guest));
    const isAdmin = computed(() => role.value === 'admin');
    const isTeacher = computed(() => role.value === 'teacher');
    const canManageUsers = computed(() => !isGuest.value && (isAdmin.value || isTeacher.value));

    async function loadRole() {
        if (isGuest.value) { role.value = 'student'; return; }
        const { data, error } = await sb.rpc('my_role');
        if (!error && ['admin', 'teacher', 'student'].includes(data)) {
            role.value = data;
            return;
        }
        // Міграцію 003 ще не виконано — роль адміна з 002; немає мережі — просто без прав
        const admin = await sb.rpc('is_admin');
        role.value = !admin.error && admin.data === true ? 'admin' : 'student';
    }

    function resetUserState() {
        user.value = null;
        role.value = 'student';
        useWordsStore().reset();
        usePracticeStore().reset();
        useStudentsStore().reset();
        useTopicsStore().reset();
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
        role,
        isAdmin,
        isTeacher,
        canManageUsers,
        isGuest,
        loadRole,
        setMode,
        submit,
        loginAsGuest,
        logout,
        goToRegister,
        init
    };
});
