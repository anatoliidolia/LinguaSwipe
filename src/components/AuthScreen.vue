<script setup>
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth.js';

const auth = useAuthStore();
const form = ref({ email: '', password: '' });

async function submit() {
    const ok = await auth.submit({ email: form.value.email.trim(), password: form.value.password });
    if (ok) form.value = { email: '', password: '' };
}
</script>

<template>
    <!-- LOGIN / REGISTER SCREEN -->
    <div class="flex-1 flex items-center justify-center p-4">
        <div class="glass-card w-full max-w-sm p-7 rounded-3xl border border-slate-700 shadow-2xl">
            <div class="text-center mb-6">
                <div class="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-3xl text-white shadow-lg shadow-sky-500/30 mb-3">
                    <i class="fa-solid fa-layer-group"></i>
                </div>
                <h1 class="text-2xl font-black text-white">LinguaSwipe</h1>
                <p class="text-xs text-slate-400 mt-1">{{ auth.authMode === 'login' ? 'Увійдіть, щоб відкрити свою колекцію слів' : 'Створіть акаунт для власної колекції слів' }}</p>
            </div>

            <div class="flex bg-slate-800/60 p-1 rounded-2xl border border-slate-700/50 mb-5">
                <button type="button" @click="auth.setMode('login')"
                        :class="auth.authMode === 'login' ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400 hover:text-white'"
                        class="flex-1 py-2 rounded-xl text-xs font-semibold transition-all">Вхід</button>
                <button type="button" @click="auth.setMode('register')"
                        :class="auth.authMode === 'register' ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400 hover:text-white'"
                        class="flex-1 py-2 rounded-xl text-xs font-semibold transition-all">Реєстрація</button>
            </div>

            <form @submit.prevent="submit" class="space-y-4">
                <div>
                    <label class="block text-xs font-medium text-slate-400 mb-1">Email</label>
                    <input v-model="form.email" required autocomplete="email" type="email" placeholder="you@gmail.com"
                           class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500">
                </div>
                <div>
                    <label class="block text-xs font-medium text-slate-400 mb-1">Пароль</label>
                    <input v-model="form.password" required type="password" placeholder="••••••"
                           :autocomplete="auth.authMode === 'login' ? 'current-password' : 'new-password'"
                           class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500">
                </div>

                <p v-if="auth.authError" class="text-xs text-rose-400 flex items-center gap-1.5">
                    <i class="fa-solid fa-circle-exclamation"></i>{{ auth.authError }}
                </p>

                <button type="submit" :disabled="auth.authLoading"
                        class="w-full py-3 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 disabled:opacity-60 text-white font-bold text-sm shadow-xl shadow-sky-500/25 transition-all flex items-center justify-center gap-2">
                    <i class="fa-solid" :class="auth.authLoading ? 'fa-spinner fa-spin' : (auth.authMode === 'login' ? 'fa-right-to-bracket' : 'fa-user-plus')"></i>
                    <span>{{ auth.authMode === 'login' ? 'Увійти' : 'Створити акаунт' }}</span>
                </button>
            </form>

            <p v-if="auth.authMode === 'register'" class="text-[11px] text-slate-500 mt-3 leading-relaxed">
                <i class="fa-solid fa-circle-info mr-1"></i>Ваші слова (без email і прогресу) також потраплять у загальний словник, який бачать усі.
            </p>

            <div class="flex items-center gap-3 my-5 text-[11px] text-slate-500">
                <div class="flex-1 h-px bg-slate-700/70"></div><span>або</span><div class="flex-1 h-px bg-slate-700/70"></div>
            </div>

            <button type="button" @click="auth.loginAsGuest()" :disabled="auth.authLoading"
                    class="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-60 text-slate-200 font-semibold text-sm transition-all flex items-center justify-center gap-2">
                <i class="fa-solid fa-user-secret"></i>
                <span>Увійти як гість</span>
            </button>
            <p class="text-[11px] text-slate-500 text-center mt-2">Гість бачить загальний словник з усіма словами, без реєстрації</p>
        </div>
    </div>
</template>
