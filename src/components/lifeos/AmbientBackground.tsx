import { useEffect, useRef } from "react";
import * as THREE from "three";
import { animate } from "animejs";

export type AmbientState =
  | "IDLE"
  | "ANALYZING"
  | "UNDERSTANDING"
  | "PLANNING"
  | "REPLANNING";

type Props = {
  state?: AmbientState;
  density?: "full" | "subtle";
};

interface StateConfig {
  speed: number;
  particleSize: number;
  opacity: number;
  coreScale: number;
  glow: number;
  convergence: number;
  turbulence: number;
  orbit: number;
  pulse: number;
}

const STATE_CONFIGS: Record<AmbientState, StateConfig> = {
  IDLE: {
    speed: 0.15,
    particleSize: 1,
    opacity: 0.42,
    coreScale: 0.92,
    glow: 0.55,
    convergence: 0,
    turbulence: 0.01,
    orbit: 0.0005,
    pulse: 0.8,
  },

  ANALYZING: {
    speed: 0.35,
    particleSize: 1.15,
    opacity: 0.62,
    coreScale: 1.05,
    glow: 0.78,
    convergence: 0.16,
    turbulence: 0.035,
    orbit: 0.0012,
    pulse: 1.2,
  },

  UNDERSTANDING: {
    speed: 0.26,
    particleSize: 1.28,
    opacity: 0.7,
    coreScale: 1.14,
    glow: 0.9,
    convergence: 0.34,
    turbulence: 0.045,
    orbit: 0.001,
    pulse: 1.5,
  },

  PLANNING: {
    speed: 0.32,
    particleSize: 1.2,
    opacity: 0.66,
    coreScale: 1.06,
    glow: 0.82,
    convergence: 0.08,
    turbulence: 0.025,
    orbit: 0.0015,
    pulse: 1.3,
  },

  REPLANNING: {
    speed: 0.62,
    particleSize: 1.45,
    opacity: 0.84,
    coreScale: 1.22,
    glow: 1,
    convergence: 0.14,
    turbulence: 0.16,
    orbit: 0.003,
    pulse: 2,
  },
};

