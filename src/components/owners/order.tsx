"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { post } from "./forms";
export default function OrderList({
  rows,
  url,
  action,
}: {
  rows: { id: string; name: string }[];
  url: string;
  action: "menu-order" | "photo-order";
}) {
  const [items, setItems] = useState(rows),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const router = useRouter();
  async function move(from: number, to: number) {
    if (busy || to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    next.splice(to, 0, next.splice(from, 1)[0]);
    setBusy(true);
    try {
      await post(
        url,
        JSON.stringify({ action, ids: next.map((x) => x.id) }),
        true,
      );
      setItems(next);
      setMessage("Ordre enregistré.");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Ordre inchangé.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <p>
        Glissez les éléments pour les classer, ou utilisez les boutons
        monter/descendre.
      </p>
      <ol className="order-list">
        {items.map((item, i) => (
          <li
            key={item.id}
            draggable={!busy}
            onDragStart={(e) => e.dataTransfer.setData("text/plain", item.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const from = items.findIndex(
                (x) => x.id === e.dataTransfer.getData("text/plain"),
              );
              if (from >= 0) void move(from, i);
            }}
          >
            <span>{item.name}</span>
            <button
              type="button"
              aria-label={`Monter ${item.name}`}
              disabled={busy || i === 0}
              onClick={() => move(i, i - 1)}
            >
              ↑
            </button>
            <button
              type="button"
              aria-label={`Descendre ${item.name}`}
              disabled={busy || i === items.length - 1}
              onClick={() => move(i, i + 1)}
            >
              ↓
            </button>
          </li>
        ))}
      </ol>
      <p role="status">{message}</p>
    </div>
  );
}
