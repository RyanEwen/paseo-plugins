/** Explicit Compose draft UI, with original control/document ownership pinned until Done. */
import type { PluginWorkspacePanelProps } from "@getpaseo/plugin/client";
import { Modal, TextInput } from "@getpaseo/plugin/client/react-native";
import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { ControlButton } from "./browser-chrome";
import type { createStyles } from "./browser-panel-styles";

type Theme = PluginWorkspacePanelProps["theme"];

/** Visible draft sheet; text reaches the focused page field only by an explicit Done. */
export function ComposeTextControls({
  styles,
  theme,
  composeText,
  cancelInput,
  enabled,
  ownershipKey,
  documentKey,
  request,
  onRequestHandled,
  onRequestControlForCompose,
  canRequestControl,
}: {
  styles: ReturnType<typeof createStyles>;
  theme: Theme;
  composeText(text: string): boolean;
  cancelInput(): void;
  enabled: boolean;
  ownershipKey: string;
  documentKey: string;
  request: { id: number; kind: "compose" | "commit"; ownershipKey: string } | null;
  onRequestHandled(id: number): void;
  onRequestControlForCompose(): void;
  canRequestControl: boolean;
}) {
  const handledRequest = useRef<number | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const composeOwner = useRef<string | null>(null);
  const composeDocument = useRef<string | null>(null);
  const liveAuthority = useRef({ enabled, ownershipKey });
  liveAuthority.current = { enabled, ownershipKey };
  const canCommit = enabled && composeOwner.current === ownershipKey;
  const canRebindCommit = enabled && composeDocument.current === documentKey;
  const canRequestCommit = canRequestControl && composeDocument.current === documentKey;
  const closeCompose = () => {
    setComposeOpen(false);
    setDraft("");
    composeOwner.current = null;
    composeDocument.current = null;
  };
  const openCompose = () => {
    cancelInput();
    composeOwner.current = ownershipKey;
    composeDocument.current = documentKey;
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
  // Menu dismissal commits before this effect; the sheet is mounted outside the menu.
  useEffect(() => {
    if (!request || handledRequest.current === request.id) return;
    handledRequest.current = request.id;
    if (enabled && request.ownershipKey === ownershipKey) {
      if (request.kind === "compose") openCompose();
      else if (composeOpen && composeDocument.current === documentKey && draft) {
        composeOwner.current = ownershipKey;
        commit();
      }
    }
    onRequestHandled(request.id);
  }, [request, enabled, ownershipKey, documentKey, onRequestHandled]);
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
                disabled={(!canCommit && !canRebindCommit && !canRequestCommit) || !draft}
                onPress={() => {
                  if (canCommit) {
                    commit();
                  } else if (canRebindCommit) {
                    composeOwner.current = ownershipKey;
                    commit();
                  } else {
                    onRequestControlForCompose();
                  }
                }}
              />
            </View>
          </View>
        </Modal.Content>
      </Modal>
    </>
  );
}
