import { readFileSync, writeFileSync, mkdirSync, statSync, existsSync, unlinkSync } from 'fs';
import { basename, dirname, join } from 'path';
import chokidar from 'chokidar';
import Anthropic from '@anthropic-ai/sdk';

const LANGS = ['ru', 'en', 'uz'];
const LANG_NAMES = { ru: 'Russian', en: 'English', uz: 'Uzbek' };
const BLOG_DIR = 'src/content/blog';

const client = new Anthropic();
const pending = new Set();

function log(msg) {
  const ts = new Date().toLocaleTimeString('ru');
  console.log(`[${ts}] ${msg}`);
}

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return null;
  return { raw: match[1], body: match[2] };
}

function hasTranslatedFlag(content) {
  const fm = parseFrontmatter(content);
  if (!fm) return false;
  return /^translated:\s*true$/m.test(fm.raw);
}

function addTranslatedFlag(content) {
  return content.replace(/^---\n/, '---\ntranslated: true\n');
}

async function translate(text, sourceLang, targetLang) {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 16384,
    messages: [
      {
        role: 'user',
        content: `Translate this blog post from ${LANG_NAMES[sourceLang]} to ${LANG_NAMES[targetLang]}.

Rules:
- Keep all markdown formatting exactly as is
- Translate frontmatter fields: title, description, tags
- Do NOT change: date, author, image
- Do NOT add a "translated" field
- Return the complete markdown file with frontmatter (---) delimiters
- Do not wrap in code blocks, return raw markdown only

${text}`,
      },
    ],
  });

  if (message.stop_reason === 'max_tokens') {
    throw new Error(`Translation truncated (hit max_tokens). Source may be too long for ${LANG_NAMES[targetLang]}.`);
  }

  return message.content[0].text;
}

function getTargetPath(filePath, sourceLang, targetLang) {
  return filePath.replace(`/blog/${sourceLang}/`, `/blog/${targetLang}/`);
}

function needsTranslation(sourcePath, targetPath) {
  if (!existsSync(targetPath)) return true;
  const sourceMtime = statSync(sourcePath).mtimeMs;
  const targetMtime = statSync(targetPath).mtimeMs;
  return sourceMtime > targetMtime;
}

async function handleFile(event, filePath) {
  log(`Event: ${event} → ${filePath}`);

  if (!filePath.endsWith('.md')) {
    log(`  Skip: not a .md file`);
    return;
  }

  if (pending.has(filePath)) {
    log(`  Skip: already processing`);
    return;
  }

  const sourceLang = LANGS.find((l) => filePath.includes(`/blog/${l}/`));
  if (!sourceLang) {
    log(`  Skip: no language detected in path`);
    return;
  }

  const content = readFileSync(filePath, 'utf-8');

  if (!parseFrontmatter(content)) {
    log(`  Skip: no valid frontmatter`);
    return;
  }

  if (hasTranslatedFlag(content)) {
    log(`  Skip: translated: true`);
    return;
  }

  const filename = basename(filePath);
  const forceUpdate = event === 'change';
  const targetLangs = LANGS.filter((l) => l !== sourceLang);
  const targets = targetLangs
    .map((l) => ({ lang: l, path: getTargetPath(filePath, sourceLang, l) }))
    .filter((t) => {
      if (forceUpdate) return true;
      const needs = needsTranslation(filePath, t.path);
      if (!needs) log(`  Skip ${t.lang}/${filename}: translation up to date`);
      return needs;
    });

  if (targets.length === 0) {
    log(`  Skip: all translations up to date`);
    return;
  }

  pending.add(filePath);
  const targetNames = targets.map((t) => t.lang).join(', ');
  log(`${forceUpdate ? 'Updating' : 'Translating'}: ${sourceLang}/${filename} → [${targetNames}]`);

  const translated = [];

  for (const target of targets) {
    try {
      if (forceUpdate) log(`  🔄 Обновляю перевод: ${target.lang}/${filename}`);
      log(`  API call: ${sourceLang} → ${target.lang}...`);
      const result = await translate(content, sourceLang, target.lang);
      const flagged = addTranslatedFlag(result);
      mkdirSync(dirname(target.path), { recursive: true });
      writeFileSync(target.path, flagged);
      translated.push(`${target.lang}/${filename}`);
      log(`  Saved: ${target.path}`);
    } catch (err) {
      console.error(`  Error translating to ${target.lang}:`, err);
    }
  }

  if (translated.length > 0) {
    log(`Done: ${sourceLang}/${filename} → ${translated.join(', ')}`);
  }

  pending.delete(filePath);
}

function deleteTranslations(filePath) {
  const sourceLang = LANGS.find((l) => filePath.includes(`/blog/${l}/`));
  if (!sourceLang) return;

  const filename = basename(filePath);
  const deleted = [];

  for (const lang of LANGS.filter((l) => l !== sourceLang)) {
    const targetPath = getTargetPath(filePath, sourceLang, lang);
    if (existsSync(targetPath)) {
      unlinkSync(targetPath);
      deleted.push(`${lang}/${filename}`);
      log(`  Deleted: ${targetPath}`);
    }
  }

  if (deleted.length > 0) {
    log(`🗑 Удалён: ${sourceLang}/${filename} → удалены ${deleted.join(', ')}`);
  }
}

const watcher = chokidar.watch(`${BLOG_DIR}/**/*.md`, {
  ignoreInitial: false,
  awaitWriteFinish: { stabilityThreshold: 1000 },
});

watcher.on('add', (path) => handleFile('add', path));
watcher.on('change', (path) => handleFile('change', path));
watcher.on('unlink', (path) => {
  log(`Event: unlink → ${path}`);
  deleteTranslations(path);
});
watcher.on('ready', () => log('Initial scan complete. Watching for changes...'));

log('Starting watcher...');
