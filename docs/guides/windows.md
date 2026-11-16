# Запуск на Windows без make

Основной запуск через `docker compose up` одинаков на всех системах. Здесь команды для тестов и
покрытия в PowerShell, если `make` нет. Нужны Python 3.13 и uv.

```powershell
docker compose -p buddy-test -f docker-compose.test.yml up -d --wait
Set-Location backend
uv sync --locked
uv run pytest -q                       # make test
uv run ruff check .                    # вместе с pytest это make check
uv run ruff format --check .
uv run mypy
Set-Location ..
```

Покрытие (то же, что `make coverage`) после запуска тестовых баз:

```powershell
Set-Location backend
uv run pytest -q --cov=app --cov-report=term --cov-report=xml:../reports/backend-coverage.xml --cov-report=lcov:../reports/backend.lcov
Set-Location ..
npm --prefix frontend ci
npm --prefix frontend run coverage
python deploy/coverage_report.py
```

Smoke-проверка: `python deploy/smoke.py`. Обёртка `deploy/smoke.sh` пробует `python3`, затем `python`
и проверяет, что это Python 3, поэтому заглушку из Microsoft Store она не примет.

`tzdata` входит в зависимости бэкенда и `corp-mock`, системная база часовых поясов не нужна. Если у
pytest нет доступа к общей временной папке, добавьте внутри `backend`
`-p no:cacheprovider --basetemp="$env:TEMP/orbi-pytest"`.

Интеграционные тесты очищают отдельную базу `buddy_test` на порту 5439 и Redis на 6380, поэтому
перед запуском завершите другие прогоны.
