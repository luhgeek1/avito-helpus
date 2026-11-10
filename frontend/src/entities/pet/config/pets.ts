import { orbiFamily } from "./orbi-family";
import { mascots } from "./mascots";
import type { Pet } from "../model/types";
const originalPets: Pet[] = [
  {
    id: "cat",
    name: "Байт",
    kind: "Кот",
    category: "animals",
    description:
      "Спокойный напарник с любопытным носом. Поможет освоиться, а потом уютно устроится рядом.",
    personality: "Любопытный · спокойный",
    greeting: "Мур! Давай разберёмся со всем по порядку?",
    color: "#7461c8",
    bg: "#eeebfb",
    palette: ["#454373", "#8583d3", "#b5b5ed", "#eeedff"],
  },
  {
    id: "corgi",
    name: "Бублик",
    kind: "Корги",
    category: "animals",
    description:
      "Короткие лапки, большое сердце. Поддержит перед первой задачей и порадуется твоим маленьким победам.",
    personality: "Дружелюбный · энергичный",
    greeting: "Гав! Новая команда — это столько новых друзей!",
    color: "#b87a29",
    bg: "#fff0d9",
    palette: ["#754e35", "#d99a4e", "#f5c577", "#fff5df"],
  },
  {
    id: "owl",
    name: "Вики",
    kind: "Сова",
    category: "animals",
    description:
      "Хранительница полезных знаний. Любит хорошие вопросы и знает, что спрашивать — совершенно нормально.",
    personality: "Внимательная · мудрая",
    greeting: "Угу! Даже самый сложный вопрос с чего-то начинается.",
    color: "#9364b4",
    bg: "#f4eafa",
    palette: ["#554065", "#a47bc3", "#d2b4e4", "#fff2db"],
  },
  {
    id: "robot",
    name: "Пикс",
    kind: "Робот",
    category: "unusual",
    description:
      "Маленький проводник по большим процессам. Всё разложит по полочкам, но никогда не забудет улыбнуться.",
    personality: "Собранный · заботливый",
    greeting: "Бип! Все системы готовы. А как твой первый день?",
    color: "#298b7d",
    bg: "#e1f3ec",
    palette: ["#325969", "#59b8ab", "#a6e0ca", "#edfff5"],
  },
  {
    id: "fox",
    name: "Искра",
    kind: "Лис",
    category: "animals",
    description:
      "Находит короткую дорогу даже в незнакомых процессах. А ещё у него самый пушистый хвост в команде.",
    personality: "Находчивый · смелый",
    greeting: "Пс-с! Вместе мы точно найдём, с чего начать.",
    color: "#c77344",
    bg: "#fff0e7",
    palette: ["#754132", "#dc864d", "#f8b275", "#fff2dc"],
  },
  {
    id: "frog",
    name: "Квак",
    kind: "Лягушонок",
    category: "animals",
    description:
      "Мастер маленьких шагов и больших прыжков. Напомнит сделать перерыв и спокойно перейти к следующей задаче.",
    personality: "Беззаботный · добрый",
    greeting: "Ква! Один маленький шаг — и ты уже ближе к цели.",
    color: "#568638",
    bg: "#edf4dc",
    palette: ["#405d3a", "#89b955", "#b9d880", "#eef6c6"],
  },
  {
    id: "penguin",
    name: "Пинг",
    kind: "Пингвин",
    category: "animals",
    description:
      "Немного стесняется, зато всегда рядом. Понимает, каково быть новичком, и помогает почувствовать себя своим.",
    personality: "Деликатный · надёжный",
    greeting: "Привет! Я тоже сначала стеснялся. Освоимся вместе?",
    color: "#478aaf",
    bg: "#e7f2fc",
    palette: ["#334e70", "#628cae", "#a6cce4", "#f7f8ee"],
  },
  {
    id: "axolotl",
    name: "Луми",
    kind: "Аксолотль",
    category: "animals",
    description:
      "Улыбка на коротких лапках. Умеет сохранять спокойствие, даже если вокруг всё новое и непонятное.",
    personality: "Мягкий · оптимистичный",
    greeting: "Привет-привет! Как ты себя сегодня чувствуешь?",
    color: "#ba6e91",
    bg: "#fcebf3",
    palette: ["#85506f", "#dfa0ba", "#f4c4d6", "#ffe9ee"],
  },
  {
    id: "sprout",
    name: "Сид",
    kind: "Росток",
    category: "unusual",
    description:
      "Растёт вместе с тобой. Каждый новый навык — ещё один листочек, а для хорошего старта нужно немного заботы.",
    personality: "Терпеливый · вдохновляющий",
    greeting: "Смотри, сколько нового! Будем расти понемногу.",
    color: "#528675",
    bg: "#e8f2e9",
    palette: ["#3d6651", "#73ab6b", "#abc98c", "#bf9add"],
  },
  {
    id: "dragon",
    name: "Драко",
    kind: "Дракончик",
    category: "unusual",
    description:
      "Совсем не страшный защитник от страха ошибиться. Верит в тебя даже тогда, когда ты пока сомневаешься.",
    personality: "Храбрый · преданный",
    greeting: "Р-р! Ошибаться можно. Я прикрою, а ты пробуй!",
    color: "#8065bc",
    bg: "#efebfb",
    palette: ["#53406e", "#9276c7", "#c2a6e5", "#9dd9c2"],
  },
];

export const pets: Pet[] = [...orbiFamily, ...mascots, ...originalPets];

// Original Orbi is the reference character and the default gallery preview.
export const defaultPet: Pet =
  pets.find((pet) => pet.id === "orbit") ?? pets[0];
