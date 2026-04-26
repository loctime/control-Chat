import { KeyboardEvent, MouseEvent, useEffect, useRef } from "react";

interface Props {
  x: number;
  y: number;
  isStarred: boolean;
  canCopy: boolean;
  onCopy: () => void;
  onToggleStar: () => void;
  onDelete: () => void;
  onClose: () => void;
  returnFocusTo?: HTMLElement | null;
}

export const MessageContextMenu = ({
  x,
  y,
  isStarred,
  canCopy,
  onCopy,
  onToggleStar,
  onDelete,
  onClose,
  returnFocusTo
}: Props) => {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const close = () => onClose();
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);

    const firstAction = menuRef.current?.querySelector<HTMLButtonElement>("button[role='menuitem']");
    firstAction?.focus();

    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      returnFocusTo?.focus();
    };
  }, [onClose, returnFocusTo]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    const actions = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("button[role='menuitem']") ?? []);
    if (!actions.length) return;

    const currentIndex = actions.findIndex((element) => element === document.activeElement);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = currentIndex < 0 ? 0 : (currentIndex + 1) % actions.length;
      actions[next].focus();
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      const next = currentIndex <= 0 ? actions.length - 1 : currentIndex - 1;
      actions[next].focus();
    }

    if (event.key === "Tab") {
      event.preventDefault();
      const delta = event.shiftKey ? -1 : 1;
      const next = currentIndex < 0 ? 0 : (currentIndex + delta + actions.length) % actions.length;
      actions[next].focus();
    }
  };

  const stop = (event: MouseEvent) => event.stopPropagation();

  return (
    <>
      <button className="menu-backdrop" aria-label="Cerrar menu" onClick={onClose} />
      <div
        ref={menuRef}
        className="context-menu"
        style={{ top: y, left: x }}
        onClick={stop}
        onKeyDown={onKeyDown}
        role="menu"
        aria-label="Acciones de mensaje"
      >
        {canCopy ? (
          <button type="button" role="menuitem" onClick={onCopy}>
            Copiar
          </button>
        ) : null}
        <button type="button" role="menuitem" onClick={onToggleStar}>
          {isStarred ? "Quitar favorito" : "Marcar favorito"}
        </button>
        <button type="button" role="menuitem" className="danger" onClick={onDelete}>
          Eliminar
        </button>
      </div>
    </>
  );
};
