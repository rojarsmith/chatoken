"use client";

import { useState } from "react";
import { LoaderCircle, Send } from "lucide-react";

export default function Composer({ disabled, pending, onSend }) {
  const [text, setText] = useState("");

  function submit() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    setText("");
    onSend(trimmed);
  }

  return (
    <div className="ax-composer">
      <textarea
        value={text}
        placeholder="Send a message…"
        rows={1}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          // Enter sends; Shift+Enter is a newline, as in every chat product.
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
      />
      <button type="button" onClick={submit} disabled={disabled || !text.trim()}>
        {pending ? <LoaderCircle size={16} /> : <Send size={16} />}
      </button>
    </div>
  );
}
