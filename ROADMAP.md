# 🗺️ Pirate Battleship — Roadmap

> Статус обновляется по мере выполнения подзадач.

---

## ✅ Выполнено

### Подзадача 1 — Базовая игровая механика
- `src/game/logic.ts`, `src/game/types.ts`
- Генерация поля `randomBoard`, логика атаки `playerAttack` / `aiAttackStep`
- Базовый AI: hunt/target с `aiMemory`

### Подзадача 2 — 3D-сцена (базовая)
- `src/three/Arena.tsx`
- GLSL-тайлы воды с hover/hit/miss анимацией
- Корабли из `BoxGeometry`, мачты, паруса, пушки
- Postprocessing: Bloom + Vignette
- Камера: анимированный переход между полями

### Подзадача 3 — VFX
- `src/three/VFX.tsx`, `src/three/Water.tsx`
- `OceanPlane` — Fresnel-вода, normal distortion, specular
- `HullFoam` — пена у бортов корабля
- `FireParticles` — огонь при попадании (InstancedMesh, vertexColors)
- `MissSplash` / `SplashRing` — брызги при промахе
- `SinkVFX` — пузыри + дым при потоплении

### Подзадача 4 — Модели + оптимизация
- `src/three/Ships.tsx`
- Корпус через `LatheGeometry` (органичный профиль лодки)
- Паруса с sin-деформацией в вершинном шейдере (надуваются от ветра)
- Рейлинг и палубные планки через `InstancedMesh` (1 draw call)
- `React.memo` на тайлах воды, кораблях, компонентах VFX
- `new THREE.Matrix4()` вынесен из render-цикла в `useMemo`

### Fix — ESM / зависимости
- `package.json`: `"type": "module"` для совместимости `vite-plugin-glsl`
- `three` поднят до `^0.169.0` для совместимости с `postprocessing ^6.39.1`

---

## 🔲 В очереди

### Подзадача 5 — Умный AI
**Файл:** `src/game/logic.ts`

- [ ] **Directed hunt** — запоминать ось после 2 попаданий подряд, стрелять только вдоль неё, разворачиваться при упоре в край
- [ ] **Parity fix** — в hunt-режиме честная фильтрация `(x+y)%2===0`, убрать смешанные приоритеты
- [ ] **Probability map** — для каждой свободной клетки считать сколько незатопленных кораблей через неё проходит → стрелять в максимум
- [ ] **Корректный сброс памяти** — после потопления не сбрасывать `aiMemory=[]` если рядом есть другие подбитые клетки без потопленного корабля

---

### Подзадача 6 — Расстановка кораблей
**Файлы:** `src/screens/PlacementScreen.tsx`, `src/App.tsx`

- [ ] Отдельный экран перед боем: 2D-сетка поверх Three.js фона
- [ ] Drag корабля мышью, клавиша `R` — ротация
- [ ] Подсветка клеток зелёный/красный (можно / нельзя поставить)
- [ ] Кнопка «Случайно» — использует существующий `randomBoard`
- [ ] Кнопка «Начать бой» → переход в фазу `playing`
- [ ] Фаза `'placement'` добавляется в `GamePhase`

---

### Подзадача 7 — Game HUD
**Файлы:** `src/components/HUD.tsx`, `src/App.module.css`

- [ ] Overlay «ВАШ ХОД» / «ХОД ПРОТИВНИКА» при смене хода (fade 1.5 с, анимированный)
- [ ] Прогресс-бар флотов: `Флот противника ████░░░ 7/10`
- [ ] Счётчик попаданий / промахов текущей партии
- [ ] Таймер хода (30 с → автоматический промах при истечении)

---

### Подзадача 8 — Звук
**Файл:** `src/game/sound.ts`

- [ ] Подключить `Howler.js` (~7 KB)
- [ ] Звуки: пушечный выстрел, попадание, промах (всплеск), потопление
- [ ] Фоновый шум моря / ветра (looping ambient)
- [ ] Кнопка mute 🔇 в углу экрана

---

### Подзадача 9 — Архитектура: useReducer
**Файлы:** `src/game/reducer.ts`, `src/App.tsx`

- [ ] `gameReducer` + типы `GameAction` (`PLAYER_ATTACK`, `AI_ATTACK`, `START_GAME`, `RESET`)
- [ ] `useReducer` вместо 6 `useState` в `App.tsx`
- [ ] AI-ход через `dispatch` + `useEffect` — убрать `setTimeout`-хаки
- [ ] Подготовка к мультиплееру / replay (чистая история действий)

---

### Подзадача 10 — Финальный polish
**Файлы:** разные

- [ ] `Suspense` + `lazy` для Three.js Canvas — быстрый первый экран без блокировки
- [ ] Экран победы/поражения с анимацией (сейчас просто текст в overlay)
- [ ] Кнопка «Реванш» без перезагрузки страницы (сброс `GameState`)
- [ ] Мобильная адаптация: touch events на тайлах воды (Three.js pointer events)
- [ ] `README.md` с описанием архитектуры и скриншотами

---

## 🏗️ Архитектура проекта

```
src/
├── game/
│   ├── types.ts          # Cell, Board, Ship, GameState, LogEntry
│   ├── logic.ts          # randomBoard, playerAttack, aiAttackStep
│   └── reducer.ts        # (подзадача 9) GameAction, gameReducer
│
├── three/
│   ├── Arena.tsx         # Canvas + InnerScene + Board3D + WaterTile + HitRing
│   ├── Ships.tsx         # PirateShip (LatheGeometry, sin-sail, InstancedMesh)
│   ├── Water.tsx         # OceanPlane (Fresnel), HullFoam
│   └── VFX.tsx           # FireParticles, MissSplash, SinkVFX
│
├── screens/
│   ├── Menu.tsx / .css
│   ├── GameOver.tsx / .css
│   └── PlacementScreen.tsx / .css  # (подзадача 6)
│
├── components/
│   ├── Hud.tsx           # боковая панель, лог
│   ├── MiniMap.tsx       # мини-карта в углу
│   └── HUD.tsx           # (подзадача 7) overlay хода + прогресс + таймер
│
├── App.tsx               # роутинг экранов, игровой цикл
├── App.module.css
└── main.tsx
```

---

## 🔧 Стек

| Слой | Технология |
|---|---|
| Фреймворк | React 18 + TypeScript |
| 3D | Three.js 0.169 + @react-three/fiber + @react-three/drei |
| Постпроцессинг | @react-three/postprocessing + postprocessing 6.39 |
| Шейдеры | GLSL (vite-plugin-glsl) |
| Звук | Howler.js (подзадача 8) |
| Сборка | Vite 5 + ESM |
