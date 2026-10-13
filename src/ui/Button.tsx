import { createButton } from '@gluestack-ui/core/button/creator';
import { useStyleContext, withStyleContext } from '@gluestack-ui/utils/nativewind-utils';
import { useCallback } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { tva, type VariantProps } from './styles';
import { useColorToken, type ColorToken } from './theme';

import type { Icon } from 'phosphor-react-native';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'pill';

const SCOPE = 'BUTTON';
const PILL_HIT_SLOP = { top: 4, bottom: 4 };

const UIButton = createButton({
  Root: withStyleContext(Pressable, SCOPE),
  Text,
  Group: View,
  Spinner: ActivityIndicator,
  Icon: View,
});

const buttonStyle = tva({
  base: 'flex-row items-center justify-center gap-2 px-4 active:opacity-80',
  variants: {
    variant: {
      primary: 'h-12 rounded-button bg-primary',
      secondary: 'h-12 rounded-button border border-line bg-card',
      destructive: 'h-12 rounded-button border border-destructive-border bg-destructive-bg',
      pill: 'h-9 rounded-pill bg-primary',
    },
    disabled: { true: 'opacity-40', false: '' },
  },
});

const buttonTextStyle = tva({
  base: '',
  parentVariants: {
    variant: {
      primary: 'font-geist-semibold text-label text-on-primary',
      pill: 'font-geist-semibold text-label text-on-primary',
      secondary: 'font-geist-medium text-label text-ink',
      destructive: 'font-geist-semibold text-label text-destructive',
    },
  },
});

const ICON_TOKENS: Record<ButtonVariant, ColorToken> = {
  primary: 'on-primary',
  pill: 'on-primary',
  secondary: 'text',
  destructive: 'destructive',
};

interface ButtonProps extends VariantProps<typeof buttonStyle> {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: Icon;
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  className?: string;
}

const ButtonLabel = ({ label }: { label: string }) => {
  const { variant } = useStyleContext(SCOPE) as { variant: ButtonVariant };

  return (
    <UIButton.Text className={buttonTextStyle({ parentVariants: { variant } })}>
      {label}
    </UIButton.Text>
  );
};

const Button = ({
  label,
  onPress,
  variant = 'primary',
  icon: IconComponent,
  loading = false,
  disabled = false,
  accessibilityLabel,
  className,
}: ButtonProps) => {
  const iconColor = useColorToken(ICON_TOKENS[variant]);
  const isDisabled = disabled || loading;

  const handlePress = useCallback(() => {
    if (!isDisabled) onPress();
  }, [isDisabled, onPress]);

  return (
    <UIButton
      isDisabled={isDisabled}
      onPress={handlePress}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      hitSlop={variant === 'pill' ? PILL_HIT_SLOP : undefined}
      className={buttonStyle({ variant, disabled: isDisabled, class: className })}
      context={{ variant }}
    >
      {loading ? <UIButton.Spinner color={iconColor} /> : null}
      {IconComponent && !loading ? <IconComponent size={18} color={iconColor} /> : null}
      <ButtonLabel label={label} />
    </UIButton>
  );
};

export default Button;
