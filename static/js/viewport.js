/**
 * NeuroSoma - 3D Anatomical Viewport
 *
 * Builds and manages the Three.js scene: anatomical meshes from backend data,
 * OrbitControls navigation, lighting, and bilateral mirroring.
 *
 * Depends on: THREE (global, from CDN), THREE.OrbitControls
 * Exposes:    window.NeuroViewport
 */
(function () {
    'use strict';

    /* ================================================================
       Constants
       ================================================================ */
    var COLORS = {
        nerve:         0xfacc15,
        nerveEmissive: 0x854d0e,
        nerveGlow:     0x713f12,
        muscle:        0xfb7185,
        muscleEmissive:0x7a1030,
        bone:          0x64748b,
        boneEmissive:  0x2d3a4a,
        canvasBg:      0x0a0f18,
        gridMain:      0x1a2744,
        gridSub:       0x111c30
    };

    /* ================================================================
       Module State
       ================================================================ */
    var scene, camera, renderer, controls;
    var nervousGroup, musculoskeletalGroup;
    var allStructureMeshes = [];   // top-level groups/meshes per structure
    var anatomyData = null;
    var container   = null;

    /* ================================================================
       init — called once from app.js
       ================================================================ */
    function init(containerEl) {
        container = containerEl;

        // ---- Scene ----
        scene = new THREE.Scene();
        scene.background = new THREE.Color(COLORS.canvasBg);
        scene.fog = new THREE.FogExp2(COLORS.canvasBg, 0.045);

        // ---- Camera ----
        var aspect = container.clientWidth / container.clientHeight;
        camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 100);
        camera.position.set(3.5, 2.8, 5.5);

        // ---- Renderer ----
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputEncoding = THREE.sRGBEncoding;
        container.appendChild(renderer.domElement);

        // ---- OrbitControls ----
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.target.set(0, 1.8, 0);
        controls.minDistance = 1.5;
        controls.maxDistance = 15;
        controls.maxPolarAngle = Math.PI * 0.92;
        controls.update();

        // ---- Lighting ----
        addLights();

        // ---- Subtle grid plane ----
        var grid = new THREE.GridHelper(14, 28, COLORS.gridMain, COLORS.gridSub);
        grid.position.y = -0.8;
        grid.material.opacity = 0.25;
        grid.material.transparent = true;
        scene.add(grid);

        // ---- Layer groups ----
        nervousGroup        = new THREE.Group();
        nervousGroup.name   = 'nervous';
        musculoskeletalGroup      = new THREE.Group();
        musculoskeletalGroup.name = 'musculoskeletal';
        scene.add(nervousGroup);
        scene.add(musculoskeletalGroup);

        // ---- Load anatomy data ----
        fetchAnatomyData();

        // ---- Resize handler ----
        window.addEventListener('resize', onResize);

        // ---- Render loop ----
        animate();
    }

    /* ================================================================
       Lighting — clinical dramatic setup
       ================================================================ */
    function addLights() {
        // Soft ambient base
        scene.add(new THREE.AmbientLight(0x334466, 0.5));

        // Key light (upper front-right)
        var key = new THREE.DirectionalLight(0xffffff, 0.75);
        key.position.set(5, 8, 6);
        scene.add(key);

        // Fill light (lower back-left)
        var fill = new THREE.DirectionalLight(0x8899bb, 0.3);
        fill.position.set(-4, -1, -5);
        scene.add(fill);

        // Rim / accent (cool cyan from behind)
        var rim = new THREE.DirectionalLight(0x38bdf8, 0.12);
        rim.position.set(-2, 4, -4);
        scene.add(rim);

        // Subtle warm point near the model center
        var warm = new THREE.PointLight(0xffa366, 0.15, 8);
        warm.position.set(0, 2.5, 2);
        scene.add(warm);
    }

    /* ================================================================
       Fetch & Build
       ================================================================ */
    function fetchAnatomyData() {
        fetch('/api/anatomy')
            .then(function (res) { return res.json(); })
            .then(function (data) {
                anatomyData = data.structures;
                buildScene(anatomyData);
            })
            .catch(function (err) {
                console.error('[NeuroViewport] Failed to load anatomy data:', err);
            });
    }

    function buildScene(structures) {
        structures.forEach(function (s) {
            var mesh;

            if (s.system === 'nervous') {
                mesh = buildNerve(s);
                nervousGroup.add(mesh);
                var mirror = createMirror(mesh);
                if (mirror) nervousGroup.add(mirror);
            } else if (s.category === 'Muscle') {
                mesh = buildMuscle(s);
                musculoskeletalGroup.add(mesh);
                var mirror = createMirror(mesh);
                if (mirror) musculoskeletalGroup.add(mirror);
            } else {
                // Bone / Vertebra
                mesh = buildBone(s);
                musculoskeletalGroup.add(mesh);
                // Midline bones — no mirror
            }

            allStructureMeshes.push(mesh);
        });
    }

    /* ================================================================
       Nerve Builder — luminous dual-tube with glow
       ================================================================ */
    function buildNerve(s) {
        var pts = s.coordinates.points.map(function (p) {
            return new THREE.Vector3(p[0], p[1], p[2]);
        });
        var curve = new THREE.CatmullRomCurve3(pts);

        var group = new THREE.Group();
        group.userData = { structureId: s.id, structure: s, type: 'nerve' };

        // Inner solid core
        var innerGeom = new THREE.TubeGeometry(curve, 64, 0.032, 8, false);
        var innerMat  = new THREE.MeshPhongMaterial({
            color:     COLORS.nerve,
            emissive:  COLORS.nerveEmissive,
            shininess: 90,
            transparent: true,
            opacity: 1.0
        });
        var inner = new THREE.Mesh(innerGeom, innerMat);
        inner.userData = { structureId: s.id, structure: s, type: 'nerve' };
        group.add(inner);

        // Outer glow halo
        var outerGeom = new THREE.TubeGeometry(curve, 64, 0.065, 8, false);
        var outerMat  = new THREE.MeshPhongMaterial({
            color:     COLORS.nerve,
            emissive:  COLORS.nerveGlow,
            transparent: true,
            opacity: 0.1,
            shininess: 0,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        var outer = new THREE.Mesh(outerGeom, outerMat);
        group.add(outer);

        return group;
    }

    /* ================================================================
       Muscle Builder — organic tube
       ================================================================ */
    function buildMuscle(s) {
        var pts = s.coordinates.points.map(function (p) {
            return new THREE.Vector3(p[0], p[1], p[2]);
        });
        var curve = new THREE.CatmullRomCurve3(pts);

        var radius = 0.08;
        if (s.id === 'sternocleidomastoid') radius = 0.095;
        if (s.id === 'trapezius_superior')  radius = 0.11;

        var geom = new THREE.TubeGeometry(curve, 48, radius, 10, false);
        var mat  = new THREE.MeshPhongMaterial({
            color:     COLORS.muscle,
            emissive:  COLORS.muscleEmissive,
            shininess: 25,
            transparent: true,
            opacity: 1.0
        });

        var mesh = new THREE.Mesh(geom, mat);
        mesh.userData = { structureId: s.id, structure: s, type: 'muscle' };
        return mesh;
    }

    /* ================================================================
       Bone Builder — geometric shapes per category
       ================================================================ */
    function buildBone(s) {
        var mat = new THREE.MeshPhongMaterial({
            color:     COLORS.bone,
            emissive:  COLORS.boneEmissive,
            shininess: 12,
            transparent: true,
            opacity: 1.0
        });

        var group = new THREE.Group();
        group.userData = { structureId: s.id, structure: s, type: 'bone' };

        if (s.id === 'occipital_base') {
            buildOccipitalBase(group, mat, s);
        } else if (s.id === 'c1_atlas') {
            buildAtlas(group, mat, s);
        } else if (s.id === 'c2_axis') {
            buildAxis(group, mat, s);
        } else if (s.id === 'c3_c7_vertebrae') {
            buildLowerCervical(group, mat, s);
        }

        return group;
    }

    /* -- Occipital Base: flattened dome -------------------------------- */
    function buildOccipitalBase(group, mat, s) {
        var geom = new THREE.SphereGeometry(0.65, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.35);
        var mesh = new THREE.Mesh(geom, mat);
        mesh.scale.set(1.4, 0.45, 1.0);
        mesh.rotation.x = -Math.PI / 5.5;
        mesh.userData = { structureId: s.id, structure: s, type: 'bone' };
        var ct = s.coordinates.camera_target;
        mesh.position.set(ct[0], ct[1], ct[2]);
        group.add(mesh);

        // Foramen magnum — dark ring hint
        var ring = new THREE.TorusGeometry(0.18, 0.025, 8, 20);
        var ringMat = new THREE.MeshPhongMaterial({
            color: 0x1e293b, emissive: 0x0f172a, shininess: 5,
            transparent: true, opacity: 0.9
        });
        var ringMesh = new THREE.Mesh(ring, ringMat);
        ringMesh.position.set(ct[0], ct[1] - 0.1, ct[2] + 0.15);
        ringMesh.rotation.x = Math.PI / 2.5;
        group.add(ringMesh);
    }

    /* -- C1 Atlas: torus (ring) --------------------------------------- */
    function buildAtlas(group, mat, s) {
        var geom = new THREE.TorusGeometry(0.34, 0.055, 8, 28);
        var mesh = new THREE.Mesh(geom, mat);
        mesh.rotation.x = Math.PI / 2;
        mesh.userData = { structureId: s.id, structure: s, type: 'bone' };
        var ct = s.coordinates.camera_target;
        mesh.position.set(ct[0], ct[1], ct[2]);
        group.add(mesh);
    }

    /* -- C2 Axis: body + dens + spinous process ----------------------- */
    function buildAxis(group, mat, s) {
        var ct = s.coordinates.camera_target;
        var sub = new THREE.Group();

        // Vertebral body
        var body = new THREE.CylinderGeometry(0.26, 0.26, 0.2, 12);
        var bodyM = new THREE.Mesh(body, mat);
        bodyM.userData = { structureId: s.id, structure: s, type: 'bone' };
        sub.add(bodyM);

        // Dens (odontoid process)
        var dens = new THREE.CylinderGeometry(0.05, 0.075, 0.28, 8);
        sub.add(new THREE.Mesh(dens, mat));
        sub.children[1].position.y = 0.22;

        // Spinous process
        var spine = new THREE.BoxGeometry(0.04, 0.1, 0.2);
        var spineM = new THREE.Mesh(spine, mat);
        spineM.position.set(0, 0, -0.22);
        sub.add(spineM);

        // Transverse processes
        addTransverseProcesses(sub, mat, 0.9);

        sub.position.set(ct[0], ct[1], ct[2]);
        group.add(sub);
    }

    /* -- C3-C7: five stacked vertebrae -------------------------------- */
    function buildLowerCervical(group, mat, s) {
        var positions = s.coordinates.points;
        positions.forEach(function (pos, i) {
            var scale = 0.88 + i * 0.04;  // Slightly larger toward C7
            var v = buildSingleVertebra(pos, scale, mat, s);
            group.add(v);
        });
    }

    function buildSingleVertebra(position, scale, mat, s) {
        var sub = new THREE.Group();

        // Vertebral body
        var body = new THREE.CylinderGeometry(0.22 * scale, 0.25 * scale, 0.16 * scale, 12);
        var bodyM = new THREE.Mesh(body, mat);
        bodyM.userData = { structureId: s.id, structure: s, type: 'bone' };
        sub.add(bodyM);

        // Spinous process
        var spine = new THREE.BoxGeometry(0.035 * scale, 0.09 * scale, 0.2 * scale);
        var spineM = new THREE.Mesh(spine, mat);
        spineM.position.set(0, 0.02, -0.22 * scale);
        sub.add(spineM);

        // Transverse processes
        addTransverseProcesses(sub, mat, scale);

        // Laminae (connecting body to spinous process)
        var lamina = new THREE.BoxGeometry(0.12 * scale, 0.05 * scale, 0.12 * scale);
        [-1, 1].forEach(function (side) {
            var lm = new THREE.Mesh(lamina, mat);
            lm.position.set(side * 0.12 * scale, 0.02, -0.13 * scale);
            sub.add(lm);
        });

        sub.position.set(position[0], position[1], position[2]);
        return sub;
    }

    function addTransverseProcesses(group, mat, scale) {
        var tp = new THREE.BoxGeometry(0.18 * scale, 0.055 * scale, 0.055 * scale);
        [-1, 1].forEach(function (side) {
            var m = new THREE.Mesh(tp, mat);
            m.position.set(side * 0.3 * scale, 0, -0.06 * scale);
            group.add(m);
        });
    }

    /* ================================================================
       Mirror — bilateral rendering for nerves & muscles
       ================================================================ */
    function createMirror(object) {
        var mirror = object.clone(true);
        mirror.scale.x = -1;
        // Fix inverted normals on mirrored geometry
        mirror.traverse(function (child) {
            if (child.isMesh && child.material) {
                child.material = child.material.clone();
                child.material.side = THREE.DoubleSide;
            }
        });
        mirror.userData = {
            structureId: object.userData.structureId,
            structure:   object.userData.structure,
            type:        object.userData.type,
            isMirror:    true
        };
        return mirror;
    }

    /* ================================================================
       Animation Loop
       ================================================================ */
    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }

    /* ================================================================
       Resize Handler
       ================================================================ */
    function onResize() {
        if (!container || !camera || !renderer) return;
        var w = container.clientWidth;
        var h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    }

    /* ================================================================
       Public API
       ================================================================ */
    window.NeuroViewport = {
        init: init,

        getScene:     function () { return scene; },
        getCamera:    function () { return camera; },
        getRenderer:  function () { return renderer; },
        getControls:  function () { return controls; },

        /** All primary structure meshes (excludes mirrors) */
        getAllMeshes:  function () { return allStructureMeshes; },

        /** Raw anatomy data array */
        getAnatomyData: function () { return anatomyData; },

        /** Toggle layer visibility */
        setLayerVisible: function (system, visible) {
            if (system === 'nervous' && nervousGroup) {
                nervousGroup.visible = visible;
            } else if (system === 'musculoskeletal' && musculoskeletalGroup) {
                musculoskeletalGroup.visible = visible;
            }
        },

        /** Manual resize trigger (e.g., after panel collapse) */
        onResize: onResize
    };
})();
