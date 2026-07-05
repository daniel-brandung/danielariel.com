// Goofy cartoon chicken, facing left, warm colors that pop against the dark moor.
// Two frames differ only in wing pose.
function chickenFrame(wing: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="84" viewBox="0 0 96 84">
  <path d="M92 36 L74 30 L90 22 L76 27 L86 14 L70 25 Z" fill="#6f4526"/>
  <ellipse cx="52" cy="46" rx="27" ry="19" fill="#8a5a33"/>
  <ellipse cx="46" cy="52" rx="16" ry="11" fill="#b98a56"/>
  <line x1="46" y1="64" x2="42" y2="78" stroke="#e8912d" stroke-width="3" stroke-linecap="round"/>
  <line x1="58" y1="64" x2="61" y2="78" stroke="#e8912d" stroke-width="3" stroke-linecap="round"/>
  ${wing}
  <circle cx="22" cy="26" r="13" fill="#9c6b3f"/>
  <path d="M14 14 q0 -7 5 -4 q2 -6 7 -2 q6 -2 4 5 l-8 8 Z" fill="#d84f42"/>
  <path d="M9 25 L1 29 L9 33 Z" fill="#e8912d"/>
  <path d="M17 37 q-1 8 5 6 l1 -6 Z" fill="#d84f42"/>
  <circle cx="18" cy="24" r="4.5" fill="#f4efe7"/>
  <circle cx="16.5" cy="24.5" r="2.2" fill="#141414"/>
</svg>`;
}

const WING_UP = `<ellipse cx="58" cy="38" rx="16" ry="9" fill="#6f4526" transform="rotate(-24 58 38)"/>`;
const WING_DOWN = `<ellipse cx="58" cy="52" rx="16" ry="9" fill="#6f4526" transform="rotate(16 58 52)"/>`;

export const CHICKEN_FRAME_SVGS: [string, string] = [chickenFrame(WING_UP), chickenFrame(WING_DOWN)];

export interface ChickenSprites {
  frames: [HTMLImageElement, HTMLImageElement];
}

function svgToImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("chicken sprite failed to load"));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

export async function loadChickenSprites(): Promise<ChickenSprites> {
  const [up, down] = await Promise.all(CHICKEN_FRAME_SVGS.map(svgToImage));
  return { frames: [up, down] };
}
