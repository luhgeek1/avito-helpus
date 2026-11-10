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
