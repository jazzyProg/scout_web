# Scout — интерфейс

Фронт сервиса поиска людей и контактов (React + Vite). Это только интерфейс: данных и ключей в нём нет,
всё лежит на сервере и закрыто паролем.

## Публикация на GitHub Pages

1. Скопируйте содержимое этой папки (`app/web`) в корень публичного репозитория, включая `.github/`.
2. В репозитории откройте **Settings → Pages → Source** и выберите **GitHub Actions**.
3. Откройте **Settings → Secrets and variables → Actions → Variables → New repository variable**:
   * имя: `VITE_API_URL`;
   * значение: публичный адрес API, например `https://perliv.tail1defb3.ts.net:8443`.
4. Сделайте push в `main`. Workflow `Deploy to GitHub Pages` соберёт сайт и опубликует его по адресу
   `https://<логин>.github.io/<репозиторий>/`.
5. Сообщите этот адрес администратору сервера: его нужно добавить в `APP_ORIGINS` в `.env` на сервере, иначе браузер
   не пустит запросы к API (CORS).

## Локальная разработка

```bash
npm install
VITE_API_URL=https://perliv.tail1defb3.ts.net:8443 npm run dev
```
