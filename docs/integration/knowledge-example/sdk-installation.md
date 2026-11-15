---
slug: sdk-installation
title: "Установка библиотеки Орби"
kind: guide
scope: company
roles: [intern, mentor, lead, hrbp, admin]
owner: "Команда Орби (демо)"
updated_at: 2026-11-15
---
## Как установить Орби

Тестовая инструкция, не регламент Авито.
До публикации установите проверенный архив командой `npm install ./orbi-companion-react-0.1.0.tgz`.
Импортируйте `OrbiCompanion` из `@orbi-companion/react` и разместите один экземпляр рядом
с приложением: `<OrbiCompanion apiUrl="/api/v1" />`. Стили и шрифты уже включены.
React и React DOM версии 19 должны быть установлены в приложении.

## Подключение сервера

Для полноценного чата запустите сервер Орби, настройте проксирование `/api/v1`
и войдите через виджет. MCP-сервисы и ключ модели настраиваются только на сервере.
Документы добавляет оператор через `python -m app.cli knowledge-import /path/to/documents`.
