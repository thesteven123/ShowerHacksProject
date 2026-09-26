type PartIndex = 2 | 3 | 4 | 5 | 6;

const PART_LABELS: Record<PartIndex, string> = {
  2: "2 — torso",
  3: "3 — right arm",
  4: "4 — left arm",
  5: "5 — right leg",
  6: "6 — left leg",
};

const canvas = document.getElementById("stage") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const slugInput = document.getElementById("slug") as HTMLInputElement;
const partSelect = document.getElementById("part") as HTMLSelectElement;
const fullbodyInput = document.getElementById("fullbody") as HTMLInputElement;
const faceInput = document.getElementById("face") as HTMLInputElement;
const closeBtn = document.getElementById("close-lasso") as HTMLButtonElement;
const undoBtn = document.getElementById("undo-point") as HTMLButtonElement;
const clearBtn = document.getElementById("clear-lasso") as HTMLButtonElement;
const exportBtn = document.getElementById("export") as HTMLButtonElement;
const partListEl = document.getElementById("part-list")!;
const statusEl = document.getElementById("status")!;

let sourceImage: HTMLImageElement | null = null;
let imageScale = 1;
let imageOffsetX = 0;
let imageOffsetY = 0;
let lassoPoints: { x: number; y: number }[] = [];
const partCrops = new Map<PartIndex, Blob>();
let faceBlob: Blob | null = null;

function setStatus(msg: string) {
  statusEl.textContent = msg;
}

function imageToCanvas(ix: number, iy: number): { x: number; y: number } {
  return {
    x: ix * imageScale + imageOffsetX,
    y: iy * imageScale + imageOffsetY,
  };
}

function canvasToImage(cx: number, cy: number): { x: number; y: number } {
  return {
    x: (cx - imageOffsetX) / imageScale,
    y: (cy - imageOffsetY) / imageScale,
  };
}

function layoutImage(img: HTMLImageElement) {
  const maxW = Math.min(window.innerWidth - 260, 1200);
  const maxH = window.innerHeight - 120;
  imageScale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
  const drawW = img.naturalWidth * imageScale;
  const drawH = img.naturalHeight * imageScale;
  canvas.width = Math.ceil(drawW);
  canvas.height = Math.ceil(drawH);
  imageOffsetX = 0;
  imageOffsetY = 0;
}

