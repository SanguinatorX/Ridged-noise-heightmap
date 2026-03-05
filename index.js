/*

FBM / Ridged Noise Heightmap

A subdivided plane with vertices displaced by layered noise functions:
  - Fractal Brownian Motion (FBM): smooth, organic terrain
  - Ridged Noise: sharp creases and mountain-like ridges

Both are built on 3D Perlin noise and animated by scrolling through
the noise field over time. Switch between them with NOISE_TYPE below.

Based on the perlin_noise_heightmap example.

@LukaPiskorec 2026

*/


import * as THREE from 'three';
import { Fn, uniform, float, vec3, positionLocal, normalLocal } from 'three/tsl';
import { floor, fract, sin, cos, dot, mix } from 'three/tsl';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const { createFBM, createRidgedNoise } = window.NoiseLib;



const randomGradient3D = Fn( ( [ p ] ) => {

  const phi   = fract( sin( dot( p, vec3( 127.1, 311.7, 74.7 ) ) ).mul( 43758.5453 ) ).mul( Math.PI * 2 );
  const theta = fract( sin( dot( p, vec3( 269.5, 183.3, 246.1 ) ) ).mul( 43758.5453 ) ).mul( Math.PI );
  return vec3(
    sin( theta ).mul( cos( phi ) ),
    sin( theta ).mul( sin( phi ) ),
    cos( theta )
  );

} );


const perlinNoise3D = Fn( ( [ p ] ) => {

  const i = floor( p ).toVar();
  const f = fract( p ).toVar();

  const u = f.mul( f ).mul( float( 3.0 ).sub( f.mul( 2.0 ) ) );

  const g000 = randomGradient3D( i );
  const g100 = randomGradient3D( i.add( vec3( 1.0, 0.0, 0.0 ) ) );
  const g010 = randomGradient3D( i.add( vec3( 0.0, 1.0, 0.0 ) ) );
  const g110 = randomGradient3D( i.add( vec3( 1.0, 1.0, 0.0 ) ) );
  const g001 = randomGradient3D( i.add( vec3( 0.0, 0.0, 1.0 ) ) );
  const g101 = randomGradient3D( i.add( vec3( 1.0, 0.0, 1.0 ) ) );
  const g011 = randomGradient3D( i.add( vec3( 0.0, 1.0, 1.0 ) ) );
  const g111 = randomGradient3D( i.add( vec3( 1.0, 1.0, 1.0 ) ) );

  const d000 = dot( g000, f );
  const d100 = dot( g100, f.sub( vec3( 1.0, 0.0, 0.0 ) ) );
  const d010 = dot( g010, f.sub( vec3( 0.0, 1.0, 0.0 ) ) );
  const d110 = dot( g110, f.sub( vec3( 1.0, 1.0, 0.0 ) ) );
  const d001 = dot( g001, f.sub( vec3( 0.0, 0.0, 1.0 ) ) );
  const d101 = dot( g101, f.sub( vec3( 1.0, 0.0, 1.0 ) ) );
  const d011 = dot( g011, f.sub( vec3( 0.0, 1.0, 1.0 ) ) );
  const d111 = dot( g111, f.sub( vec3( 1.0, 1.0, 1.0 ) ) );

  return mix(
    mix( mix( d000, d100, u.x ), mix( d010, d110, u.x ), u.y ),
    mix( mix( d001, d101, u.x ), mix( d011, d111, u.x ), u.y ),
    u.z
  ).add( 0.5 );

} );



// ─── Renderer & Scene ─────────────────────────────────────────

const renderer = new THREE.WebGPURenderer( {
  canvas: document.querySelector( '#canvas' ),
  antialias: true,
} );
renderer.setSize( window.innerWidth, window.innerHeight-130 );
await renderer.init();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0000ff);

const camera = new THREE.PerspectiveCamera(
  45, window.innerWidth / window.innerHeight, 1, 1000
);
camera.position.set( 0, 2.5, 15 );
scene.scale.y = -1;
camera.lookAt( 0, 2.5, 0 );

const controls = new OrbitControls( camera, renderer.domElement );
controls.update();


