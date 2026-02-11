# ACROPOLIS INTEGRO Blog

Мультиязычный блог компании ACROPOLIS INTEGRO с автоматическим переводом постов.

## Стек

- [Astro 5](https://astro.build/) — SSG-фреймворк
- [Tailwind CSS 4](https://tailwindcss.com/) — стилизация
- [Decap CMS](https://decapcms.org/) — админ-панель для контента
- [Claude API](https://docs.anthropic.com/) — автоматический перевод постов

## Языки

- **ru** (по умолчанию)
- **en**
- **uz**

Маршрутизация i18n — ручная (`routing: 'manual'`), с кастомным middleware для обхода `/admin/`.

## Структура проекта

```
src/
  components/
    BaseLayout.astro       # Основной layout
    Header.astro           # Навигация + переключатель языков
    Footer.astro
    BlogCard.astro         # Карточка поста
  content/blog/
    ru/                    # Оригиналы постов (пишутся через CMS)
    en/                    # Автоматические переводы
    uz/                    # Автоматические переводы
  pages/
    index.astro            # Редирект → /ru/
    admin/index.astro      # Decap CMS
    {ru,en,uz}/
      index.astro          # Главная
      blog/
        index.astro        # Список постов
        [slug].astro       # Страница поста
  middleware.ts            # Обход i18n для /admin/
scripts/
  translate.mjs            # Перевод одного поста
  watch-translate.mjs      # Watcher — автоперевод при изменениях
  translate-all.mjs        # Пакетный перевод (для CI)
public/
  admin/config.yml         # Конфигурация Decap CMS
  uploads/                 # Медиафайлы
```

## Скрипты

| Команда | Описание |
|:--------|:---------|
| `npm run dev` | Astro dev-сервер (порт 4321) |
| `npm run build` | Сборка для продакшена в `./dist/` |
| `npm run preview` | Превью сборки |
| `npm run cms` | Decap CMS прокси-сервер (порт 8081) |
| `npm run watch:translate` | Watcher автоперевода |
| `npm run dev:full` | Все три сервера одновременно |
| `npm run translate -- path/to/post.md` | Ручной перевод одного поста |

## Локальная разработка

```bash
# Установка зависимостей
npm install

# Запуск всего стека (dev-сервер + CMS + автоперевод)
npm run dev:full
```

Для работы CMS локально — раскомментировать `local_backend: true` в `public/admin/config.yml`.

Для автоперевода нужен API-ключ Anthropic в `.env`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

## Автоперевод

Посты пишутся на русском через Decap CMS. Переводы генерируются автоматически:

- **Локально**: `npm run watch:translate` — следит за `src/content/blog/ru/` и переводит в `en/` и `uz/`
- **CI**: При пуше в `main` GitHub Actions запускает `translate-all.mjs`, коммитит переводы и деплоит

Переведённые файлы помечаются `translated: true` в frontmatter для предотвращения повторного перевода.

## Деплой

Продакшен деплоится через **Coolify**, который триггерится вебхуком из GitHub Actions после автоперевода.

### GitHub Secrets

| Секрет | Описание |
|:-------|:---------|
| `ANTHROPIC_API_KEY` | API-ключ Claude для перевода |
| `COOLIFY_DEPLOY_URL` | URL вебхука Coolify |
| `COOLIFY_TOKEN` | Bearer-токен для авторизации в Coolify |
