// ---- Draggable lanyard badge ----
// The string is simulated as a rope of connected points (verlet
// integration): each point falls under gravity and gets pulled back
// toward its neighbors to keep the segments roughly a fixed length
// apart. The correction is partial (not fully rigid), which is what
// lets the ribbon visibly stretch under load and spring back after.

const container = document.getElementById('lanyard-container');
const canvas = document.getElementById('lanyard-canvas');
const card = document.getElementById('lanyard-card');
const ctx = canvas.getContext('2d');

let width, height;
function resize() {
  width = container.offsetWidth;
  height = container.offsetHeight;
  canvas.width = width;
  canvas.height = height;
}
window.addEventListener('resize', resize);
resize();

// ---- Rope setup ----
const numSegments = 9;
const segmentLength = 26;
// The anchor sits just above the visible area so the string looks
// like it's coming from off-screen instead of showing a dot where
// it's pinned.
const anchor = { x: width / 2, y: -40 };

let points = [];
for (let i = 0; i <= numSegments; i++) {
  points.push({
    x: anchor.x,
    y: anchor.y + i * segmentLength,
    oldx: anchor.x,
    oldy: anchor.y + i * segmentLength,
    pinned: i === 0
  });
}

const gravity = 0.85;
const friction = 0.99;          // higher = less damping = livelier, bouncier swings
const dragStrength = 0.22;      // lower = more lag/stretch while you're dragging
const constraintIterations = 3; // fewer = stretchier, less rigid rope
const stiffness = 0.55;         // lower = the ribbon can stretch further before snapping back

// ---- Dragging ----
let dragging = false;
let target = { x: 0, y: 0 };
let dragOffset = { x: 0, y: 0 };

function getPointerPos(e) {
  const rect = container.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return { x: clientX - rect.left, y: clientY - rect.top };
}

function startDrag(e) {
  dragging = true;
  const pos = getPointerPos(e);
  const last = points[points.length - 1];
  dragOffset.x = last.x - pos.x;
  dragOffset.y = last.y - pos.y;
  e.preventDefault();
}

function moveDrag(e) {
  if (!dragging) return;
  const pos = getPointerPos(e);
  target.x = pos.x + dragOffset.x;
  target.y = pos.y + dragOffset.y;
  e.preventDefault();
}

function endDrag() {
  dragging = false;
}

card.addEventListener('mousedown', startDrag);
card.addEventListener('touchstart', startDrag, { passive: false });
window.addEventListener('mousemove', moveDrag);
window.addEventListener('touchmove', moveDrag, { passive: false });
window.addEventListener('mouseup', endDrag);
window.addEventListener('touchend', endDrag);

// ---- Physics ----
function updatePoints() {
  for (const p of points) {
    if (p.pinned) continue;
    const vx = (p.x - p.oldx) * friction;
    const vy = (p.y - p.oldy) * friction;
    p.oldx = p.x;
    p.oldy = p.y;
    p.x += vx;
    p.y += vy + gravity;
  }

  if (dragging) {
    // Easing toward the cursor (rather than snapping to it) gives the
    // ribbon room to stretch, so letting go feels like a real bounce.
    const last = points[points.length - 1];
    last.x += (target.x - last.x) * dragStrength;
    last.y += (target.y - last.y) * dragStrength;
  }
}

function applyConstraints() {
  for (let iter = 0; iter < constraintIterations; iter++) {
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
      const diff = (dist - segmentLength) / dist;
      // Multiplying by "stiffness" (< 1) makes this a soft spring
      // correction instead of a hard, instantly-rigid one.
      const offsetX = dx * 0.5 * diff * stiffness;
      const offsetY = dy * 0.5 * diff * stiffness;

      if (!p1.pinned) {
        p1.x += offsetX;
        p1.y += offsetY;
      }
      if (!p2.pinned) {
        p2.x -= offsetX;
        p2.y -= offsetY;
      }
    }
    points[0].x = anchor.x;
    points[0].y = anchor.y;
  }
}

// ---- Rendering ----
const ribbonColor = '#ff8fc4';
const baseWidth = 14;

function draw() {
  ctx.clearRect(0, 0, width, height);

  // Draw the string as a flat ribbon (a rectangle per segment) instead
  // of a round cord. Segments get slightly thinner when stretched past
  // their resting length, like a real elastic strap.
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 0.0001;
    const nx = -dy / len;
    const ny = dx / len;

    const stretch = segmentLength / len;
    const w = (baseWidth * Math.min(1.15, Math.max(0.65, stretch))) / 2;

    ctx.beginPath();
    ctx.moveTo(p1.x + nx * w, p1.y + ny * w);
    ctx.lineTo(p2.x + nx * w, p2.y + ny * w);
    ctx.lineTo(p2.x - nx * w, p2.y - ny * w);
    ctx.lineTo(p1.x - nx * w, p1.y - ny * w);
    ctx.closePath();
    ctx.fillStyle = ribbonColor;
    ctx.fill();
  }

  // Round off the joints between segments so the ribbon reads as one
  // continuous strip instead of separate rectangles.
  for (let i = 1; i < points.length - 1; i++) {
    ctx.beginPath();
    ctx.arc(points[i].x, points[i].y, baseWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = ribbonColor;
    ctx.fill();
  }

  // Move and rotate the card to follow the last two points of the rope
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const angle = Math.atan2(last.x - prev.x, last.y - prev.y) * (180 / Math.PI);

  card.style.transform = `translate(${last.x}px, ${last.y}px) rotate(${angle}deg)`;
}

function loop() {
  updatePoints();
  applyConstraints();
  draw();
  requestAnimationFrame(loop);
}
loop();
