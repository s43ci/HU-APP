import { useEffect, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { Stroke } from '@/data/annotations';

export type DrawTool = { kind: 'pen' | 'marker' | 'eraser'; color: string };

const path = (pts: [number, number][], w: number) =>
  pts.map(([x, y], i) => `${i ? 'L' : 'M'}${(x * w).toFixed(1)} ${y.toFixed(1)}`).join(' ');

/**
 * Freehand drawing over the page. Strokes scroll with the text; x is stored as a fraction of
 * the page width so drawings stay in place when the device rotates.
 */
export function DrawingLayer({ strokes, active, tool, onChange, resolveColor }: { strokes: Stroke[]; active: boolean; tool: DrawTool; onChange: (s: Stroke[]) => void; resolveColor: (c: string) => string }) {
  const [width, setWidth] = useState(0);
  const [live, setLive] = useState<Stroke | null>(null);
  const ref = useRef({ width: 0, tool, strokes, onChange, live: null as Stroke | null });
  useEffect(() => {
    ref.current.tool = tool;
    ref.current.strokes = strokes;
    ref.current.onChange = onChange;
  });

  const eraseAt = (x: number, y: number) => {
    const r = ref.current;
    const hit = (s: Stroke) => s.points.some(([px, py]) => Math.hypot(px * r.width - x, py - y) < 16);
    const next = r.strokes.filter((s) => !hit(s));
    if (next.length !== r.strokes.length) r.onChange(next);
  };

  // Refs are only read inside the gesture callbacks, never during render.
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        const r = ref.current;
        const { locationX: x, locationY: y } = e.nativeEvent;
        if (r.tool.kind === 'eraser') return eraseAt(x, y);
        const marker = r.tool.kind === 'marker';
        r.live = { id: `s${Date.now().toString(36)}`, color: r.tool.color, width: marker ? 16 : 2.5, opacity: marker ? 0.32 : 1, points: [[x / (r.width || 1), y]] };
        setLive(r.live);
      },
      onPanResponderMove: (e) => {
        const r = ref.current;
        const { locationX: x, locationY: y } = e.nativeEvent;
        if (r.tool.kind === 'eraser') return eraseAt(x, y);
        if (!r.live) return;
        const last = r.live.points[r.live.points.length - 1];
        if (Math.hypot(last[0] * r.width - x, last[1] - y) < 2) return;
        r.live = { ...r.live, points: [...r.live.points, [x / (r.width || 1), y]] };
        setLive(r.live);
      },
      onPanResponderRelease: () => {
        const r = ref.current;
        if (r.live && r.live.points.length > 1) r.onChange([...r.strokes, r.live]);
        r.live = null;
        setLive(null);
      },
      onPanResponderTerminate: () => {
        ref.current.live = null;
        setLive(null);
      },
    }),
  );

  const onLayout = (e: LayoutChangeEvent) => {
    ref.current.width = e.nativeEvent.layout.width;
    setWidth(e.nativeEvent.layout.width);
  };

  const all = live ? [...strokes, live] : strokes;
  return (
    <View
      onLayout={onLayout}
      pointerEvents={active ? 'auto' : 'none'}
      style={[StyleSheet.absoluteFill, { zIndex: 5 }]}
      {...(active ? responder.panHandlers : {})}>
      {width ? (
        <Svg width="100%" height="100%" pointerEvents="none">
          {all.map((s) => (
            <Path key={s.id} d={path(s.points, width)} stroke={resolveColor(s.color)} strokeOpacity={s.opacity} strokeWidth={s.width} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          ))}
        </Svg>
      ) : null}
    </View>
  );
}
