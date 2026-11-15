import { css, fonts } from "orbi:styles";

export function createSurface(nonce: string | undefined, zIndex: number) {
  const host = document.createElement("div");
  host.dataset.orbiSdk = "";
  host.style.zIndex = String(zIndex);
  const root = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  const fontStyle = document.createElement("style");
  if (nonce) { style.nonce = nonce; fontStyle.nonce = nonce; }
  style.textContent = css;
  fontStyle.textContent = fonts;
  root.append(style);
  document.head.append(fontStyle);
  document.body.append(host);
  return { root, host, destroy() { host.remove(); fontStyle.remove(); } };
}
