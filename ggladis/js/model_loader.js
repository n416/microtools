class ModelLoader {
    constructor(canvas) {
        this.canvas = canvas;
        this.scene = new THREE.Scene();

        // カメラ設定 (初期値)
        this.camera = new THREE.OrthographicCamera(-4, 4, 3, -3, 0.1, 1000);
        this.camera.position.set(0, 1.5, 10);
        this.camera.lookAt(0, 1.5, 0);

        // レンダラー設定
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true,
        });
        this.renderer.setSize(this.canvas.width, this.canvas.height);
        this.renderer.setPixelRatio(window.devicePixelRatio);

        // ライト設定
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
        this.scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
        directionalLight.position.set(5, 10, 7.5);
        this.scene.add(directionalLight);
    }
    
    updateCameraProjection(worldWidth, worldHeight) {
        this.camera.left = -worldWidth / 2;
        this.camera.right = worldWidth / 2;
        this.camera.top = worldHeight / 2;
        this.camera.bottom = -worldHeight / 2;
        this.camera.updateProjectionMatrix();
    }

    async loadFighter(fighterJsonPath) {
        try {
            // fighter.jsonを読み込み
            const fighterResponse = await fetch(fighterJsonPath);
            const fighterData = await fighterResponse.json();
            const modelFile = fighterData.modelFile;

            // test_mec.jsonを読み込み
            const modelResponse = await fetch(`data/${modelFile}`);
            const sceneData = await modelResponse.json();
            
            const mechaGroup = new THREE.Group();
            const loader = new THREE.BufferGeometryLoader();

            sceneData.objects.forEach((data) => {
                let geometry;
                const params = data.geometryParameters;
                switch (data.geometryType) {
                    case 'Box':
                        geometry = new THREE.BoxGeometry(params?.width, params?.height, params?.depth);
                        break;
                    case 'Sphere':
                        geometry = new THREE.SphereGeometry(params?.radius, params?.widthSegments, params?.heightSegments);
                        break;
                    case 'Cylinder':
                        geometry = new THREE.CylinderGeometry(params?.radiusTop, params?.radiusBottom, params?.height, params?.radialSegments);
                        break;
                    case 'Custom':
                        if (params) geometry = loader.parse(params);
                        break;
                    default: return;
                }

                if (geometry) {
                    const material = new THREE.MeshStandardMaterial({
                        color: data.material.color,
                        metalness: data.material.metalness,
                        emissive: data.material.emissive,
                        side: THREE.DoubleSide
                    });
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.position.fromArray(data.position);
                    mesh.rotation.fromArray(data.rotation);
                    mesh.scale.fromArray(data.scale);
                    mechaGroup.add(mesh);
                }
            });

            this.scene.add(mechaGroup);
            return mechaGroup;

        } catch (e) {
            console.error("Failed to load 3D model:", e);
            return null;
        }
    }
}