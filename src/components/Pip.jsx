// Pip, the dove mascot. Eight poses live in /public/mascot as transparent PNGs (420px tall).
// pose: fly | sprig | sleepy | lookback | love | curious | angry | sad
export default function Pip({ pose = "curious", size = 140, float = false, style = {}, ...rest }) {
  return (
    <img
      src={`/mascot/pip-${pose}.png`}
      alt=""
      aria-hidden="true"
      draggable={false}
      loading="lazy"
      className={float ? "pip-float" : undefined}
      style={{ height: size, width: "auto", display: "block", userSelect: "none", pointerEvents: "none", ...style }}
      {...rest}
    />
  );
}
