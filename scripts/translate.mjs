import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { basename, dirname, join } from 'path';
import Anthropic from '@anthropic-ai/sdk';

const LANGS = ['ru', 'en', 'uz'];
const LANG_NAMES = { ru: 'Russian', en: 'English', uz: 'Uzbek' };

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: npm run translate -- src/content/blog/ru/post.md');
  process.exit(1);
}

const sourceLang = LANGS.find((l) => inputPath.includes(`/blog/${l}/`));
if (!sourceLang) {
  console.error('Could not detect source language from path. Expected /blog/ru/, /blog/en/, or /blog/uz/');
  process.exit(1);
}

const targetLangs = LANGS.filter((l) => l !== sourceLang);
const filename = basename(inputPath);
const source = readFileSync(inputPath, 'utf-8');

const client = new Anthropic();

async function translate(text, targetLang) {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `Translate this blog post from ${LANG_NAMES[sourceLang]} to ${LANG_NAMES[targetLang]}.

Rules:
- Keep all markdown formatting exactly as is
- Translate frontmatter fields: title, description, tags
- Do NOT change: date, author, image
- Return the complete markdown file with frontmatter (---) delimiters
- Do not wrap in code blocks, return raw markdown only

${text}`,
      },
    ],
  });

  return message.content[0].text;
}

for (const targetLang of targetLangs) {
  console.log(`Translating to ${LANG_NAMES[targetLang]}...`);
  const translated = await translate(source, targetLang);
  const targetDir = join(dirname(inputPath).replace(`/blog/${sourceLang}`, `/blog/${targetLang}`));
  mkdirSync(targetDir, { recursive: true });
  const targetPath = join(targetDir, filename);
  writeFileSync(targetPath, translated);
  console.log(`  Saved: ${targetPath}`);
}

console.log('Done.');
