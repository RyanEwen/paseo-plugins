import type { PluginWorkspacePanelProps } from "@getpaseo/plugin/client";
import { Modal, TextInput } from "@getpaseo/plugin/client/react-native";
import { useEffect, useRef, useState } from "react";
import { Text, type TextStyle, View, type ViewStyle } from "react-native";
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
  const composeOwner = useRef<string | null>(null);
  const liveAuthority = useRef({ enabled, ownershipKey });
  liveAuthority.current = { enabled, ownershipKey };
  const canCommit = enabled && composeOwner.current === ownershipKey;
  const closeCompose = () => {
    setComposeOpen(false);
    setDraft("");
    composeOwner.current = null;
  };
  const openCompose = () => {
    cancelInput();
    composeOwner.current = ownershipKey;
    setComposeOpen(true);
  };
  const commit = () => {
    // Consume before publication: a rapid second Done or retained old handler
    // must not repeat insertion or borrow a replacement page's control.
    if (
      !liveAuthority.current.enabled ||
      liveAuthority.current.ownershipKey !== ownershipKey ||
      composeOwner.current !== ownershipKey ||
      !draft
    )
      return;
    composeOwner.current = null;
    if (composeText(draft)) {
      closeCompose();
    } else {
      // false means nothing was admitted, so the same draft remains reviewable.
      composeOwner.current = ownershipKey;
    }
  };
  useEffect(() => {
    if (!request || handledRequest.current === request.id) return;
    handledRequest.current = request.id;
    if (enabled && request.ownershipKey === ownershipKey) openCompose();
    onRequestHandled(request.id);
  }, [request, enabled, ownershipKey, onRequestHandled]);
  return (
    <>
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
    </>
  );
}
