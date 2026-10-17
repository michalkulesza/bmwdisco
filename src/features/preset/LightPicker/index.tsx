import { CheckIcon } from 'phosphor-react-native/src/icons/Check';
import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { ELEMENT_IDS } from '@/data/elements';
import { contextOf, LOGICAL_ACTION_CATALOG, selectActionOptions } from '@/domain/actions';
import { useSessionSelector } from '@/session';
import Popover, { type PopoverTriggerProps } from '@/ui/Popover';
import Text from '@/ui/Text';
import { useColorToken } from '@/ui/theme';
import { translateKey } from '@/ui/tile/helpers';

import ElementOption from './ElementOption';
import { groupElements, LIST_MAX_HEIGHT, selectedRowOffset } from './helpers';

import type { LightSelection } from '../light-selection';

interface LightPickerProps {
  value: LightSelection | undefined;
  onSelect: (selection: LightSelection) => void;
  trigger: (props: PopoverTriggerProps, state: { open: boolean }) => ReactElement;
}

const LightPicker = ({ value, onSelect, trigger }: LightPickerProps) => {
  const { t } = useTranslation();
  const car = useSessionSelector((snapshot) => snapshot.context.car);
  const selectable = car?.selectableElements ?? ELEMENT_IDS;
  const actionOptions = car
    ? selectActionOptions(contextOf(car)).filter(
        (option) =>
          option.id !== 'biXenonShutterBoth' &&
          !(
            option.resolution.status === 'unsupported' &&
            option.resolution.reason === 'noSemanticMapping'
          ),
      )
    : LOGICAL_ACTION_CATALOG.filter((option) => option.id !== 'biXenonShutterBoth').map(
        ({ id }) => ({ id, resolution: undefined }),
      );
  const [open, setOpen] = useState(false);
  const check = useColorToken('text');

  const rows = useMemo(() => groupElements(selectable), [selectable]);
  const contentOffset = useMemo(
    () => ({ x: 0, y: selectedRowOffset(rows, value?.kind === 'legacy' ? value.id : undefined) }),
    [rows, value],
  );

  const handleOpen = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);
  const handleSelect = useCallback(
    (selection: LightSelection) => {
      onSelect(selection);
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
        {actionOptions.length ? (
          <Text variant="tag" tone="muted" className="h-9 px-3 pb-1 pt-3 uppercase">
            {translateKey(t, 'actions.logical')}
          </Text>
        ) : null}
        {actionOptions.map(({ id, resolution }) => {
          const selected = value?.kind === 'action' && value.id === id;
          const reason =
            !resolution || resolution.status === 'supported' ? undefined : resolution.reason;
          return (
            <Pressable
              key={`action:${id}`}
              accessibilityRole="radio"
              accessibilityLabel={translateKey(t, `actions.names.${id}`)}
              accessibilityState={{ checked: selected }}
              onPress={() => handleSelect({ kind: 'action', id })}
              className="min-h-12 flex-row items-center gap-3 px-3 py-2 active:opacity-60"
            >
              <View className="flex-1 gap-0.5">
                <Text variant="body">{translateKey(t, `actions.names.${id}`)}</Text>
                {reason ? (
                  <Text variant="small" tone="muted">
                    {translateKey(t, `actions.reasons.${reason}`)}
                  </Text>
                ) : null}
              </View>
              {selected ? <CheckIcon size={18} weight="bold" color={check} /> : null}
            </Pressable>
          );
        })}
        <Text variant="tag" tone="muted" className="h-9 px-3 pb-1 pt-3 uppercase">
          {translateKey(t, 'actions.legacy')}
        </Text>
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
              selected={value?.kind === 'legacy' && row.id === value.id}
              onSelect={(id) => handleSelect({ kind: 'legacy', id })}
            />
          ),
        )}
      </ScrollView>
    </Popover>
  );
};

export default LightPicker;
