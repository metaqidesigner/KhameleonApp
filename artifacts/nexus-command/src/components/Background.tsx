import { useJarvisStore } from '@/store/jarvisStore';

export default function Background() {
  const scanLines = useJarvisStore(s => s.scanLinesEnabled);
  return (
    <div
      className="j-bg-layer"
      style={scanLines ? {} : { '--j-scanlines': 'none' } as React.CSSProperties}
    />
  );
}
