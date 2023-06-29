import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js";
import Stats from "three/addons/libs/stats.module.js";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";
import {
  MeshBVH,
  MeshBVHVisualizer,
  StaticGeometryGenerator
} from "https://unpkg.com/three-mesh-bvh@^0.5.22/build/index.module.js";
import { JoyStick } from "three/addons/controls/joy.js";
import * as TWEEN from "three/addons/tween/tween.esm.js";

const loader = new THREE.TextureLoader();

const params = {
  firstPerson: true,
  displayCollider: false,
  displayBVH: false,
  visualizeDepth: 10,
  gravity: -30,
  playerSpeed: 3,
  physicsSteps: 5,
  reset: reset,
  exposure: 1
};

let renderer, camera, scene, clock, gui, stats;
let collider, visualizer, player, controls;
let playerIsOnGround = false;
let fwdPressed = false,
  bkdPressed = false,
  lftPressed = false,
  rgtPressed = false;
let playerVelocity = new THREE.Vector3();
let upVector = new THREE.Vector3(0, 1, 0);
let tempVector = new THREE.Vector3();
let tempVector2 = new THREE.Vector3();
let tempBox = new THREE.Box3();
let tempMat = new THREE.Matrix4();
let tempSegment = new THREE.Line3();
//const camHighCorrection = new THREE.Vector3(0, 1, 0);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clickedPoint = new THREE.Vector3();
const playerPos = new THREE.Vector3();
let dY;
let target = null;
let timeout = null;
let lightPosition = new THREE.Vector3();
const tekstInfo = `<p>Najlepiej oglądać ekspozycję na dużym ekranie (komputer stacjonarny,
  laptop). Po wnętrzu galerii można poruszać się na kilka sposobów, używając
  myszki, dżojstika, który znajduje się w lewym dolnym rogu ekranu, używając
  klawiszy ze strzałkami, albo po podwójnym kliknięciu na podłogę i
  podążaniu za żółto-niebieską ikonką wskazującą kierunek drogi. Podwójne
  kliknięcie w wybrany obraz (obiekt) przybliża go na pierwszy plan, ponowne
  kliknięcie zamyka ono obrazu.  [X]</p>`;

init();
render();

