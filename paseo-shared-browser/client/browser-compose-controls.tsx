import type { PluginWorkspacePanelProps } from "@getpaseo/plugin/client";
import { Modal, TextInput } from "@getpaseo/plugin/client/react-native";
import { useEffect, useRef, useState } from "react";
import { Text, type TextStyle, View, type ViewStyle } from "react-native";
import { createComposeSession } from "./browser-compose-session";
import { ControlButton, type ControlButtonStyles } from "./browser-control-button";

type Theme = PluginWorkspacePanelProps["theme"];
interface ComposeStyles extends ControlButtonStyles {
  sheetContent: ViewStyle;
  devicePresetDetail: TextStyle;
  field: TextStyle;
  mobileRow: ViewStyle;
}

/** Visible draft sheet; text is inserted into the focused page field only by an explicit Done. */
export function ComposeTextControls({
  styles,
  theme,
  composeText,
  cancelInput,
  enabled,
  ownershipKey,
  request,
  onRequestHandled,
}: {
  styles: ComposeStyles;
  theme: Theme;
  composeText(text: string): boolean;
  cancelInput(): void;
  enabled: boolean;
  ownershipKey: string;
  request: { id: number; ownershipKey: string } | null;
  onRequestHandled(id: number): void;
}) {
  const handledRequest = useRef<number | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const live = useRef({ enabled, ownershipKey, composeText, cancelInput });
  live.current = { enabled, ownershipKey, composeText, cancelInput };
  const [session] = useState(() =>
    createComposeSession({
      authority: () => live.current,
      composeText: (text) => live.current.composeText(text),
      cancelInput: () => live.current.cancelInput(),
    }),
  );
  const canCommit = enabled && session.owner() === ownershipKey;
  const closeCompose = () => {
    setComposeOpen(false);
    setDraft("");
    session.close();
  };
  const openCompose = () => {
    session.open();
    setComposeOpen(true);
  };
  const commit = () => {
    if (session.commit(draft)) closeCompose();
  };
  useEffect(() => {
    if (!request || handledRequest.current === request.id) return;
    handledRequest.current = request.id;
    if (enabled && request.ownershipKey === ownershipKey) openCompose();
    onRequestHandled(request.id);
  }, [request, enabled, ownershipKey, onRequestHandled]);
  return (
    <Modal
      title="Compose text"
      open={composeOpen}
      onOpenChange={(open) => {
        if (!open) closeCompose();
      }}
    >
      <Modal.Content>
        <View style={styles.sheetContent}>
          <Text style={styles.devicePresetDetail}>
            Compose with your keyboard, then choose Done to insert the text into the focused page
            field.
          </Text>
          <TextInput
            autoFocus
            multiline
            value={draft}
            maxLength={16_000}
            accessibilityLabel="Text to compose"
            onChangeText={setDraft}
            style={[styles.field, { minHeight: 100 }]}
          />
          {!canCommit ? (
            <Text style={styles.devicePresetDetail}>
              Browser control or page changed. Close this draft and focus the field again.
            </Text>
          ) : null}
          <View style={styles.mobileRow}>
            <ControlButton styles={styles} theme={theme} label="Cancel" onPress={closeCompose} />
            <ControlButton
              styles={styles}
              theme={theme}
              label="Done"
              primary
              disabled={!canCommit || !draft}
              onPress={commit}
            />
          </View>
        </View>
      </Modal.Content>
    </Modal>
  );
}
