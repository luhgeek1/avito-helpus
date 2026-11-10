# Работа над проектом

- Общайся с пользователем на русском, если он не просит другое.
- Перед работой прочитай `TASK.md`, `PRODUCT.md`, `DESIGN.md` и `CONTEXT.md`.
- `TASK.md` содержит исходное ТЗ хакатона; текущий согласованный объём работы описан в `PRODUCT.md` и последних поручениях пользователя.
- После значимого этапа и перед завершением работы добавляй в `CONTEXT.md` запись об изменениях, решениях, идеях, проверках и оставшейся работе. Сохраняй чужие записи и обновляй текущее состояние.
- Для интерфейса придерживайся `DESIGN.md`. Новые маскоты рисуются в `frontend/src/entities/pet/lib/mascot-sprites.ts`, исходная серия и диспетчер — в `frontend/src/entities/pet/lib/sprite.ts`; данные и палитры находятся в `frontend/src/entities/pet/config/mascots.ts` и `frontend/src/entities/pet/config/pets.ts` на целочисленной пиксельной сетке; исходные персонажи — 32×32, детальные вариации Орби — 64×64. Проверяй все кадры и поддержку reduced motion.
- Перед завершением изменений приложения выполни `npm run build` и проверь изменённые экраны на десктопе и телефоне.

- Фронтенд находится в `frontend/` и следует FSD: `app → pages → widgets → features → entities → shared`. Используй публичные API слайсов (`index.ts`), не допускай импортов вверх и между слайсами одного слоя. Подробности — в `frontend/README.md`.
- Серверный код размещай в `backend/`. Пока там только описание; реализация API требует отдельной задачи.
- Фронтенд — самостоятельное приложение. Выполняй `npm ci`, `npm run dev`, `npm run build`, `npm run check:architecture` внутри `frontend/`; его package.json, package-lock.json и node_modules находятся там же. Для вызова из корня можно использовать `npm --prefix frontend run build`. Корневого npm workspace нет. Проверяй архитектуру после изменений структуры или импортов.

- Текущий ориентир — Орби (`orbit`): большой одиночный глаз и цветные спутники. Его новые вариации находятся в `frontend/src/entities/pet/config/orbi-family.ts`, рисование — в `frontend/src/entities/pet/lib/orbi-sprites.ts`. У категории `orbi` обязателен `orbiDesign`; сохраняй общие черты семейства и прозрачную рамку всех кадров.

- Последний выбор направления: Орби — парящий робот без рук, ног и двигателей; частицы должны оставаться отделёнными от корпуса. Не возвращай удалённые конечности у 15 вариаций. Исключение — оригинальный `orbit`: по последней явной правке пользователя он восстановлен в самой первой версии с фиолетовыми боковыми деталями, ножками и розовым шарфом. Избранные реализованы в `features/pet/favorite` и общем состоянии `entities/pet`; сохраняй лайки (`buddy-favorites`) отдельно от выбранного спутника (`buddy-pet`).

- По последней просьбе пользователя основным снова является оригинальный Орби (`orbit`) со скриншота: он первый в своей группе, `defaultPet` для предпросмотра и доступен через `/pets?pet=orbit`. Не подменяй его Нео; лайки и сохранённый выбор не сбрасывай.

- Все 15 вариаций `orbi-*` получили детальную отрисовку 64×64: `orbi-base.ts` задаёт форму на 32×32, `orbi-sprites.ts`, `orbi-details.ts` и `orbi-detail-painter.ts` добавляют детали. Оригинальный `orbit` по-прежнему рисуется в `mascot-sprites.ts` на 32×32 и не проходит через этот рендерер. При дальнейших изменениях защищай его 4 кадра первой версии.

- В корне проекта оставляй только Markdown-документы и папки `frontend/`, `backend/` (служебную `.git/` сохраняй). Все исходники, зависимости и материалы петов, изображения, записи и отчёты размещай в `frontend/`. Общий каталог визуальных материалов — `frontend/design/`, отчёты и скриншоты — `frontend/design/captures/`.

- Write code comments and Git commit titles/bodies in English. Keep user-facing interface text and project documentation in Russian unless requested otherwise.

- Keep application-code changes in each commit within 150 added/deleted lines. Configuration, dependency lockfiles, documentation, and verification reports are exempt; commit them as complete logical changes instead of splitting them to meet this limit.
