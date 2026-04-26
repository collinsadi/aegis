import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useRef } from "react";
import * as THREE from "three";
export default function ParticleCanvas() {
    const canvasRef = useRef(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas)
            return;
        const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.z = 5;
        const count = 800;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 20;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
            const t = Math.random();
            if (t < 0.5) {
                colors[i * 3] = 0.61;
                colors[i * 3 + 1] = 0.36;
                colors[i * 3 + 2] = 0.9;
            }
            else {
                colors[i * 3] = 0.3;
                colors[i * 3 + 1] = 0.79;
                colors[i * 3 + 2] = 0.94;
            }
        }
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        const material = new THREE.PointsMaterial({
            size: 0.035, vertexColors: true, transparent: true, opacity: 0.55, sizeAttenuation: true,
        });
        const particles = new THREE.Points(geometry, material);
        scene.add(particles);
        let mouseX = 0, mouseY = 0;
        const onMouseMove = (e) => {
            mouseX = (e.clientX / window.innerWidth - 0.5) * 0.5;
            mouseY = (e.clientY / window.innerHeight - 0.5) * 0.5;
        };
        const onResize = () => {
            renderer.setSize(window.innerWidth, window.innerHeight);
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
        };
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("resize", onResize);
        let rafId;
        function animate() {
            rafId = requestAnimationFrame(animate);
            particles.rotation.y += 0.0008;
            particles.rotation.x += 0.0003;
            camera.position.x += (mouseX - camera.position.x) * 0.03;
            camera.position.y += (-mouseY - camera.position.y) * 0.03;
            renderer.render(scene, camera);
        }
        animate();
        return () => {
            cancelAnimationFrame(rafId);
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("resize", onResize);
            geometry.dispose();
            material.dispose();
            renderer.dispose();
        };
    }, []);
    return _jsx("canvas", { id: "bg-canvas", ref: canvasRef });
}
