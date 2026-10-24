import { normalizeTranscription } from './validation.js';

// SPLIT ONE LINE INTO CELLS, RESPECTING "QUOTED, VALUES"
export function splitCSVLine(line, delimiter) {
    const cells = [];
    let cell = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') { cell += '"'; i++; }
            else inQuotes = !inQuotes;
        } else if (ch === delimiter && !inQuotes) {
            cells.push(cell);
            cell = '';
        } else {
            cell += ch;
        }
    }
    cells.push(cell);
    return cells.map(c => c.trim().replace(/^'|'$/g, ''));
}

// PARSE CSV / TEXT INTO { word, transcription, translation } ITEMS
// Рядок: "слово, переклад" або "слово, [транскрипція], переклад" ("[]" — без транскрипції)
export function parseCSVContent(csvText) {
    const lines = csvText.replace(/^﻿/, '').split(/\r?\n/);
    const parsed = [];

    lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        let parts;
        if (trimmed.includes('\t')) parts = splitCSVLine(trimmed, '\t');
        else if (trimmed.includes(';')) parts = splitCSVLine(trimmed, ';');
        // "Endure - Витримувати, терпіти": тире до першої коми — роздільник, а кома — частина перекладу
        else if (/^[^,"]+?\s+[-–—]\s+/.test(trimmed)) parts = trimmed.split(/\s+[-–—]\s+/);
        else if (trimmed.includes(',')) parts = splitCSVLine(trimmed, ',');
        else parts = trimmed.split(/\s+[-–—]\s+/);

        if (parts.length < 2) return;
        const w = parts[0].trim();
        let rest = parts.slice(1);
        let tr = '';
        if (rest.length > 1 && /^(\[.*\]|\/.*\/)$/.test(rest[0].trim())) {
            tr = normalizeTranscription(rest[0]);
            rest = rest.slice(1);
        }
        const t = rest.join(', ').trim();

        // Skip header if present (e.g. "word,translation" or "English,Ukrainian")
        if (index === 0 && ['word', 'english', 'слово'].includes(w.toLowerCase())) return;

        if (w && t) parsed.push({ word: w, transcription: tr, translation: t });
    });

    return parsed;
}
