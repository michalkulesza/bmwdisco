import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { tva, type VariantProps } from './styles';

const textStyle = tva({
  base: '',
  variants: {
    variant: {
      title: 'font-geist-bold text-title tracking-title',
      section: 'font-geist-semibold text-section tracking-section',
      heading: 'font-geist-semibold text-heading',
      body: 'font-geist text-body',
      bodyMedium: 'font-geist-medium text-body',
      label: 'font-geist-medium text-label',
      labelStrong: 'font-geist-semibold text-label',
      meta: 'font-geist text-meta',
      small: 'font-geist text-small',
      tag: 'font-geist-medium text-tag',
    },
    tone: {
      default: 'text-ink',
      soft: 'text-ink-soft',
      muted: 'text-ink-muted',
      destructive: 'text-destructive',
      onPrimary: 'text-on-primary',
    },
  },
});

type TextProps = RNTextProps & VariantProps<typeof textStyle> & { className?: string };

const Text = ({ variant = 'body', tone = 'default', className, ...props }: TextProps) => (
  <RNText className={textStyle({ variant, tone, class: className })} {...props} />
);

export default Text;
