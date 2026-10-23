import { useEffect, useRef, useState } from "react";

// Swipeable photos for a full profile view: scroll-snap left and right, bars at the top show where you are,
// and arrows appear on a computer. Anything passed as children sits on top (back button, name, badges).
export default function PhotoCarousel({ photos = [], name = "", maxHeight = "60vh", children, topOffset = 14 }) {
  const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "?")}&size=600&background=F4F2EE&color=B8912A`;
  const list = photos.filter(Boolean).length ? photos.filter(Boolean) : [fallback];
  const scroller = useRef(null);
  const [idx, setIdx] = useState(0);

  // a new profile starts at its first photo
  const key = list.join("|");
  useEffect(() => { setIdx(0); scroller.current?.scrollTo({ left: 0 }); }, [key]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el || !el.clientWidth) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== idx) setIdx(Math.max(0, Math.min(list.length - 1, i)));
  };
  const go = (i) => {
    const el = scroller.current;
    if (!el) return;
    const n = Math.max(0, Math.min(list.length - 1, i));
    el.scrollTo({ left: n * el.clientWidth, behavior: "smooth" });
  };

  const arrow = (dir) => ({
    position: "absolute", top: "50%", [dir < 0 ? "left" : "right"]: 10, transform: "translateY(-50%)",
    width: 34, height: 34, borderRadius: 17, border: "none", background: "rgba(0,0,0,0.35)", color: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 2,
  });

  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: "3/4", maxHeight, background: "#F4F2EE", overflow: "hidden" }}>
      <div
        ref={scroller}
        onScroll={onScroll}
        className="photo-carousel"
        style={{ display: "flex", width: "100%", height: "100%", overflowX: "auto", overflowY: "hidden", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", scrollbarWidth: "none", overscrollBehaviorX: "contain" }}
      >
        {list.map((src, i) => (
          <img
            key={i}
            src={src}
            alt={i === 0 ? name : `${name}, photo ${i + 1}`}
            draggable={false}
            loading={i === 0 ? "eager" : "lazy"}
            style={{ flex: "0 0 100%", width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 20%", scrollSnapAlign: "start", scrollSnapStop: "always", display: "block", userSelect: "none" }}
            onError={(e) => { if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback; }}
          />
        ))}
      </div>

      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.78) 0%, transparent 48%)", pointerEvents: "none" }} />

      {list.length > 1 && (
        <>
          <div style={{ position: "absolute", top: `max(${topOffset}px, env(safe-area-inset-top, ${topOffset}px))`, left: 16, right: 16, display: "flex", gap: 4, pointerEvents: "none", zIndex: 2 }}>
            {list.map((_, i) => <span key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i === idx ? "#fff" : "rgba(255,255,255,0.4)", transition: "background 0.2s" }} />)}
          </div>
          {idx > 0 && (
            <button className="photo-carousel-arrow" onClick={() => go(idx - 1)} aria-label="Previous photo" style={arrow(-1)}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
          )}
          {idx < list.length - 1 && (
            <button className="photo-carousel-arrow" onClick={() => go(idx + 1)} aria-label="Next photo" style={arrow(1)}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          )}
        </>
      )}

      {children}
    </div>
  );
}