// faut ajouter une lumière pour voir le relief
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 5);
scene.add(light);



// ─── Informations ─────────────────────────────────────────

const configNoise = {
  noiseType : "ridged",

  octaves    : 1,
  lacunarity : 2.0,
  gain       : 2,

  noiseScale           : 0.3,
  displacementStrength : 3,

  travelDirection : [ 0, 2, 1 ],
  travelSpeed     : 2.0,
};

const cubeMelee = {
  // number of boxes to scatter in the scene
  boxCount : 100,

  // size of each cube
  boxSizeX : 0.8,
  boxSizeZ : 0.8,
  boxSizeY : 0.8,

  // boxes are placed randomly within a cube of this side length
  spreadX : 25,
  spreadY : 40,
  spreadZ : 15,

// rotation speed in radians per millisecond
  rotationSpeed : 0.005,
}



// ─── Noise Displacement ───────────────────────────────────────

// paramètres pour le noise builder
const noiseParams = {
  octaves: configNoise.octaves,
  lacunarity: configNoise.lacunarity,
  gain: configNoise.gain
};

const noiseFn = configNoise.noiseType === 'ridged'
  ? createRidgedNoise( noiseParams )
  : createFBM( noiseParams );

const uTime = uniform( 0.0 );

const travelDir = vec3(
  configNoise.travelDirection[0],
  configNoise.travelDirection[1],
  configNoise.travelDirection[2]
);

// vertex displacement
const displacedPosition = Fn( () => {

  const pos = positionLocal.toVar();
  const nrm = normalLocal.toVar();

  const noiseInput = pos
    .mul( configNoise.noiseScale )
    .add( travelDir.mul( uTime ) );

  const noiseVal = noiseFn( noiseInput )
    .sub( 0.5 )
    .mul( configNoise.displacementStrength );

  return pos.add( nrm.mul( noiseVal ) );

} )();



// ─── Cubes ──────────────────────────────────────

const cube = new THREE.BoxGeometry( cubeMelee.boxSizeX, cubeMelee.boxSizeZ, cubeMelee.boxSizeY );
const cubeMaterial = new THREE.MeshNormalMaterial( { flatShading: true } );

// create all meshes, assign random positions, and add to scene
const cubesMeshes = [];

for ( let i = 0; i < cubeMelee.boxCount; i++ ) {

  const cubeMesh = new THREE.Mesh( cube, cubeMaterial );
  cubeMesh.position.set(
    ( Math.random() - 0.5 ) * cubeMelee.spreadX,
    ( Math.random() - 0.5 ) * cubeMelee.spreadZ,
    ( Math.random() - 0.5 ) * cubeMelee.spreadY,
  );
  scene.add( cubeMesh );
  cubesMeshes.push( cubeMesh );
}



// ─── Couche standart ──────────────────────────────────────

const couche1 = new THREE.PlaneGeometry( 50, 32, 200, 200 );

const couche1Material = new THREE.MeshNormalMaterial( { flatShading: true, side: THREE.DoubleSide } );
couche1Material.positionNode = displacedPosition;

const mesh = new THREE.Mesh( couche1, couche1Material );
mesh.rotation.x = Math.PI /2;
mesh.position.y = -5;
scene.add( mesh );



// ─── Deuxième couche inversée ─────────────────────────────

const displacedPositionInverted = Fn( () => {

  const pos = positionLocal.toVar();
  const nrm = normalLocal.toVar();

  const noiseInput = pos.mul( configNoise.noiseScale ).add( travelDir.mul( uTime ) );
  const noiseVal   = noiseFn( noiseInput ).sub( 0.5 ).mul( configNoise.displacementStreght );

  // on pousse dans le sens opposé
  return pos.sub( nrm.mul( noiseVal ) );

} )();

const materialDown = new THREE.MeshNormalMaterial({
  flatShading: true,
  side: THREE.DoubleSide
});

materialDown.positionNode = displacedPositionInverted;

const meshDown = new THREE.Mesh( couche1.clone(), materialDown );
meshDown.rotation.x = -Math.PI / 2;
meshDown.position.y = 5.3; // hauteur au-dessus du premier

