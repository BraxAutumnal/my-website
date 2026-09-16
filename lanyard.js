// ---- Draggable lanyard badge ----
// The string is simulated as a rope of connected points (verlet
// integration): each point falls under gravity and gets pulled back
// toward its neighbors to keep the segments a fixed length apart.
// The card is a normal HTML element that we move to match the last
// point in the rope every frame, so it looks like it's hanging off it.

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
// The anchor sits just above the visible area, so the string looks
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

const gravity = 0.7;
const friction = 0.99;       // higher = less damping = livelier, bouncier swings
const dragStrength = 0.3;    // how strongly the card eases toward your cursor
const constraintIterations = 6;

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
    // Easing toward the cursor instead of snapping straight to it
    // gives the string some give, so letting go feels like a real
    // bounce instead of a hard stop.
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
      const offsetX = dx * 0.5 * diff;
      const offsetY = dy * 0.5 * diff;

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
function draw() {
  ctx.clearRect(0, 0, width, height);

  // The string. Its top point sits off-screen (see anchor above),
  // so nothing shows where it's actually pinned.
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.strokeStyle = '#ff8fc4';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();

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
