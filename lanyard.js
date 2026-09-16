// ---- Draggable lanyard badge ----
// The string is simulated as a rope of connected points (verlet
// integration): each point falls under gravity and gets pulled back
// toward its neighbors to keep the segments roughly a fixed length
// apart. The correction is intentionally soft/partial (not fully
// rigid), which is what lets the ribbon visibly stretch under load
// and settle with a natural, wavy wobble after you let go instead of
// snapping back like a stiff rod.
//
// On top of that swing, the card itself gets its own independent spin
// and tilt, driven by how fast the last point of the rope is moving.
// Whip it sideways and it twirls around on the string (showing the
// back before it settles) the way flicking a real convention badge
// does; yank it up/down and it tips, then gravity eases it back flat -
// the same way a hanging badge doesn't stay tipped, but can happily
// rest facing either way after a spin.

const container = document.getElementById('lanyard-container');
const canvas = document.getElementById('lanyard-canvas');
const card = document.getElementById('lanyard-card');
const flip = card.querySelector('.lanyard-flip');
const ctx = canvas.getContext('2d');

// ---- Rope setup ----
const numSegments = 9;
const segmentLength = 26;
// The anchor sits just above the visible area so the string looks
// like it's coming from off-screen instead of showing a dot where
// it's pinned.
const anchor = { x: 0, y: -40 };
let points = [];

let width, height;
function resize() {
  const oldAnchorX = anchor.x;
  width = container.offsetWidth;
  // The drawing surface is made noticeably taller than the container's
  // own height, so the badge can be dragged well past the container's
  // resting height (or toward the bottom of a tall window) without the
  // rope running out of canvas to draw on and disappearing.
  height = Math.max(container.offsetHeight, window.innerHeight) * 2;
  canvas.width = width;
  canvas.height = height;
  canvas.style.height = height + 'px';
  anchor.x = width / 2;

  // Shift every existing point (and its previous-frame position) by
  // the same amount the anchor just moved, instead of only moving the
  // pinned point. Moving just the anchor left the rest of the rope
  // behind, so any resize - including the ones that fullscreen and
  // windowed toggles trigger - made the whole rope suddenly stretch
  // across the gap in a single frame. That snap-instead-of-slide is
  // what reads as the badge "spazzing," and can kick the spin hard
  // enough that it settles back-first, since nothing pulls spin back
  // toward front (only tilt has a restoring force - see
  // updateSpinAndTilt below).
  const dx = anchor.x - oldAnchorX;
  if (dx && points.length) {
    for (const p of points) {
      p.x += dx;
      p.oldx += dx;
    }
  }
}

window.addEventListener('resize', resize);
resize();

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
const constraintIterations = 2; // fewer = stretchier, less rigid rope
const stiffness = 0.4;          // lower = the ribbon can stretch further before snapping back
const windStrength = 0.045;     // tiny constant sway so it never looks totally frozen at rest

// ---- Spin & tilt ("turning around") ----
let spin = 0;            // rotateY - free to end up facing either way
let spinVelocity = 0;
const spinTorque = 0.02;
const spinDamping = 0.94;

let tiltX = 0;            // rotateX - always eases back toward flat
let tiltVelocity = 0;
const tiltTorque = 0.015;
const tiltRestoring = 0.02;
const tiltDamping = 0.9;
const tiltLimit = 20;

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
let frame = 0;

function updatePoints() {
  frame++;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.pinned) continue;
    const vx = (p.x - p.oldx) * friction;
    const vy = (p.y - p.oldy) * friction;
    p.oldx = p.x;
    p.oldy = p.y;
    p.x += vx + Math.sin(frame * 0.02 + i * 0.6) * windStrength;
    p.y += vy + gravity;
  }

  if (dragging) {
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

function updateSpinAndTilt() {
  const last = points[points.length - 1];
  const vx = last.x - last.oldx;
  const vy = last.y - last.oldy;

  spinVelocity += vx * spinTorque;
  spinVelocity *= spinDamping;
  spin += spinVelocity;

  tiltVelocity += vy * tiltTorque;
  tiltVelocity += -tiltX * tiltRestoring;
  tiltVelocity *= tiltDamping;
  tiltX += tiltVelocity;
  if (tiltX > tiltLimit) { tiltX = tiltLimit; tiltVelocity = 0; }
  if (tiltX < -tiltLimit) { tiltX = -tiltLimit; tiltVelocity = 0; }
}

// ---- Rendering ----
const ribbonColor = '#ff8fc4';
const baseWidth = 14;

function draw() {
  ctx.clearRect(0, 0, width, height);

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

  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const angle = Math.atan2(last.x - prev.x, last.y - prev.y) * (180 / Math.PI);

  card.style.transform = `translate(${last.x}px, ${last.y}px) rotateZ(${angle}deg)`;
  flip.style.transform = `rotateX(${tiltX}deg) rotateY(${spin}deg)`;
}

function loop() {
  updatePoints();
  applyConstraints();
  updateSpinAndTilt();
  draw();
  requestAnimationFrame(loop);
}
loop();
