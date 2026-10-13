import { z } from 'zod';

export const mappingRowSchema = z.strictObject({
  sgbd: z.string(),
  group: z.string(),
  description: z.string(),
  command: z.string(),
  function: z.string(),
  args: z.array(z.string()),
});

export const mappingFileSchema = z.array(mappingRowSchema);

const fnArgSchema = z.union([
  z.tuple([z.string(), z.number()]),
  z.tuple([z.string(), z.number(), z.string()]),
  z.tuple([
    z.string(),
    z.number(),
    z.strictObject({
      e: z.string().optional(),
      s: z.tuple([z.number(), z.number(), z.number()]).optional(),
    }),
  ]),
]);

const fnSchema = z.strictObject({
  n: z.string(),
  s: z.number(),
  id: z.string().optional(),
  a: z.array(fnArgSchema).optional(),
  r: z.array(z.array(z.unknown())).optional(),
  p: z.string().optional(),
});

const lightBitsSchema = z.array(z.tuple([z.number(), z.string()]));

const lightsSchema = z.strictObject({
  function: z.string(),
  template: z.string(),
  channels: z.record(z.string(), lightBitsSchema),
  state: z.strictObject({ on: lightBitsSchema, off: lightBitsSchema }).optional(),
  fixed: z.record(z.string(), z.string()).optional(),
});

export const udsFileSchema = z.strictObject({
  sgbd: z.string(),
  addr: z.string().regex(/^[0-9A-Fa-f]{2}$/),
  jobs: z.record(z.string(), z.string()),
  fns: z.array(fnSchema),
  enums: z.record(z.string(), z.record(z.string(), z.number())),
  lights: lightsSchema.optional(),
});

const packStepSchema = z.strictObject({
  command: z.string(),
  group: z.array(z.string()),
  params: z.record(z.string(), z.string()).optional(),
});

const packActionSchema = z.strictObject({
  title: z.string(),
  icon: z.string(),
  color: z.string(),
  align: z.string(),
  section: z.string().optional(),
  sequence: z.array(packStepSchema),
  disable: z.array(packStepSchema),
});

export const packFileSchema = z.strictObject({
  title: z.string(),
  description: z.string(),
  sgbds: z.array(z.string()),
  icon: z.string(),
  group: z.number(),
  index: z.number(),
  column_count: z.number(),
  file_name: z.string(),
  flashable: z.boolean().optional(),
  actions: z.array(packActionSchema),
});

export const ecuModulesFileSchema = z.array(
  z.strictObject({
    ADR_INDEX: z.string(),
    SGBD_HEX: z.string(),
    SGBD: z.string(),
    GRUPPE: z.string(),
    BAUREIHE: z.string(),
  }),
);

export const chassisInfoFileSchema = z.array(
  z.strictObject({
    name: z.string(),
    chassis: z.string(),
    region: z.string(),
    engine: z.string(),
    body: z.string(),
    steering: z.string(),
    series: z.string(),
  }),
);

export type MappingRow = z.infer<typeof mappingRowSchema>;
export type UdsFile = z.infer<typeof udsFileSchema>;
export type PackFile = z.infer<typeof packFileSchema>;
export type PackAction = PackFile['actions'][number];
export type PackStep = PackAction['sequence'][number];
export type EcuModuleRow = z.infer<typeof ecuModulesFileSchema>[number];
export type ChassisRow = z.infer<typeof chassisInfoFileSchema>[number];