export function AmbientBackground({
  state = "IDLE",
  density = "full",
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<AmbientState>(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reducedMotion) return;

    let destroyed = false;

    /* ================================================================
       RENDERER
       ================================================================ */

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });

    const pixelRatio = Math.min(
      window.devicePixelRatio || 1,
      1.5,
    );

    renderer.setPixelRatio(pixelRatio);

    renderer.setSize(
      container.clientWidth,
      Math.max(container.clientHeight, 1),
      false,
    );

    renderer.setClearColor(0x000000, 0);

    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.inset = "0";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.pointerEvents = "none";

    container.appendChild(renderer.domElement);

    /* ================================================================
       SCENE
       ================================================================ */

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      52,
      container.clientWidth /
        Math.max(container.clientHeight, 1),
      0.1,
      1000,
    );

    camera.position.set(0, 0, 17);

    const world = new THREE.Group();

    scene.add(world);

    /* ================================================================
       PARTICLES
       ================================================================ */

    const mobile = window.innerWidth < 768;

    const particleCount =
      density === "subtle"
        ? mobile
          ? 350
          : 650
        : mobile
          ? 650
          : 1300;

    const positions = new Float32Array(
      particleCount * 3,
    );

    const basePositions = new Float32Array(
      particleCount * 3,
    );

    const velocities = new Float32Array(
      particleCount * 3,
    );

    const seeds = new Float32Array(
      particleCount,
    );

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;

      const radius =
        4 +
        Math.pow(Math.random(), 0.72) * 17;

      const theta =
        Math.random() * Math.PI * 2;

      const phi =
        Math.acos(
          2 * Math.random() - 1,
        );

      const x =
        radius *
        Math.sin(phi) *
        Math.cos(theta);

      const y =
        radius *
        Math.sin(phi) *
        Math.sin(theta);

      const z =
        radius *
        Math.cos(phi);

      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;

      basePositions[i3] = x;
      basePositions[i3 + 1] = y;
      basePositions[i3 + 2] = z;

      velocities[i3] =
        (Math.random() - 0.5) * 0.0015;

      velocities[i3 + 1] =
        (Math.random() - 0.5) * 0.0015;

      velocities[i3 + 2] =
        (Math.random() - 0.5) * 0.0015;

      seeds[i] =
        Math.random() * Math.PI * 2;
    }

    const particleGeometry =
      new THREE.BufferGeometry();

    particleGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(
        positions,
        3,
      ),
    );

    const particleMaterial =
      new THREE.PointsMaterial({
        color: 0x46eaff,
        size: mobile ? 0.055 : 0.075,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

    const particles =
      new THREE.Points(
        particleGeometry,
        particleMaterial,
      );

    world.add(particles);

    /* ================================================================
       BLACK HOLE CORE
       ================================================================ */

    const coreGroup =
      new THREE.Group();

    world.add(coreGroup);

    /* Event horizon */

    const horizonGeometry =
      new THREE.SphereGeometry(
        1.65,
        48,
        48,
      );

    const horizonMaterial =
      new THREE.MeshBasicMaterial({
        color: 0x000307,
        transparent: true,
        opacity: 0.96,
      });

    const horizon =
      new THREE.Mesh(
        horizonGeometry,
        horizonMaterial,
      );

    coreGroup.add(horizon);

    /* Inner blue energy */

    const energyGeometry =
      new THREE.SphereGeometry(
        1.76,
        40,
        40,
      );

    const energyMaterial =
      new THREE.MeshBasicMaterial({
        color: 0x00c8ff,
        wireframe: true,
        transparent: true,
        opacity: 0.075,
        blending: THREE.AdditiveBlending,
      });

    const energy =
      new THREE.Mesh(
        energyGeometry,
        energyMaterial,
      );

    coreGroup.add(energy);

    /* Outer neural shell */

    const shellGeometry =
      new THREE.IcosahedronGeometry(
        2.25,
        3,
      );

    const shellMaterial =
      new THREE.MeshBasicMaterial({
        color: 0x16d9ff,
        wireframe: true,
        transparent: true,
        opacity: 0.055,
        blending: THREE.AdditiveBlending,
      });

    const shell =
      new THREE.Mesh(
        shellGeometry,
        shellMaterial,
      );

    coreGroup.add(shell);

    /* ================================================================
       ACCRETION DISK
       ================================================================ */

    const diskGroup =
      new THREE.Group();

    coreGroup.add(diskGroup);

    const diskMaterials: THREE.MeshBasicMaterial[] =
      [];

    for (let i = 0; i < 4; i++) {
      const radius = 2.35 + i * 0.42;

      const geometry =
        new THREE.TorusGeometry(
          radius,
          0.018 + i * 0.006,
          8,
          180,
        );

      const material =
        new THREE.MeshBasicMaterial({
          color:
            i % 2 === 0
              ? 0x00c8ff
              : 0x4f8cff,
          transparent: true,
          opacity:
            0.22 - i * 0.035,
          blending: THREE.AdditiveBlending,
        });

      const ring =
        new THREE.Mesh(
          geometry,
          material,
        );

      ring.rotation.x =
        Math.PI * 0.45;

      ring.rotation.z =
        i * 0.28;

      diskGroup.add(ring);
      diskMaterials.push(material);
    }

    /* ================================================================
       ENERGY PARTICLES AROUND CORE
       ================================================================ */

    const energyParticleCount =
      mobile ? 180 : 360;

    const energyPositions =
      new Float32Array(
        energyParticleCount * 3,
      );

    for (
      let i = 0;
      i < energyParticleCount;
      i++
    ) {
      const i3 = i * 3;

      const radius =
        2.1 + Math.random() * 2.4;

      const angle =
        Math.random() *
        Math.PI *
        2;

      energyPositions[i3] =
        Math.cos(angle) *
        radius;

      energyPositions[i3 + 1] =
        (Math.random() - 0.5) *
        0.45;

      energyPositions[i3 + 2] =
        Math.sin(angle) *
        radius;
    }

    const energyParticleGeometry =
      new THREE.BufferGeometry();

    energyParticleGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(
        energyPositions,
        3,
      ),
    );

    const energyParticleMaterial =
      new THREE.PointsMaterial({
        color: 0x8df5ff,
        size: mobile ? 0.035 : 0.05,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

    const energyParticles =
      new THREE.Points(
        energyParticleGeometry,
        energyParticleMaterial,
      );

    coreGroup.add(energyParticles);

    /* ================================================================
       GLOW SPRITE
       ================================================================ */

    const glowCanvas =
      document.createElement("canvas");

    glowCanvas.width = 256;
    glowCanvas.height = 256;

    const glowContext =
      glowCanvas.getContext("2d");

    if (glowContext) {
      const gradient =
        glowContext.createRadialGradient(
          128,
          128,
          0,
          128,
          128,
          128,
        );

      gradient.addColorStop(
        0,
        "rgba(0,220,255,0.32)",
      );

      gradient.addColorStop(
        0.22,
        "rgba(0,200,255,0.16)",
      );

      gradient.addColorStop(
        0.5,
        "rgba(79,140,255,0.06)",
      );

      gradient.addColorStop(
        1,
        "rgba(0,0,0,0)",
      );

      glowContext.fillStyle =
        gradient;

      glowContext.fillRect(
        0,
        0,
        256,
        256,
      );
    }

    const glowTexture =
      new THREE.CanvasTexture(
        glowCanvas,
      );

    const glowMaterial =
      new THREE.SpriteMaterial({
        map: glowTexture,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

    const glow =
      new THREE.Sprite(
        glowMaterial,
      );

    glow.scale.set(
      16,
      16,
      1,
    );

    glow.position.z = -3;

    world.add(glow);

    /* ================================================================
       MOUSE
       ================================================================ */

    const mouse = {
      x: 0,
      y: 0,
    };

    const targetMouse = {
      x: 0,
      y: 0,
    };

    const handlePointerMove = (
      event: PointerEvent,
    ) => {
      targetMouse.x =
        (event.clientX /
          window.innerWidth -
          0.5) *
        2;

      targetMouse.y =
        (event.clientY /
          window.innerHeight -
          0.5) *
        2;
    };

    window.addEventListener(
      "pointermove",
      handlePointerMove,
      { passive: true },
    );

    /* ================================================================
       STATE TRANSITIONS
       ================================================================ */

    const current = {
      speed:
        STATE_CONFIGS[
          stateRef.current
        ].speed,

      opacity:
        STATE_CONFIGS[
          stateRef.current
        ].opacity,

      coreScale:
        STATE_CONFIGS[
          stateRef.current
        ].coreScale,

      glow:
        STATE_CONFIGS[
          stateRef.current
        ].glow,

      turbulence:
        STATE_CONFIGS[
          stateRef.current
        ].turbulence,
    };

    let previousState =
      stateRef.current;

    const animateState = (
      nextState: AmbientState,
    ) => {
      const config =
        STATE_CONFIGS[nextState];

      animate(current, {
        speed: config.speed,
        opacity: config.opacity,
        coreScale: config.coreScale,
        glow: config.glow,
        turbulence: config.turbulence,
        duration: 1200,
        ease: "out(3)",
      });
    };

    /* ================================================================
       MODERN TIMER
       ================================================================ */

    const timer = new THREE.Timer();

    timer.connect(document);

    /* ================================================================
       ANIMATION
       ================================================================ */

    let animationFrame = 0;

    const render = () => {
      if (destroyed) return;

      animationFrame =
        requestAnimationFrame(render);

      timer.update();

      const elapsed =
        timer.getElapsed();

      const activeState =
        stateRef.current;

      if (
        activeState !==
        previousState
      ) {
        animateState(
          activeState,
        );

        previousState =
          activeState;
      }

      const config =
        STATE_CONFIGS[
          activeState
        ];

      /* Mouse */

      mouse.x +=
        (targetMouse.x -
          mouse.x) *
        0.025;

      mouse.y +=
        (targetMouse.y -
          mouse.y) *
        0.025;

      /* World movement */

      world.rotation.y =
        mouse.x * 0.045 +
        elapsed *
          config.orbit;

      world.rotation.x =
        -mouse.y * 0.028;

      /* Core breathing */

      const breathing =
        1 +
        Math.sin(
          elapsed *
            config.pulse,
        ) *
          0.035 *
          current.glow;

      coreGroup.scale.setScalar(
        current.coreScale *
          breathing,
      );

      /* Core rotation */

      shell.rotation.x +=
        0.0012 *
        current.speed;

      shell.rotation.y +=
        0.0018 *
        current.speed;

      energy.rotation.y -=
        0.0022 *
        current.speed;

      energy.rotation.z +=
        0.0008 *
        current.speed;

      horizon.rotation.y +=
        0.0002 *
        current.speed;

      /* Accretion disk */

      diskGroup.rotation.y +=
        0.0015 *
        current.speed;

      diskGroup.rotation.z =
        Math.sin(
          elapsed * 0.22,
        ) *
        0.08;

      /* Glow */

      glowMaterial.opacity =
        0.18 +
        current.glow *
          0.38;

      /* Energy particles */

      energyParticles.rotation.y +=
        0.0015 *
        current.speed;

      energyParticles.rotation.x =
        Math.sin(
          elapsed * 0.35,
        ) *
        0.08;

      /* ============================================================
         PARTICLES
         ============================================================ */

      const positionAttribute =
        particleGeometry.getAttribute(
          "position",
        ) as THREE.BufferAttribute;

      const array =
        positionAttribute.array as Float32Array;

      for (
        let i = 0;
        i < particleCount;
        i++
      ) {
        const i3 = i * 3;

        let x =
          array[i3] ?? 0;

        let y =
          array[i3 + 1] ?? 0;

        let z =
          array[i3 + 2] ?? 0;

        const baseX =
          basePositions[i3] ?? 0;

        const baseY =
          basePositions[i3 + 1] ?? 0;

        const baseZ =
          basePositions[i3 + 2] ?? 0;

        const distance =
          Math.sqrt(
            x * x +
              y * y +
              z * z,
          );

        /* Orbital rotation */

        const angle =
          config.orbit *
          4;

        const cos =
          Math.cos(angle);

        const sin =
          Math.sin(angle);

        const rotatedX =
          x * cos -
          z * sin;

        const rotatedZ =
          x * sin +
          z * cos;

        x = rotatedX;
        z = rotatedZ;

        /* Convergence */

        if (
          config.convergence >
          0
        ) {
          const force =
            config.convergence *
            0.00075;

          const normalizedX =
            x /
            Math.max(
              distance,
              1,
            );

          const normalizedY =
            y /
            Math.max(
              distance,
              1,
            );

          const normalizedZ =
            z /
            Math.max(
              distance,
              1,
            );

          x -=
            normalizedX *
            force *
            distance;

          y -=
            normalizedY *
            force *
            distance;

          z -=
            normalizedZ *
            force *
            distance;
        }

        /* Turbulence */

        const turbulence =
          current.turbulence;

        if (turbulence > 0) {
          x +=
            Math.sin(
              elapsed * 1.4 +
                seeds[i]!,
            ) *
            turbulence *
            0.018;

          y +=
            Math.cos(
              elapsed * 1.2 +
                seeds[i]!,
            ) *
            turbulence *
            0.018;

          z +=
            Math.sin(
              elapsed * 1.7 +
                seeds[i]! *
                  1.7,
            ) *
            turbulence *
            0.012;
        }

        /* Natural movement */

        x +=
          (baseX - x) *
          0.00012;

        y +=
          (baseY - y) *
          0.00012;

        z +=
          (baseZ - z) *
          0.00012;

        /* Drift */

        x +=
          (velocities[i3] ?? 0) *
          current.speed *
          10;

        y +=
          (velocities[i3 + 1] ?? 0) *
          current.speed *
          10;

        z +=
          (velocities[i3 + 2] ?? 0) *
          current.speed *
          10;

        /* Boundary */

        if (Math.abs(x) > 22)
          x = -x;

        if (Math.abs(y) > 22)
          y = -y;

        if (Math.abs(z) > 22)
          z = -z;

        array[i3] = x;
        array[i3 + 1] = y;
        array[i3 + 2] = z;
      }

      positionAttribute.needsUpdate =
        true;

      particleMaterial.opacity =
        current.opacity;

      particleMaterial.size =
        (mobile
          ? 0.055
          : 0.075) *
        (0.85 +
          current.glow * 0.45);

      energyParticleMaterial.opacity =
        0.3 +
        current.glow *
          0.35;

      shellMaterial.opacity =
        0.035 +
        current.glow *
          0.045;

      energyMaterial.opacity =
        0.04 +
        current.glow *
          0.045;

      /* ============================================================
         CAMERA
         ============================================================ */

      camera.position.x +=
        (mouse.x * 0.5 -
          camera.position.x) *
        0.012;

      camera.position.y +=
        (-mouse.y * 0.35 -
          camera.position.y) *
        0.012;

      camera.lookAt(
        0,
        0,
        0,
      );

      renderer.render(
        scene,
        camera,
      );
    };

    render();

    /* ================================================================
       RESIZE
       ================================================================ */

    const resize = () => {
      const width =
        container.clientWidth;

      const height =
        Math.max(
          container.clientHeight,
          1,
        );

      camera.aspect =
        width / height;

      camera.updateProjectionMatrix();

      renderer.setSize(
        width,
        height,
        false,
      );

      renderer.setPixelRatio(
        Math.min(
          window.devicePixelRatio ||
            1,
          1.5,
        ),
      );
    };

    window.addEventListener(
      "resize",
      resize,
    );

    /* ================================================================
       VISIBILITY
       ================================================================ */

    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(
          animationFrame,
        );
      } else {
        render();
      }
    };

    document.addEventListener(
      "visibilitychange",
      handleVisibility,
    );

    /* ================================================================
       CLEANUP
       ================================================================ */

    return () => {
      destroyed = true;

      cancelAnimationFrame(
        animationFrame,
      );

      window.removeEventListener(
        "resize",
        resize,
      );

      window.removeEventListener(
        "pointermove",
        handlePointerMove,
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibility,
      );

      timer.dispose();

      particleGeometry.dispose();
      particleMaterial.dispose();

      horizonGeometry.dispose();
      horizonMaterial.dispose();

      energyGeometry.dispose();
      energyMaterial.dispose();

      shellGeometry.dispose();
      shellMaterial.dispose();

      diskMaterials.forEach(
        (material) =>
          material.dispose(),
      );

      energyParticleGeometry.dispose();
      energyParticleMaterial.dispose();

      glowTexture.dispose();
      glowMaterial.dispose();

      renderer.dispose();

      if (
        renderer.domElement.parentNode ===
        container
      ) {
        container.removeChild(
          renderer.domElement,
        );
      }
    };
  }, [density]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{
        contain: "strict",
        background:
          "radial-gradient(circle at 50% 42%, rgba(0, 180, 255, 0.07), transparent 32%), linear-gradient(180deg, #07121c 0%, #040a11 45%, #02060b 100%)",
      }}
    >
      {/* Atmospheric light */}

      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 42%, rgba(0, 210, 255, 0.055), transparent 28%), radial-gradient(circle at 15% 20%, rgba(79, 140, 255, 0.035), transparent 30%), radial-gradient(circle at 85% 75%, rgba(22, 217, 255, 0.025), transparent 30%)",
        }}
      />

      {/* Cinematic vignette */}

      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 35%, rgba(0, 0, 0, 0.32) 100%)",
        }}
      />
    </div>
  );
}