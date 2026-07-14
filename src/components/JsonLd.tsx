import { useEffect } from "react";

/** 任意のJSON-LDを<head>へ挿入する。dataがnullの場合は何も出力しない。 */
export function JsonLd({ id, data }: { id: string; data: object | null }) {
  const serialized = data ? JSON.stringify(data) : "";

  useEffect(() => {
    if (!serialized) return;
    let el = document.getElementById(id) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement("script");
      el.type = "application/ld+json";
      el.id = id;
      document.head.appendChild(el);
    }
    el.textContent = serialized;
    return () => {
      document.getElementById(id)?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, serialized]);

  return null;
}
