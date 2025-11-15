import React, { useState, useRef, useEffect, useCallback } from "react";

// --- Vector Class ---
// A simple 2D Vector class to make math easier.
// Defined outside the component so it's not recreated on every render.
class Vector {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  add(v) {
    this.x += v.x;
    this.y += v.y;
    return this;
  }
  sub(v) {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }
  mult(n) {
    this.x *= n;
    this.y *= n;
    return this;
  }
  div(n) {
    if (n !== 0) {
      this.x /= n;
      this.y /= n;
    }
    return this;
  }
  mag() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }
  normalize() {
    const m = this.mag();
    if (m !== 0) {
      this.div(m);
    }
    return this;
  }
  setMag(n) {
    return this.normalize().mult(n);
  }
  limit(max) {
    const mSq = this.x * this.x + this.y * this.y;
    if (mSq > max * max) {
      this.div(Math.sqrt(mSq)).mult(max);
    }
    return this;
  }
  heading() {
    return Math.atan2(this.y, this.x);
  }
  static dist(v1, v2) {
    const dx = v1.x - v2.x;
    const dy = v1.y - v2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  static sub(v1, v2) {
    return new Vector(v1.x - v2.x, v1.y - v2.y);
  }
}

// --- Boid Class ---
// The main "bird" object.
class Boid {
  constructor(width, height) {
    this.position = new Vector(Math.random() * width, Math.random() * height);
    const angle = Math.random() * Math.PI * 2;
    this.velocity = new Vector(Math.cos(angle), Math.sin(angle));
    this.velocity.setMag(Math.random() * 2 + 2);
    this.acceleration = new Vector();

    // These will be updated from the React state
    this.maxForce = 0.1;
    this.maxSpeed = 4;
    this.perceptionRadius = 50;
    this.separationRadius = 25;
  }

  // 1. Alignment
  align(boids) {
    let steering = new Vector();
    let total = 0;
    for (let other of boids) {
      let d = Vector.dist(this.position, other.position);
      if (other !== this && d < this.perceptionRadius) {
        steering.add(other.velocity);
        total++;
      }
    }
    if (total > 0) {
      steering.div(total);
      steering.setMag(this.maxSpeed);
      steering.sub(this.velocity);
      steering.limit(this.maxForce);
    }
    return steering;
  }

  // 2. Cohesion
  cohesion(boids) {
    let steering = new Vector();
    let total = 0;
    for (let other of boids) {
      let d = Vector.dist(this.position, other.position);
      if (other !== this && d < this.perceptionRadius) {
        steering.add(other.position);
        total++;
      }
    }
    if (total > 0) {
      steering.div(total);
      steering.sub(this.position);
      steering.setMag(this.maxSpeed);
      steering.sub(this.velocity);
      steering.limit(this.maxForce);
    }
    return steering;
  }

  // 3. Separation
  separation(boids) {
    let steering = new Vector();
    let total = 0;
    for (let other of boids) {
      let d = Vector.dist(this.position, other.position);
      if (other !== this && d < this.separationRadius) {
        let diff = Vector.sub(this.position, other.position);
        diff.div(d * d);
        steering.add(diff);
        total++;
      }
    }
    if (total > 0) {
      steering.div(total);
      steering.setMag(this.maxSpeed);
      steering.sub(this.velocity);
      steering.limit(this.maxForce);
    }
    return steering;
  }

  // Combine rules
  flock(boids, alignWeight, cohesionWeight, separationWeight) {
    // Update properties from React state (passed in)
    this.separationRadius = this.perceptionRadius * 0.5;

    let alignment = this.align(boids);
    let cohesion = this.cohesion(boids);
    let separation = this.separation(boids);

    alignment.mult(alignWeight);
    cohesion.mult(cohesionWeight);
    separation.mult(separationWeight);

    this.applyForce(alignment);
    this.applyForce(cohesion);
    this.applyForce(separation);
  }

  applyForce(force) {
    this.acceleration.add(force);
  }

  update() {
    this.velocity.add(this.acceleration);
    this.velocity.limit(this.maxSpeed);
    this.position.add(this.velocity);
    this.acceleration.mult(0);
  }

  edges(width, height) {
    if (this.position.x > width) this.position.x = 0;
    else if (this.position.x < 0) this.position.x = width;
    if (this.position.y > height) this.position.y = 0;
    else if (this.position.y < 0) this.position.y = height;
  }

  draw(ctx) {
    const angle = this.velocity.heading();
    ctx.save();
    ctx.translate(this.position.x, this.position.y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-3, -3);
    ctx.lineTo(-3, 3);
    ctx.closePath();
    ctx.fillStyle = "white";
    ctx.fill();
    ctx.restore();
  }
}

