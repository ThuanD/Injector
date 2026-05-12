/* ═══════════════════════════════════════════════════════
   INJECTOR LANDING – Three.js Particle Network + GSAP
   ═══════════════════════════════════════════════════════ */

// ── THREE.JS PARTICLE NETWORK ──────────────────────────
(function () {
  const canvas = document.getElementById("three-canvas");
  if (!canvas) return;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.z = 50;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  // ── Particles ──
  const PARTICLE_COUNT = 280;
  const SPREAD = 80;
  const CONNECTION_DIST = 14;

  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const velocities = [];
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const sizes = new Float32Array(PARTICLE_COUNT);

  // Palette: cyan #3dd6f5, purple #7c6cf8, green #2dd4a0
  const palette = [
    { r: 0.24, g: 0.84, b: 0.96 }, // cyan
    { r: 0.49, g: 0.42, b: 0.97 }, // purple
    { r: 0.18, g: 0.83, b: 0.63 }, // green
    { r: 0.96, g: 0.65, b: 0.14 }, // amber
  ];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    positions[i3] = (Math.random() - 0.5) * SPREAD;
    positions[i3 + 1] = (Math.random() - 0.5) * SPREAD;
    positions[i3 + 2] = (Math.random() - 0.5) * SPREAD * 0.5;

    velocities.push({
      x: (Math.random() - 0.5) * 0.02,
      y: (Math.random() - 0.5) * 0.02,
      z: (Math.random() - 0.5) * 0.01,
    });

    const col = palette[Math.floor(Math.random() * palette.length)];
    colors[i3] = col.r;
    colors[i3 + 1] = col.g;
    colors[i3 + 2] = col.b;

    sizes[i] = Math.random() * 2.5 + 1;
  }

  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3)
  );
  particleGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  particleGeometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

  // Custom shader for glowing dots
  const particleMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: renderer.getPixelRatio() },
    },
    vertexShader: `
      attribute float size;
      attribute vec3 color;
      varying vec3 vColor;
      varying float vAlpha;
      uniform float uTime;
      uniform float uPixelRatio;

      void main() {
        vColor = color;
        vec3 pos = position;
        pos.y += sin(uTime * 0.3 + position.x * 0.1) * 1.2;
        pos.x += cos(uTime * 0.2 + position.y * 0.08) * 0.8;

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = size * uPixelRatio * (40.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;

        float dist = length(mvPosition.xyz);
        vAlpha = smoothstep(80.0, 20.0, dist) * 0.85;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float glow = 1.0 - smoothstep(0.0, 0.5, d);
        glow = pow(glow, 1.5);
        gl_FragColor = vec4(vColor, glow * vAlpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const particles = new THREE.Points(particleGeometry, particleMaterial);
  scene.add(particles);

  // ── Connection Lines ──
  const MAX_LINES = 600;
  const linePositions = new Float32Array(MAX_LINES * 6);
  const lineColors = new Float32Array(MAX_LINES * 6);
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(linePositions, 3)
  );
  lineGeometry.setAttribute(
    "color",
    new THREE.BufferAttribute(lineColors, 3)
  );
  lineGeometry.setDrawRange(0, 0);

  const lineMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.15,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
  scene.add(lines);

  // ── Mouse tracking ──
  const mouse = { x: 0, y: 0, worldX: 0, worldY: 0 };
  document.addEventListener("mousemove", (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    mouse.worldX = mouse.x * 30;
    mouse.worldY = mouse.y * 20;
  });

  // ── Scroll parallax ──
  let scrollY = 0;
  window.addEventListener("scroll", () => {
    scrollY = window.scrollY;
  });

  // ── Resize ──
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    particleMaterial.uniforms.uPixelRatio.value = renderer.getPixelRatio();
  });

  // ── Render loop ──
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();
    particleMaterial.uniforms.uTime.value = elapsed;

    const posArr = particleGeometry.attributes.position.array;

    // Move particles
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      posArr[i3] += velocities[i].x;
      posArr[i3 + 1] += velocities[i].y;
      posArr[i3 + 2] += velocities[i].z;

      // Boundary wrap
      const half = SPREAD / 2;
      if (posArr[i3] > half) posArr[i3] = -half;
      if (posArr[i3] < -half) posArr[i3] = half;
      if (posArr[i3 + 1] > half) posArr[i3 + 1] = -half;
      if (posArr[i3 + 1] < -half) posArr[i3 + 1] = half;
    }

    particleGeometry.attributes.position.needsUpdate = true;

    // Update connections
    let lineIdx = 0;
    const lp = lineGeometry.attributes.position.array;
    const lc = lineGeometry.attributes.color.array;

    for (let i = 0; i < PARTICLE_COUNT && lineIdx < MAX_LINES; i++) {
      for (
        let j = i + 1;
        j < PARTICLE_COUNT && lineIdx < MAX_LINES;
        j++
      ) {
        const i3 = i * 3;
        const j3 = j * 3;
        const dx = posArr[i3] - posArr[j3];
        const dy = posArr[i3 + 1] - posArr[j3 + 1];
        const dz = posArr[i3 + 2] - posArr[j3 + 2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < CONNECTION_DIST) {
          const li = lineIdx * 6;
          lp[li] = posArr[i3];
          lp[li + 1] = posArr[i3 + 1];
          lp[li + 2] = posArr[i3 + 2];
          lp[li + 3] = posArr[j3];
          lp[li + 4] = posArr[j3 + 1];
          lp[li + 5] = posArr[j3 + 2];

          const alpha = 1 - dist / CONNECTION_DIST;
          lc[li] = 0.24 * alpha;
          lc[li + 1] = 0.84 * alpha;
          lc[li + 2] = 0.96 * alpha;
          lc[li + 3] = 0.49 * alpha;
          lc[li + 4] = 0.42 * alpha;
          lc[li + 5] = 0.97 * alpha;

          lineIdx++;
        }
      }
    }
    lineGeometry.setDrawRange(0, lineIdx * 2);
    lineGeometry.attributes.position.needsUpdate = true;
    lineGeometry.attributes.color.needsUpdate = true;

    // Camera moves with mouse & scroll
    camera.position.x += (mouse.worldX * 0.3 - camera.position.x) * 0.03;
    camera.position.y +=
      (mouse.worldY * 0.3 - scrollY * 0.01 - camera.position.y) * 0.03;
    camera.lookAt(0, 0, 0);

    // Gentle scene rotation
    particles.rotation.y = elapsed * 0.03;
    lines.rotation.y = elapsed * 0.03;

    renderer.render(scene, camera);
  }

  animate();
})();

// ── GSAP ANIMATIONS ────────────────────────────────────
(function () {
  gsap.registerPlugin(ScrollTrigger);

  // Hero elements stagger
  const heroTimeline = gsap.timeline({ defaults: { ease: "power3.out" } });
  heroTimeline
    .from(".hero-badge", { y: 40, opacity: 0, duration: 0.8 })
    .from("h1", { y: 60, opacity: 0, duration: 0.9 }, "-=0.5")
    .from(".hero-sub", { y: 40, opacity: 0, duration: 0.7 }, "-=0.5")
    .from(".hero-btns", { y: 30, opacity: 0, duration: 0.6 }, "-=0.3")
    .from(
      ".hero-stats .stat",
      { y: 20, opacity: 0, duration: 0.5, stagger: 0.1 },
      "-=0.3"
    );

  // Section headers
  gsap.utils.toArray(".section-tag, .section-title, .section-sub").forEach((el) => {
    gsap.from(el, {
      scrollTrigger: {
        trigger: el,
        start: "top 88%",
        toggleActions: "play none none none",
      },
      y: 30,
      opacity: 0,
      duration: 0.7,
      ease: "power2.out",
    });
  });

  // Feature cards
  gsap.utils.toArray(".feat-card").forEach((card, i) => {
    gsap.from(card, {
      scrollTrigger: {
        trigger: card,
        start: "top 90%",
        toggleActions: "play none none none",
      },
      y: 50,
      opacity: 0,
      duration: 0.6,
      delay: i * 0.08,
      ease: "power2.out",
    });
  });

  // Template pills
  gsap.utils.toArray(".tpl-pill").forEach((pill, i) => {
    gsap.from(pill, {
      scrollTrigger: {
        trigger: pill,
        start: "top 92%",
        toggleActions: "play none none none",
      },
      scale: 0.7,
      opacity: 0,
      duration: 0.4,
      delay: i * 0.03,
      ease: "back.out(1.7)",
    });
  });

  // Steps slide in from left
  gsap.utils.toArray(".step-item").forEach((step, i) => {
    gsap.from(step, {
      scrollTrigger: {
        trigger: step,
        start: "top 88%",
        toggleActions: "play none none none",
      },
      x: -40,
      opacity: 0,
      duration: 0.6,
      delay: i * 0.12,
      ease: "power2.out",
    });
  });

  // Terminal slide in from right
  gsap.from(".terminal", {
    scrollTrigger: {
      trigger: ".terminal",
      start: "top 85%",
      toggleActions: "play none none none",
    },
    x: 60,
    opacity: 0,
    duration: 0.8,
    ease: "power2.out",
  });

  // FAQ items
  gsap.utils.toArray(".faq-item").forEach((item, i) => {
    gsap.from(item, {
      scrollTrigger: {
        trigger: item,
        start: "top 90%",
        toggleActions: "play none none none",
      },
      y: 30,
      opacity: 0,
      duration: 0.5,
      delay: i * 0.06,
      ease: "power2.out",
    });
  });

  // CTA section
  gsap.from(".cta-box", {
    scrollTrigger: {
      trigger: ".cta-box",
      start: "top 80%",
      toggleActions: "play none none none",
    },
    y: 50,
    opacity: 0,
    duration: 0.8,
    ease: "power3.out",
  });

  // Smooth active nav highlight (replaces inline script)
  const sections = document.querySelectorAll("section[id]");
  const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');

  window.addEventListener("scroll", () => {
    let current = "";
    sections.forEach((s) => {
      if (window.scrollY >= s.offsetTop - 100) current = s.id;
    });
    navLinks.forEach((a) => {
      a.style.color =
        a.getAttribute("href") === `#${current}` ? "var(--accent)" : "";
    });
  });

  // ── Magnetic hover for CTA buttons ──
  document.querySelectorAll(".btn-primary, .nav-cta").forEach((btn) => {
    btn.addEventListener("mousemove", (e) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      gsap.to(btn, {
        x: x * 0.15,
        y: y * 0.15,
        duration: 0.3,
        ease: "power2.out",
      });
    });
    btn.addEventListener("mouseleave", () => {
      gsap.to(btn, { x: 0, y: 0, duration: 0.5, ease: "elastic.out(1, 0.4)" });
    });
  });

  // ── Typing effect for terminal ──
  const termBody = document.querySelector(".terminal-body");
  if (termBody) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            termBody.classList.add("typing-active");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.3 }
    );
    observer.observe(termBody);
  }

  // ── Counter animation for stats ──
  const statNumbers = document.querySelectorAll(".stat-n");
  const statsObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const text = el.textContent.trim();
          // Animate plain integers (e.g. "27", "9"); skip "MV3", "v2.0"
          if (/^\d+$/.test(text)) {
            const target = parseInt(text, 10);
            gsap.from(el, {
              textContent: 0,
              duration: 1.4,
              ease: "power2.out",
              snap: { textContent: 1 },
              onUpdate: function () {
                el.textContent = Math.ceil(this.targets()[0].textContent);
              },
              onComplete: () => {
                el.textContent = target;
              },
            });
          }
          statsObserver.unobserve(el);
        }
      });
    },
    { threshold: 0.5 }
  );
  statNumbers.forEach((n) => statsObserver.observe(n));
})();

// ── MOBILE NAV TOGGLE ──────────────────────────────────
(function () {
  const btn = document.getElementById("navToggle");
  const links = document.getElementById("navLinks");
  if (!btn || !links) return;

  const close = () => {
    links.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
  };

  btn.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  });

  // close menu after clicking a link
  links.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", close);
  });

  // close when resizing to desktop
  window.addEventListener("resize", () => {
    if (window.innerWidth > 768) close();
  });
})();

// ── CUSTOM CURSOR GLOW ─────────────────────────────────
(function () {
  const glow = document.createElement("div");
  glow.className = "cursor-glow";
  document.body.appendChild(glow);

  let mx = 0, my = 0, cx = 0, cy = 0;

  document.addEventListener("mousemove", (e) => {
    mx = e.clientX;
    my = e.clientY;
  });

  function moveCursor() {
    cx += (mx - cx) * 0.12;
    cy += (my - cy) * 0.12;
    glow.style.transform = `translate(${cx - 200}px, ${cy - 200}px)`;
    requestAnimationFrame(moveCursor);
  }
  moveCursor();
})();
