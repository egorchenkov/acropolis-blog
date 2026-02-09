import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'fs';
import { basename, join } from 'path';
import Anthropic from '@anthropic-ai/sdk';

const LANGS = ['ru', 'en', 'uz'];
const LANG_NAMES = { ru: 'Russian', en: 'English', uz: 'Uzbek' };
const BLOG_DIR = 'src/content/blog';

const client = new Anthropic();

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
    max_tokens: 4096,
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

  return message.content[0].text;
}

let translated = 0;

for (const sourceLang of LANGS) {
  const dir = join(BLOG_DIR, sourceLang);
  if (!existsSync(dir)) continue;

  const files = readdirSync(dir).filter((f) => f.endsWith('.md'));

  for (const file of files) {
    const filePath = join(dir, file);
    const content = readFileSync(filePath, 'utf-8');

    if (!parseFrontmatter(content)) continue;
    if (hasTranslatedFlag(content)) continue;

    const targetLangs = LANGS.filter((l) => l !== sourceLang);

    for (const targetLang of targetLangs) {
      const targetDir = join(BLOG_DIR, targetLang);
      const targetPath = join(targetDir, file);

      if (existsSync(targetPath)) continue;

      console.log(`Translating: ${sourceLang}/${file} → ${targetLang}/${file}...`);
      try {
        const result = await translate(content, sourceLang, targetLang);
        const flagged = addTranslatedFlag(result);
        mkdirSync(targetDir, { recursive: true });
        writeFileSync(targetPath, flagged);
        translated++;
        console.log(`  Saved: ${targetPath}`);
      } catch (err) {
        console.error(`  Error translating to ${targetLang}:`, err.message);
      }
    }
  }
}

console.log(`Done. Translated ${translated} file(s).`);
