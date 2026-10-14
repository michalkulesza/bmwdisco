import { createPopover } from '@gluestack-ui/core/popover/creator';
import { useCallback, useMemo, useState, type ReactElement, type ReactNode, type Ref } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';

const UIPopover = createPopover({
  Root: View,
  Arrow: View,
  Content: View,
  Header: View,
  Footer: View,
  Body: View,
  Backdrop: Pressable,
  CloseButton: Pressable,
});

const CONTENT_CLASS = 'overflow-hidden rounded-card border border-card-border bg-card shadow-lg';

const BACKDROP_STYLE = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as const;
const ROOT_STYLE = { flex: 1 } as const;
const POPOVER_OFFSET = 4;

export interface PopoverTriggerProps {
  ref: Ref<View>;
  onPress: () => void;
  [key: string]: unknown;
}

interface PopoverProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  trigger: (props: PopoverTriggerProps, state: { open: boolean }) => ReactElement;
  maxHeight?: number;
  children: ReactNode;
}

const Popover = ({ isOpen, onOpen, onClose, trigger, maxHeight, children }: PopoverProps) => {
  const [triggerWidth, setTriggerWidth] = useState<number | undefined>();

  const handleTriggerLayout = useCallback((event: LayoutChangeEvent) => {
    setTriggerWidth(event.nativeEvent.layout.width);
  }, []);

  const renderTrigger = useCallback(
    (props: PopoverTriggerProps, state: { open: boolean }) => (
      <View onLayout={handleTriggerLayout}>{trigger(props, state)}</View>
    ),
    [handleTriggerLayout, trigger],
  );

  const sizeStyle = useMemo(() => ({ width: triggerWidth, maxHeight }), [triggerWidth, maxHeight]);

  return (
    <UIPopover
      isOpen={isOpen}
      onOpen={onOpen}
      onClose={onClose}
      trigger={renderTrigger}
      placement="bottom"
      offset={POPOVER_OFFSET}
      shouldFlip={false}
      trapFocus={false}
      useRNModal
      testID="popover-root"
      style={ROOT_STYLE}
    >
      <UIPopover.Backdrop testID="popover-backdrop" style={BACKDROP_STYLE} />
      <UIPopover.Content
        className={CONTENT_CLASS}
        style={sizeStyle}
        accessibilityViewIsModal
        onAccessibilityEscape={onClose}
      >
        <UIPopover.Body>{children}</UIPopover.Body>
      </UIPopover.Content>
    </UIPopover>
  );
};

export default Popover;
