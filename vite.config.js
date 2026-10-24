import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// Підставляє у dist/sw.js список зібраних файлів (з хешами в назвах) і версію кешу,
// щоб додаток відкривався офлайн, а старий кеш очищався після кожного деплою.
function serviceWorkerManifest() {
    let outDir;
    let files = [];
    return {
        name: 'linguaswipe-sw-manifest',
        apply: 'build',
        configResolved(config) {
            outDir = resolve(config.root, config.build.outDir);
        },
        generateBundle(_, bundle) {
            files = Object.keys(bundle).filter(name => !name.endsWith('.map'));
        },
        closeBundle() {
            const swPath = resolve(outDir, 'sw.js');
            const version = createHash('sha256').update(files.sort().join('\n')).digest('hex').slice(0, 10);
            const code = readFileSync(swPath, 'utf8')
                .replace("'__BUILD_VERSION__'", JSON.stringify(version))
                .replace('[/* __BUILD_ASSETS__ */]', JSON.stringify(files.map(f => './' + f)));
            writeFileSync(swPath, code);
        }
    };
}

export default defineConfig({
    // Відносні шляхи: сайт живе на anatoliidolia.github.io/LinguaSwipe/, а не в корені домену
    base: './',
    plugins: [vue(), serviceWorkerManifest()]
});
