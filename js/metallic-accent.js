(function() {
    const container = document.getElementById('metallic-accent');
    if (!container) return;

    const scene = new THREE.Scene();

    const width = container.clientWidth;
    const height = container.clientHeight;
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 1000);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 2.5;
    container.appendChild(renderer.domElement);

    // Metallic blue torus knot
    const geometry = new THREE.TorusKnotGeometry(1.2, 0.4, 200, 48, 2, 3);
    geometry.computeBoundingSphere();

    const material = new THREE.MeshStandardMaterial({
        color: 0x5599dd,
        metalness: 1.0,
        roughness: 0.06,
        envMapIntensity: 3.5,
        emissive: 0x0a1a30,
        emissiveIntensity: 0.3,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.setScalar(0.7);
    scene.add(mesh);

    // Studio light panels - bright emissive geometry for the metal to reflect
    const panelMat1 = new THREE.MeshBasicMaterial({ color: 0xc0e0ff, side: THREE.DoubleSide });
    const panelMat2 = new THREE.MeshBasicMaterial({ color: 0x4090d0, side: THREE.DoubleSide });
    const panelMat3 = new THREE.MeshBasicMaterial({ color: 0x80b8e8, side: THREE.DoubleSide });
    const panelMat4 = new THREE.MeshBasicMaterial({ color: 0x2060a0, side: THREE.DoubleSide });

    // Top panel - large bright key
    const topPanel = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), panelMat1);
    topPanel.position.set(0, 6, 0);
    topPanel.rotation.x = Math.PI / 2;
    scene.add(topPanel);

    // Right panel
    const rightPanel = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), panelMat3);
    rightPanel.position.set(6, 0, 0);
    rightPanel.rotation.y = -Math.PI / 2;
    scene.add(rightPanel);

    // Left panel - deeper blue
    const leftPanel = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), panelMat2);
    leftPanel.position.set(-6, 0, 0);
    leftPanel.rotation.y = Math.PI / 2;
    scene.add(leftPanel);

    // Back panel - subtle
    const backPanel = new THREE.Mesh(new THREE.PlaneGeometry(8, 6), panelMat4);
    backPanel.position.set(0, 0, -5);
    scene.add(backPanel);

    // Front-bottom - slight fill
    const bottomPanel = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), panelMat2);
    bottomPanel.position.set(0, -5, 2);
    bottomPanel.rotation.x = -Math.PI / 3;
    scene.add(bottomPanel);

    // Lighting - direct lights still needed for specular highlights
    const ambientLight = new THREE.AmbientLight(0x204060, 1.5);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xe0f0ff, 6.0);
    keyLight.position.set(5, 5, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x4080c0, 4.0);
    fillLight.position.set(-4, 2, 2);
    scene.add(fillLight);

    const rimLight = new THREE.SpotLight(0x60b0e0, 14.0, 20, Math.PI / 4);
    rimLight.position.set(-5, 5, -5);
    rimLight.target = mesh;
    scene.add(rimLight);

    const pointLight1 = new THREE.PointLight(0xb0d8ff, 50, 100);
    pointLight1.position.set(0, 5, 5);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x4090d0, 40, 100);
    pointLight2.position.set(-5, -5, 5);
    scene.add(pointLight2);

    const bottomLight = new THREE.PointLight(0x4080c0, 18, 15);
    bottomLight.position.set(0, -3, 3);
    scene.add(bottomLight);

    // Environment map for real reflections - captures studio panels
    const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256, {
        generateMipmaps: true,
        minFilter: THREE.LinearMipmapLinearFilter,
    });
    const cubeCamera = new THREE.CubeCamera(0.1, 100, cubeRenderTarget);
    scene.add(cubeCamera);
    scene.environment = cubeRenderTarget.texture;

    // Camera framing
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

    // Hide panels from camera but keep them for env map reflections
    topPanel.layers.set(1);
    rightPanel.layers.set(1);
    leftPanel.layers.set(1);
    backPanel.layers.set(1);
    bottomPanel.layers.set(1);
    cubeCamera.layers.enableAll();

    // Mouse tracking
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

    const clock = new THREE.Clock();
    let frameCount = 0;

    function animate() {
        requestAnimationFrame(animate);
        const time = clock.getElapsedTime();
        frameCount++;

        // Update env map periodically for reflections
        if (frameCount % 30 === 1) {
            mesh.visible = false;
            cubeCamera.position.copy(mesh.position);
            cubeCamera.update(renderer, scene);
            mesh.visible = true;
        }

        const targetX = mouse.active ? mouse.y * tiltStrength : 0;
        const targetY = mouse.active ? mouse.x * tiltStrength : 0;
        smoothMouse.x += (targetX - smoothMouse.x) * lerpFactor;
        smoothMouse.y += (targetY - smoothMouse.y) * lerpFactor;

        mesh.rotation.x = time * 0.3 + smoothMouse.x;
        mesh.rotation.y = time * 0.15 + smoothMouse.y;

        // Animate accent lights for breathing effect
        bottomLight.intensity = 18 + Math.sin(time * 0.7) * 5;
        pointLight2.intensity = 40 + Math.cos(time * 0.5) * 10;

        renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', function() {
        fitCameraToMesh();
    });
})();
