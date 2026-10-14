import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { ELEMENT_IDS, type ElementId } from '@/data/elements';
import { useSessionSelector } from '@/session';
import Popover, { type PopoverTriggerProps } from '@/ui/Popover';
import Text from '@/ui/Text';
import { translateKey } from '@/ui/tile/helpers';

import ElementOption from './ElementOption';
import { groupElements, LIST_MAX_HEIGHT, selectedRowOffset } from './helpers';

interface LightPickerProps {
  value: ElementId | undefined;
  onSelect: (id: ElementId) => void;
  trigger: (props: PopoverTriggerProps, state: { open: boolean }) => ReactElement;
}

const LightPicker = ({ value, onSelect, trigger }: LightPickerProps) => {
  const { t } = useTranslation();
  const selectable = useSessionSelector(
    (snapshot) => snapshot.context.car?.selectableElements ?? ELEMENT_IDS,
  );
  const [open, setOpen] = useState(false);

  const rows = useMemo(() => groupElements(selectable), [selectable]);
  const contentOffset = useMemo(() => ({ x: 0, y: selectedRowOffset(rows, value) }), [rows, value]);

  const handleOpen = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);
  const handleSelect = useCallback(
    (id: ElementId) => {
      onSelect(id);
      setOpen(false);
    },
    [onSelect],
  );
  const renderTrigger = useCallback(
    (props: PopoverTriggerProps) => trigger(props, { open }),
    [open, trigger],
  );

  return (
    <Popover
      isOpen={open}
      onOpen={handleOpen}
      onClose={handleClose}
      trigger={renderTrigger}
      maxHeight={LIST_MAX_HEIGHT}
    >
      <ScrollView
        contentOffset={contentOffset}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        {rows.map((row) =>
          row.type === 'group' ? (
            <Text
              key={`g-${row.category}`}
              variant="tag"
              tone="muted"
              className="h-9 px-3 pb-1 pt-3 uppercase"
            >
              {translateKey(t, `categories.${row.category}`)}
            </Text>
          ) : (
            <ElementOption
              key={row.id}
              id={row.id}
              selected={row.id === value}
              onSelect={handleSelect}
            />
          ),
        )}
      </ScrollView>
    </Popover>
  );
};

export default LightPicker;
