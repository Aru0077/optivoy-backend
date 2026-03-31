import { ValueTransformer } from 'typeorm';

export const decimalNumberTransformer: ValueTransformer = {
  to(value: number | null | undefined): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (!Number.isFinite(value)) {
      return null;
    }
    return value.toFixed(2);
  },
  from(value: string | number | null): number | null {
    if (value === null) {
      return null;
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  },
};