scene.add( meshDown );



// ─── Mur de fond ────────────────────────────────────────

const wallGeometry = new THREE.PlaneGeometry(50, 12, 200, 200); // subdivisions pour le relief

const displacedWallPosition = Fn(() => {
    const pos = positionLocal.toVar();
    const nrm = normalLocal.toVar();

    const noiseInput = pos.mul(configNoise.noiseScale).add(travelDir.mul(uTime));
    const noiseVal = noiseFn(noiseInput).sub(0.5).mul(configNoise.displacementStrength * 0.5);

    return pos.add(nrm.mul(noiseVal));
})();

const wallMaterial = new THREE.MeshStandardMaterial({ 
    color: new THREE.Color(0.8, 0.8, 0.8),  // bleu clair,
    side: THREE.DoubleSide,
    flatShading: true,       // fait ressortir les bosses
    metalness: 0,
    roughness: 0.5,
});
wallMaterial.positionNode = displacedWallPosition;

const wall = new THREE.Mesh(wallGeometry, wallMaterial);
wall.position.set(0, 0, -15);
wall.rotation.y = 0;
scene.add(wall);
wallMaterial.color = new THREE.Color(0.4, 0.7, 1); // vrai bleu clair



// ─── Cervelle ────────────────────────────────────────

//const uTime = uniform( 0.0 );
const noiseScaleBlob = 2.0;
const displacementStrengthBlob = 0.6;

const displacedPositionBlob = Fn( () => {

  const pos = positionLocal.toVar();
  const nrm = normalLocal.toVar();

  // sample 3D noise at scaled position, animate by scrolling through Z
  const noiseInput = pos.mul( noiseScaleBlob ).add( vec3( 0.0, 0.0, uTime ) );
  const noiseVal = perlinNoise3D( noiseInput ).sub( 0.5 ).mul( displacementStrengthBlob );

  // push vertex outward/inward along its normal
  return pos.add( nrm.mul( noiseVal ) );

} )();


const geometry_blob = new THREE.IcosahedronGeometry( 1.4, 30 );

const material_blob = new THREE.MeshNormalMaterial( { flatShading: true } );
material_blob.positionNode = displacedPositionBlob;

const mesh_blob = new THREE.Mesh( geometry_blob, material_blob );
scene.add( mesh_blob );



// ─── Animation Loop ───────────────────────────────────────────

let time = Date.now();

renderer.setAnimationLoop(() => {

  const currentTime = Date.now();
  const deltaTime = currentTime - time;
  time = currentTime;

  // animation du bruit pour le terrain
  uTime.value += deltaTime * 0.001 * configNoise.travelSpeed;

  // rotation des cubes
  for (const cube of cubesMeshes) {
    cube.rotateY(cubeMelee.rotationSpeed * deltaTime);
  }

  renderer.render(scene, camera);
});


// ─── Mouvement blob et cubes ─────────────────────────────────

let cervelleCountX = 0;
let cervelleCountY = 0;
let cubeMouvCount = 0;

let cervelleDirectionX = 0.1;
let cervelleDirectionY = 0.1;
let cubeDirection = 0.1;

// sauvegarde positions de base des cubes
for (const cube of cubesMeshes) {
  cube.userData.baseX = cube.position.x;
}

setInterval(() => {
  // mouvement blob
  cervelleCountX += cervelleDirectionX;
  cervelleCountY += cervelleDirectionY;

  if (cervelleCountX > 8 || cervelleCountX < -8) cervelleDirectionX *= -1;
  if (cervelleCountY > 5 || cervelleCountY < -5) cervelleDirectionY *= -1;

  mesh_blob.position.x = cervelleCountX;
  mesh_blob.position.y = cervelleCountY;

  // mouvement cubes
  cubeMouvCount += cubeDirection;
  if (cubeMouvCount > 12 || cubeMouvCount < -12) cubeDirection *= -1;

  for (const cube of cubesMeshes) {
    cube.position.x = cube.userData.baseX + cubeMouvCount;
  }

}, 10);
