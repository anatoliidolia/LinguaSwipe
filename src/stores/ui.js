import { defineStore } from 'pinia';
import { ref } from 'vue';

// Стан інтерфейсу: вкладка, повідомлення і модальні вікна
export const useUiStore = defineStore('ui', () => {
    const currentTab = ref('practice');
    const statusMessage = ref('');

    const singleModalOpen = ref(false);
    const bulkModalOpen = ref(false);
    const formWord = ref({ id: '', word: '', transcription: '', translation: '' });
    // Чий словник змінюють модалки: 'own' — свій, 'student' — відкритий у вкладці «Користувачі»
    const modalTarget = ref('own');

    const anyModalOpen = () => singleModalOpen.value || bulkModalOpen.value;

    function openAddModal(target = 'own') {
        modalTarget.value = target;
        formWord.value = { id: '', word: '', transcription: '', translation: '' };
        singleModalOpen.value = true;
    }

    function editWord(item, target = 'own') {
        modalTarget.value = target;
        formWord.value = { ...item, transcription: item.transcription || '' };
        singleModalOpen.value = true;
    }

    function openBulkModal(target = 'own') {
        modalTarget.value = target;
        bulkModalOpen.value = true;
    }

    function reset() {
        currentTab.value = 'practice';
        singleModalOpen.value = false;
        bulkModalOpen.value = false;
    }

    return {
        currentTab,
        statusMessage,
        singleModalOpen,
        bulkModalOpen,
        formWord,
        modalTarget,
        anyModalOpen,
        openAddModal,
        editWord,
        openBulkModal,
        reset
    };
});
