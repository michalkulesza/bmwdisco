import { OverlayProvider } from '@gluestack-ui/core/overlay/creator';
import {
  createToastHook,
  ToastProvider as GluestackToastProvider,
} from '@gluestack-ui/core/toast/creator';
import { X } from 'phosphor-react-native';
import { useCallback, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { tva } from './styles';
import Text from './Text';
import { useColorToken } from './theme';

export type ToastTone = 'default' | 'success' | 'error';

interface ToastOptions {
  title: string;
  description?: string;
  tone?: ToastTone;
  duration?: number;
}

const useGluestackToast = createToastHook(View);

const toastStyle = tva({
  base: 'mx-4 flex-row items-center gap-3 rounded-card border py-3 pl-4 pr-1',
  variants: {
    tone: {
      default: 'border-line bg-raised',
      success: 'border-connected-border bg-connected-bg',
      error: 'border-destructive-border bg-destructive-bg',
    },
  },
});

interface ToastViewProps extends Pick<ToastOptions, 'title' | 'description'> {
  tone: ToastTone;
  onDismiss: () => void;
}

const ToastView = ({ title, description, tone, onDismiss }: ToastViewProps) => {
  const { t } = useTranslation();
  const iconColor = useColorToken('text-muted');
  const titleTone = tone === 'error' ? 'destructive' : 'default';

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      className={toastStyle({ tone })}
    >
      <View className="flex-1 gap-0.5">
        <Text variant="labelStrong" tone={titleTone}>
          {title}
        </Text>
        {description ? (
          <Text variant="small" tone="muted">
            {description}
          </Text>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('ui.dismiss')}
        onPress={onDismiss}
        className="size-touch items-center justify-center active:opacity-60"
      >
        <X size={18} color={iconColor} />
      </Pressable>
    </View>
  );
};

export const useToast = () => {
  const toast = useGluestackToast();

  const show = useCallback(
    ({ title, description, tone = 'default', duration }: ToastOptions) =>
      toast.show({
        placement: 'bottom',
        duration,
        render: ({ id }) => (
          <ToastView
            title={title}
            description={description}
            tone={tone}
            onDismiss={() => toast.close(id)}
          />
        ),
      }),
    [toast],
  );

  return useMemo(() => ({ show, close: toast.close, closeAll: toast.closeAll }), [show, toast]);
};

export const ToastProvider = ({ children }: { children: ReactNode }) => (
  <OverlayProvider>
    <GluestackToastProvider>{children}</GluestackToastProvider>
  </OverlayProvider>
);
