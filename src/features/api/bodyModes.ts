export const bodyModes = ['None','Text','JSON','XML','Form URL encoded','Multipart draft','Binary file'] as const;
export type BodyMode = typeof bodyModes[number];
