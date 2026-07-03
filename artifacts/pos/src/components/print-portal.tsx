import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function PrintPortal({ children, pageStyle }: { children: React.ReactNode, pageStyle?: string }) {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let el = document.getElementById("print-portal");
    if (!el) {
      el = document.createElement("div");
      el.id = "print-portal";
      document.body.appendChild(el);
    }
    setContainer(el);

    return () => {};
  }, []);

  if (!container) return null;

  return createPortal(
    <>
      {pageStyle && <style>{`@page { ${pageStyle} }`}</style>}
      {children}
    </>,
    container
  );
}