function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!sourceImage) return;

  ctx.drawImage(
    sourceImage,
    0,
    0,
    sourceImage.naturalWidth,
    sourceImage.naturalHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  if (lassoPoints.length > 0) {
    ctx.strokeStyle = "#7cfac0";
    ctx.lineWidth = 2;
    ctx.fillStyle = "rgba(124, 250, 192, 0.15)";
    ctx.beginPath();
    const first = lassoPoints[0]!;
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < lassoPoints.length; i++) {
      ctx.lineTo(lassoPoints[i]!.x, lassoPoints[i]!.y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    for (const p of lassoPoints) {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  refreshPartList();
  exportBtn.disabled = partCrops.size === 0 && !faceBlob;
}

function refreshPartList() {
  partListEl.innerHTML = "";
  for (const idx of [2, 3, 4, 5, 6] as PartIndex[]) {
    const row = document.createElement("div");
    row.className = "thumb";
    const label = document.createElement("span");
    label.className = partCrops.has(idx) ? "done" : "pending";
    label.textContent = PART_LABELS[idx];
    row.appendChild(label);
    const blob = partCrops.get(idx);
    if (blob) {
      const img = document.createElement("img");
      img.src = URL.createObjectURL(blob);
      row.appendChild(img);
    }
    partListEl.appendChild(row);
  }
  if (faceBlob) {
    const row = document.createElement("div");
    row.className = "thumb";
    const label = document.createElement("span");
    label.className = "done";
    label.textContent = "1 — face";
    row.appendChild(label);
    const img = document.createElement("img");
    img.src = URL.createObjectURL(faceBlob);
    row.appendChild(img);
    partListEl.appendChild(row);
  }
}

async function commitLasso() {
  if (!sourceImage || lassoPoints.length < 3) {
    setStatus("Need at least 3 points for a lasso.");
    return;
  }

  const part = Number(partSelect.value) as PartIndex;
  const imgPts = lassoPoints.map((p) => canvasToImage(p.x, p.y));

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of imgPts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const pad = 2;
  minX = Math.max(0, Math.floor(minX - pad));
  minY = Math.max(0, Math.floor(minY - pad));
  maxX = Math.min(sourceImage.naturalWidth, Math.ceil(maxX + pad));
  maxY = Math.min(sourceImage.naturalHeight, Math.ceil(maxY + pad));
  const w = maxX - minX;
  const h = maxY - minY;
  if (w < 2 || h < 2) {
    setStatus("Lasso too small.");
    return;
  }

  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const octx = off.getContext("2d")!;
  octx.beginPath();
  const first = imgPts[0]!;
  octx.moveTo(first.x - minX, first.y - minY);
  for (let i = 1; i < imgPts.length; i++) {
    const p = imgPts[i]!;
    octx.lineTo(p.x - minX, p.y - minY);
  }
  octx.closePath();
  octx.clip();
  octx.drawImage(sourceImage, minX, minY, w, h, 0, 0, w, h);

  const blob = await new Promise<Blob>((resolve, reject) => {
    off.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
  });

  partCrops.set(part, blob);
  lassoPoints = [];
  setStatus(`Saved ${PART_LABELS[part]}. Pick another part or export.`);
  redraw();
}

fullbodyInput.addEventListener("change", async () => {
  const file = fullbodyInput.files?.[0];
  if (!file) return;
  partCrops.clear();
  lassoPoints = [];
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    sourceImage = img;
    layoutImage(img);
    redraw();
    setStatus("Click to draw lasso around the selected part.");
    URL.revokeObjectURL(url);
  };
  img.src = url;
});

faceInput.addEventListener("change", async () => {
  const file = faceInput.files?.[0];
  if (!file) {
    faceBlob = null;
    redraw();
    return;
  }
  faceBlob = file;
  setStatus("Face loaded — included on export as <slug>1crop.png");
  redraw();
});

canvas.addEventListener("click", (e) => {
  if (!sourceImage) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  lassoPoints.push({ x, y });
  redraw();
});

canvas.addEventListener("dblclick", (e) => {
  e.preventDefault();
  void commitLasso();
});

closeBtn.addEventListener("click", () => void commitLasso());
undoBtn.addEventListener("click", () => {
  lassoPoints.pop();
  redraw();
});
clearBtn.addEventListener("click", () => {
  lassoPoints = [];
  redraw();
});

async function writeFileHandle(dir: FileSystemDirectoryHandle, name: string, blob: Blob) {
  const handle = await dir.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
}

exportBtn.addEventListener("click", async () => {
  const slug = slugInput.value.trim() || "friend";
  if (!("showDirectoryPicker" in window)) {
    setStatus("Use Chrome/Edge for folder export, or save crops manually from devtools.");
    for (const [part, blob] of partCrops) {
      downloadBlob(blob, `${slug}${part}.png`);
    }
    if (faceBlob) downloadBlob(faceBlob, `${slug}1crop.png`);
    return;
  }

  try {
    const dir = await window.showDirectoryPicker({ mode: "readwrite" });
    for (const [part, blob] of partCrops) {
      await writeFileHandle(dir, `${slug}${part}.png`, blob);
    }
    if (faceBlob) {
      await writeFileHandle(dir, `${slug}1crop.png`, faceBlob);
    }
    setStatus(`Exported ${partCrops.size} part(s)${faceBlob ? " + face" : ""} to chosen folder.`);
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") return;
    setStatus(String(e));
  }
});

function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

window.addEventListener("resize", () => {
  if (sourceImage) {
    layoutImage(sourceImage);
    lassoPoints = [];
    redraw();
  }
});

refreshPartList();