function init() {
  // joystick controls
  var joy3Param = { title: "joystick3" };
  var Joy3 = new JoyStick("joy3Div", joy3Param);

  setInterval(function () {
    let joyEvt = Joy3.GetDir();
    switch (joyEvt) {
      case "W":
        lftPressed = true;
        break;
      case "E":
        rgtPressed = true;
        break;
      case "N":
        fwdPressed = true;
        break;
      case "S":
        bkdPressed = true;
        break;
      case "NE":
        fwdPressed = true;
        rgtPressed = true;
        break;
      case "SW":
        bkdPressed = true;
        lftPressed = true;
        break;
      case "SE":
        bkdPressed = true;
        rgtPressed = true;
        break;
      case "NW":
        fwdPressed = true;
        lftPressed = true;
        break;
      case "C":
        lftPressed = false;
        rgtPressed = false;
        fwdPressed = false;
        bkdPressed = false;
        break;
      default:
        break;
    }
  }, 50);

  const makeTextInfo = () => {
    document.getElementById("info").innerHTML = tekstInfo;
  };

  //const bgColor = 0x64a8ba;

  // renderer setup
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  //renderer.setClearColor(bgColor, 1);
  renderer.useLegacyLights = true;
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.LinearToneMapping;
  renderer.toneMappingExposure = params.exposure;
  renderer.shadowMap.type = THREE.LinearToneMapping;
  renderer.outputEncoding = THREE.sRGBEncoding;
  document.body.appendChild(renderer.domElement);

  // scene setup
  scene = new THREE.Scene();
  const texture = new THREE.TextureLoader().load(
    "textures/hucul4req.jpg",
    render
  );
  texture.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = texture;

  // lights
  const makeLight = (intensity, distance, power, ltPosition, sphereSize) => {
    let light = new THREE.PointLight(0xffffff, intensity, distance);
    light.power = power;
    light.position.copy(ltPosition); //-17, 0, 2.5);
    light.castShadow = true;
    scene.add(light);
    light.shadow.mapSize.width = 512; // default
    light.shadow.mapSize.height = 512; // default
    light.shadow.camera.near = 0.5; // default
    light.shadow.camera.far = 500; // default

    let pointLightHelper = new THREE.PointLightHelper(light, sphereSize);
    scene.add(pointLightHelper);
  };

  //swiatło pierwsze od schoó∑
  makeLight(2, 15, 30, lightPosition.set(-17, 0, 2.5), 0.2);
  makeLight(2, 15, 30, lightPosition.set(-17, 0, -8), 0.2);
  //
  makeLight(2, 10, 30, lightPosition.set(-6, 0, 4.5), 0.7);
  makeLight(2, 10, 40, lightPosition.set(-7, 0, -8), 0.7);
  //
  makeLight(2, 15, 20, lightPosition.set(5, 0, -7), 0.4);
  makeLight(2, 15, 20, lightPosition.set(6, 0, 1), 0.1);
  // światła ostatnie
  makeLight(2, 15, 40, lightPosition.set(15, 0, -5), 0.7);
  makeLight(2, 15, 10, lightPosition.set(13, 0, 5), 0.7);
  //

  // camera setup
  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    50
  );
  camera.position.set(10, 6, -10);
  camera.far = 100;
  camera.updateProjectionMatrix();
  window.camera = camera;

  clock = new THREE.Clock();

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 4, 0);
  // stats setup
  /*
  stats = new Stats();
  document.body.appendChild(stats.dom);
*/
  makeTextInfo();

  loadColliderEnvironment();

  // character
  player = new THREE.Mesh(
    new RoundedBoxGeometry(1.0, 2.0, 1.0, 10, 0.5),
    new THREE.MeshStandardMaterial()
  );
  player.geometry.translate(0, -0.5, 0);
  player.name = "Player";
  player.capsuleInfo = {
    radius: 0.5,
    segment: new THREE.Line3(
      new THREE.Vector3(),
      new THREE.Vector3(0, -1.0, 0.0)
    )
  };
  player.castShadow = false;

  scene.add(player);
  reset();

  /// circle
  const circle = new THREE.Group();
  circle.position.copy(player.position);
  circle.position.y = -30;

  const circleYellow = new THREE.Mesh(
    new THREE.RingGeometry(0.6, 0.8, 32),
    new THREE.MeshBasicMaterial({
      color: 0xffcc00,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5
    })
  );
  circleYellow.rotation.x = (90 * Math.PI) / 180;
  const circleBlue = new THREE.Mesh(
    new THREE.RingGeometry(0.8, 1, 32),
    new THREE.MeshBasicMaterial({
      color: 0x0066cc,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5
    })
  );
  circleBlue.rotation.x = (90 * Math.PI) / 180;
  circle.add(circleYellow);
  circle.add(circleBlue);
  scene.add(circle);

  // simple raycaster after click
  const onPointerDown = (event) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);

    const intersects = raycaster.intersectObjects(scene.children);

    let result = intersects.find(
      ({ object }) => object.userData.type === "Image"
    );

    if (result) {
      if (!document.getElementById("viewer")) {
        const viewer = document.createElement("div");
        viewer.className = "viewer";
        viewer.id = "viewer";
        viewer.style.animation = "fadeIn 2s forwards";
        viewer.innerHTML = "</br>";
        const viewImage = document.createElement("img");
        viewImage.id = "image-view";
        viewImage.src = result.object.userData.imagePath;
        viewer.appendChild(viewImage);

        // text-on-screen
        if (result.object.userData.opis) {
          const textOnscreen = document.createElement("div");
          textOnscreen.id = "text-on-screen";
          viewer.appendChild(textOnscreen);

          textOnscreen.innerText = `${result.object.userData.opis}`;
        }
        document.body.appendChild(viewer);
      }
    } else {
      if (document.getElementById("viewer")) {
        const el = document.getElementById("viewer");
        fadeOutEl(el);
      }
    }
    // is clicked object smhg a floor?

    result = intersects.find(({ object }) => object.name === "Floor");
    // if clicked obj is on 1st plan
    if (result) {
      const index = intersects.indexOf(result);

      if ((index >= 0) & (index < 2)) {
        const dist = result.distance;
        clickedPoint.copy(result.point);
        playerPos.copy(player.position);
        dY = 1.4999900030602324;
        clickedPoint.y = clickedPoint.y + dY;
        // Tween
        const tween = new TWEEN.Tween(playerPos)
          .to(clickedPoint, dist * 200)
          .onUpdate(() => {
            player.position.copy(playerPos);
            player.updateMatrixWorld();
          });
        tween.start(); // Start the tween immediately

        let innerRad = new THREE.Vector3(1, 1, 1);
        const zero = new THREE.Vector3(0, 0, 0);
        circle.position.copy(result.point);
        circle.position.y += 0.01;
        const tweenCircle = new TWEEN.Tween(innerRad);
        tweenCircle.to(zero, 3000);
        tweenCircle.onUpdate(() => {
          circle.scale.copy(innerRad);
        });
        tweenCircle.start();
      }
    }
  };

  const fadeOutEl = (el) => {
    el.style.animation = "fadeOut 2s forwards";
    el.addEventListener("animationend", () => {
      el.remove();
      /*
      const els = document.el; //getElementsByClassName("viewer");
      while (els.length > 0) {
        els[0].remove();
      }*/
    });
  };
  // dat.gui
  /*
  gui = new GUI();
  gui.add(params, "firstPerson").onChange((v) => {
    if (!v) {
      camera.position
        .sub(controls.target)
        .normalize()
        .multiplyScalar(20)
        .add(controls.target);
    }
  });

  const visFolder = gui.addFolder("Visualization");
  visFolder.add(params, "displayCollider");
  visFolder.add(params, "displayBVH");
  visFolder.add(params, "visualizeDepth", 1, 20, 1).onChange((v) => {
    visualizer.depth = v;
    visualizer.update();
  });
  visFolder.open();

  const physicsFolder = gui.addFolder("Player");
  physicsFolder.add(params, "physicsSteps", 0, 30, 1);
  physicsFolder.add(params, "gravity", -100, 100, 0.01).onChange((v) => {
    params.gravity = parseFloat(v);
  });
  physicsFolder.add(params, "playerSpeed", 1, 20);
  physicsFolder.open();

  gui.add(params, "reset");
  gui.open(false);
  */
  document.getElementById("info").addEventListener("pointerdown", (e) => {
    console.log(document.getElementById("info"));
    if (document.getElementById("info").innerText === "info") {
      makeTextInfo();
    } else {
      document.getElementById("info").innerText = "info";
    }
  });

  window.addEventListener("pointerdown", (e) => {
    if (e.target === target) {
      // double
      clearTimeout(timeout);
      target = null;
      timeout = null;
      onPointerDown(e);
    } else {
      // single
      target = e.target;
      timeout = setTimeout(() => {
        target = null;
        timeout = null;
      }, 500);
      if (document.getElementById("text-on-screen")) {
        const el = document.getElementById("text-on-screen");
        fadeOutEl(el);
      } else if (document.getElementById("viewer")) {
        let el = document.getElementById("viewer");
        fadeOutEl(el);
      }
    }
  });

  window.addEventListener(
    "resize",
    function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();

      renderer.setSize(window.innerWidth, window.innerHeight);
    },
    false
  );

  window.addEventListener("keydown", function (e) {
    switch (e.code) {
      case "KeyT":
        TWEEN.removeAll;
        break;
      case "KeyW":
        fwdPressed = true;
        break;
      case "ArrowUp":
        fwdPressed = true;
        break;
      case "KeyS":
        bkdPressed = true;
        break;
      case "ArrowDown":
        bkdPressed = true;
        break;
      case "KeyD":
        rgtPressed = true;
        break;
      case "ArrowRight":
        rgtPressed = true;
        break;
      case "KeyA":
        lftPressed = true;
        break;
      case "ArrowLeft":
        lftPressed = true;
        break;
      case "Space":
        if (playerIsOnGround) {
          playerVelocity.y = 10.0;
          playerIsOnGround = false;
        }

        break;
      default:
        break;
    }
  });

  window.addEventListener("keyup", function (e) {
    switch (e.code) {
      case "KeyW":
        fwdPressed = false;
        break;
      case "ArrowUp":
        fwdPressed = false;
        break;
      case "KeyS":
        bkdPressed = false;
        break;
      case "ArrowDown":
        bkdPressed = false;
        break;
      case "KeyD":
        rgtPressed = false;
        break;
      case "ArrowRight":
        rgtPressed = false;
        break;
      case "KeyA":
        lftPressed = false;
        break;
      case "ArrowLeft":
        lftPressed = false;
        break;
      default:
        break;
    }
  });
}

