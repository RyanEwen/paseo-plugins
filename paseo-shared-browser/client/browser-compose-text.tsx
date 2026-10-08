import type { PluginWorkspacePanelProps } from "@getpaseo/plugin/client";
import { Modal, TextInput } from "@getpaseo/plugin/client/react-native";
import { useState } from "react";
import { Text, type TextStyle, View, type ViewStyle } from "react-native";
import { ControlButton, type ControlButtonStyles } from "./browser-control-button";

interface ComposeStyles extends ControlButtonStyles {
  sheetContent: ViewStyle;
  devicePresetDetail: TextStyle;
  field: TextStyle;
  mobileRow: ViewStyle;
}

/**
 * Visible text entry for phones and compact web. The draft is local; only an
 * explicit action inserts it, and only while the same human control owns the page.
 */
export function ComposeTextSheet({
  styles,
  theme,
  ownerKey,
  ownershipKey,
  enabled,
  onInsert,
  onClose,
}: {
  styles: ComposeStyles;
  theme: PluginWorkspacePanelProps["theme"];
  /** Ownership captured when the sheet opened; null when closed. */
  ownerKey: string | null;
  ownershipKey: string;
  enabled: boolean;
  onInsert(text: string, submit: boolean): boolean;
  onClose(): void;
}) {
  const [draft, setDraft] = useState("");
  const canCommit = enabled && ownerKey === ownershipKey;
  const close = () => {
    setDraft("");
    onClose();
  };
  const commit = (submit: boolean) => {
    if (!canCommit || !draft) return;
    // false means nothing was admitted, so the same draft remains reviewable.
    if (onInsert(draft, submit)) close();
  };
  return (
    <Modal
      title="Compose text"
      open={ownerKey !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <Modal.Content>
        <View style={styles.sheetContent}>
          <Text style={styles.devicePresetDetail}>
            Type here, then insert the text into the focused page field. Insert and Enter also
            submits it.
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
            <ControlButton styles={styles} theme={theme} label="Cancel" onPress={close} />
            <ControlButton
              styles={styles}
              theme={theme}
              label="Insert"
              primary
              disabled={!canCommit || !draft}
              onPress={() => commit(false)}
            />
            <ControlButton
              styles={styles}
              theme={theme}
              label="Insert and Enter"
              primary
              disabled={!canCommit || !draft}
              onPress={() => commit(true)}
            />
          </View>
        </View>
      </Modal.Content>
    </Modal>
  );
}
