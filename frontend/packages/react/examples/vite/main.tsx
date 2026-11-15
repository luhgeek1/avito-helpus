import { StrictMode, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { OrbiCompanion } from "@orbi-companion/react";
import type { OrbiHandle } from "@orbi-companion/react";

function App() {
  const buddy = useRef<OrbiHandle>(null);
  const [mounted, mount] = useState(true);
  const connected = new URLSearchParams(location.search).has("connected");
  return <main>
    <h1>Орби в обычном React-приложении</h1>
    <p>Стили страницы специально отличаются от стилей спутника.</p>
    <button id="host-button" onClick={() => mount(!mounted)}>{mounted ? "Убрать виджет" : "Вернуть виджет"}</button>
    <button onClick={() => buddy.current?.ask("Как установить библиотеку?")}>Спросить Орби</button>
    <input aria-label="Поле приложения" placeholder="Двойной Enter здесь не открывает Spotlight" />
    {mounted && <OrbiCompanion ref={buddy} mode={connected ? "connected" : "guide"} apiUrl="/api/v1"
      autoStartTour={new URLSearchParams(location.search).has("tour")} />}
  </main>;
}

// A hostile host stylesheet tests both directions of style isolation.
const style = document.createElement("style");
style.textContent = "html{font-size:24px}body{margin:24px;background:#fff8e7;color:#503518;font-family:serif}button{background:#ffe08a;border:3px solid #81592b;padding:12px;color:#503518;font:16px serif;margin:4px}input{display:block;margin-top:24px}svg{width:10px}*{box-sizing:content-box}";
document.head.append(style);
createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
