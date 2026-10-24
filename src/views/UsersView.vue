<script setup>
import { onMounted, onUnmounted, watch } from 'vue';
import { useAuthStore } from '../stores/auth.js';
import { useStudentsStore } from '../stores/students.js';
import StudentDictionary from '../components/StudentDictionary.vue';

const auth = useAuthStore();
const studentsStore = useStudentsStore();

// Пошук за email: чекаємо паузу у введенні, щоб не слати запит на кожну літеру
let searchTimer = null;
watch(() => studentsStore.search, () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => studentsStore.loadUsers(), 300);
});
watch(() => studentsStore.onlyMyStudents, () => studentsStore.loadUsers());

onMounted(() => studentsStore.loadUsers());
onUnmounted(() => clearTimeout(searchTimer));

const formatDate = value => new Date(value).toLocaleDateString('uk-UA');
</script>

<template>
    <div class="w-full flex-1 flex flex-col my-2">
        <StudentDictionary v-if="studentsStore.student" />

        <template v-else>
            <!-- Controls -->
            <div class="glass-card p-4 rounded-2xl mb-4 border border-slate-800 flex flex-col sm:flex-row gap-3 justify-between items-center">
                <div class="relative w-full sm:w-80">
                    <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
                    <input
                            v-model="studentsStore.search"
                            type="text"
                            placeholder="Пошук за email..."
                            class="w-full bg-slate-900/90 border border-slate-700/80 text-slate-200 text-xs rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:border-sky-500 transition-all">
                </div>

                <div class="flex bg-slate-800/60 p-1 rounded-xl border border-slate-700/50 text-xs">
                    <button @click="studentsStore.onlyMyStudents = false"
                            :class="!studentsStore.onlyMyStudents ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400 hover:text-white'"
                            class="px-3 py-1 rounded-lg font-semibold transition-all flex items-center gap-1.5">
                        <i class="fa-solid fa-users"></i>Усі
                    </button>
                    <button @click="studentsStore.onlyMyStudents = true"
                            :class="studentsStore.onlyMyStudents ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400 hover:text-white'"
                            class="px-3 py-1 rounded-lg font-semibold transition-all flex items-center gap-1.5">
                        <i class="fa-solid fa-user-graduate"></i>Мої студенти
                    </button>
                </div>
            </div>

            <p class="text-[11px] text-slate-500 mb-3 px-1">
                <i class="fa-solid fa-circle-info mr-1"></i>
                <template v-if="auth.isAdmin">Адмін може відкрити словник будь-якого користувача і призначати викладачів.</template>
                <template v-else>Позначте своїх студентів — після цього ви зможете додавати, змінювати і видаляти слова в їхніх словниках.</template>
            </p>

            <!-- Users List -->
            <div class="flex flex-col gap-2 flex-1 overflow-y-auto max-h-[calc(100vh-260px)] pr-1">
                <div
                        v-for="user in studentsStore.users"
                        :key="user.id"
                        class="glass-card p-3 sm:p-4 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center gap-3 justify-between">

                    <div class="min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="font-bold text-sm text-white truncate">{{ user.email }}</span>
                            <span v-if="user.id === auth.user.id" class="text-[9px] font-bold uppercase text-sky-300 bg-sky-500/15 border border-sky-500/30 px-1.5 py-0.5 rounded-md">Ви</span>
                            <span v-if="user.is_admin" class="text-[9px] font-bold uppercase text-amber-300 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded-md">Адмін</span>
                            <span v-if="user.is_teacher" class="text-[9px] font-bold uppercase text-violet-300 bg-violet-500/15 border border-violet-500/30 px-1.5 py-0.5 rounded-md">Викладач</span>
                            <span v-if="user.is_my_student" class="text-[9px] font-bold uppercase text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded-md">Мій студент</span>
                        </div>
                        <p class="text-[11px] text-slate-500 mt-0.5">
                            <i class="fa-solid fa-book mr-1"></i>{{ user.word_count }} слів · з {{ formatDate(user.created_at) }}
                        </p>
                    </div>

                    <div v-if="user.id !== auth.user.id" class="flex items-center gap-2 flex-wrap justify-end">
                        <button v-if="auth.isAdmin && !user.is_admin"
                                @click="studentsStore.setTeacher(user, !user.is_teacher)"
                                :class="user.is_teacher ? 'bg-violet-500/20 text-violet-300 border-violet-500/40' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'"
                                class="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border transition-all flex items-center gap-1.5">
                            <i class="fa-solid fa-chalkboard-user"></i>{{ user.is_teacher ? 'Викладач ✓' : 'Зробити викладачем' }}
                        </button>

                        <button v-if="!user.is_admin"
                                @click="studentsStore.setStudent(user, !user.is_my_student)"
                                :class="user.is_my_student ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'"
                                class="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border transition-all flex items-center gap-1.5">
                            <i class="fa-solid fa-user-graduate"></i>{{ user.is_my_student ? 'Мій студент ✓' : 'Додати в студенти' }}
                        </button>

                        <button v-if="studentsStore.canEditDictionary(user)"
                                @click="studentsStore.openStudent(user)"
                                class="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-sky-500 hover:bg-sky-400 text-white transition-all flex items-center gap-1.5">
                            <i class="fa-solid fa-book-open"></i>Словник
                        </button>
                    </div>
                </div>

                <div v-if="!studentsStore.loading && studentsStore.users.length === 0" class="text-center py-12 text-slate-500">
                    <i class="fa-solid fa-users-slash text-3xl mb-2 block"></i>
                    <p>{{ studentsStore.onlyMyStudents ? 'У вас ще немає студентів. Перейдіть в «Усі» і додайте їх.' : 'Користувачів не знайдено.' }}</p>
                </div>

                <div class="text-center py-2">
                    <i v-if="studentsStore.loading" class="fa-solid fa-spinner fa-spin text-slate-500"></i>
                    <button v-else-if="studentsStore.hasMore" @click="studentsStore.loadUsers({ append: true })"
                            class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700">
                        Показати ще
                    </button>
                </div>
            </div>
        </template>
    </div>
</template>
