<script setup>
import { useUiStore } from '../stores/ui.js';

const ui = useUiStore();
</script>

<template>
    <!-- STATUS BANNER (import results, errors) -->
    <div v-if="ui.statusMessage" class="bg-sky-950/80 border-b border-sky-800 px-4 py-2 text-center text-xs text-sky-300 flex items-center justify-center gap-2">
        <i class="fa-solid fa-info-circle"></i>
        <span>{{ ui.statusMessage }}</span>
        <button @click="ui.statusMessage = ''" class="ml-2 text-slate-400 hover:text-white"><i class="fa-solid fa-xmark"></i></button>
    </div>
</template>
