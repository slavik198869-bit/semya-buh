# semya-buh — лендинг «СемьЯ-Бух»

Статический лендинг для Cloudflare Pages. Публикуется автоматически при каждом push в ветку `main`.

## Состав

| Путь | Что это |
| --- | --- |
| `index.html` | Страница сайта (корень домена) |
| `as/` | CSS и JS оформления |
| `images/` | Фотографии |
| `icons/` | Иконка вкладки и знак в шапке |
| `local-fonts/` | Шрифты Open Sans локально |
| `functions/api/lead.js` | Pages Function: приём заявки на `/api/lead`, отправка в Telegram |

## Настройки Cloudflare Pages

- Framework preset: **None**
- Build command: пусто
- Build output directory: `/`
- Environment variables: `TG_TOKEN` (Secret), `TG_CHAT_ID`

## Правки

Страницу правим в рабочем проекте `E:\modulsoft-copy\nastya.html`, затем копируем сюда как `index.html`
и коммитим. Текст дублируется в массив `slides` в `build-nastya.js` — сборщик не запускается.

Перед коммитом проверка: `node --check functions/api/lead.js`.
