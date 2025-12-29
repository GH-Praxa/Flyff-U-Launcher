import "./themeAnimations.css";

type CanvasEffect = {
  resize(width: number, height: number): void;
  draw(delta: number): void;
};

const OVERLAY_ID = "theme-animation-layer";
const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
let currentEffect: CanvasEffect | null = null;
let LOOP_ID: number | null = null;
let lastTimestamp = 0;
let currentWidth = 0;
let currentHeight = 0;

if (!ctx) {
  throw new Error("Canvas context failed to initialize");
}

const overlay = document.createElement("div");
overlay.id = OVERLAY_ID;
overlay.className = "theme-animation-layer";
overlay.appendChild(canvas);
document.body.prepend(overlay);
document.body.classList.add("has-theme-animation");

const updateOverlayVisibility = (visible: boolean) => {
  overlay.classList.toggle("is-active", visible);
};

function resizeCanvas() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const ratio = window.devicePixelRatio || 1;
  if (width === currentWidth && height === currentHeight) {
    return;
  }
  currentWidth = width;
  currentHeight = height;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  currentEffect?.resize(width, height);
}

window.addEventListener("resize", () => {
  resizeCanvas();
});

resizeCanvas();

function animationLoop(timestamp: number) {
  if (!currentEffect) {
    LOOP_ID = null;
    return;
  }
  if (!lastTimestamp) {
    lastTimestamp = timestamp;
  }
  const delta = timestamp - lastTimestamp;
  lastTimestamp = timestamp;
  ctx.clearRect(0, 0, currentWidth, currentHeight);
  currentEffect.draw(delta);
  LOOP_ID = requestAnimationFrame(animationLoop);
}

function stopLoop() {
  if (LOOP_ID) {
    cancelAnimationFrame(LOOP_ID);
    LOOP_ID = null;
  }
  lastTimestamp = 0;
  ctx.clearRect(0, 0, currentWidth, currentHeight);
}

function ensureLoop() {
  if (LOOP_ID) {
    return;
  }
  lastTimestamp = 0;
  LOOP_ID = requestAnimationFrame(animationLoop);
}

export type ThemeEffect = "particles" | "rain" | "grid";

class ParticleEffect implements CanvasEffect {
  private particles: {
    x: number;
    y: number;
    radius: number;
    speedX: number;
    speedY: number;
    alpha: number;
  }[] = [];

  constructor(private ctx: CanvasRenderingContext2D, private width: number, private height: number) {
    this.buildParticles();
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.buildParticles();
  }

  private buildParticles() {
    const count = Math.max(30, Math.floor((this.width + this.height) / 40));
    this.particles = Array.from({ length: count }, () => this.createParticle());
  }

  private createParticle() {
    return {
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      radius: 2 + Math.random() * 4,
      speedX: (Math.random() - 0.5) * 0.02 * this.width,
      speedY: 0.03 * this.height + Math.random() * 0.02 * this.height,
      alpha: 0.15 + Math.random() * 0.35,
    };
  }

  draw(delta: number) {
    this.ctx.save();
    this.ctx.fillStyle = "rgba(255,255,255,0.08)";
    for (const particle of this.particles) {
      particle.x += particle.speedX * (delta / 1000);
      particle.y += particle.speedY * (delta / 1000);
      if (particle.y > this.height + particle.radius) {
        particle.y = -particle.radius;
      }
      if (particle.x > this.width + particle.radius) {
        particle.x = -particle.radius;
      }
      if (particle.x < -particle.radius) {
        particle.x = this.width + particle.radius;
      }
      const gradient = this.ctx.createRadialGradient(
        particle.x,
        particle.y,
        0,
        particle.x,
        particle.y,
        particle.radius * 1.3
      );
      gradient.addColorStop(0, `rgba(255,255,255,${particle.alpha})`);
      gradient.addColorStop(0.6, "rgba(255,255,255,0.05)");
      gradient.addColorStop(1, "transparent");
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }
}

class RainEffect implements CanvasEffect {
  private drops: {
    x: number;
    y: number;
    length: number;
    speed: number;
    thickness: number;
  }[] = [];

  constructor(private ctx: CanvasRenderingContext2D, private width: number, private height: number) {
    this.buildDrops();
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.buildDrops();
  }

  private buildDrops() {
    const count = Math.max(40, Math.floor((this.width + this.height) / 20));
    this.drops = Array.from({ length: count }, () => this.createDrop());
  }

  private createDrop() {
    return {
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      length: 20 + Math.random() * 60,
      speed: 200 + Math.random() * 300,
      thickness: 1 + Math.random() * 1.5,
    };
  }

  draw(delta: number) {
    this.ctx.save();
    this.ctx.strokeStyle = "rgba(255,255,255,0.12)";
    this.ctx.lineCap = "round";
    this.ctx.lineWidth = 1;
    for (const drop of this.drops) {
      drop.y += (drop.speed * delta) / 1000;
      if (drop.y > this.height + drop.length) {
        drop.y = -drop.length;
      }
      this.ctx.beginPath();
      this.ctx.moveTo(drop.x, drop.y);
      this.ctx.lineTo(drop.x, drop.y + drop.length);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }
}

class GridEffect implements CanvasEffect {
  private offset = 0;
  private scanLine = 0;

  constructor(private ctx: CanvasRenderingContext2D, private width: number, private height: number) {}

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  draw(delta: number) {
    this.offset += (delta / 1000) * 20;
    this.scanLine = (this.scanLine + (delta / 1000) * 80) % (this.height * 2);
    const step = 80;
    this.ctx.save();
    this.ctx.strokeStyle = "rgba(255,255,255,0.05)";
    this.ctx.lineWidth = 1;
    for (let x = -step + (this.offset % step); x < this.width + step; x += step) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.height);
      this.ctx.stroke();
    }
    for (let y = -step + (this.offset % step); y < this.height + step; y += step) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.width, y);
      this.ctx.stroke();
    }
    const gradient = this.ctx.createLinearGradient(0, this.scanLine - 40, 0, this.scanLine + 40);
    gradient.addColorStop(0, "rgba(255,255,255,0)");
    gradient.addColorStop(0.5, "rgba(255,255,255,0.35)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.ctx.restore();
  }
}

function createEffect(effect: ThemeEffect): CanvasEffect {
  switch (effect) {
    case "particles":
      return new ParticleEffect(ctx, currentWidth, currentHeight);
    case "rain":
      return new RainEffect(ctx, currentWidth, currentHeight);
    case "grid":
      return new GridEffect(ctx, currentWidth, currentHeight);
  }
}

let activeEffect: ThemeEffect | null = null;

export function setThemeEffect(effect?: ThemeEffect) {
  if (!effect) {
    if (activeEffect) {
      activeEffect = null;
      currentEffect = null;
      stopLoop();
      updateOverlayVisibility(false);
    }
    return;
  }
  if (activeEffect === effect) {
    return;
  }
  activeEffect = effect;
  currentEffect = createEffect(effect);
  resizeCanvas();
  ensureLoop();
  updateOverlayVisibility(true);
}

export function resetThemeEffect() {
  activeEffect = null;
  currentEffect = null;
  stopLoop();
  updateOverlayVisibility(false);
}