function loadColliderEnvironment() {
  new GLTFLoader().load("../models/galeriaGLTF/vincenz.gltf", (res) => {
    const gltfScene = res.scene;
    gltfScene.scale.setScalar(1);
    gltfScene.position.set(0, 0, 0);

    //g(gltfScene);

    const box = new THREE.Box3();
    box.setFromObject(gltfScene);
    box.getCenter(gltfScene.position).negate();
    gltfScene.updateMatrixWorld(true);

    let environment = new THREE.Group();
    // visual geometry setup
    const toMerge = {};

    gltfScene.traverse((c) => {
      if (c.isMesh) {
        const hex = c.material.color.getHex();

        toMerge[hex] = toMerge[hex] || [];
        toMerge[hex].push(c);
      } else if (c.name === "Lights") {
        //
      }
    });

    for (const hex in toMerge) {
      const arr = toMerge[hex];
      const visualGeometries = [];

      arr.forEach((mesh) => {
        switch (mesh.userData.type) {
          case "Floor":
            mesh.material.map.wrapS = THREE.RepeatWrapping;
            mesh.material.map.wrapT = THREE.RepeatWrapping;
            mesh.material.map.repeat.set(4, 4);
            mesh.material.needsUpdate = true;
            break;
          case "Image":
            mesh.material = new THREE.MeshStandardMaterial({
              map: loader.load(mesh.userData.imagePath)
            });
            //texture.mapping = THREE.EquirectangularReflectionMapping;
            break;
          default:
            break;
        }
        environment.attach(mesh);
      });

      if (visualGeometries.length) {
        const newGeom = BufferGeometryUtils.mergeBufferGeometries(
          visualGeometries
        );
        const newMesh = new THREE.Mesh(
          newGeom,
          new THREE.MeshStandardMaterial({
            color: parseInt(hex),
            shadowSide: 2
          })
        );
        newMesh.castShadow = true;
        newMesh.receiveShadow = true;
        newMesh.material.shadowSide = 2;
        // environment.add(newMesh);
      }
    }

    const staticGenerator = new StaticGeometryGenerator(environment);
    staticGenerator.attributes = ["position"];

    const mergedGeometry = staticGenerator.generate();
    mergedGeometry.boundsTree = new MeshBVH(mergedGeometry, {
      lazyGeneration: false
    });

    collider = new THREE.Mesh(mergedGeometry);
    collider.material.wireframe = true;
    collider.material.opacity = 0.5;
    collider.material.transparent = true;

    visualizer = new MeshBVHVisualizer(collider, params.visualizeDepth);
    scene.add(visualizer);
    scene.add(collider);
    scene.add(environment);
  });
}

