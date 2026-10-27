# Публикация на GitHub Pages

Игра собирается в статическую папку `dist`. Workflow `.github/workflows/pages.yml`
устанавливает зависимости, запускает тесты, собирает игру и публикует результат
при push в `master`. Также доступен ручной запуск через Actions → Deploy game to
GitHub Pages → Run workflow.

## Первое включение

1. В репозитории `gartonot/mutant-game` открыть Settings → Pages.
2. В Build and deployment → Source выбрать **GitHub Actions**.
3. Отправить изменения проекта в `master`, включая новые исходники и используемые
   ресурсы. Локальные незакоммиченные файлы не попадают в сборку на GitHub.
4. Дождаться успешного workflow в Actions.

Ожидаемый адрес: https://gartonot.github.io/mutant-game/.
Для GitHub Free репозиторий должен быть публичным.

Путь ресурсов берётся из `actions/configure-pages` через `PAGES_BASE_PATH`.
Это также позволяет использовать корневой адрес или настроенный собственный домен.
Для локальной разработки переменная не нужна: `npm run dev` работает от `/`.
Секреты и персональный токен для публикации не требуются — используется встроенный
`GITHUB_TOKEN` с разрешениями workflow.

## Проверка сборки с путём Pages (PowerShell)

```powershell
$env:PAGES_BASE_PATH = '/mutant-game/'
npm run build
npm run preview
```

Открыть http://localhost:4173/mutant-game/. После остановки preview очистить
переменную в этом терминале:

```powershell
Remove-Item Env:PAGES_BASE_PATH
```

Не нужно коммитить `dist` или `node_modules`. Публикуется только `dist`, а не весь
репозиторий. GitHub Pages обслуживает статические файлы; серверные возможности
потребуют отдельного сервиса.

Документация: https://vite.dev/guide/static-deploy.html#github-pages
