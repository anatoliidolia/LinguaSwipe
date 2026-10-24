import { defineStore } from 'pinia';
import { ref } from 'vue';

// Стан інтерфейсу: вкладка, повідомлення і модальні вікна
export const useUiStore = defineStore('ui', () => {
    const currentTab = ref('practice');
    const statusMessage = ref('');

    const singleModalOpen = ref(false);
    const bulkModalOpen = ref(false);
    const formWord = ref({ id: '', word: '', transcription: '', translation: '' });

    const anyModalOpen = () => singleModalOpen.value || bulkModalOpen.value;

    function openAddModal() {
        formWord.value = { id: '', word: '', transcription: '', translation: '' };
        singleModalOpen.value = true;
    }

    function editWord(item) {
        formWord.value = { ...item, transcription: item.transcription || '' };
        singleModalOpen.value = true;
    }

    function openBulkModal() {
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
        anyModalOpen,
        openAddModal,
        editWord,
        openBulkModal,
        reset
    };
});
