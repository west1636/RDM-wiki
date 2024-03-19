import { editorViewOptionsCtx as n } from "@milkdown/core";
import i from "clsx";
const l = (s) => {
  s.update(n, (r) => {
    const o = r.attributes;
    return {
      ...r,
      attributes: (e) => {
        const t = typeof o == "function" ? o(e) : o;
        return {
          ...t,
          class: i("prose dark:prose-invert outline-none", (t == null ? void 0 : t.class) || "", "milkdown-theme-nord")
        };
      }
    };
  });
};
export {
  l as nord
};
//# sourceMappingURL=index.es.js.map
