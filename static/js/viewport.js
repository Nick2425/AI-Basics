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
    function init(containerEl, viewCubeContainerEl) {
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

        // ---- Raycaster click-to-inspect ----
        setupViewportRaycaster(container);

        // ---- ViewCube (Autodesk Inventor style) ----
        initViewCube(viewCubeContainerEl);

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
       Selection & Transparency Dimming
       ================================================================ */
    var selectedStructureId = null;
    var selectedAnchor3D = null;
    var selectCallbacks   = [];
    var deselectCallbacks = [];

    function setupViewportRaycaster(containerEl) {
        var raycaster = new THREE.Raycaster();
        var mouse = new THREE.Vector2();
        var isDown = false;
        var startX = 0, startY = 0;

        containerEl.addEventListener('pointerdown', function (e) {
            if (e.target !== renderer.domElement) return;
            isDown = true;
            startX = e.clientX;
            startY = e.clientY;
        });

        containerEl.addEventListener('pointerup', function (e) {
            if (!isDown || e.target !== renderer.domElement) return;
            isDown = false;

            var dx = Math.abs(e.clientX - startX);
            var dy = Math.abs(e.clientY - startY);
            if (dx > 5 || dy > 5) return; // user was orbiting/dragging

            var rect = renderer.domElement.getBoundingClientRect();
            mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            raycaster.setFromCamera(mouse, camera);

            var interactable = [];
            if (nervousGroup && nervousGroup.visible) interactable.push(nervousGroup);
            if (musculoskeletalGroup && musculoskeletalGroup.visible) interactable.push(musculoskeletalGroup);

            var intersects = raycaster.intersectObjects(interactable, true);
            if (intersects.length > 0) {
                var structure = null;
                var curr = intersects[0].object;
                while (curr && curr !== scene) {
                    if (curr.userData && curr.userData.structure) {
                        structure = curr.userData.structure;
                        break;
                    }
                    curr = curr.parent;
                }

                if (structure) {
                    selectStructure(structure.id, intersects[0].point);
                    return;
                }
            }

            deselectStructure();
        });
    }

    function selectStructure(structureId, hitPoint) {
        selectedStructureId = structureId;
        var structure = getStructureById(structureId);
        if (!structure) return;

        // Dim all non-selected structures to 25% opacity
        [nervousGroup, musculoskeletalGroup].forEach(function (grp) {
            if (!grp) return;
            grp.children.forEach(function (child) {
                var isTarget = (child.userData && child.userData.structureId === structureId);
                child.traverse(function (mesh) {
                    if (mesh.isMesh && mesh.material) {
                        mesh.material.transparent = true;
                        if (isTarget) {
                            if (mesh.material.emissive && mesh.material.emissive.getHex() === COLORS.nerveGlow) {
                                mesh.material.opacity = 0.2;
                            } else {
                                mesh.material.opacity = 1.0;
                            }
                            mesh.material.depthWrite = true;
                        } else {
                            mesh.material.opacity = 0.25;
                            mesh.material.depthWrite = false;
                        }
                    }
                });
            });
        });

        // Determine 3D anchor position for sticky note
        var anchor3D = hitPoint;
        if (!anchor3D && structure.coordinates && structure.coordinates.camera_target) {
            var ct = structure.coordinates.camera_target;
            anchor3D = new THREE.Vector3(ct[0], ct[1], ct[2]);
        }
        selectedAnchor3D = anchor3D;
        var screenPos = getScreenCoordinates(anchor3D);

        selectCallbacks.forEach(function (cb) {
            try { cb(structure, screenPos, anchor3D); } catch (err) { console.error(err); }
        });
    }

    function deselectStructure() {
        if (!selectedStructureId) return;
        selectedStructureId = null;
        selectedAnchor3D = null;

        [nervousGroup, musculoskeletalGroup].forEach(function (grp) {
            if (!grp) return;
            grp.traverse(function (child) {
                if (child.isMesh && child.material) {
                    if (child.material.emissive && child.material.emissive.getHex() === COLORS.nerveGlow) {
                        child.material.opacity = 0.1;
                        child.material.depthWrite = false;
                    } else {
                        child.material.opacity = 1.0;
                        child.material.depthWrite = true;
                    }
                    child.material.transparent = true;
                }
            });
        });

        deselectCallbacks.forEach(function (cb) {
            try { cb(); } catch (err) { console.error(err); }
        });
    }

    function getStructureById(id) {
        if (!anatomyData) return null;
        for (var i = 0; i < anatomyData.length; i++) {
            if (anatomyData[i].id === id) return anatomyData[i];
        }
        return null;
    }

    function getScreenCoordinates(vec3) {
        if (!vec3 || !container || !camera) return { x: 200, y: 150 };
        var v = (vec3 instanceof THREE.Vector3) ? vec3.clone() : new THREE.Vector3(vec3[0], vec3[1], vec3[2]);
        v.project(camera);
        var rect = container.getBoundingClientRect();
        return {
            x: ((v.x + 1) * rect.width) / 2,
            y: ((-v.y + 1) * rect.height) / 2
        };
    }

    /* ================================================================
       Autodesk Inventor-Style ViewCube & Synchronization
       ================================================================ */
    var viewCubeScene, viewCubeCamera, viewCubeRenderer, viewCubeMesh;
    var viewCubeContainer = null;
    var isCameraTweening = false;

    function initViewCube(vcContainer) {
        viewCubeContainer = vcContainer || document.getElementById('viewcube-container');
        if (!viewCubeContainer) return;

        var size = 110;
        viewCubeScene = new THREE.Scene();

        viewCubeCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 50);
        viewCubeCamera.position.set(0, 0, 3.0);

        viewCubeRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        viewCubeRenderer.setSize(size, size);
        viewCubeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        viewCubeRenderer.outputEncoding = THREE.sRGBEncoding;
        viewCubeContainer.appendChild(viewCubeRenderer.domElement);

        viewCubeScene.add(new THREE.AmbientLight(0xffffff, 0.9));
        var dirLight = new THREE.DirectionalLight(0xffffff, 0.55);
        dirLight.position.set(3, 4, 5);
        viewCubeScene.add(dirLight);

        // Three.js BoxGeometry face order:
        // [0: +X (RIGHT), 1: -X (LEFT), 2: +Y (TOP), 3: -Y (BOTTOM), 4: +Z (FRONT), 5: -Z (BACK)]
        var faceConfigs = [
            { text: 'RIGHT',  normal: new THREE.Vector3(1, 0, 0) },
            { text: 'LEFT',   normal: new THREE.Vector3(-1, 0, 0) },
            { text: 'TOP',    normal: new THREE.Vector3(0, 1, 0) },
            { text: 'BOTTOM', normal: new THREE.Vector3(0, -1, 0) },
            { text: 'FRONT',  normal: new THREE.Vector3(0, 0, 1) },
            { text: 'BACK',   normal: new THREE.Vector3(0, 0, -1) }
        ];

        var materials = faceConfigs.map(function (cfg) {
            var canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 128;
            var ctx = canvas.getContext('2d');

            ctx.fillStyle = '#1e293b';
            ctx.fillRect(0, 0, 128, 128);

            ctx.strokeStyle = '#475569';
            ctx.lineWidth = 6;
            ctx.strokeRect(3, 3, 122, 122);

            ctx.fillStyle = '#f8fafc';
            ctx.font = 'bold 22px Outfit, Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(cfg.text, 64, 64);

            var texture = new THREE.CanvasTexture(canvas);
            return new THREE.MeshPhongMaterial({
                map: texture,
                shininess: 30
            });
        });

        var geom = new THREE.BoxGeometry(1.4, 1.4, 1.4);
        viewCubeMesh = new THREE.Mesh(geom, materials);
        viewCubeScene.add(viewCubeMesh);

        var edges = new THREE.EdgesGeometry(geom);
        var edgeLines = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x94a3b8 }));
        viewCubeMesh.add(edgeLines);

        setupViewCubeEvents(viewCubeContainer, faceConfigs);
    }

    function setupViewCubeEvents(el, faceConfigs) {
        var isDown = false;
        var startX = 0, startY = 0;
        var lastX = 0, lastY = 0;
        var hasDragged = false;
        var raycaster = new THREE.Raycaster();
        var mouse = new THREE.Vector2();

        el.addEventListener('pointerdown', function (e) {
            isDown = true;
            hasDragged = false;
            startX = e.clientX;
            startY = e.clientY;
            lastX = e.clientX;
            lastY = e.clientY;
            try { el.setPointerCapture(e.pointerId); } catch (_) {}
        });

        el.addEventListener('pointermove', function (e) {
            if (!isDown) return;
            var dx = e.clientX - lastX;
            var dy = e.clientY - lastY;
            if (Math.abs(e.clientX - startX) > 4 || Math.abs(e.clientY - startY) > 4) {
                hasDragged = true;
            }
            lastX = e.clientX;
            lastY = e.clientY;

            if (hasDragged && camera && controls) {
                var target = controls.target;
                var offset = new THREE.Vector3().copy(camera.position).sub(target);
                var spherical = new THREE.Spherical().setFromVector3(offset);
                spherical.theta -= dx * 0.012;
                spherical.phi -= dy * 0.012;
                spherical.phi = Math.max(0.04, Math.min(Math.PI - 0.04, spherical.phi));
                offset.setFromSpherical(spherical);
                camera.position.copy(target).add(offset);
                camera.lookAt(target);
                controls.update();
            }
        });

        el.addEventListener('pointerup', function (e) {
            if (!isDown) return;
            isDown = false;
            try { el.releasePointerCapture(e.pointerId); } catch (_) {}

            if (!hasDragged && viewCubeMesh && viewCubeCamera) {
                var rect = el.getBoundingClientRect();
                mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

                raycaster.setFromCamera(mouse, viewCubeCamera);
                var intersects = raycaster.intersectObject(viewCubeMesh);
                if (intersects.length > 0) {
                    var faceIdx = Math.floor(intersects[0].faceIndex / 2);
                    if (faceConfigs[faceIdx]) {
                        snapToNormal(faceConfigs[faceIdx].normal);
                    }
                }
            }
        });
    }

    function snapToNormal(normal) {
        if (!camera || !controls || isCameraTweening) return;

        var target = controls.target;
        var currentDist = camera.position.distanceTo(target);
        var dist = Math.max(2.5, Math.min(10, currentDist));

        var targetPos = new THREE.Vector3();
        if (Math.abs(normal.y) > 0.9) {
            targetPos.set(target.x + 0.0001, target.y + normal.y * dist, target.z + 0.0001);
        } else {
            targetPos.set(target.x + normal.x * dist, target.y + normal.y * dist, target.z + normal.z * dist);
        }

        tweenCameraTo(targetPos, target, 380);
    }

    function tweenCameraTo(targetPos, lookAtPos, durationMs) {
        isCameraTweening = true;
        var startPos = camera.position.clone();
        var startTime = performance.now();

        function step(now) {
            var elapsed = now - startTime;
            var t = Math.min(1, elapsed / durationMs);
            var ease = 1 - Math.pow(1 - t, 3);

            camera.position.lerpVectors(startPos, targetPos, ease);
            camera.lookAt(lookAtPos);
            controls.target.copy(lookAtPos);
            controls.update();

            if (t < 1) {
                requestAnimationFrame(step);
            } else {
                camera.position.copy(targetPos);
                controls.update();
                isCameraTweening = false;
            }
        }
        requestAnimationFrame(step);
    }

    function snapCameraTo(direction) {
        var normalMap = {
            front:  new THREE.Vector3(0, 0, 1),
            back:   new THREE.Vector3(0, 0, -1),
            right:  new THREE.Vector3(1, 0, 0),
            left:   new THREE.Vector3(-1, 0, 0),
            top:    new THREE.Vector3(0, 1, 0),
            bottom: new THREE.Vector3(0, -1, 0)
        };
        var normal = normalMap[direction.toLowerCase()];
        if (normal) snapToNormal(normal);
    }

    /* ================================================================
       Animation Loop
       ================================================================ */
    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);

        // Synchronize ViewCube
        if (viewCubeCamera && controls && camera && viewCubeRenderer && viewCubeScene) {
            var dir = new THREE.Vector3().copy(camera.position).sub(controls.target).normalize();
            viewCubeCamera.position.copy(dir.multiplyScalar(3.0));
            viewCubeCamera.lookAt(0, 0, 0);
            viewCubeCamera.up.copy(camera.up);
            viewCubeRenderer.render(viewCubeScene, viewCubeCamera);
        }
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

        getScene:        function () { return scene; },
        getCamera:       function () { return camera; },
        getRenderer:     function () { return renderer; },
        getControls:     function () { return controls; },
        getViewCube:     function () { return viewCubeMesh; },

        /** All primary structure meshes (excludes mirrors) */
        getAllMeshes:    function () { return allStructureMeshes; },

        /** Raw anatomy data array */
        getAnatomyData:  function () { return anatomyData; },

        /** Snap main camera to orthogonal direction (front, back, right, left, top, bottom) */
        snapCameraTo:    snapCameraTo,

        /** Select structure by ID with transparency isolation */
        selectStructureById: selectStructure,

        /** Deselect active structure and restore full opacity */
        deselectStructure:   deselectStructure,

        /** Listeners for selection */
        onSelect:   function (cb) { selectCallbacks.push(cb); },
        onDeselect: function (cb) { deselectCallbacks.push(cb); },

        /** Lookup structure metadata by id */
        getStructureById:    getStructureById,

        /** Get projected screen coordinates { x, y } from 3D vector */
        getScreenCoordinates: getScreenCoordinates,

        /** Get active 3D anchor position */
        getSelectedAnchor3D: function () { return selectedAnchor3D; },

        /** Get currently selected structure ID */
        getSelectedStructureId: function () { return selectedStructureId; },

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
