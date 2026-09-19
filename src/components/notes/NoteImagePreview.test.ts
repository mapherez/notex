import { describe, expect, it } from 'vitest';
import { constrainImagePreviewTransform, fitImagePreviewSize } from './NoteImagePreview';

describe('fitImagePreviewSize', () => {
  it('fits either axis to 80% of the viewport without changing the original ratio', () => {
    expect(fitImagePreviewSize(
      { height: 1000, width: 2000 },
      { height: 800, width: 1000 },
    )).toEqual({ height: 400, width: 800 });

    expect(fitImagePreviewSize(
      { height: 2000, width: 1000 },
      { height: 800, width: 1000 },
    )).toEqual({ height: 640, width: 320 });
  });
});

describe('constrainImagePreviewTransform', () => {
  it('keeps the fitted image centred and clamps zoom to the preview limits', () => {
    expect(constrainImagePreviewTransform(
      { scale: 0.4, x: 80, y: -80 },
      { height: 300, width: 500 },
      { height: 700, width: 900 },
    )).toEqual({ scale: 1, x: 0, y: 0 });

    expect(constrainImagePreviewTransform(
      { scale: 20, x: 0, y: 0 },
      { height: 300, width: 500 },
      { height: 700, width: 900 },
    ).scale).toBe(4);
  });

  it('allows panning only across the enlarged overflow', () => {
    expect(constrainImagePreviewTransform(
      { scale: 3, x: 900, y: -900 },
      { height: 400, width: 600 },
      { height: 700, width: 900 },
    )).toEqual({ scale: 3, x: 450, y: -250 });
  });
});