// --- Main React Component ---
export default function BoidsMurmuration() {
  // --- State for Controls ---
  const [boidCount, setBoidCount] = useState(150);
  const [alignment, setAlignment] = useState(1.0);
  const [cohesion, setCohesion] = useState(1.0);
  const [separation, setSeparation] = useState(1.5);
  const [perception, setPerception] = useState(50);
  const [maxSpeed, setMaxSpeed] = useState(4);
  const [maxForce, setMaxForce] = useState(0.1);
  const [showControls, setShowControls] = useState(true);

  // --- Refs ---
  const canvasRef = useRef(null);
  // Use a ref to store the flock array, preventing re-initialization on render
  const flockRef = useRef([]);
  // Ref to store the animation frame request ID
  const animationFrameRef = useRef(null);

  // --- Control Data ---
  // Using an array to map over for controls UI
  const controls = [
    {
      name: "Boids",
      value: boidCount,
      set: setBoidCount,
      min: 10,
      max: 300,
      step: 10,
    },
    {
      name: "Alignment",
      value: alignment,
      set: setAlignment,
      min: 0,
      max: 2.5,
      step: 0.1,
    },
    {
      name: "Cohesion",
      value: cohesion,
      set: setCohesion,
      min: 0,
      max: 2.5,
      step: 0.1,
    },
    {
      name: "Separation",
      value: separation,
      set: setSeparation,
      min: 0,
      max: 2.5,
      step: 0.1,
    },
    {
      name: "Perception",
      value: perception,
      set: setPerception,
      min: 10,
      max: 200,
      step: 1,
    },
    {
      name: "Max Speed",
      value: maxSpeed,
      set: setMaxSpeed,
      min: 1,
      max: 10,
      step: 0.1,
    },
    {
      name: "Max Force",
      value: maxForce,
      set: setMaxForce,
      min: 0.01,
      max: 0.5,
      step: 0.01,
    },
  ];

  // --- Animation Loop ---
  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const flock = flockRef.current;

    // Semi-transparent background for trails
    ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let boid of flock) {
      // Update boid properties from React state
      boid.maxSpeed = maxSpeed;
      boid.maxForce = maxForce;
      boid.perceptionRadius = perception;

      // Run simulation logic
      boid.flock(flock, alignment, cohesion, separation);
      boid.update();
      boid.edges(canvas.width, canvas.height);
      boid.draw(ctx);
    }

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [alignment, cohesion, separation, perception, maxSpeed, maxForce]); // Dependencies

  // --- Initialization and Resize Effect ---
  useEffect(() => {
    const canvas = canvasRef.current;
    const flock = flockRef.current;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      // Re-populate flock only if count changes (handled in boidCount effect)
      // or if it's the first run
      if (flock.length === 0) {
        for (let i = 0; i < boidCount; i++) {
          flock.push(new Boid(canvas.width, canvas.height));
        }
      }
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Start animation loop
    animationFrameRef.current = requestAnimationFrame(animate);

    // Cleanup
    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationFrameRef.current);
      // Don't clear flock here, let the boidCount effect handle it
    };
  }, [animate, boidCount]); // Rerun on boidCount change is handled by next effect

  // --- Effect for Boid Count Changes ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const currentCount = flockRef.current.length;
    if (boidCount > currentCount) {
      // Add boids
      for (let i = 0; i < boidCount - currentCount; i++) {
        flockRef.current.push(new Boid(canvas.width, canvas.height));
      }
    } else if (boidCount < currentCount) {
      // Remove boids
      flockRef.current = flockRef.current.slice(0, boidCount);
    }
  }, [boidCount]);

  return (
    <div className="relative w-full h-screen bg-black">
      <canvas ref={canvasRef} className="block w-full h-full" />

      {/* --- Controls Panel --- */}
      {showControls && (
        <div className="absolute top-4 left-4 w-full max-w-xs p-6 bg-gray-900/70 text-white backdrop-blur-md border border-gray-700 rounded-lg shadow-xl">
          <h2 className="text-xl font-semibold mb-4 pb-2 border-b border-gray-600">
            Flock Controls
          </h2>

          <div className="space-y-4">
            {controls.map((control) => (
              <div key={control.name} className="control-group">
                <label className="flex justify-between items-center mb-1 text-sm font-medium text-gray-200">
                  <span>{control.name}:</span>
                  <span className="font-normal text-gray-400">
                    {parseFloat(control.value).toFixed(
                      control.step < 1 ? 2 : 0
                    )}
                  </span>
                </label>
                <input
                  type="range"
                  min={control.min}
                  max={control.max}
                  step={control.step}
                  value={control.value}
                  onChange={(e) => control.set(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer range-sm"
                />
              </div>
            ))}
          </div>

          <button
            onClick={() => setShowControls(false)}
            className="w-full mt-6 px-4 py-2 bg-gray-700/50 hover:bg-gray-600/50 text-white text-sm rounded-md transition-colors"
          >
            Hide Controls
          </button>
        </div>
      )}

      {/* --- Show Controls Button --- */}
      {!showControls && (
        <button
          onClick={() => setShowControls(true)}
          className="absolute bottom-4 left-4 px-5 py-2.5 bg-gray-900/70 text-white text-sm font-medium backdrop-blur-md border border-gray-700 rounded-lg shadow-xl hover:bg-gray-800/70 transition-colors"
        >
          Show Controls
        </button>
      )}
    </div>
  );
}