function reset() {
  playerVelocity.set(0, 0, 0);
  player.position.set(15, 1, -4);
  camera.position.sub(controls.target);
  controls.target.copy(player.position);
  camera.position.add(player.position);

  controls.update();
}

function updatePlayer(delta) {
  if (playerIsOnGround) {
    playerVelocity.y = delta * params.gravity;
  } else {
    playerVelocity.y += delta * params.gravity;
  }

  player.position.addScaledVector(playerVelocity, delta);

  // move the player
  const angle = controls.getAzimuthalAngle();
  if (fwdPressed) {
    tempVector.set(0, 0, -1).applyAxisAngle(upVector, angle);
    player.position.addScaledVector(tempVector, params.playerSpeed * delta);
  }

  if (bkdPressed) {
    tempVector.set(0, 0, 1).applyAxisAngle(upVector, angle);
    player.position.addScaledVector(tempVector, params.playerSpeed * delta);
  }
  if (lftPressed) {
    tempVector.set(-1, 0, 0).applyAxisAngle(upVector, angle);
    player.position.addScaledVector(tempVector, params.playerSpeed * delta);
  }

  if (rgtPressed) {
    tempVector.set(1, 0, 0).applyAxisAngle(upVector, angle);
    player.position.addScaledVector(tempVector, params.playerSpeed * delta);
  }

  player.updateMatrixWorld();

  // adjust player position based on collisions
  const capsuleInfo = player.capsuleInfo;
  tempBox.makeEmpty();
  tempMat.copy(collider.matrixWorld).invert();
  tempSegment.copy(capsuleInfo.segment);

  // get the position of the capsule in the local space of the collider
  tempSegment.start.applyMatrix4(player.matrixWorld).applyMatrix4(tempMat);
  tempSegment.end.applyMatrix4(player.matrixWorld).applyMatrix4(tempMat);

  // get the axis aligned bounding box of the capsule
  tempBox.expandByPoint(tempSegment.start);
  tempBox.expandByPoint(tempSegment.end);

  tempBox.min.addScalar(-capsuleInfo.radius);
  tempBox.max.addScalar(capsuleInfo.radius);

  collider.geometry.boundsTree.shapecast({
    intersectsBounds: (box) => box.intersectsBox(tempBox),

    intersectsTriangle: (tri) => {
      // check if the triangle is intersecting the capsule and adjust the
      // capsule position if it is.
      const triPoint = tempVector;
      const capsulePoint = tempVector2;

      const distance = tri.closestPointToSegment(
        tempSegment,
        triPoint,
        capsulePoint
      );
      if (distance < capsuleInfo.radius) {
        const depth = capsuleInfo.radius - distance;
        const direction = capsulePoint.sub(triPoint).normalize();

        tempSegment.start.addScaledVector(direction, depth);
        tempSegment.end.addScaledVector(direction, depth);
      }
    }
  });

  // get the adjusted position of the capsule collider in world space after checking
  // triangle collisions and moving it. capsuleInfo.segment.start is assumed to be
  // the origin of the player model.
  const newPosition = tempVector;
  newPosition.copy(tempSegment.start).applyMatrix4(collider.matrixWorld);

  // check how much the collider was moved
  const deltaVector = tempVector2;
  deltaVector.subVectors(newPosition, player.position);

  // if the player was primarily adjusted vertically we assume it's on something we should consider ground
  playerIsOnGround = deltaVector.y > Math.abs(delta * playerVelocity.y * 0.25);

  const offset = Math.max(0.0, deltaVector.length() - 1e-5);
  deltaVector.normalize().multiplyScalar(offset);

  // adjust the player model
  player.position.add(deltaVector);

  if (!playerIsOnGround) {
    deltaVector.normalize();
    playerVelocity.addScaledVector(
      deltaVector,
      -deltaVector.dot(playerVelocity)
    );
  } else {
    playerVelocity.set(0, 0, 0);
  }

  camera.position.sub(controls.target);
  controls.target.copy(player.position);
  camera.position.add(player.position);

  // if the player has fallen too far below the level reset their position to the start
  if (player.position.y < -25) {
    reset();
  }
}

function render() {
  //stats.update();
  TWEEN.update();
  requestAnimationFrame(render);

  const delta = Math.min(clock.getDelta(), 0.1);

  if (params.firstPerson) {
    controls.maxPolarAngle = Math.PI;
    controls.minDistance = 1e-4;
    controls.maxDistance = 1e-4;
  } else {
    controls.maxPolarAngle = Math.PI / 2;
    controls.minDistance = 1;
    controls.maxDistance = 20;
  }

  if (collider) {
    collider.visible = params.displayCollider;
    visualizer.visible = params.displayBVH;

    const physicsSteps = params.physicsSteps;

    for (let i = 0; i < physicsSteps; i++) {
      updatePlayer(delta / physicsSteps);
    }
  }

  // TODO: limit the camera movement based on the collider
  // raycast in direction of camera and move it if it's further than the closest point

  controls.update();

  renderer.render(scene, camera);
}
