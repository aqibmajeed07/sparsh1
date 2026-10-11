'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function Login3DScene() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 30;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // ── Particle Field (Stars & Neural Nodes) ──
    const particleCount = 750;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const palette = [
      new THREE.Color('#6C63FF'), // Sparsh Purple
      new THREE.Color('#00C9A7'), // Teal
      new THREE.Color('#38bdf8'), // Sky Blue
      new THREE.Color('#a855f7'), // Neon Violet
    ];

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 80;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 60;

      const color = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.65,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(geometry, particleMaterial);
    scene.add(particles);

    // ── 3D Geometric Floating Holograms ──
    // 1. Floating Torus Knot
    const torusKnotGeo = new THREE.TorusKnotGeometry(4.5, 1.2, 80, 16);
    const torusKnotMat = new THREE.MeshBasicMaterial({
      color: 0x6c63ff,
      wireframe: true,
      transparent: true,
      opacity: 0.22,
    });
    const torusKnot = new THREE.Mesh(torusKnotGeo, torusKnotMat);
    torusKnot.position.set(22, 10, -8);
    scene.add(torusKnot);

    // 2. Floating Icosahedron
    const icoGeo = new THREE.IcosahedronGeometry(4, 1);
    const icoMat = new THREE.MeshBasicMaterial({
      color: 0x00c9a7,
      wireframe: true,
      transparent: true,
      opacity: 0.28,
    });
    const icosahedron = new THREE.Mesh(icoGeo, icoMat);
    icosahedron.position.set(-20, -10, -5);
    scene.add(icosahedron);

    // 3. Floating Ring
    const ringGeo = new THREE.RingGeometry(3, 3.6, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.25,
      wireframe: true,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(16, -12, -2);
    scene.add(ring);

    // ── Mouse Interactivity ──
    let targetMouseX = 0;
    let targetMouseY = 0;
    let currentMouseX = 0;
    let currentMouseY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window;
      targetMouseX = (e.clientX / innerWidth - 0.5) * 2;
      targetMouseY = (e.clientY / innerHeight - 0.5) * 2;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // ── Resize Listener ──
    const handleResize = () => {
      if (!container) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    // ── Animation Loop ──
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Smooth mouse lerp
      currentMouseX += (targetMouseX - currentMouseX) * 0.04;
      currentMouseY += (targetMouseY - currentMouseY) * 0.04;

      // Particle rotation
      particles.rotation.y = elapsed * 0.03 + currentMouseX * 0.25;
      particles.rotation.x = elapsed * 0.015 - currentMouseY * 0.25;

      // Torus knot rotation
      torusKnot.rotation.x = elapsed * 0.25;
      torusKnot.rotation.y = elapsed * 0.35;
      torusKnot.position.y = 10 + Math.sin(elapsed * 0.8) * 1.5;

      // Icosahedron rotation & float
      icosahedron.rotation.x = -elapsed * 0.2;
      icosahedron.rotation.z = elapsed * 0.3;
      icosahedron.position.y = -10 + Math.cos(elapsed * 0.7) * 1.8;

      // Ring rotation
      ring.rotation.x = elapsed * 0.4;
      ring.rotation.y = elapsed * 0.2;

      // Camera slight parallax
      camera.position.x = currentMouseX * 4;
      camera.position.y = -currentMouseY * 3;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };

    animate();

    // ── Cleanup ──
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);

      geometry.dispose();
      particleMaterial.dispose();
      torusKnotGeo.dispose();
      torusKnotMat.dispose();
      icoGeo.dispose();
      icoMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();

      renderer.dispose();
      if (container && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none z-0 overflow-hidden"
      aria-hidden="true"
    />
  );
}
