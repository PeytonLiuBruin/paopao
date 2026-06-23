(() => {
  "use strict";
  const version = "20260623-intro-bubbles";
  const parts = Array.from({ length: 8 }, (_, index) => `./game.${version}.part${String(index).padStart(2, "0")}.js`);
  Promise.all(parts.map((path) => fetch(path, { cache: "no-cache" }).then((response) => {
    if (!response.ok) throw new Error(`load failed: ${path}`);
    return response.text();
  })))
    .then((chunks) => {
      const code = atob(chunks.join("").replace(/\s+/g, ""));
      (0, eval)(code);
    })
    .catch((error) => {
      console.error(error);
      const curtain = document.getElementById("curtain");
      const stats = document.getElementById("endStats");
      if (curtain) curtain.classList.remove("hidden");
      if (stats) stats.textContent = "加载失败，刷新试试";
    });
})();
