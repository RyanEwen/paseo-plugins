import { useEffect, useRef } from "react";
import { TextInput as NativeTextInput } from "react-native";
import type { useBrowserCanvasInput } from "./use-browser-canvas-input";

/** Hidden native software-keyboard sink; explicit text entry lives in ComposeTextSheet. */
export function NativeKeyboardControls({
  relay,
  enabled,
  ownershipKey,
  request,
  onRequestHandled,
}: {
  relay: ReturnType<typeof useBrowserCanvasInput>["nativeKeyboard"];
  enabled: boolean;
  ownershipKey: string;
  request: { id: number; kind: "keyboard"; ownershipKey: string } | null;
  onRequestHandled(id: number): void;
}) {
  const handledRequest = useRef<number | null>(null);
  // Menu dismissal commits before this focus effect. The hidden input remains
  // mounted outside the menu so closing it cannot remove the typing sink.
  useEffect(() => {
    if (!request || handledRequest.current === request.id) return;
    handledRequest.current = request.id;
    if (enabled && request.ownershipKey === ownershipKey) relay.focus();
    onRequestHandled(request.id);
  }, [request, enabled, ownershipKey, relay, onRequestHandled]);
  return (
    <NativeTextInput
    key={relay.inputKey}
    ref={relay.inputRef}
    {...relay.inputProps}
    editable={enabled}
    caretHidden
    accessibilityLabel="Shared browser software keyboard"
    style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
    />
  );
}
