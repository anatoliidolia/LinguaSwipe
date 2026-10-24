import { defineStore } from 'pinia';
import { sb, check } from '../lib/supabase.js';
import { useUiStore } from './ui.js';

// Звіти викладача про прогрес студентів у топіках (migrations/007_topic_progress_reports.sql).
// Дані потрібні лише відкритому екрану, тож стан тримають компоненти, а тут — лише запити.
export const useProgressStore = defineStore('progress', () => {
    const ui = useUiStore();

    async function call(fn, args) {
        try {
            return check(await sb.rpc(fn, args));
        } catch (err) {
            ui.statusMessage = err.message;
            return [];
        }
    }

    // Топік: кожен студент, якому він відкритий
    const topicSummary = topicId => call('topic_progress_summary', { p_topic: topicId });
    // Топік: кожне слово, проблемні зверху
    const topicWordStats = topicId => call('topic_word_stats', { p_topic: topicId });
    // Один студент в одному топіку: кожне слово
    const studentTopicWords = (topicId, studentId) => call('student_topic_words', { p_topic: topicId, p_student: studentId });
    // Один студент: усі мої топіки, які йому відкрито
    const studentTopics = studentId => call('student_topics_progress', { p_student: studentId });

    return { topicSummary, topicWordStats, studentTopicWords, studentTopics };
});
