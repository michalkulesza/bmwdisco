import { tva as gluestackTva, type VariantProps } from '@gluestack-ui/utils/nativewind-utils';

export type { VariantProps };

const MERGE_DISABLED = { twMerge: false } as const;

export const tva: typeof gluestackTva = (options) => gluestackTva(options, MERGE_DISABLED);
