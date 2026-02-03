(function() {
    const container = document.getElementById('metallic-accent');
    if (!container) return;

    // SCENE
    const scene = new THREE.Scene();

    // CAMERA
    const width = container.clientWidth;
    const height = container.clientHeight;
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 1000);

    // RENDERER
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // OBJECT (TorusKnot)
    const geometry = new THREE.TorusKnotGeometry(1.2, 0.4, 128, 32, 2, 3);
    geometry.computeBoundingSphere();

    // MATERIAL
    const material = new THREE.MeshStandardMaterial({
        color: 0x4884D4,
        metalness: 1.0,
        roughness: 0.15,
        envMapIntensity: 1.5,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.setScalar(0.7);
    scene.add(mesh);

    // LIGHTING
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);

    const rimLight = new THREE.SpotLight(0x00ffff, 5.0);
    rimLight.position.set(-5, 5, -5);
    scene.add(rimLight);

    const pointLight1 = new THREE.PointLight(0xffffff, 20, 100);
    pointLight1.position.set(0, 5, 5);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x4884D4, 20, 100);
    pointLight2.position.set(-5, -5, 5);
    scene.add(pointLight2);

    function fitCameraToMesh() {
        const newWidth = Math.max(container.clientWidth, 1);
        const newHeight = Math.max(container.clientHeight, 1);
        const aspect = newWidth / newHeight;

        camera.aspect = aspect;

        const boundingRadius = geometry.boundingSphere ? geometry.boundingSphere.radius * mesh.scale.x : 1;
        const padding = 1.4;
        const radius = boundingRadius * padding;
        const vFov = THREE.MathUtils.degToRad(camera.fov);
        const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);

        const distV = radius / Math.sin(vFov / 2);
        const distH = radius / Math.sin(hFov / 2);
        camera.position.z = Math.max(distV, distH);
        camera.updateProjectionMatrix();

        renderer.setSize(newWidth, newHeight);
    }

    fitCameraToMesh();

    // MOUSE TRACKING
    const mouse = { x: 0, y: 0, active: false };
    const smoothMouse = { x: 0, y: 0 };
    const lerpFactor = 0.05;
    const tiltStrength = 0.4;

    container.addEventListener('mousemove', function(e) {
        const rect = container.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
        mouse.active = true;
    });

    container.addEventListener('mouseleave', function() {
        mouse.active = false;
    });

    // ANIMATION LOOP
    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);

        const time = clock.getElapsedTime();

        // Smoothly interpolate toward target (or back to zero when inactive)
        const targetX = mouse.active ? mouse.y * tiltStrength : 0;
        const targetY = mouse.active ? mouse.x * tiltStrength : 0;
        smoothMouse.x += (targetX - smoothMouse.x) * lerpFactor;
        smoothMouse.y += (targetY - smoothMouse.y) * lerpFactor;

        // Blend auto-rotation with cursor tilt
        mesh.rotation.x = time * 0.3 + smoothMouse.x;
        mesh.rotation.y = time * 0.15 + smoothMouse.y;

        renderer.render(scene, camera);
    }
    animate();

    // RESIZE HANDLER
    window.addEventListener('resize', function() {
        fitCameraToMesh();
    });
})();
