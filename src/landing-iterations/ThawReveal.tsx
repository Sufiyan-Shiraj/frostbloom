import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/**
 * Iteration 2: "The Thaw" (Organic Metaball Reveal)
 * Restoration: High-Contrast Gooey Engine.
 */
interface ThawRevealProps {
  winterSrc: string;
  springSrc: string;
  thawRadius?: number;
  persistence?: number;
  refraction?: number;
}

const ThawReveal: React.FC<ThawRevealProps> = ({
  winterSrc,
  springSrc,
  thawRadius = 80,
  persistence = 0.99, // High persistence for deep trails
  refraction = 0.08,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [maskCanvas] = useState(() => document.createElement('canvas'));

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    renderer.setSize(width, height);

    // Metaball Logic: We use a low-res canvas for organic merging
    maskCanvas.width = 256; 
    maskCanvas.height = 256;
    const ctx = maskCanvas.getContext('2d', { alpha: false });
    if (ctx) {
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, 256, 256);
    }

    const maskTexture = new THREE.CanvasTexture(maskCanvas);
    maskTexture.minFilter = THREE.LinearFilter;
    maskTexture.magFilter = THREE.LinearFilter;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const textureLoader = new THREE.TextureLoader();
    
    const winterTex = textureLoader.load(winterSrc);
    const springTex = textureLoader.load(springSrc);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        tWinter: { value: winterTex },
        tSpring: { value: springTex },
        tMask: { value: maskTexture },
        uRefraction: { value: refraction },
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
      `,
      fragmentShader: `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D tWinter;
        uniform sampler2D tSpring;
        uniform sampler2D tMask;
        uniform float uRefraction;
        uniform float uTime;

        void main() {
          float maskValue = texture2D(tMask, vUv).r;
          
          // CRITICAL: High-contrast smoothstep creates the 'Gooey' metaball edge
          float mask = smoothstep(0.4, 0.6, maskValue);
          
          float dx = dFdx(mask);
          float dy = dFdy(mask);
          vec2 offset = vec2(dx, dy) * uRefraction * 0.5 * sin(uTime * 2.0 + vUv.y * 12.0);
          
          vec3 winter = texture2D(tWinter, vUv + offset * 0.3).rgb;
          vec3 spring = texture2D(tSpring, vUv - offset * 0.6).rgb;
          
          gl_FragColor = vec4(mix(winter, spring, mask), 1.0);
        }
      `
    });

    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(quad);

    const mouse = { x: 0, y: 0, active: false };
    const handleMouseMove = (e: MouseEvent) => {
      const rect = containerRef.current!.getBoundingClientRect();
      mouse.x = (e.clientX - rect.left) / rect.width * 256;
      mouse.y = (e.clientY - rect.top) / rect.height * 256;
      mouse.active = true;
    };
    window.addEventListener('mousemove', handleMouseMove);

    let frameId = 0;
    const render = () => {
      frameId = requestAnimationFrame(render);
      material.uniforms.uTime.value += 0.016;

      if (ctx) {
          // Trail Persistence Logic
          ctx.globalAlpha = 1.0 - persistence;
          ctx.fillStyle = 'black';
          ctx.fillRect(0, 0, 256, 256);
          
          if (mouse.active) {
            ctx.globalAlpha = 1.0;
            
            // 1. Get exact container dimensions
            const w = containerRef.current?.clientWidth || 256;
            const h = containerRef.current?.clientHeight || 256;
            
            // 2. Aspect correction math:
            // The canvas (256x256) is stretched to fill W/H by the shader.
            // To get a final 1.6:1 egg on screen, we draw with (1.6 * H / W) scale.
            const targetAspect = 1.6;
            const ellipseScaleX = targetAspect * (h / w);
            
            // Map the pixel thawRadius to the 256-unit canvas coordinate system
            // We treat thawRadius as the vertical radius (syncing with CSS mask)
            const verticalRadiusCanvas = (thawRadius / h) * 256 * 0.5;
            
            ctx.save();
            ctx.translate(mouse.x, mouse.y);
            ctx.scale(ellipseScaleX, 1.0); 
            
            const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, verticalRadiusCanvas);
            grad.addColorStop(0, '#fff');
            grad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = grad;
            
            ctx.beginPath();
            ctx.arc(0, 0, verticalRadiusCanvas, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
          maskTexture.needsUpdate = true;
      }
      renderer.render(scene, camera);
    };
    render();

    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      winterTex.dispose();
      springTex.dispose();
      maskTexture.dispose();
    };
  }, [winterSrc, springSrc, thawRadius, persistence, refraction, maskCanvas]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100vh', position: 'relative', background: '#000' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
};

export default ThawReveal;
