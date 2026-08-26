<div align="center">

# ⚡ f-insight

**Современное Chrome-расширение для FACEIT CS2: real-time телеметрия лобби, MR12 предикты, детекция смурфов и тактический анализ вето карт.**

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://react.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Game](https://img.shields.io/badge/CS2-FACEIT%20Ready-FF5500?style=flat-square)](https://www.faceit.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](../LICENSE)

[Возможности](#-ключевые-возможности) • [Архитектура](#-архитектура) • [Установка](#-установка-и-сборка) • [Безопасность](#-безопасность-и-правила-faceit) • [English Version](README_EN.md)

</div>

---

## 📌 Обзор

**f-insight** объединяет real-time аналитику комнат матчей FACEIT, многофакторный прогноз победы (MR12), эвристический скоринг смурфов и автоматизацию рутинных действий в быстром расширении на **Chrome Manifest V3** с нулевой начальной настройкой.

---

## ✨ Ключевые возможности

<table>
  <tr>
    <td width="50%" valign="top">
      <h4>⚡ Автоматизация и QoL</h4>
      <ul>
        <li><b>Auto Ready-Up:</b> Автоматическое подтверждение готовности при нахождении матча.</li>
        <li><b>Защита от AFK:</b> Закрытие диалогов "Are you still here?".</li>
        <li><b>1-Click Connect IP:</b> Быстрое копирование IP и запуск через steam-ссылку.</li>
        <li><b>Режим сна:</b> Отключение расширения вне матч-румов (тумблер Extension Status во вкладке Overview).</li>
      </ul>
    </td>
    <td width="50%" valign="top">
      <h4>🧠 Многофакторный MR12 Предикт</h4>
      <ul>
        <li><b>Синергетическая модель:</b> Базовый Elo, винрейт на карте (±12%), моментум игроков (±10%), сыгранность пати (±8%).</li>
        <li><b>Симуляция счета:</b> Вероятный счет матча (<code>13 : 9</code> или <code>13 : 11 OT</code>).</li>
        <li><b>FCR Рейтинг:</b> Оценка доли огневой мощи каждого игрока в команде.</li>
        <li><b>Клик по игроку — сразу флаут:</b> карточка открывается мгновенно даже пока полная статистика грузится, и честно помечает, какие данные ещё не пришли.</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h4>🗺️ Тактический Помощник Вето</h4>
      <ul>
        <li><b>Живой пул карт CS2:</b> Пул самообучается на трафике матчей и работает уже с фазы ACCEPT, до начала вето.</li>
        <li><b>План для капитана:</b> Рекомендации Priority 1 Best Pick и Must Ban на основе статов соперника.</li>
        <li><b>Шорткаты:</b> Нажатие <code>Alt + V</code> для мгновенного вызова оверлея вето.</li>
      </ul>
    </td>
    <td width="50%" valign="top">
      <h4>🚨 Детектор Смурфов и Радар</h4>
      <ul>
        <li><b>Скоринг рисков (0–100%):</b> Выявление подозрительных аккаунтов с аномальным винрейтом и K/D.</li>
        <li><b>Аудит Steam:</b> Проверка часов в CS2, возраста аккаунта и VAC-банов.</li>
        <li><b>5-осевой Радар:</b> Наглядная оценка параметров Firepower, Damage, Precision, Winrate, Impact.</li>
      </ul>
    </td>
  </tr>
</table>

---

## 🏛️ Архитектура

**Гибридный канал данных.** Основной источник — пассивное наблюдение за JSON-трафиком, который страница FACEIT и так загружает (детали матча, профили игроков, статистика): MAIN-world хук клонирует ответы и передает их расширению через изолированный мост. Собственные запросы к API — только резервный канал с мягким пейсингом (интервал между запросами, backoff при троттлинге). Это исключает выедание лимита домена и «Action Failed» в интерфейсе FACEIT.

Ключевые слои:

| Слой | Ответственность |
|---|---|
| `network-hook.js` (MAIN world) | Перехват ответов api.faceit.com без модификации запросов |
| Content script (Shadow DOM) | SPA-роутинг, DOM-сканирование игроков, React-микрокорни UI |
| Service worker (MV3) | Анализ, кэш с TTL, парсеры payload'ов, автоматизации |
| Самонаблюдаемый пул карт | Учится на перехваченных матчах — veto-матрица работает до голосования |

Полная схема потоков данных и контракты модулей — в [CODE_DOCUMENTATION.md](CODE_DOCUMENTATION.md).

---

## 🛠️ Установка и Сборка

### Сборка из исходного кода

```bash
# 1. Клонировать репозиторий
git clone https://github.com/m0rvey/f-insight.git
cd f-insight

# 2. Установить зависимости
npm install

# 3. Собрать бандл расширения
npm run build
```

Собранные файлы расширения появятся в папке `dist/`.

### Загрузка в Google Chrome / Brave / Edge
1. Откройте страницу `chrome://extensions/` в браузере.
2. Включите **Режим разработчика** (тумблер в правом верхнем углу).
3. Нажмите **Загрузить распакованное расширение** и выберите папку `dist/`.

---

## 🔒 Безопасность и Правила FACEIT

- **Безопасность:** Расширение использует только публичные API, наблюдение за DOM и пассивное чтение JSON-ответов, которые страница сама получает от `api.faceit.com` (запросы не модифицируются и не подменяются). Никакого вмешательства в память игры или процессы античита.
- **Приватность:** Все вычисления производятся локально в браузере без передачи токенов или учетных данных куда-либо.

---

## 📄 Лицензия

Распространяется под лицензией **MIT**. См. [LICENSE](../LICENSE).  
Автор: [m0rvey](https://github.com/m0rvey).
