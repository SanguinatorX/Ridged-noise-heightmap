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



// ─── Renderer & Scene ─────────────────────────────────────────

const renderer = new THREE.WebGPURenderer( {
  canvas: document.querySelector( '#canvas' ),
  antialias: true,
} );
renderer.setSize( window.innerWidth, window.innerHeight-130 );
await renderer.init();

const scene = new THREE.Scene();
scene.background = new THREE.Color( 0x000000 );

const camera = new THREE.PerspectiveCamera(
  45, window.innerWidth / window.innerHeight, 1, 1000
);
camera.position.set( 0, 2.5, 15 );
scene.scale.y = -1;
camera.lookAt( 0, 2.5, 0 );

const controls = new OrbitControls( camera, renderer.domElement );
controls.update();


// ─── Noise Displacement ───────────────────────────────────────

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


// ─── Geometry & Material ──────────────────────────────────────


const geometry = new THREE.PlaneGeometry( 30, 32, 200, 200 );

const material = new THREE.MeshNormalMaterial( { flatShading: true, side: THREE.DoubleSide } );
material.positionNode = displacedPosition;

const mesh = new THREE.Mesh( geometry, material );
mesh.rotation.x = Math.PI /2;
mesh.position.y = -5;
scene.add( mesh );



// ─── Deuxième couche inversée ─────────────────────────────

const displacedPositionInverted = Fn( () => {

  const pos = positionLocal.toVar();
  const nrm = normalLocal.toVar();

  const noiseInput = pos.mul( NOISE_SCALE ).add( travelDir.mul( uTime ) );
  const noiseVal   = noiseFn( noiseInput ).sub( 0.5 ).mul( DISPLACEMENT_STRENGTH );

  // on pousse dans le sens opposé
  return pos.sub( nrm.mul( noiseVal ) );

} )();

const materialTop = new THREE.MeshNormalMaterial({
  flatShading: true,
  side: THREE.DoubleSide
});

materialTop.positionNode = displacedPositionInverted;

const meshTop = new THREE.Mesh( geometry.clone(), materialTop );
meshTop.rotation.x = -Math.PI / 2;
meshTop.position.y = 5.3; // hauteur au-dessus du premier

scene.add( meshTop );



// ─── Mur de fond ────────────────────────────────────────

const wallGeometry = new THREE.PlaneGeometry(30, 12, 200, 200); // subdivisions pour le relief

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

// faut ajouter une lumière pour voir le relief
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 5);
scene.add(light);



// ─── Animation Loop ───────────────────────────────────────────

let time = Date.now();

renderer.setAnimationLoop( () => {

  const currentTime = Date.now();
  const deltaTime   = currentTime - time;
  time = currentTime;

  uTime.value += deltaTime * 0.001 * configNoise.travelSpeed;

  renderer.render( scene, camera );

} );
